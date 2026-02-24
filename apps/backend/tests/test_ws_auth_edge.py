"""Edge case tests for WebSocket authentication (Story 1-6).

Covers security and error scenarios not in test_ws_auth.py:
  - Auth with missing payload fields
  - Auth with extra/unexpected payload fields
  - Re-auth after already authenticated
  - Auth_reset creates a usable session (round-trip)
  - Non-dict messages
  - Malformed JSON
  - Auth with pairing token that is a real session (should fail)
  - Multiple auth attempts on the same connection
  - Auth with empty payload
  - Unknown message types when authenticated

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
    """Create a mock LLM provider for auth edge tests."""
    provider = MagicMock()
    provider.name = "mock-provider"
    result = LLMResult(
        content="Auth edge test response",
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
    return asyncio.run(create_pairing_token(db_path))


def _create_session(db_path: str, token: str) -> dict:
    return asyncio.run(create_session(db_path, token))


def _get_session(db_path: str, token: str) -> dict | None:
    return asyncio.run(get_session_by_token(db_path, token))


class TestAuthMalformedPayloads:
    """Test auth with malformed or missing payload fields."""

    def test_auth_with_missing_token_field(self, auth_client):
        """Auth message with no 'token' key in payload should return AUTH_INVALID_TOKEN."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_INVALID_TOKEN"

    def test_auth_with_null_token(self, auth_client):
        """Auth message with null token should return AUTH_INVALID_TOKEN."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": None}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_INVALID_TOKEN"

    def test_auth_with_numeric_token(self, auth_client):
        """Auth message with numeric token should return AUTH_INVALID_TOKEN."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": 12345}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_INVALID_TOKEN"

    def test_auth_with_no_payload(self, auth_client):
        """Auth message with no payload should be handled safely."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth"})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_INVALID_TOKEN"

    def test_auth_with_extra_fields_still_works(self, auth_client, test_settings):
        """Auth payload with extra fields should still authenticate if token is valid."""
        _create_session(test_settings.db_path, "valid-token-extra")

        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({
                "type": "auth",
                "payload": {
                    "token": "valid-token-extra",
                    "extra_field": "ignored",
                    "another": 42,
                },
            })
            ws.receive_json()  # status:idle after auth
            # Verify by sending a real message
            ws.send_json({"type": "chat", "payload": {"message": "hi"}})
            response = ws.receive_json()
            assert response["type"] == "status"
            assert response["payload"]["state"] == "thinking"


class TestReAuth:
    """Test re-authentication on an already authenticated connection."""

    def test_re_auth_with_same_token(self, auth_client, test_settings):
        """Re-authenticating with the same token should succeed silently."""
        _create_session(test_settings.db_path, "same-token")

        with auth_client.websocket_connect("/ws") as ws:
            # First auth
            ws.send_json({"type": "auth", "payload": {"token": "same-token"}})
            ws.receive_json()  # status:idle after first auth
            # Second auth (same token)
            ws.send_json({"type": "auth", "payload": {"token": "same-token"}})
            ws.receive_json()  # status:idle after second auth
            # Should still work
            ws.send_json({"type": "chat", "payload": {"message": "still working"}})
            response = ws.receive_json()
            assert response["type"] == "status"
            assert response["payload"]["state"] == "thinking"

    def test_re_auth_with_different_valid_token(self, auth_client, test_settings):
        """Re-authenticating with a different valid token should switch session."""
        _create_session(test_settings.db_path, "token-a")
        _create_session(test_settings.db_path, "token-b")

        with auth_client.websocket_connect("/ws") as ws:
            # Auth with token-a
            ws.send_json({"type": "auth", "payload": {"token": "token-a"}})
            ws.receive_json()  # status:idle after first auth
            # Re-auth with token-b
            ws.send_json({"type": "auth", "payload": {"token": "token-b"}})
            ws.receive_json()  # status:idle after second auth
            # Should work with new session
            ws.send_json({"type": "chat", "payload": {"message": "switched"}})
            response = ws.receive_json()
            assert response["type"] == "status"
            assert response["payload"]["state"] == "thinking"

    def test_re_auth_with_invalid_token_does_not_break_session(self, auth_client, test_settings):
        """Re-authenticating with an invalid token after valid auth should return error
        but the message loop continues (connection is not closed)."""
        _create_session(test_settings.db_path, "original-token")

        with auth_client.websocket_connect("/ws") as ws:
            # First auth succeeds
            ws.send_json({"type": "auth", "payload": {"token": "original-token"}})
            ws.receive_json()  # status:idle after auth
            # Second auth fails
            ws.send_json({"type": "auth", "payload": {"token": "bad-token"}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_INVALID_TOKEN"


class TestMalformedMessages:
    """Test handling of malformed WebSocket messages."""

    def test_invalid_json_returns_ws_invalid_json(self, auth_client):
        """Sending non-JSON text should return WS_INVALID_JSON error."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_text("this is not json {{{")
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_INVALID_JSON"

    def test_json_array_returns_ws_invalid_json(self, auth_client):
        """Sending a JSON array (not object) should return WS_INVALID_JSON."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_text(json.dumps([1, 2, 3]))
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_INVALID_JSON"

    def test_json_string_returns_ws_invalid_json(self, auth_client):
        """Sending a JSON primitive string should return WS_INVALID_JSON."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_text(json.dumps("just a string"))
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_INVALID_JSON"

    def test_json_number_returns_ws_invalid_json(self, auth_client):
        """Sending a JSON number should return WS_INVALID_JSON."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_text("42")
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_INVALID_JSON"

    def test_empty_string_returns_ws_invalid_json(self, auth_client):
        """Sending an empty string should return WS_INVALID_JSON."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_text("")
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_INVALID_JSON"

    def test_json_null_returns_ws_invalid_json(self, auth_client):
        """Sending JSON null should return WS_INVALID_JSON."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_text("null")
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_INVALID_JSON"


class TestAuthResetRoundTrip:
    """Test auth_reset creates a usable session."""

    def test_auth_reset_session_is_usable_for_subsequent_auth(self, auth_client, test_settings):
        """After auth_reset, the old session is gone but the connection
        continues to work (the internal authenticated flag stays true for
        the current connection)."""
        _create_session(test_settings.db_path, "reset-flow-token")

        with auth_client.websocket_connect("/ws") as ws:
            # Authenticate
            ws.send_json({"type": "auth", "payload": {"token": "reset-flow-token"}})
            ws.receive_json()  # status:idle after auth
            # Reset
            ws.send_json({"type": "auth_reset", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "status"
            assert response["payload"]["state"] == "idle"

            # Connection should still be usable (authenticated within this connection)
            ws.send_json({"type": "chat", "payload": {"message": "after reset"}})
            chat_response = ws.receive_json()
            assert chat_response["type"] == "status"
            assert chat_response["payload"]["state"] == "thinking"

    def test_auth_reset_old_token_no_longer_works_on_new_connection(self, auth_client, test_settings):
        """After auth_reset, the old token is invalidated and cannot be used
        on a new WS connection."""
        _create_session(test_settings.db_path, "invalidated-token")

        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": "invalidated-token"}})
            ws.receive_json()  # status:idle after auth
            ws.send_json({"type": "auth_reset", "payload": {}})
            ws.receive_json()  # status response from reset

        # New connection with old token should fail
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": "invalidated-token"}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_INVALID_TOKEN"


class TestUnknownMessageTypes:
    """Test handling of unknown message types when authenticated."""

    def test_unknown_type_returns_ws_unknown_type(self, auth_client, test_settings):
        """Authenticated connection receiving unknown message type gets WS_UNKNOWN_TYPE."""
        _create_session(test_settings.db_path, "unk-token")

        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": "unk-token"}})
            ws.receive_json()  # status:idle after auth
            ws.send_json({"type": "nonexistent_type", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_UNKNOWN_TYPE"
            assert "nonexistent_type" in response["payload"]["message"]

    def test_message_with_missing_type_when_unauthenticated(self, auth_client):
        """Message with no 'type' field when unauthenticated should return AUTH_REQUIRED."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"payload": {"message": "hello"}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_REQUIRED"

    def test_message_with_none_type_when_authenticated(self, auth_client, test_settings):
        """Message with type=None when authenticated returns WS_UNKNOWN_TYPE."""
        _create_session(test_settings.db_path, "none-type-token")

        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": "none-type-token"}})
            ws.receive_json()  # status:idle after auth
            ws.send_json({"type": None, "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_UNKNOWN_TYPE"


class TestPairingTokenSecurity:
    """Security tests for the pairing token flow."""

    def test_pairing_token_cannot_be_used_as_session_token(self, auth_client, test_settings):
        """A pairing token (is_pairing=1) should not authenticate as a regular session."""
        pairing_token = _create_pairing_token(test_settings.db_path)

        with auth_client.websocket_connect("/ws") as ws:
            # Try to use the pairing token directly as a session token (no pairing_token field)
            ws.send_json({"type": "auth", "payload": {"token": pairing_token}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_INVALID_TOKEN"

    def test_real_session_token_cannot_be_used_as_pairing_token(self, auth_client, test_settings):
        """A real session token cannot be used in the pairing_token field."""
        _create_session(test_settings.db_path, "real-session")

        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({
                "type": "auth",
                "payload": {
                    "token": str(uuid.uuid4()),
                    "pairing_token": "real-session",  # This is a real token, not a pairing token
                },
            })
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_PAIRING_FAILED"

    def test_empty_pairing_token_treated_as_no_pairing_token(self, auth_client):
        """Empty pairing token string is falsy in Python, so it falls through
        to regular token check and returns AUTH_INVALID_TOKEN (since the random
        session token is not in the database)."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({
                "type": "auth",
                "payload": {
                    "token": str(uuid.uuid4()),
                    "pairing_token": "",
                },
            })
            response = ws.receive_json()
            assert response["type"] == "error"
            # Empty pairing_token is falsy → skips pairing flow → AUTH_INVALID_TOKEN
            assert response["payload"]["code"] == "AUTH_INVALID_TOKEN"

    def test_pairing_token_cannot_be_reused_across_connections(self, auth_client, test_settings):
        """Once a pairing token is consumed, it cannot be used again on a new connection."""
        pairing_token = _create_pairing_token(test_settings.db_path)

        # First connection: consume the pairing token
        with auth_client.websocket_connect("/ws") as ws:
            session_token_1 = str(uuid.uuid4())
            ws.send_json({
                "type": "auth",
                "payload": {
                    "token": session_token_1,
                    "pairing_token": pairing_token,
                },
            })
            ws.receive_json()  # status:idle after auth
            ws.send_json({"type": "sync", "payload": {}})
            ws.receive_json()  # consume the module_list response

        # Second connection: try the same pairing token
        with auth_client.websocket_connect("/ws") as ws:
            session_token_2 = str(uuid.uuid4())
            ws.send_json({
                "type": "auth",
                "payload": {
                    "token": session_token_2,
                    "pairing_token": pairing_token,
                },
            })
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "AUTH_PAIRING_FAILED"


class TestMultipleAuthAttempts:
    """Test multiple auth attempts on the same connection."""

    def test_auth_fails_then_succeeds(self, auth_client, test_settings):
        """An invalid auth followed by a valid auth should succeed."""
        _create_session(test_settings.db_path, "valid-retry-token")

        with auth_client.websocket_connect("/ws") as ws:
            # First: invalid
            ws.send_json({"type": "auth", "payload": {"token": "wrong"}})
            err = ws.receive_json()
            assert err["payload"]["code"] == "AUTH_INVALID_TOKEN"

            # Second: valid
            ws.send_json({"type": "auth", "payload": {"token": "valid-retry-token"}})
            ws.receive_json()  # status:idle after auth
            # Should be authenticated now
            ws.send_json({"type": "chat", "payload": {"message": "recovered"}})
            response = ws.receive_json()
            assert response["type"] == "status"
            assert response["payload"]["state"] == "thinking"

    def test_multiple_failed_auths_do_not_crash(self, auth_client):
        """Sending many failed auth messages should not crash the server."""
        with auth_client.websocket_connect("/ws") as ws:
            for i in range(10):
                ws.send_json({"type": "auth", "payload": {"token": f"bad-{i}"}})
                response = ws.receive_json()
                assert response["type"] == "error"
                assert response["payload"]["code"] == "AUTH_INVALID_TOKEN"


class TestErrorResponseFormat:
    """Verify all error responses include the required fields."""

    def test_auth_required_has_all_fields(self, auth_client):
        """AUTH_REQUIRED error should have code, message, and agent_action."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "chat", "payload": {"message": "hi"}})
            response = ws.receive_json()
            payload = response["payload"]
            assert "code" in payload
            assert "message" in payload
            assert "agent_action" in payload
            assert payload["code"] == "AUTH_REQUIRED"

    def test_auth_invalid_token_has_all_fields(self, auth_client):
        """AUTH_INVALID_TOKEN error should have code, message, and agent_action."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": "nonexistent"}})
            response = ws.receive_json()
            payload = response["payload"]
            assert "code" in payload
            assert "message" in payload
            assert "agent_action" in payload

    def test_auth_pairing_failed_has_all_fields(self, auth_client):
        """AUTH_PAIRING_FAILED error should have code, message, and agent_action."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({
                "type": "auth",
                "payload": {
                    "token": str(uuid.uuid4()),
                    "pairing_token": "invalid-pairing",
                },
            })
            response = ws.receive_json()
            payload = response["payload"]
            assert "code" in payload
            assert "message" in payload
            assert "agent_action" in payload

    def test_ws_invalid_json_has_all_fields(self, auth_client):
        """WS_INVALID_JSON error should have code, message, and agent_action."""
        with auth_client.websocket_connect("/ws") as ws:
            ws.send_text("not json!")
            response = ws.receive_json()
            payload = response["payload"]
            assert "code" in payload
            assert "message" in payload
            assert "agent_action" in payload

    def test_ws_unknown_type_has_all_fields(self, auth_client, test_settings):
        """WS_UNKNOWN_TYPE error should have code, message, and agent_action."""
        _create_session(test_settings.db_path, "format-token")

        with auth_client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": "format-token"}})
            ws.receive_json()  # status:idle after auth
            ws.send_json({"type": "unknown_xyz", "payload": {}})
            response = ws.receive_json()
            payload = response["payload"]
            assert "code" in payload
            assert "message" in payload
            assert "agent_action" in payload
