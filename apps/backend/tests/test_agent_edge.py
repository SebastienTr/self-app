"""Edge-case tests for agent.py — Story 2.1 TEA expansion.

Covers paths NOT exercised by test_agent.py:
  - _log_llm_usage: DB path does not exist (aiosqlite error → silent skip)
  - _log_llm_usage: llm_usage table does not exist (SQL error → silent skip)
  - handle_chat with empty message string (provider still called)
  - handle_chat with LLM result containing empty content string
  - handle_chat with LLM result containing very long content
  - handle_chat: provider.name used in error agent_action field
  - handle_chat: error payload code is always "LLM_CHAT_FAILED"
  - handle_chat: thinking sent before provider is called (ordering invariant)
  - handle_chat: idle always sent even when _log_llm_usage fails
  - handle_chat: provider called exactly once per invocation
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import aiosqlite
import pytest

from app.agent import handle_chat, _log_llm_usage
from app.llm.base import LLMResult, LLMStreamChunk


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


def _make_stream_fn(content: str = "Response content", provider_name: str = "test-provider"):
    """Create an async generator that yields chunks for the given content."""
    async def stream(prompt: str = "", **kwargs):
        yield LLMStreamChunk(delta=content, accumulated=content, done=False)
        yield LLMStreamChunk(
            delta="", accumulated=content, done=True,
            tokens_in=5, tokens_out=10, model="test-model",
            provider=provider_name, latency_ms=42,
        )
    return stream


def _make_provider(content: str = "Response content") -> MagicMock:
    """Helper to create a mock provider returning given content via streaming."""
    provider = MagicMock()
    provider.name = "test-provider"
    provider.execute = AsyncMock(return_value=_make_result(content))
    provider.stream = _make_stream_fn(content)
    return provider


async def _create_db_with_usage_table(db_path: str) -> None:
    """Create a test DB with llm_usage + memory_core tables."""
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
            """CREATE TABLE IF NOT EXISTS memory_core (
                id TEXT PRIMARY KEY,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                category TEXT,
                user_id TEXT NOT NULL DEFAULT 'default',
                created_at TEXT NOT NULL
            )"""
        )
        await db.commit()
    finally:
        await db.close()


class TestHandleChatEdgeCases:
    """Edge cases for handle_chat function."""

    @pytest.mark.asyncio
    async def test_empty_message_still_calls_provider(self, ws, tmp_path):
        """handle_chat with empty message still calls provider.stream with enriched prompt."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        captured_prompt = None

        async def tracking_stream(prompt: str = "", **kwargs):
            nonlocal captured_prompt
            captured_prompt = prompt
            yield LLMStreamChunk(delta="Response", accumulated="Response", done=False)
            yield LLMStreamChunk(delta="", accumulated="Response", done=True,
                                 tokens_in=5, tokens_out=10, model="m", provider="p", latency_ms=42)

        provider = MagicMock()
        provider.name = "test-provider"
        provider.stream = tracking_stream

        await handle_chat(ws, "", provider, db_path)

        assert captured_prompt is not None
        assert "User message:" in captured_prompt

    @pytest.mark.asyncio
    async def test_empty_message_completes_full_protocol(self, ws, tmp_path):
        """handle_chat with empty message still completes the full streaming protocol."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        provider = _make_provider("OK")
        await handle_chat(ws, "", provider, db_path)

        types = [m["type"] for m in ws.sent]
        # New order: thinking, streaming, chat_stream, chat_stream(done), idle
        assert types == ["status", "status", "chat_stream", "chat_stream", "status"]

    @pytest.mark.asyncio
    async def test_empty_content_from_provider_sends_empty_delta(self, ws, tmp_path):
        """When provider returns empty string content, chat_stream delta is empty."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        provider = _make_provider("")
        await handle_chat(ws, "Hello", provider, db_path)

        # Find the first chat_stream (done=False) — should have empty delta
        stream_msgs = [m for m in ws.sent if m.get("type") == "chat_stream"]
        assert len(stream_msgs) == 2
        assert stream_msgs[0]["payload"]["delta"] == ""
        assert stream_msgs[0]["payload"]["done"] is False
        # Done message
        assert stream_msgs[1]["payload"]["done"] is True

    @pytest.mark.asyncio
    async def test_very_long_content_from_provider(self, ws, tmp_path):
        """handle_chat with very long provider response is sent as single chunk."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        long_content = "A very long response. " * 500
        provider = _make_provider(long_content)
        await handle_chat(ws, "Tell me everything", provider, db_path)

        stream_msgs = [m for m in ws.sent if m.get("type") == "chat_stream"]
        assert stream_msgs[0]["payload"]["delta"] == long_content

    @pytest.mark.asyncio
    async def test_error_payload_code_is_always_llm_chat_failed(self, ws, tmp_path):
        """LLM error always produces error payload with code=LLM_CHAT_FAILED."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        provider = MagicMock()
        provider.name = "failing-provider"

        async def failing_stream(prompt: str = "", **kwargs):
            raise ValueError("Unexpected shape")
            yield  # noqa: E701
        provider.stream = failing_stream

        await handle_chat(ws, "Hello", provider, db_path)

        error_msgs = [m for m in ws.sent if m.get("type") == "error"]
        assert len(error_msgs) == 1
        assert error_msgs[0]["payload"]["code"] == "LLM_CHAT_FAILED"

    @pytest.mark.asyncio
    async def test_error_payload_includes_provider_name_in_agent_action(self, ws, tmp_path):
        """Error's agent_action field references the provider name."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        provider = MagicMock()
        provider.name = "my-special-provider"

        async def failing_stream(prompt: str = "", **kwargs):
            raise RuntimeError("CLI failed")
            yield  # noqa: E701
        provider.stream = failing_stream

        await handle_chat(ws, "Hello", provider, db_path)

        error_msgs = [m for m in ws.sent if m.get("type") == "error"]
        assert "my-special-provider" in error_msgs[0]["payload"]["agent_action"]

    @pytest.mark.asyncio
    async def test_thinking_status_sent_before_provider_stream(self, ws, tmp_path):
        """status:thinking must be sent before provider.stream() yields."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        call_order = []

        async def tracking_send_json(data):
            call_order.append(("ws_send", data.get("type"), data.get("payload", {}).get("state")))
            ws.sent.append(data)

        ws.send_json = tracking_send_json

        async def tracking_stream(prompt: str = "", **kwargs):
            call_order.append(("provider_stream", None, None))
            yield LLMStreamChunk(delta="Response", accumulated="Response", done=False)
            yield LLMStreamChunk(delta="", accumulated="Response", done=True,
                                 tokens_in=5, tokens_out=10, model="m", provider="p", latency_ms=42)

        provider = MagicMock()
        provider.name = "track-provider"
        provider.stream = tracking_stream

        await handle_chat(ws, "Test", provider, db_path)

        # Verify thinking was sent before stream yielded
        thinking_idx = next(
            i for i, item in enumerate(call_order)
            if item[0] == "ws_send" and item[2] == "thinking"
        )
        stream_idx = next(
            i for i, item in enumerate(call_order)
            if item[0] == "provider_stream"
        )
        assert thinking_idx < stream_idx

    @pytest.mark.asyncio
    async def test_stream_called_exactly_once(self, ws, tmp_path):
        """provider.stream() is iterated exactly once per handle_chat invocation."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        call_count = 0

        async def counting_stream(prompt: str = "", **kwargs):
            nonlocal call_count
            call_count += 1
            yield LLMStreamChunk(delta="Once", accumulated="Once", done=False)
            yield LLMStreamChunk(delta="", accumulated="Once", done=True,
                                 tokens_in=5, tokens_out=10, model="m", provider="p", latency_ms=42)

        provider = MagicMock()
        provider.name = "test-provider"
        provider.stream = counting_stream

        await handle_chat(ws, "Call once", provider, db_path)

        assert call_count == 1

    @pytest.mark.asyncio
    async def test_idle_sent_even_when_log_llm_usage_fails(self, ws, tmp_path):
        """status:idle is sent even if _log_llm_usage raises an exception.

        This verifies the finally block fires even when the DB insertion
        (which is not in the except branch) also fails.
        """
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        provider = _make_provider("OK")

        # Patch _log_llm_usage to raise an exception after successful provider call
        with patch("app.agent._log_llm_usage", side_effect=Exception("DB gone")):
            await handle_chat(ws, "Hello", provider, db_path)

        # Despite _log_llm_usage failing, status:idle must still be sent
        assert ws.sent[-1]["type"] == "status"
        assert ws.sent[-1]["payload"]["state"] == "idle"

    @pytest.mark.asyncio
    async def test_total_messages_on_success_is_five(self, ws, tmp_path):
        """Exactly 5 messages are sent on happy path: thinking, streaming, chat_stream, done, idle."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        provider = _make_provider("Exactly five messages")
        await handle_chat(ws, "Test", provider, db_path)

        assert len(ws.sent) == 5

    @pytest.mark.asyncio
    async def test_total_messages_on_error_is_three(self, ws, tmp_path):
        """Exactly 3 messages are sent on error path: thinking, error, idle."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        provider = MagicMock()
        provider.name = "error-provider"

        async def failing_stream(prompt: str = "", **kwargs):
            raise Exception("Boom")
            yield  # noqa: E701
        provider.stream = failing_stream

        await handle_chat(ws, "Test", provider, db_path)

        assert len(ws.sent) == 3
        types = [m["type"] for m in ws.sent]
        assert types == ["status", "error", "status"]

    @pytest.mark.asyncio
    async def test_error_message_field_is_user_facing(self, ws, tmp_path):
        """Error message payload.message is a user-facing string (not the raw exception)."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        provider = MagicMock()
        provider.name = "test"

        async def failing_stream(prompt: str = "", **kwargs):
            raise Exception("INTERNAL: null pointer")
            yield  # noqa: E701
        provider.stream = failing_stream

        await handle_chat(ws, "Hello", provider, db_path)

        error_msgs = [m for m in ws.sent if m.get("type") == "error"]
        # The user-facing message should NOT contain raw exception internals
        user_message = error_msgs[0]["payload"]["message"]
        assert "INTERNAL: null pointer" not in user_message
        # It should be the standard user-facing message from agent.py
        assert "error" in user_message.lower() or "try again" in user_message.lower()


