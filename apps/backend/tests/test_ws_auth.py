"""WebSocket authentication tests.

Tests auth gate, pairing flow, session management, and error handling
for the WS endpoint authentication layer.

Note: Tests that verify auth success by sending a chat message now expect
status:thinking as the first response (story 2.1 replaced the echo stub with
agent.handle_chat). The auth_client fixture mocks the LLM provider.
"""

import asyncio
import importlib
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import aiosqlite
import pytest
from starlette.testclient import TestClient

from app.llm.base import LLMResult
from app.sessions import create_pairing_token, create_session, get_session_by_token


async def _setup_auth_db(db_path: str) -> None:
    """Create all tables matching migrations 001 + 002."""
    db = await aiosqlite.connect(db_path)
    try:
        await db.execute("PRAGMA journal_mode=WAL;")
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
        await db.execute(
            """CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                token TEXT UNIQUE NOT NULL,
                user_id TEXT NOT NULL DEFAULT 'default',
                created_at TEXT NOT NULL,
                last_seen TEXT NOT NULL,
                is_pairing INTEGER DEFAULT 0
            )"""
        )
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
            "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)"
        )
        await db.execute("INSERT OR IGNORE INTO schema_version (version) VALUES (2)")
        await db.commit()
    finally:
        await db.close()


def _make_mock_provider() -> MagicMock:
    """Create a mock LLM provider for auth tests."""
    provider = MagicMock()
    provider.name = "mock-provider"
    result = LLMResult(
        content="Auth test response",
        provider="mock-provider",
        model="mock-model",
        tokens_in=3,
        tokens_out=5,
        latency_ms=10,
        cost_estimate=0.0,
    )
    provider.execute = AsyncMock(return_value=result)
    return provider


@pytest.fixture
def auth_client(test_settings, tmp_path):
    """Create a test client with a database ready for auth tests.

    Mocks the LLM provider so chat tests don't call the real Claude CLI.
    """
    asyncio.run(_setup_auth_db(test_settings.db_path))
    import app.main as main_mod
    importlib.reload(main_mod)
    mock_provider = _make_mock_provider()
    with patch.object(main_mod, "get_provider", return_value=mock_provider):
        yield TestClient(main_mod.app)


def _create_pairing_token(db_path: str) -> str:
    """Helper to create a pairing token synchronously."""
    return asyncio.run(create_pairing_token(db_path))


def _create_session(db_path: str, token: str) -> dict:
    """Helper to create a session synchronously."""
    return asyncio.run(create_session(db_path, token))


def _get_session(db_path: str, token: str) -> dict | None:
    """Helper to look up a session synchronously."""
    return asyncio.run(get_session_by_token(db_path, token))


class TestAuthRequired:
    """Test that unauthenticated connections receive AUTH_REQUIRED errors."""

    def test_chat_without_auth_returns_auth_required(self, auth_client):
        """Test that sending a chat message without auth gets AUTH_REQUIRED."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "chat", "payload": {"message": "hello"}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_REQUIRED"
            assert "agent_action" in response["payload"]

    def test_sync_without_auth_returns_auth_required(self, auth_client):
        """Test that sending a sync message without auth gets AUTH_REQUIRED."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_REQUIRED"

    def test_log_without_auth_returns_auth_required(self, auth_client):
        """Test that sending a log message without auth gets AUTH_REQUIRED."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({
                "type": "log",
                "payload": {"layer": "test", "event": "e", "severity": "info", "context": {}},
            })
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_REQUIRED"

    def test_multiple_messages_without_auth_all_rejected(self, auth_client):
        """Test that all messages before auth are rejected."""
        with auth_client.websocket_connect("/ws") as ws:
            for msg_type in ["chat", "sync", "log"]:
                ws.send_json({"type": msg_type, "payload": {}})
                response = ws.receive_json()
                assert response["type"] == "error"
                assert response["payload"]["code"] == "AUTH_REQUIRED"


class TestAuthWithValidToken:
    """Test authentication with valid session tokens."""

    def test_auth_with_valid_session_token_allows_subsequent_messages(self, auth_client, test_settings):
        """Test that auth with a valid token allows subsequent messages."""
        session = _create_session(test_settings.db_path, "valid-token")

        with auth_client.websocket_connect("/ws") as ws:
            # Authenticate
            ws.send_json({"type": "auth", "payload": {"token": "valid-token"}})
            # No error response means success — send a real message
            ws.send_json({"type": "chat", "payload": {"message": "hello"}})
            response = ws.receive_json()
            # Story 2.1: first response is now status:thinking (not chat_stream)
            assert response["type"] == "status"
            assert response["payload"]["state"] == "thinking"

    def test_auth_with_valid_token_updates_last_seen(self, auth_client, test_settings):
        """Test that successful auth updates the last_seen timestamp."""
        session = _create_session(test_settings.db_path, "seen-token")
        original_last_seen = session["last_seen"]

        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": "seen-token"}})
            # Send a message to ensure auth was processed
            ws.send_json({"type": "sync", "payload": {}})
            ws.receive_json()

        # Check last_seen was updated
        updated = _get_session(test_settings.db_path, "seen-token")
        assert updated is not None
        assert updated["last_seen"] >= original_last_seen


class TestAuthWithInvalidToken:
    """Test authentication with invalid tokens."""

    def test_auth_with_invalid_token_returns_error(self, auth_client):
        """Test that auth with an unknown token returns AUTH_INVALID_TOKEN."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": "bad-token"}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_INVALID_TOKEN"

    def test_auth_with_empty_token_returns_error(self, auth_client):
        """Test that auth with an empty token returns error."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": ""}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_INVALID_TOKEN"


class TestAuthWithPairingToken:
    """Test authentication using pairing tokens."""

    def test_auth_with_pairing_token_creates_session(self, auth_client, test_settings):
        """Test that auth with a valid pairing token creates a real session."""
        pairing_token = _create_pairing_token(test_settings.db_path)

        with auth_client.websocket_connect("/ws") as ws:
            session_token = str(uuid.uuid4())
            ws.send_json({
                "type": "auth",
                "payload": {"token": session_token, "pairing_token": pairing_token},
            })
            # No error = success. Verify by sending a real message.
            ws.send_json({"type": "chat", "payload": {"message": "paired!"}})
            response = ws.receive_json()
            # Story 2.1: first response is status:thinking (not chat_stream)
            assert response["type"] == "status"
            assert response["payload"]["state"] == "thinking"

        # Verify real session was created
        session = _get_session(test_settings.db_path, session_token)
        assert session is not None
        assert session["is_pairing"] == 0

    def test_pairing_token_is_consumed_after_use(self, auth_client, test_settings):
        """Test that pairing token is deleted after successful consumption."""
        pairing_token = _create_pairing_token(test_settings.db_path)

        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({
                "type": "auth",
                "payload": {"token": str(uuid.uuid4()), "pairing_token": pairing_token},
            })
            ws.send_json({"type": "sync", "payload": {}})
            ws.receive_json()

        # Pairing token should be gone
        found = _get_session(test_settings.db_path, pairing_token)
        assert found is None

    def test_invalid_pairing_token_returns_error(self, auth_client, test_settings):
        """Test that an invalid pairing token returns AUTH_PAIRING_FAILED."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({
                "type": "auth",
                "payload": {"token": str(uuid.uuid4()), "pairing_token": "bad-pairing"},
            })
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_PAIRING_FAILED"


