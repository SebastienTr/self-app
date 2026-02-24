"""Edge-case tests for SOUL injection in agent.py — Story 2.2 TEA expansion.

Covers SOUL-related paths NOT exercised by test_agent.py or test_agent_edge.py:
  - _build_module_prompt: empty soul_content, very large soul_content
  - _build_module_prompt: soul_content with curly braces (f-string safety)
  - _build_module_prompt: soul_content with markdown code fences
  - _build_module_prompt: ordering invariant verified with unique markers
  - handle_chat: data_dir derivation from various db_path formats
  - handle_chat: SOUL load failure (unexpected exception) still sends idle
  - handle_chat: SOUL content read on every chat call (no stale cache)
  - handle_chat: SOUL content with special characters in LLM prompt
  - handle_chat: corrupted SOUL.md during chat still works (auto-recovery)
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import aiosqlite
import pytest

from app.agent import (
    _build_module_prompt,
    handle_chat,
)
from app.llm.base import LLMResult

# Shared test SOUL content
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


def _make_result(content: str = "Response content") -> LLMResult:
    """Helper to create an LLMResult with given content."""
    return LLMResult(
        content=content,
        provider="test-provider",
        model="test-model",
        tokens_in=5,
        tokens_out=10,
        latency_ms=42,
        cost_estimate=0.0001,
    )


def _make_provider(content: str = "Response content") -> MagicMock:
    """Helper to create a mock provider returning given content."""
    provider = MagicMock()
    provider.name = "test-provider"
    provider.execute = AsyncMock(return_value=_make_result(content))
    return provider


def _get_prompt(provider: MagicMock) -> str:
    """Extract the prompt string from a mock provider's call_args."""
    ca = provider.execute.call_args
    return ca.kwargs.get(
        "prompt", ca.args[0] if ca.args else ""
    )


async def _setup_db(db_path: str) -> None:
    """Create llm_usage + modules tables for tests."""
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


class TestBuildModulePromptSoulEdgeCases:
    """Edge cases for _build_module_prompt with various SOUL content."""

    def test_empty_soul_content(self):
        """Prompt with empty soul_content still has structure."""
        prompt = _build_module_prompt("hello", "")
        assert "# Agent Identity" in prompt
        assert "# Instructions" in prompt
        assert "hello" in prompt

    def test_very_large_soul_content(self):
        """Prompt handles very large SOUL content (50KB)."""
        large_soul = "# Large SOUL\n\n" + ("Identity detail. " * 3000)
        prompt = _build_module_prompt("test", large_soul)
        assert "# Large SOUL" in prompt
        assert "Identity detail." in prompt
        assert "test" in prompt

    def test_soul_with_curly_braces_no_format_error(self):
        """SOUL content with curly braces doesn't cause f-string errors."""
        braced_soul = (
            "# SOUL\n\n"
            "Use {{template}} syntax. Also {single} braces.\n"
            "Dict: {'key': 'value'}\n"
        )
        # This should NOT raise a KeyError or ValueError
        prompt = _build_module_prompt("test", braced_soul)
        assert "{{template}}" in prompt
        assert "{single}" in prompt

    def test_soul_with_percent_signs(self):
        """SOUL content with % signs doesn't cause format errors."""
        percent_soul = "# SOUL\n\n100% committed. Use %s format."
        prompt = _build_module_prompt("test", percent_soul)
        assert "100% committed" in prompt

    def test_soul_with_backslashes(self):
        """SOUL content with backslashes is preserved."""
        bs_soul = "# SOUL\n\nPath: C:\\Users\\agent\\data"
        prompt = _build_module_prompt("test", bs_soul)
        assert "C:\\Users\\agent\\data" in prompt

    def test_soul_with_markdown_code_fences(self):
        """SOUL content containing code fences doesn't break prompt."""
        fenced_soul = (
            "# SOUL\n\n"
            "Example:\n"
            "```python\nprint('hello')\n```\n"
        )
        prompt = _build_module_prompt("test", fenced_soul)
        assert "```python" in prompt
        assert "print('hello')" in prompt

    def test_ordering_invariant_with_unique_markers(self):
        """Verify SOUL < Instructions < User message ordering with markers."""
        soul = "UNIQUE_SOUL_MARKER_XYZ"
        message = "UNIQUE_USER_MESSAGE_ABC"
        prompt = _build_module_prompt(message, soul)

        soul_pos = prompt.index("UNIQUE_SOUL_MARKER_XYZ")
        instructions_pos = prompt.index("# Instructions")
        # User message is prefixed with "User message: "
        user_pos = prompt.index("UNIQUE_USER_MESSAGE_ABC")

        assert soul_pos < instructions_pos < user_pos

    def test_soul_content_in_agent_identity_section(self):
        """SOUL content appears between '# Agent Identity' and '# Instructions'."""
        soul = "SOUL_BOUNDARY_TEST_CONTENT"
        prompt = _build_module_prompt("msg", soul)

        identity_pos = prompt.index("# Agent Identity")
        instructions_pos = prompt.index("# Instructions")
        soul_pos = prompt.index("SOUL_BOUNDARY_TEST_CONTENT")

        assert identity_pos < soul_pos < instructions_pos

    def test_multiline_soul_content_preserved(self):
        """Multi-line SOUL content is fully preserved in prompt."""
        multiline_soul = (
            "# Identity\n"
            "\n"
            "Line 1\n"
            "Line 2\n"
            "Line 3\n"
            "\n"
            "## Section\n"
            "More content\n"
        )
        prompt = _build_module_prompt("test", multiline_soul)
        assert "Line 1\nLine 2\nLine 3" in prompt


