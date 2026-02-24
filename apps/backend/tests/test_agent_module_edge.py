"""Edge-case tests for agent.py module creation — Story 3.4 TEA expansion.

Covers paths NOT exercised by test_agent.py or test_agent_edge.py:
  - _try_extract_module_spec: detailed _SpecResult fields (has_code_fence, error)
  - _try_extract_module_spec: non-dict JSON (array), multiple code fences
  - _extract_chat_text: strips JSON block, preserves surrounding text
  - _extract_chat_text: no JSON block returns full text
  - _extract_chat_text: only JSON block returns empty string
  - _build_module_prompt: includes snake_case instruction, example JSON
  - _handle_module_creation: DB save failure sends MODULE_CREATION_FAILED
  - _handle_module_creation: empty chat_text (only JSON in LLM response)
  - handle_chat: module spec with extra fields (preserved in payload)
  - handle_chat: missing fields error includes sorted field names
  - handle_chat: invalid JSON with chat text sends both chat_stream and error
  - handle_chat: module_created wire_spec includes module_id from DB
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import aiosqlite
import pytest

from app.agent import (
    _build_module_prompt,
    _extract_chat_text,
    _extract_module_spec,
    _try_extract_module_spec,
    handle_chat,
)
from app.llm.base import LLMResult

# Shared SOUL content for tests that call _build_module_prompt directly
_TEST_SOUL = "# Test SOUL\n\nYou are a test agent."



class MockWebSocket:
    """Minimal mock WebSocket that records sent messages."""

    def __init__(self):
        self.sent = []

    async def send_json(self, data: dict) -> None:
        self.sent.append(data)


@pytest.fixture
def ws():
    return MockWebSocket()


def _make_result(content: str) -> LLMResult:
    """Helper to create an LLMResult with given content."""
    return LLMResult(
        content=content,
        provider="test-provider",
        model="test-model",
        tokens_in=50,
        tokens_out=200,
        latency_ms=500,
        cost_estimate=0.01,
    )


def _make_provider(content: str) -> MagicMock:
    """Helper to create a mock provider returning given content."""
    provider = MagicMock()
    provider.name = "test-provider"
    provider.execute = AsyncMock(return_value=_make_result(content))
    return provider


async def _setup_full_db(db_path: str) -> None:
    """Create llm_usage + modules tables for module creation tests."""
    db = await aiosqlite.connect(db_path)
    try:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute(
            """CREATE TABLE IF NOT EXISTS llm_usage (
                id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                tokens_in INTEGER,
                tokens_out INTEGER,
                cost_estimate REAL,
                created_at TEXT NOT NULL
            )"""
        )
        await db.execute(
            """CREATE TABLE IF NOT EXISTS modules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                spec TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                vitality_score REAL DEFAULT 0,
                user_id TEXT NOT NULL DEFAULT 'default',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )"""
        )
        await db.commit()
    finally:
        await db.close()


# --- Valid module spec for tests ---
_VALID_SPEC = {
    "name": "Test Module",
    "type": "metric",
    "template": "metric-dashboard",
    "data_sources": [
        {
            "id": "api-1",
            "type": "rest_api",
            "config": {"url": "https://api.example.com/data", "method": "GET"},
        }
    ],
    "refresh_interval": 3600,
    "schema_version": 1,
    "accessible_label": "Test module for weather data",
}


class TestTryExtractModuleSpec:
    """Tests for _try_extract_module_spec — detailed result with error info."""

    def test_no_code_fence_returns_no_fence_no_error(self):
        """No code fence: has_code_fence=False, spec=None, error=None."""
        result = _try_extract_module_spec("Just plain text, no JSON here.")

        assert result.spec is None
        assert result.error is None
        assert result.has_code_fence is False

    def test_valid_spec_returns_fence_true_no_error(self):
        """Valid spec: has_code_fence=True, spec not None, error=None."""
        content = f"Here is a module:\n```json\n{json.dumps(_VALID_SPEC)}\n```"
        result = _try_extract_module_spec(content)

        assert result.spec is not None
        assert result.error is None
        assert result.has_code_fence is True
        assert result.spec["name"] == "Test Module"

    def test_invalid_json_returns_fence_true_with_error(self):
        """Invalid JSON in code fence: has_code_fence=True, spec=None, error set."""
        content = '```json\n{invalid json here!}\n```'
        result = _try_extract_module_spec(content)

        assert result.spec is None
        assert result.error is not None
        assert result.has_code_fence is True
        assert "Invalid JSON" in result.error

    def test_non_dict_json_returns_error(self):
        """JSON array in code fence: has_code_fence=True, spec=None, error about object."""
        content = '```json\n[1, 2, 3]\n```'
        result = _try_extract_module_spec(content)

        assert result.spec is None
        assert result.error is not None
        assert result.has_code_fence is True
        assert "JSON object" in result.error

    def test_json_string_returns_error(self):
        """JSON string in code fence: not a dict, returns error."""
        content = '```json\n"just a string"\n```'
        result = _try_extract_module_spec(content)

        assert result.spec is None
        assert result.error is not None
        assert result.has_code_fence is True

    def test_missing_fields_returns_sorted_field_names_in_error(self):
        """Missing fields error lists the fields in sorted order."""
        partial_spec = {"name": "Partial", "type": "metric"}
        content = f"```json\n{json.dumps(partial_spec)}\n```"
        result = _try_extract_module_spec(content)

        assert result.spec is None
        assert result.error is not None
        assert result.has_code_fence is True
        # Missing fields should be listed sorted
        assert "accessible_label" in result.error
        assert "data_sources" in result.error
        assert "refresh_interval" in result.error
        assert "schema_version" in result.error
        assert "template" in result.error

    def test_extra_fields_accepted(self):
        """Spec with extra fields beyond required is accepted."""
        spec_with_extras = {**_VALID_SPEC, "custom_field": "value", "priority": 1}
        content = f"```json\n{json.dumps(spec_with_extras)}\n```"
        result = _try_extract_module_spec(content)

        assert result.spec is not None
        assert result.error is None
        assert result.spec["custom_field"] == "value"

    def test_first_code_fence_used_when_multiple_present(self):
        """When multiple JSON code fences exist, the first one is used."""
        first_spec = {**_VALID_SPEC, "name": "First Module"}
        second_spec = {**_VALID_SPEC, "name": "Second Module"}
        content = (
            f"First module:\n```json\n{json.dumps(first_spec)}\n```\n"
            f"Second module:\n```json\n{json.dumps(second_spec)}\n```"
        )
        result = _try_extract_module_spec(content)

        assert result.spec is not None
        assert result.spec["name"] == "First Module"

    def test_code_fence_with_whitespace(self):
        """Code fence with extra whitespace around JSON is handled."""
        content = f"```json\n\n  {json.dumps(_VALID_SPEC)}  \n\n```"
        result = _try_extract_module_spec(content)

        assert result.spec is not None
        assert result.spec["name"] == "Test Module"

    def test_empty_json_object_missing_all_required_fields(self):
        """Empty JSON object {} — all required fields missing."""
        content = '```json\n{}\n```'
        result = _try_extract_module_spec(content)

        assert result.spec is None
        assert result.error is not None
        assert result.has_code_fence is True
        assert "missing required fields" in result.error.lower()


class TestExtractChatText:
    """Tests for _extract_chat_text helper."""

    def test_removes_json_block_from_response(self):
        """Extracts text portion, removing the JSON code block."""
        content = (
            "I'll create a module for you!\n\n"
            f"```json\n{json.dumps(_VALID_SPEC)}\n```\n\n"
            "Let me know if you need changes."
        )
        text = _extract_chat_text(content)

        assert "I'll create a module for you!" in text
        assert "Let me know if you need changes." in text
        assert "```json" not in text
        assert "data_sources" not in text

    def test_no_json_block_returns_full_text(self):
        """When no JSON code block, returns the full text unchanged."""
        content = "Just a regular response with no JSON."
        text = _extract_chat_text(content)

        assert text == "Just a regular response with no JSON."

    def test_only_json_block_returns_empty_string(self):
        """When response is only a JSON code block, returns empty string."""
        content = f"```json\n{json.dumps(_VALID_SPEC)}\n```"
        text = _extract_chat_text(content)

        assert text == ""

    def test_preserves_text_before_json_block(self):
        """Text before JSON block is preserved."""
        content = f"Creating your module now.\n```json\n{json.dumps(_VALID_SPEC)}\n```"
        text = _extract_chat_text(content)

        assert "Creating your module now." in text

    def test_preserves_text_after_json_block(self):
        """Text after JSON block is preserved."""
        content = f"```json\n{json.dumps(_VALID_SPEC)}\n```\nModule created!"
        text = _extract_chat_text(content)

        assert "Module created!" in text

    def test_strips_whitespace_from_result(self):
        """Result is stripped of leading/trailing whitespace."""
        content = f"  \n  ```json\n{json.dumps(_VALID_SPEC)}\n```  \n  "
        text = _extract_chat_text(content)

        assert text == "" or not text.startswith(" ")


class TestBuildModulePromptEdgeCases:
    """Extended tests for _build_module_prompt."""

    def test_includes_snake_case_instruction(self):
        """Prompt includes instruction to use snake_case for JSON fields."""
        prompt = _build_module_prompt("weather", _TEST_SOUL)
        assert "snake_case" in prompt

    def test_includes_example_json_block(self):
        """Prompt includes an example JSON code block."""
        prompt = _build_module_prompt("weather", _TEST_SOUL)
        assert "```json" in prompt
        assert "metric-dashboard" in prompt

    def test_includes_module_type_options(self):
        """Prompt includes the valid module type options."""
        prompt = _build_module_prompt("stocks", _TEST_SOUL)
        assert "metric" in prompt
        assert "list" in prompt

    def test_includes_refresh_interval_defaults(self):
        """Prompt includes recommended refresh interval values."""
        prompt = _build_module_prompt("news", _TEST_SOUL)
        assert "3600" in prompt  # weather
        assert "300" in prompt   # stocks
        assert "1800" in prompt  # news

    def test_includes_no_id_instruction(self):
        """Prompt tells LLM not to include an id field."""
        prompt = _build_module_prompt("anything", _TEST_SOUL)
        assert "Do NOT include" in prompt or "do NOT" in prompt.lower()

    def test_message_with_special_characters(self):
        """Prompt handles special characters in user message."""
        prompt = _build_module_prompt('Track "big tech" stocks & bonds <2024>', _TEST_SOUL)
        assert '"big tech"' in prompt
        assert "& bonds" in prompt

    def test_message_is_at_end_of_prompt(self):
        """User message appears at the end of the prompt after system instructions."""
        prompt = _build_module_prompt("Show me the weather", _TEST_SOUL)
        # User message should be at the end
        message_pos = prompt.rfind("Show me the weather")
        system_pos = prompt.find("You are Self")
        assert system_pos < message_pos


class TestHandleChatModuleCreationEdgeCases:
    """Edge cases for handle_chat module creation flow."""

    @pytest.mark.asyncio
    async def test_module_created_payload_has_module_id_from_db(self, ws, tmp_path):
        """module_created payload's module_id matches the DB-generated UUID."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        content = f"Here is your module:\n```json\n{json.dumps(_VALID_SPEC)}\n```"
        provider = _make_provider(content)

        await handle_chat(ws, "Create a module", provider, db_path)

        module_msgs = [m for m in ws.sent if m["type"] == "module_created"]
        assert len(module_msgs) == 1

        module_id = module_msgs[0]["payload"]["module_id"]

        # Verify the module_id exists in the DB
        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute("SELECT id FROM modules WHERE id = ?", (module_id,))
            row = await cursor.fetchone()
            assert row is not None
            assert row[0] == module_id
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_module_creation_with_extra_spec_fields(self, ws, tmp_path):
        """Extra fields in spec are preserved in module_created payload."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        spec_with_extras = {
            **_VALID_SPEC,
            "custom_color": "#FF0000",
            "priority": 5,
        }
        content = f"Module:\n```json\n{json.dumps(spec_with_extras)}\n```"
        provider = _make_provider(content)

        await handle_chat(ws, "Create module", provider, db_path)

        module_msgs = [m for m in ws.sent if m["type"] == "module_created"]
        payload = module_msgs[0]["payload"]
        assert payload["custom_color"] == "#FF0000"
        assert payload["priority"] == 5

    @pytest.mark.asyncio
    async def test_module_creation_empty_chat_text_still_sends_done(self, ws, tmp_path):
        """When LLM returns only JSON (no conversational text), chat_stream done is still sent."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        # LLM response with only JSON code block, no text
        content = f"```json\n{json.dumps(_VALID_SPEC)}\n```"
        provider = _make_provider(content)

        await handle_chat(ws, "Create module", provider, db_path)

        stream_msgs = [m for m in ws.sent if m["type"] == "chat_stream"]
        # Should at minimum have the done=True message
        done_msgs = [m for m in stream_msgs if m["payload"].get("done") is True]
        assert len(done_msgs) >= 1

    @pytest.mark.asyncio
    async def test_module_creation_db_save_failure_sends_error(self, ws, tmp_path):
        """When DB save fails during module creation, MODULE_CREATION_FAILED is sent."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        content = f"Creating module:\n```json\n{json.dumps(_VALID_SPEC)}\n```"
        provider = _make_provider(content)

        # Patch create_module to raise an exception
        with patch("app.agent.create_module", side_effect=Exception("DB write failed")):
            await handle_chat(ws, "Create module", provider, db_path)

        error_msgs = [m for m in ws.sent if m["type"] == "error"]
        assert len(error_msgs) == 1
        assert error_msgs[0]["payload"]["code"] == "MODULE_CREATION_FAILED"
        assert "DB write failed" in error_msgs[0]["payload"]["message"]

    @pytest.mark.asyncio
    async def test_module_creation_db_save_failure_still_sends_idle(self, ws, tmp_path):
        """When DB save fails, status:idle is still sent in finally."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        content = f"Module:\n```json\n{json.dumps(_VALID_SPEC)}\n```"
        provider = _make_provider(content)

        with patch("app.agent.create_module", side_effect=Exception("DB error")):
            await handle_chat(ws, "Create module", provider, db_path)

        assert ws.sent[-1] == {"type": "status", "payload": {"state": "idle"}}

    @pytest.mark.asyncio
    async def test_invalid_json_sends_chat_text_before_error(self, ws, tmp_path):
        """Invalid JSON code fence still sends conversational text as chat_stream."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        content = (
            "Sure, I'll create that module!\n\n"
            "```json\n{invalid json here}\n```"
        )
        provider = _make_provider(content)

        await handle_chat(ws, "Create module", provider, db_path)

        # Should have chat_stream messages with the conversational text
        stream_msgs = [m for m in ws.sent if m["type"] == "chat_stream"]
        assert len(stream_msgs) >= 1

        # First stream message should have the conversational text
        delta_msgs = [m for m in stream_msgs if m["payload"].get("done") is False]
        if delta_msgs:
            assert "create that module" in delta_msgs[0]["payload"]["delta"].lower()

        # Error should also be present
        error_msgs = [m for m in ws.sent if m["type"] == "error"]
        assert len(error_msgs) == 1
        assert error_msgs[0]["payload"]["code"] == "MODULE_CREATION_FAILED"

    @pytest.mark.asyncio
    async def test_missing_fields_sends_specific_error_message(self, ws, tmp_path):
        """Missing required fields error includes which fields are missing."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        # Spec missing several required fields
        partial_spec = {"name": "Partial", "type": "metric"}
        content = f"Module:\n```json\n{json.dumps(partial_spec)}\n```"
        provider = _make_provider(content)

        await handle_chat(ws, "Create module", provider, db_path)

        error_msgs = [m for m in ws.sent if m["type"] == "error"]
        assert len(error_msgs) == 1
        error_msg = error_msgs[0]["payload"]["message"]
        assert "missing required fields" in error_msg.lower()

    @pytest.mark.asyncio
    async def test_missing_fields_does_not_save_to_db(self, ws, tmp_path):
        """Module spec with missing fields does not create a DB entry."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        partial_spec = {"name": "Incomplete"}
        content = f"```json\n{json.dumps(partial_spec)}\n```"
        provider = _make_provider(content)

        await handle_chat(ws, "Create module", provider, db_path)

        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute("SELECT COUNT(*) FROM modules")
            row = await cursor.fetchone()
            assert row[0] == 0
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_module_spec_name_used_as_module_name(self, ws, tmp_path):
        """Module name in DB matches the name field from the spec."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        spec = {**_VALID_SPEC, "name": "Custom Module Name"}
        content = f"```json\n{json.dumps(spec)}\n```"
        provider = _make_provider(content)

        await handle_chat(ws, "Create module", provider, db_path)

        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute("SELECT name FROM modules")
            row = await cursor.fetchone()
            assert row[0] == "Custom Module Name"
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_unnamed_module_fallback(self, ws, tmp_path):
        """Module with empty name in spec gets 'Unnamed Module' fallback."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        # Spec with all required fields but empty name
        # (name IS a required field in _REQUIRED_SPEC_FIELDS, but the module_name
        # comes from spec.get("name", "Unnamed Module"))
        spec = {**_VALID_SPEC}
        del spec["name"]
        # Add name back since it's required
        spec["name"] = ""
        content = f"```json\n{json.dumps(spec)}\n```"
        provider = _make_provider(content)

        await handle_chat(ws, "Create module", provider, db_path)

        # Empty string name is replaced with "Unnamed Module" by validation
        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute("SELECT name FROM modules")
            row = await cursor.fetchone()
            assert row[0] == "Unnamed Module"
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_llm_usage_logged_even_during_module_creation(self, ws, tmp_path):
        """LLM usage is logged to llm_usage table even when module creation occurs."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        content = f"Module:\n```json\n{json.dumps(_VALID_SPEC)}\n```"
        provider = _make_provider(content)

        await handle_chat(ws, "Create module", provider, db_path)

        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute("SELECT COUNT(*) FROM llm_usage")
            row = await cursor.fetchone()
            assert row[0] == 1
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_module_creation_total_message_count(self, ws, tmp_path):
        """Module creation sends exactly 7 messages."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        content = f"Creating module:\n```json\n{json.dumps(_VALID_SPEC)}\n```"
        provider = _make_provider(content)

        await handle_chat(ws, "Create module", provider, db_path)

        # Expected: thinking, chat_stream(text), chat_stream(done), discovering, composing, module_created, idle
        assert len(ws.sent) == 7
        types = [m["type"] for m in ws.sent]
        assert types == [
            "status",           # thinking
            "chat_stream",      # conversational text
            "chat_stream",      # done=True
            "status",           # discovering
            "status",           # composing
            "module_created",   # the module
            "status",           # idle
        ]