class TestAuthReset:
    """Test auth_reset message handling."""

    def test_auth_reset_when_authenticated_returns_new_token(self, auth_client, test_settings):
        """Test that auth_reset creates a new session and returns status."""
        _create_session(test_settings.db_path, "reset-me")

        with auth_client.websocket_connect("/ws") as ws:
            # Authenticate first
            ws.send_json({"type": "auth", "payload": {"token": "reset-me"}})
            # Now reset
            ws.send_json({"type": "auth_reset", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "status"
            assert response["payload"]["state"] == "idle"

    def test_auth_reset_invalidates_old_session(self, auth_client, test_settings):
        """Test that auth_reset deletes the old session."""
        _create_session(test_settings.db_path, "old-token")

        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": "old-token"}})
            ws.send_json({"type": "auth_reset", "payload": {}})
            ws.receive_json()  # status response

        # Old token should be gone
        old = _get_session(test_settings.db_path, "old-token")
        assert old is None

    def test_auth_reset_when_not_authenticated_returns_auth_required(self, auth_client):
        """Test that auth_reset without prior auth returns AUTH_REQUIRED."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth_reset", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_REQUIRED"


class TestReconnection:
    """Test reconnection with existing session token."""

    def test_reconnect_with_same_token_succeeds(self, auth_client, test_settings):
        """Test that reconnecting with the same token works."""
        _create_session(test_settings.db_path, "persist-token")

        # First connection
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": "persist-token"}})
            ws.send_json({"type": "chat", "payload": {"message": "first"}})
            # Story 2.1: first response is status:thinking (agent.handle_chat)
            r = ws.receive_json()
            assert r["type"] == "status"
            assert r["payload"]["state"] == "thinking"

        # Second connection (simulates reconnect)
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": "persist-token"}})
            ws.send_json({"type": "chat", "payload": {"message": "second"}})
            r = ws.receive_json()
            assert r["type"] == "status"
            assert r["payload"]["state"] == "thinking"

    def test_reconnect_updates_last_seen(self, auth_client, test_settings):
        """Test that reconnection updates last_seen timestamp."""
        session = _create_session(test_settings.db_path, "reconnect-token")

        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": "reconnect-token"}})
            ws.send_json({"type": "sync", "payload": {}})
            ws.receive_json()

        updated = _get_session(test_settings.db_path, "reconnect-token")
        assert updated is not None
        assert updated["last_seen"] >= session["last_seen"]


class TestPairingTokenOnStartup:
    """Test pairing token generation on startup."""

    def test_health_endpoint_includes_pairing_available(self, auth_client, test_settings):
        """Test that /health includes pairing_available field."""
        # Create a pairing token (simulating startup)
        _create_pairing_token(test_settings.db_path)

        import app.main as main_mod
        importlib.reload(main_mod)
        client = TestClient(main_mod.app)

        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "pairing_available" in data
        assert isinstance(data["pairing_available"], bool)