class TestLogLlmUsageEdgeCases:
    """Edge cases for _log_llm_usage helper function."""

    @pytest.mark.asyncio
    async def test_log_llm_usage_silent_on_missing_table(self, tmp_path):
        """_log_llm_usage silently skips when llm_usage table does not exist."""
        db_path = str(tmp_path / "no_table.db")

        # Create DB but WITHOUT llm_usage table
        db = await aiosqlite.connect(db_path)
        try:
            await db.execute("PRAGMA journal_mode=WAL;")
            await db.commit()
        finally:
            await db.close()

        result = _make_result("Test")
        # Should NOT raise — should log warning and skip
        await _log_llm_usage(result, db_path)

    @pytest.mark.asyncio
    async def test_log_llm_usage_silent_on_invalid_db_path(self):
        """_log_llm_usage silently skips when DB path is completely invalid."""
        result = _make_result("Test")
        # Invalid path — aiosqlite will fail to connect
        # The function must not propagate the exception
        await _log_llm_usage(result, "/nonexistent/path/to/test.db")

    @pytest.mark.asyncio
    async def test_log_llm_usage_inserts_with_null_tokens(self, tmp_path):
        """_log_llm_usage handles LLMResult with None tokens_in and tokens_out."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        result = LLMResult(
            content="Response",
            provider="test",
            model="test-model",
            tokens_in=None,   # NULL in DB
            tokens_out=None,  # NULL in DB
            latency_ms=50,
            cost_estimate=None,  # NULL in DB
        )

        # Should not raise
        await _log_llm_usage(result, db_path)

        # Row should be present
        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute("SELECT tokens_in, tokens_out, cost_estimate FROM llm_usage")
            row = await cursor.fetchone()
            assert row is not None
            assert row[0] is None
            assert row[1] is None
            assert row[2] is None
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_log_llm_usage_uses_uuid_as_id(self, tmp_path):
        """_log_llm_usage inserts a UUID as the row ID."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        result = _make_result("Test content")
        await _log_llm_usage(result, db_path)

        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute("SELECT id FROM llm_usage")
            row = await cursor.fetchone()
            assert row is not None
            # Should be a valid UUID string
            parsed_uuid = uuid.UUID(row[0])
            assert str(parsed_uuid) == row[0]
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_log_llm_usage_stores_provider_and_model(self, tmp_path):
        """_log_llm_usage stores correct provider and model values."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        result = LLMResult(
            content="Content",
            provider="anthropic-claude",
            model="claude-sonnet-4-5",
            tokens_in=100,
            tokens_out=200,
            latency_ms=1200,
            cost_estimate=0.005,
        )
        await _log_llm_usage(result, db_path)

        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute("SELECT provider, model FROM llm_usage")
            row = await cursor.fetchone()
            assert row[0] == "anthropic-claude"
            assert row[1] == "claude-sonnet-4-5"
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_log_llm_usage_multiple_calls_inserts_multiple_rows(self, tmp_path):
        """Multiple _log_llm_usage calls insert multiple distinct rows."""
        db_path = str(tmp_path / "test.db")
        await _create_db_with_usage_table(db_path)

        result = _make_result("Response")
        await _log_llm_usage(result, db_path)
        await _log_llm_usage(result, db_path)
        await _log_llm_usage(result, db_path)

        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute("SELECT COUNT(*) FROM llm_usage")
            row = await cursor.fetchone()
            assert row[0] == 3
        finally:
            await db.close()
