"""Tests for agent.py — handle_chat orchestration.

Tests handle_chat with mock provider:
  - Happy path: sends thinking status, chat_stream chunks, idle status
  - LLM error: sends error message and idle status
  - Streaming chunks: sends delta messages and done message
  - Module creation: detects JSON spec in LLM response, creates module, sends module_created
"""

import json
from unittest.mock import AsyncMock, MagicMock

import aiosqlite
import pytest

from app.agent import (
    _DEFAULT_SOUL_CONTENT,
    _build_module_prompt,
    _extract_module_spec,
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


@pytest.fixture
def mock_provider():
    """Mock LLM provider returning a simple result."""
    provider = MagicMock()
    provider.name = "test-provider"
    result = LLMResult(
        content="Hello, I am the agent!",
        provider="test-provider",
        model="test-model",
        tokens_in=10,
        tokens_out=20,
        latency_ms=100,
        cost_estimate=0.001,
    )
    provider.execute = AsyncMock(return_value=result)
    return provider


@pytest.fixture
def mock_provider_error():
    """Mock LLM provider that raises an exception."""
    provider = MagicMock()
    provider.name = "test-provider"
    provider.execute = AsyncMock(side_effect=Exception("LLM provider failure"))
    return provider


class TestHandleChat:
    """Tests for handle_chat orchestration function."""

    @pytest.mark.asyncio
    async def test_happy_path_sends_thinking_status_first(
        self, ws, mock_provider, tmp_path
    ):
        """handle_chat must send status:thinking before calling provider."""
        db_path = str(tmp_path / "test.db")

        # Set up DB so _log_llm_usage can work
        import aiosqlite
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
            await db.commit()
        finally:
            await db.close()

        await handle_chat(ws, "Hello", mock_provider, db_path)

        # First message should be status: thinking
        assert ws.sent[0] == {
            "type": "status",
            "payload": {"state": "thinking"},
        }

    @pytest.mark.asyncio
    async def test_happy_path_sends_chat_stream_with_content(
        self, ws, mock_provider, tmp_path
    ):
        """handle_chat must send chat_stream with content from provider."""
        db_path = str(tmp_path / "test.db")

        import aiosqlite
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
            await db.commit()
        finally:
            await db.close()

        await handle_chat(ws, "Hello", mock_provider, db_path)

        # Find chat_stream with done=False
        stream_msgs = [
            m for m in ws.sent if m.get("type") == "chat_stream"
        ]
        assert len(stream_msgs) == 2

        # First: content chunk
        assert stream_msgs[0] == {
            "type": "chat_stream",
            "payload": {"delta": "Hello, I am the agent!", "done": False},
        }

        # Second: done signal
        assert stream_msgs[1] == {
            "type": "chat_stream",
            "payload": {"delta": "", "done": True},
        }

    @pytest.mark.asyncio
    async def test_happy_path_sends_idle_status_last(
        self, ws, mock_provider, tmp_path
    ):
        """handle_chat must send status:idle as the last message (in finally)."""
        db_path = str(tmp_path / "test.db")

        import aiosqlite
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
            await db.commit()
        finally:
            await db.close()

        await handle_chat(ws, "Hello", mock_provider, db_path)

        # Last message should be status: idle
        assert ws.sent[-1] == {
            "type": "status",
            "payload": {"state": "idle"},
        }

    @pytest.mark.asyncio
    async def test_happy_path_message_order(self, ws, mock_provider, tmp_path):
        """Messages must be: thinking → chat_stream(done=False) → chat_stream(done=True) → idle."""
        db_path = str(tmp_path / "test.db")

        import aiosqlite
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
            await db.commit()
        finally:
            await db.close()

        await handle_chat(ws, "Test message", mock_provider, db_path)

        types = [m["type"] for m in ws.sent]
        assert types == ["status", "chat_stream", "chat_stream", "status"]
        assert ws.sent[0]["payload"]["state"] == "thinking"
        assert ws.sent[1]["payload"]["done"] is False
        assert ws.sent[2]["payload"]["done"] is True
        assert ws.sent[-1]["payload"]["state"] == "idle"

    @pytest.mark.asyncio
    async def test_llm_error_sends_error_message(
        self, ws, mock_provider_error, tmp_path
    ):
        """On LLM error, handle_chat must send error message."""
        db_path = str(tmp_path / "test.db")

        await handle_chat(ws, "Hello", mock_provider_error, db_path)

        error_msgs = [m for m in ws.sent if m.get("type") == "error"]
        assert len(error_msgs) == 1
        assert error_msgs[0]["payload"]["code"] == "LLM_CHAT_FAILED"
        assert "message" in error_msgs[0]["payload"]
        assert "agent_action" in error_msgs[0]["payload"]

    @pytest.mark.asyncio
    async def test_llm_error_still_sends_idle_status(
        self, ws, mock_provider_error, tmp_path
    ):
        """On LLM error, status:idle must still be sent in the finally block."""
        db_path = str(tmp_path / "test.db")

        await handle_chat(ws, "Hello", mock_provider_error, db_path)

        # Last message should be idle (from finally)
        assert ws.sent[-1] == {
            "type": "status",
            "payload": {"state": "idle"},
        }

    @pytest.mark.asyncio
    async def test_llm_error_no_chat_stream_sent(
        self, ws, mock_provider_error, tmp_path
    ):
        """On LLM error, no chat_stream messages should be sent."""
        db_path = str(tmp_path / "test.db")

        await handle_chat(ws, "Hello", mock_provider_error, db_path)

        stream_msgs = [m for m in ws.sent if m.get("type") == "chat_stream"]
        assert len(stream_msgs) == 0

    @pytest.mark.asyncio
    async def test_llm_usage_logged_on_success(
        self, ws, mock_provider, tmp_path
    ):
        """On success, LLM usage should be inserted into llm_usage table."""
        import aiosqlite

        db_path = str(tmp_path / "test.db")
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
            await db.commit()
        finally:
            await db.close()

        await handle_chat(ws, "Hello", mock_provider, db_path)

        # Verify row was inserted
        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute("SELECT COUNT(*) FROM llm_usage")
            row = await cursor.fetchone()
            assert row[0] == 1
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_provider_called_with_enriched_prompt(
        self, ws, mock_provider, tmp_path
    ):
        """provider.execute() must be called with an enriched prompt containing the user message."""
        db_path = str(tmp_path / "test.db")

        import aiosqlite
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
            await db.commit()
        finally:
            await db.close()

        await handle_chat(ws, "Tell me a story", mock_provider, db_path)

        # Provider is called once with an enriched prompt containing the user message
        mock_provider.execute.assert_called_once()
        call_kwargs = mock_provider.execute.call_args
        prompt = call_kwargs.kwargs.get("prompt", call_kwargs.args[0] if call_kwargs.args else "")
        assert "Tell me a story" in prompt
        # Prompt should include module creation system instructions
        assert "data_sources" in prompt


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


# --- Valid module spec JSON that the LLM would return ---
_VALID_MODULE_SPEC_JSON = json.dumps({
    "name": "Paris Weather",
    "type": "metric",
    "template": "metric-dashboard",
    "data_sources": [
        {
            "id": "openmeteo-paris",
            "type": "rest_api",
            "config": {
                "url": "https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current=temperature_2m",
                "method": "GET",
            },
        }
    ],
    "refresh_interval": 3600,
    "schema_version": 1,
    "accessible_label": "Paris weather forecast showing current temperature",
})

# LLM response with conversational text AND a JSON code block
_MODULE_CREATION_RESPONSE = (
    "I'll create a weather module for you. Let me find the right data sources...\n\n"
    "```json\n"
    f"{_VALID_MODULE_SPEC_JSON}\n"
    "```"
)

# LLM response with INVALID JSON in code block
_INVALID_JSON_RESPONSE = (
    "Sure, I'll create that module!\n\n"
    "```json\n"
    '{"name": "Bad Module", "type": "metric", INVALID}\n'
    "```"
)


class TestExtractModuleSpec:
    """Tests for _extract_module_spec helper."""

    def test_extracts_json_from_code_fence(self):
        """Extracts valid module spec JSON from markdown code fence."""
        spec = json.dumps({
            "name": "Test", "type": "metric", "template": "metric-dashboard",
            "data_sources": [], "refresh_interval": 3600, "schema_version": 1,
            "accessible_label": "test module"
        })
        text = f'Some text\n```json\n{spec}\n```\nMore text'
        result = _extract_module_spec(text)
        assert result is not None
        assert result["name"] == "Test"

    def test_returns_none_for_no_code_fence(self):
        """Returns None when no JSON code fence is present."""
        result = _extract_module_spec("Just a regular chat response with no JSON.")
        assert result is None

    def test_returns_none_for_invalid_json(self):
        """Returns None when JSON code fence has invalid JSON."""
        text = '```json\n{invalid json here}\n```'
        result = _extract_module_spec(text)
        assert result is None

    def test_returns_none_for_missing_required_fields(self):
        """Returns None when JSON is valid but missing required module fields."""
        text = '```json\n{"random": "data"}\n```'
        result = _extract_module_spec(text)
        assert result is None

    def test_extracts_valid_module_spec(self):
        """Extracts a complete valid module spec."""
        result = _extract_module_spec(_MODULE_CREATION_RESPONSE)
        assert result is not None
        assert result["name"] == "Paris Weather"
        assert result["type"] == "metric"
        assert result["template"] == "metric-dashboard"
        assert len(result["data_sources"]) == 1
        assert result["refresh_interval"] == 3600
        assert result["schema_version"] == 1


class TestBuildModulePrompt:
    """Tests for _build_module_prompt helper."""

    def test_includes_user_message(self):
        """Prompt includes the user's original message."""
        prompt = _build_module_prompt("Show me the weather in Paris", _TEST_SOUL)
        assert "Show me the weather in Paris" in prompt

    def test_includes_schema_instructions(self):
        """Prompt includes schema field requirements."""
        prompt = _build_module_prompt("Track my stocks", _TEST_SOUL)
        assert "data_sources" in prompt
        assert "refresh_interval" in prompt
        assert "schema_version" in prompt
        assert "accessible_label" in prompt

    def test_soul_content_at_top_of_prompt(self):
        """SOUL content appears at the beginning of the prompt, before instructions."""
        soul = "# My Custom SOUL\n\nI am unique."
        prompt = _build_module_prompt("hello", soul)
        soul_pos = prompt.find("# My Custom SOUL")
        instructions_pos = prompt.find("# Instructions")
        user_msg_pos = prompt.find("hello")
        assert soul_pos < instructions_pos < user_msg_pos

    def test_soul_content_injected_in_prompt(self):
        """SOUL content is injected into the prompt."""
        soul = "# Agent Identity\n\nSpecial personality trait XYZ."
        prompt = _build_module_prompt("test message", soul)
        assert "Special personality trait XYZ" in prompt

    def test_prompt_contains_agent_identity_header(self):
        """Prompt starts with '# Agent Identity' header."""
        prompt = _build_module_prompt("test", _TEST_SOUL)
        assert prompt.strip().startswith("# Agent Identity")

    def test_prompt_contains_instructions_header(self):
        """Prompt contains '# Instructions' header after SOUL."""
        prompt = _build_module_prompt("test", _TEST_SOUL)
        assert "# Instructions" in prompt


class TestHandleChatModuleCreation:
    """Tests for handle_chat with module creation flow."""

    @pytest.mark.asyncio
    async def test_module_creation_sends_status_sequence(self, ws, tmp_path):
        """Module creation sends: thinking -> discovering -> composing -> idle."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        provider = MagicMock()
        provider.name = "test-provider"
        result = LLMResult(
            content=_MODULE_CREATION_RESPONSE,
            provider="test-provider",
            model="test-model",
            tokens_in=50,
            tokens_out=200,
            latency_ms=500,
            cost_estimate=0.01,
        )
        provider.execute = AsyncMock(return_value=result)

        await handle_chat(ws, "Show me the weather in Paris", provider, db_path)

        status_msgs = [
            m for m in ws.sent if m.get("type") == "status"
        ]
        states = [m["payload"]["state"] for m in status_msgs]
        assert states == ["thinking", "discovering", "composing", "idle"]

    @pytest.mark.asyncio
    async def test_module_creation_sends_chat_stream_before_module_created(self, ws, tmp_path):
        """Conversational text is sent as chat_stream before module_created."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        provider = MagicMock()
        provider.name = "test-provider"
        result = LLMResult(
            content=_MODULE_CREATION_RESPONSE,
            provider="test-provider",
            model="test-model",
            tokens_in=50,
            tokens_out=200,
            latency_ms=500,
            cost_estimate=0.01,
        )
        provider.execute = AsyncMock(return_value=result)

        await handle_chat(ws, "Show me the weather in Paris", provider, db_path)

        # Find chat_stream messages
        stream_msgs = [m for m in ws.sent if m.get("type") == "chat_stream"]
        assert len(stream_msgs) >= 2  # At least delta + done

        # Find module_created message
        module_msgs = [m for m in ws.sent if m.get("type") == "module_created"]
        assert len(module_msgs) == 1

        # chat_stream done should come before module_created
        stream_done_idx = next(
            i for i, m in enumerate(ws.sent)
            if m.get("type") == "chat_stream" and m["payload"].get("done") is True
        )
        module_created_idx = next(
            i for i, m in enumerate(ws.sent)
            if m.get("type") == "module_created"
        )
        assert stream_done_idx < module_created_idx

    @pytest.mark.asyncio
    async def test_module_creation_sends_module_created_with_spec(self, ws, tmp_path):
        """module_created message contains the full spec with server-generated id."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        provider = MagicMock()
        provider.name = "test-provider"
        result = LLMResult(
            content=_MODULE_CREATION_RESPONSE,
            provider="test-provider",
            model="test-model",
            tokens_in=50,
            tokens_out=200,
            latency_ms=500,
            cost_estimate=0.01,
        )
        provider.execute = AsyncMock(return_value=result)

        await handle_chat(ws, "Show me the weather in Paris", provider, db_path)

        module_msgs = [m for m in ws.sent if m.get("type") == "module_created"]
        assert len(module_msgs) == 1

        payload = module_msgs[0]["payload"]
        assert "module_id" in payload
        assert payload["name"] == "Paris Weather"
        assert payload["type"] == "metric"
        assert payload["template"] == "metric-dashboard"
        assert payload["schema_version"] == 1

    @pytest.mark.asyncio
    async def test_module_creation_saves_to_db(self, ws, tmp_path):
        """Module is saved to the modules table on creation."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        provider = MagicMock()
        provider.name = "test-provider"
        result = LLMResult(
            content=_MODULE_CREATION_RESPONSE,
            provider="test-provider",
            model="test-model",
            tokens_in=50,
            tokens_out=200,
            latency_ms=500,
            cost_estimate=0.01,
        )
        provider.execute = AsyncMock(return_value=result)

        await handle_chat(ws, "Show me the weather in Paris", provider, db_path)

        # Verify module is in DB
        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute("SELECT COUNT(*) FROM modules")
            row = await cursor.fetchone()
            assert row[0] == 1
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_invalid_json_sends_error(self, ws, tmp_path):
        """Invalid JSON in LLM response sends MODULE_CREATION_FAILED error."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        provider = MagicMock()
        provider.name = "test-provider"
        result = LLMResult(
            content=_INVALID_JSON_RESPONSE,
            provider="test-provider",
            model="test-model",
            tokens_in=50,
            tokens_out=200,
            latency_ms=500,
            cost_estimate=0.01,
        )
        provider.execute = AsyncMock(return_value=result)

        await handle_chat(ws, "Create a broken module", provider, db_path)

        error_msgs = [m for m in ws.sent if m.get("type") == "error"]
        assert len(error_msgs) == 1
        assert error_msgs[0]["payload"]["code"] == "MODULE_CREATION_FAILED"

    @pytest.mark.asyncio
    async def test_invalid_json_still_sends_idle(self, ws, tmp_path):
        """Invalid module JSON still ends with status:idle."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        provider = MagicMock()
        provider.name = "test-provider"
        result = LLMResult(
            content=_INVALID_JSON_RESPONSE,
            provider="test-provider",
            model="test-model",
            tokens_in=50,
            tokens_out=200,
            latency_ms=500,
            cost_estimate=0.01,
        )
        provider.execute = AsyncMock(return_value=result)

        await handle_chat(ws, "Create a broken module", provider, db_path)

        assert ws.sent[-1] == {
            "type": "status",
            "payload": {"state": "idle"},
        }

    @pytest.mark.asyncio
    async def test_regular_chat_still_works(self, ws, tmp_path):
        """Regular chat (no JSON code block) still works as before."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        provider = MagicMock()
        provider.name = "test-provider"
        result = LLMResult(
            content="Just a normal chat response with no JSON block.",
            provider="test-provider",
            model="test-model",
            tokens_in=10,
            tokens_out=20,
            latency_ms=100,
            cost_estimate=0.001,
        )
        provider.execute = AsyncMock(return_value=result)

        await handle_chat(ws, "Hello there", provider, db_path)

        types = [m["type"] for m in ws.sent]
        assert "module_created" not in types
        assert types == ["status", "chat_stream", "chat_stream", "status"]

    @pytest.mark.asyncio
    async def test_module_created_spec_has_snake_case_keys(self, ws, tmp_path):
        """module_created payload uses snake_case keys on the wire."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        provider = MagicMock()
        provider.name = "test-provider"
        result = LLMResult(
            content=_MODULE_CREATION_RESPONSE,
            provider="test-provider",
            model="test-model",
            tokens_in=50,
            tokens_out=200,
            latency_ms=500,
            cost_estimate=0.01,
        )
        provider.execute = AsyncMock(return_value=result)

        await handle_chat(ws, "Show me the weather", provider, db_path)

        module_msgs = [m for m in ws.sent if m.get("type") == "module_created"]
        assert len(module_msgs) == 1
        payload = module_msgs[0]["payload"]

        # Keys should be snake_case
        assert "module_id" in payload
        assert "data_sources" in payload
        assert "refresh_interval" in payload
        assert "schema_version" in payload
        assert "accessible_label" in payload

        # camelCase keys should NOT be present
        assert "moduleId" not in payload
        assert "dataSources" not in payload
        assert "refreshInterval" not in payload


class TestHandleChatSoulInjection:
    """Tests for SOUL.md content injection into LLM prompt (Story 2.2, AC: #2, #5, #6)."""

    @pytest.mark.asyncio
    async def test_prompt_contains_soul_content(self, ws, mock_provider, tmp_path):
        """handle_chat loads SOUL and passes it to the LLM prompt."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        # Write a custom SOUL.md so we can verify it's in the prompt
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(
            "# Unique Test SOUL\n\nI am a very unique test agent.",
            encoding="utf-8",
        )

        await handle_chat(ws, "Hello", mock_provider, db_path)

        # Verify the prompt passed to provider contains SOUL content
        mock_provider.execute.assert_called_once()
        call_kwargs = mock_provider.execute.call_args
        prompt = call_kwargs.kwargs.get("prompt", call_kwargs.args[0] if call_kwargs.args else "")
        assert "Unique Test SOUL" in prompt
        assert "very unique test agent" in prompt

    @pytest.mark.asyncio
    async def test_soul_content_before_module_instructions(self, ws, mock_provider, tmp_path):
        """SOUL content appears before module creation instructions in prompt."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text("# SOUL MARKER CONTENT", encoding="utf-8")

        await handle_chat(ws, "Hello", mock_provider, db_path)

        call_kwargs = mock_provider.execute.call_args
        prompt = call_kwargs.kwargs.get("prompt", call_kwargs.args[0] if call_kwargs.args else "")
        soul_pos = prompt.find("SOUL MARKER CONTENT")
        instructions_pos = prompt.find("# Instructions")
        user_msg_pos = prompt.find("User message: Hello")
        assert soul_pos < instructions_pos < user_msg_pos

    @pytest.mark.asyncio
    async def test_missing_soul_file_creates_default(self, ws, mock_provider, tmp_path):
        """handle_chat with missing SOUL.md creates default and still works."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)
        # Don't create SOUL.md — it should be auto-created

        await handle_chat(ws, "Hello", mock_provider, db_path)

        # Should not crash
        assert ws.sent[0]["payload"]["state"] == "thinking"
        assert ws.sent[-1]["payload"]["state"] == "idle"

        # Default SOUL.md should have been created
        soul_file = tmp_path / "SOUL.md"
        assert soul_file.exists()

        # Verify prompt contains default SOUL content
        call_kwargs = mock_provider.execute.call_args
        prompt = call_kwargs.kwargs.get("prompt", call_kwargs.args[0] if call_kwargs.args else "")
        assert "Self" in prompt
        assert "# Agent Identity" in prompt

    @pytest.mark.asyncio
    async def test_handle_chat_with_default_soul_no_crash(self, ws, mock_provider, tmp_path):
        """handle_chat with default SOUL.md does not crash."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)

        # Write default SOUL content
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(_DEFAULT_SOUL_CONTENT, encoding="utf-8")

        await handle_chat(ws, "Tell me a joke", mock_provider, db_path)

        types = [m["type"] for m in ws.sent]
        assert types == ["status", "chat_stream", "chat_stream", "status"]
