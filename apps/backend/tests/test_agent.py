"""Tests for agent.py — handle_chat orchestration.

Tests handle_chat with mock provider:
  - Happy path: sends thinking status, chat_stream chunks, idle status
  - LLM error: sends error message and idle status
  - Streaming chunks: sends delta messages and done message
"""

import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agent import handle_chat
from app.llm.base import LLMResult


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
    async def test_provider_called_with_message(
        self, ws, mock_provider, tmp_path
    ):
        """provider.execute() must be called with the chat message as prompt."""
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

        mock_provider.execute.assert_called_once_with(prompt="Tell me a story")