class TestHandleChatSoulEdgeCases:
    """Edge cases for SOUL loading in handle_chat."""

    @pytest.mark.asyncio
    async def test_data_dir_derived_from_db_path(self, ws, tmp_path):
        """handle_chat derives data_dir from db_path parent directory."""
        # db_path is tmp_path/subdir/test.db → data_dir should be tmp_path/subdir
        subdir = tmp_path / "subdir"
        subdir.mkdir()
        db_path = str(subdir / "test.db")
        await _setup_db(db_path)

        provider = _make_provider("Response")

        await handle_chat(ws, "Hello", provider, db_path)

        # SOUL.md should have been created in the subdir (same as db parent)
        soul_file = subdir / "SOUL.md"
        assert soul_file.exists()

    @pytest.mark.asyncio
    async def test_soul_loaded_on_every_chat_call(self, ws, tmp_path):
        """handle_chat loads SOUL from disk on every call (no caching)."""
        db_path = str(tmp_path / "test.db")
        await _setup_db(db_path)
        soul_file = tmp_path / "SOUL.md"

        # First call — creates default SOUL
        provider1 = _make_provider("Response 1")
        await handle_chat(ws, "Hello", provider1, db_path)

        prompt1 = _get_prompt(provider1)

        # Modify SOUL between calls
        soul_file.write_text(
            "# Modified SOUL\n\nNEW_UNIQUE_MARKER",
            encoding="utf-8",
        )

        # Second call — should use modified SOUL
        ws2 = MockWebSocket()
        provider2 = _make_provider("Response 2")
        await handle_chat(ws2, "Hello again", provider2, db_path)

        prompt2 = _get_prompt(provider2)

        assert "NEW_UNIQUE_MARKER" in prompt2
        assert "NEW_UNIQUE_MARKER" not in prompt1

    @pytest.mark.asyncio
    async def test_corrupted_soul_during_chat_auto_recovers(self, ws, tmp_path):
        """handle_chat with corrupted SOUL.md auto-recovers and still works."""
        db_path = str(tmp_path / "test.db")
        await _setup_db(db_path)

        # Write binary garbage as SOUL.md
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_bytes(b"\xff\xfe\x00\x80\x81")

        provider = _make_provider("Response")
        await handle_chat(ws, "Hello", provider, db_path)

        # Should not crash — should auto-recover with default SOUL
        assert ws.sent[0]["payload"]["state"] == "thinking"
        assert ws.sent[-1]["payload"]["state"] == "idle"

        # Prompt should contain default SOUL content
        prompt = _get_prompt(provider)
        assert "Self" in prompt

    @pytest.mark.asyncio
    async def test_empty_soul_during_chat_auto_recovers(self, ws, tmp_path):
        """handle_chat with empty SOUL.md auto-recovers and still works."""
        db_path = str(tmp_path / "test.db")
        await _setup_db(db_path)

        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text("", encoding="utf-8")

        provider = _make_provider("Response")
        await handle_chat(ws, "Hello", provider, db_path)

        # Should complete normally
        types = [m["type"] for m in ws.sent]
        assert types == ["status", "chat_stream", "chat_stream", "status"]

        # Prompt should contain default SOUL
        prompt = _get_prompt(provider)
        assert "# Agent Identity" in prompt

    @pytest.mark.asyncio
    async def test_soul_load_failure_sends_idle(self, ws, tmp_path):
        """If load_soul raises unexpected error, handle_chat still sends idle."""
        db_path = str(tmp_path / "test.db")
        await _setup_db(db_path)

        provider = MagicMock()
        provider.name = "test-provider"
        provider.execute = AsyncMock(
            side_effect=Exception("should not reach")
        )

        # Patch load_soul to raise an unexpected exception
        with patch(
            "app.agent.load_soul",
            side_effect=RuntimeError("Disk exploded"),
        ):
            await handle_chat(ws, "Hello", provider, db_path)

        # idle must still be sent (finally block)
        assert ws.sent[-1] == {
            "type": "status",
            "payload": {"state": "idle"},
        }

        # Should have error message
        error_msgs = [m for m in ws.sent if m["type"] == "error"]
        assert len(error_msgs) == 1
        assert error_msgs[0]["payload"]["code"] == "LLM_CHAT_FAILED"

    @pytest.mark.asyncio
    async def test_soul_with_special_chars_in_prompt(self, ws, tmp_path):
        """SOUL with special characters doesn't break prompt assembly."""
        db_path = str(tmp_path / "test.db")
        await _setup_db(db_path)

        special_soul = (
            "# SOUL\n\n"
            "Characters: <html> & \"quotes\" 'apostrophe'\n"
            "Regex: [a-z]+ \\d{3}\n"
            "Dollar: $100 Backtick: `code`\n"
        )
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(special_soul, encoding="utf-8")

        provider = _make_provider("Response")
        await handle_chat(ws, "Hello", provider, db_path)

        # Should complete normally
        types = [m["type"] for m in ws.sent]
        assert types == ["status", "chat_stream", "chat_stream", "status"]

        # Prompt should contain the special chars
        prompt = _get_prompt(provider)
        assert "<html>" in prompt
        assert '"quotes"' in prompt

    @pytest.mark.asyncio
    async def test_handle_chat_with_default_soul_includes_all_sections(
        self, ws, tmp_path
    ):
        """handle_chat with default SOUL includes all identity sections in prompt."""
        db_path = str(tmp_path / "test.db")
        await _setup_db(db_path)
        # No SOUL.md exists — default will be created

        provider = _make_provider("Response")
        await handle_chat(ws, "Hello", provider, db_path)

        prompt = _get_prompt(provider)

        # All default SOUL sections should be in the prompt
        assert "## Name" in prompt
        assert "## Personality" in prompt
        assert "## Communication Style" in prompt
        assert "## Values" in prompt

    @pytest.mark.asyncio
    async def test_soul_content_not_duplicated_in_prompt(
        self, ws, tmp_path
    ):
        """SOUL content appears exactly once in the prompt (no duplication)."""
        db_path = str(tmp_path / "test.db")
        await _setup_db(db_path)

        unique_soul = "# SOUL\n\nUNIQUE_SOUL_MARKER_12345"
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(unique_soul, encoding="utf-8")

        provider = _make_provider("Response")
        await handle_chat(ws, "Hello", provider, db_path)

        prompt = _get_prompt(provider)

        count = prompt.count("UNIQUE_SOUL_MARKER_12345")
        assert count == 1

    @pytest.mark.asyncio
    async def test_module_creation_with_custom_soul(self, ws, tmp_path):
        """Module creation flow works with custom SOUL content."""
        db_path = str(tmp_path / "test.db")
        await _setup_db(db_path)

        custom_soul = "# Custom Agent\n\nSpecialized module creator."
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(custom_soul, encoding="utf-8")

        valid_spec = {
            "name": "Test Module",
            "type": "metric",
            "template": "metric-dashboard",
            "data_sources": [
                {
                    "id": "api-1",
                    "type": "rest_api",
                    "config": {
                        "url": "https://api.example.com/data",
                        "method": "GET",
                    },
                }
            ],
            "refresh_interval": 3600,
            "schema_version": 1,
            "accessible_label": "Test module",
        }
        content = (
            "Creating module:\n"
            f"```json\n{json.dumps(valid_spec)}\n```"
        )
        provider = _make_provider(content)

        await handle_chat(ws, "Create a module", provider, db_path)

        # Module should be created successfully
        module_msgs = [
            m for m in ws.sent if m["type"] == "module_created"
        ]
        assert len(module_msgs) == 1

        # Prompt should have contained custom SOUL
        prompt = _get_prompt(provider)
        assert "Custom Agent" in prompt
        assert "Specialized module creator" in prompt
