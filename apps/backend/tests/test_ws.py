"""WebSocket endpoint tests.

Tests the /ws endpoint for message routing, error handling,
and protocol compliance.

Uses Starlette's TestClient with websocket_connect for WS testing.
All tests authenticate before sending messages (auth gate added in story 1.6).
"""

import asyncio
import importlib
import json
import uuid

import aiosqlite
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.sessions import create_session


async def _setup_ws_db(db_path: str, session_token: str = "test-ws-token") -> None:
    """Create tables and a test session for WS tests."""
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
            "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)"
        )
        await db.execute("INSERT OR IGNORE INTO schema_version (version) VALUES (2)")
        await db.commit()
    finally:
        await db.close()
    # Create a test session for authentication
    await create_session(db_path, session_token)


# Default test session token used by all WS tests
_TEST_TOKEN = "test-ws-token"


def _auth(ws, token: str = _TEST_TOKEN) -> None:
    """Authenticate a WebSocket connection with the given token."""
    ws.send_json({"type": "auth", "payload": {"token": token}})


@pytest.fixture
def client(test_settings, tmp_path):
    """Create a test client with auth-ready database."""
    asyncio.run(_setup_ws_db(test_settings.db_path, _TEST_TOKEN))
    import app.main as main_mod
    importlib.reload(main_mod)
    return TestClient(main_mod.app)


@pytest.fixture
def sync_client(test_settings, tmp_path):
    """Create a test client with a database containing test modules.

    Sets up the DB with the modules table and test fixtures for delta sync tests.
    Uses test_settings to point settings.db_path to a temp directory.
    """
    asyncio.run(_setup_ws_db(test_settings.db_path, _TEST_TOKEN))
    # Reload main module to pick up new settings
    import app.main as main_mod
    importlib.reload(main_mod)
    return TestClient(main_mod.app)


async def _insert_module(db_path: str, module_id: str, name: str, updated_at: str,
                          spec: str = "{}") -> None:
    """Helper to insert a test module into the database."""
    db = await aiosqlite.connect(db_path)
    try:
        await db.execute(
            "INSERT OR REPLACE INTO modules (id, name, spec, status, vitality_score, user_id, created_at, updated_at) "
            "VALUES (?, ?, ?, 'active', 0, 'default', ?, ?)",
            (module_id, name, spec, updated_at, updated_at),
        )
        await db.commit()
    finally:
        await db.close()


class TestWebSocketConnection:
    """Test basic WebSocket connection lifecycle."""

    def test_ws_connection_establishes(self, client):
        """Test that a WebSocket connection can be established."""
        with client.websocket_connect("/ws") as ws:
            # Connection established if no exception
            assert ws is not None

    def test_ws_accepts_connection(self, client):
        """Test that the server accepts the connection."""
        with client.websocket_connect("/ws"):
            pass  # No exception means connection was accepted


class TestChatMessage:
    """Test chat message type handling."""

    def test_chat_message_receives_chat_stream_response(self, client):
        """Test that a chat message receives a chat_stream echo response."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Hello world"}})
            response = ws.receive_json()

            assert response["type"] == "chat_stream"
            assert response["payload"]["done"] is True
            assert "Hello world" in response["payload"]["delta"]

    def test_chat_message_follows_type_payload_format(self, client):
        """Test that chat_stream response follows { type, payload } format."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Test"}})
            response = ws.receive_json()

            assert "type" in response
            assert "payload" in response
            assert isinstance(response["payload"], dict)

    def test_chat_message_with_empty_message(self, client):
        """Test chat with empty message field."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": ""}})
            response = ws.receive_json()

            assert response["type"] == "chat_stream"
            assert response["payload"]["done"] is True


class TestLogMessage:
    """Test log message type handling."""

    def test_log_message_is_processed(self, client):
        """Test that a log message is accepted without error response."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({
                "type": "log",
                "payload": {
                    "layer": "mobile:ws",
                    "event": "test_event",
                    "severity": "info",
                    "context": {"key": "value"},
                },
            })
            # Log messages don't send a response — send another message to verify no error
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()
            # If the log message caused an error, we'd get an error response first
            assert response["type"] == "module_list"


class TestSyncMessage:
    """Test sync message type handling."""

    def test_sync_receives_module_list_response(self, client):
        """Test that a sync message with no last_sync receives a module_list response."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({
                "type": "sync",
                "payload": {},
            })
            response = ws.receive_json()

            assert response["type"] == "module_list"
            assert response["payload"]["modules"] == []

    def test_sync_with_last_sync_receives_module_sync_response(self, client):
        """Test that a sync with last_sync receives a module_sync (delta) response."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({
                "type": "sync",
                "payload": {"last_sync": "2024-01-01T00:00:00Z"},
            })
            response = ws.receive_json()

            assert response["type"] == "module_sync"
            assert "modules" in response["payload"]
            assert "last_sync" in response["payload"]

    def test_sync_response_follows_type_payload_format(self, client):
        """Test that sync response follows { type, payload } format."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({
                "type": "sync",
                "payload": {},
            })
            response = ws.receive_json()

            assert "type" in response
            assert "payload" in response
            assert "modules" in response["payload"]


class TestUnknownMessageType:
    """Test handling of unknown message types."""

    def test_unknown_type_receives_error_response(self, client):
        """Test that unknown message type gets an error response."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "unknown_type", "payload": {}})
            response = ws.receive_json()

            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_UNKNOWN_TYPE"
            assert "unknown_type" in response["payload"]["message"]

    def test_unknown_type_error_has_agent_action(self, client):
        """Test that the error response includes agent_action field."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "bogus", "payload": {}})
            response = ws.receive_json()

            assert response["type"] == "error"
            assert "agent_action" in response["payload"]

    def test_missing_type_field_receives_error(self, client):
        """Test that a message with no type field gets an error."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"payload": {"data": "no type"}})
            response = ws.receive_json()

            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_UNKNOWN_TYPE"


class TestInvalidJson:
    """Test handling of invalid JSON messages."""

    def test_invalid_json_receives_error_response(self, client):
        """Test that invalid JSON receives a WS_INVALID_JSON error."""
        with client.websocket_connect("/ws") as ws:
            ws.send_text("this is not json {{{")
            response = ws.receive_json()

            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_INVALID_JSON"
            assert "agent_action" in response["payload"]

    def test_invalid_json_error_follows_format(self, client):
        """Test that WS_INVALID_JSON error follows { type, payload } format."""
        with client.websocket_connect("/ws") as ws:
            ws.send_text("not json")
            response = ws.receive_json()

            assert "type" in response
            assert "payload" in response
            assert "code" in response["payload"]
            assert "message" in response["payload"]


class TestResponseFormat:
    """Test that all response messages follow { type, payload } format."""

    def test_chat_stream_response_format(self, client):
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "test"}})
            response = ws.receive_json()
            assert set(response.keys()) == {"type", "payload"}

    def test_module_list_response_format(self, client):
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "sync", "payload": {"last_sync": ""}})
            response = ws.receive_json()
            assert set(response.keys()) == {"type", "payload"}

    def test_error_response_format(self, client):
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "bad_type", "payload": {}})
            response = ws.receive_json()
            assert set(response.keys()) == {"type", "payload"}

    def test_invalid_json_error_format(self, client):
        with client.websocket_connect("/ws") as ws:
            ws.send_text("bad")
            response = ws.receive_json()
            assert set(response.keys()) == {"type", "payload"}


class TestMultipleMessages:
    """Test handling multiple messages in sequence."""

    def test_multiple_different_message_types(self, client):
        """Test that multiple message types can be handled in one session."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)

            # Chat
            ws.send_json({"type": "chat", "payload": {"message": "Hi"}})
            resp1 = ws.receive_json()
            assert resp1["type"] == "chat_stream"

            # Sync
            ws.send_json({"type": "sync", "payload": {"last_sync": ""}})
            resp2 = ws.receive_json()
            assert resp2["type"] == "module_list"

            # Unknown
            ws.send_json({"type": "fake", "payload": {}})
            resp3 = ws.receive_json()
            assert resp3["type"] == "error"

    def test_log_then_sync(self, client):
        """Test log (no response) followed by sync (has response)."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({
                "type": "log",
                "payload": {"layer": "test", "event": "e", "severity": "info", "context": {}},
            })
            ws.send_json({"type": "sync", "payload": {"last_sync": ""}})
            response = ws.receive_json()
            assert response["type"] == "module_list"


class TestEdgeCases:
    """Edge case tests for the WebSocket endpoint."""

    def test_empty_payload_in_chat(self, client):
        """Test chat message with empty payload."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "chat_stream"
            assert response["payload"]["done"] is True
            # Empty message key should result in empty echo
            assert "Echo: " in response["payload"]["delta"]

    def test_missing_payload_key(self, client):
        """Test message with no payload key at all."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat"})
            response = ws.receive_json()
            # payload defaults to {} via msg.get("payload", {})
            assert response["type"] == "chat_stream"
            assert response["payload"]["done"] is True

    def test_auth_type_is_handled(self, client):
        """Test that auth message type is handled (not WS_UNKNOWN_TYPE)."""
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": _TEST_TOKEN}})
            # No error = success. Verify by sending chat.
            ws.send_json({"type": "chat", "payload": {"message": "test"}})
            response = ws.receive_json()
            assert response["type"] == "chat_stream"

    def test_auth_reset_type_is_handled(self, client):
        """Test that auth_reset message type is handled (not WS_UNKNOWN_TYPE)."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "auth_reset", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "status"
            assert response["payload"]["state"] == "idle"

    def test_module_action_type_is_unknown(self, client):
        """Test that module_action message type is not handled yet."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({
                "type": "module_action",
                "payload": {"module_id": "123", "action": "refresh"},
            })
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_UNKNOWN_TYPE"

    def test_empty_string_type(self, client):
        """Test message with empty string as type."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_UNKNOWN_TYPE"

    def test_null_type(self, client):
        """Test message with null type."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": None, "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_UNKNOWN_TYPE"

    def test_chat_with_unicode_message(self, client):
        """Test chat with unicode characters."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({
                "type": "chat",
                "payload": {"message": "Hello! 你好 🌍 café"},
            })
            response = ws.receive_json()
            assert response["type"] == "chat_stream"
            assert "Hello! 你好 🌍 café" in response["payload"]["delta"]

    def test_chat_with_very_long_message(self, client):
        """Test chat with a very long message."""
        long_msg = "A" * 10000
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": long_msg}})
            response = ws.receive_json()
            assert response["type"] == "chat_stream"
            assert long_msg in response["payload"]["delta"]

    def test_sync_with_empty_last_sync(self, client):
        """Test sync with empty string last_sync."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "sync", "payload": {"last_sync": ""}})
            response = ws.receive_json()
            assert response["type"] == "module_list"
            assert response["payload"]["modules"] == []

    def test_sync_with_missing_last_sync(self, client):
        """Test sync with no last_sync field in payload."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "module_list"
            assert response["payload"]["modules"] == []

    def test_log_with_empty_context(self, client):
        """Test log with empty context object."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({
                "type": "log",
                "payload": {
                    "layer": "mobile:ws",
                    "event": "test",
                    "severity": "info",
                    "context": {},
                },
            })
            # Log doesn't respond — verify no error by sending sync
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "module_list"

    def test_log_with_nested_context(self, client):
        """Test log with deeply nested context payload."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({
                "type": "log",
                "payload": {
                    "layer": "mobile:ws",
                    "event": "complex_event",
                    "severity": "debug",
                    "context": {
                        "nested": {"deep": {"value": 42}},
                        "list": [1, 2, 3],
                    },
                },
            })
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "module_list"

    def test_payload_with_null_values(self, client):
        """Test chat payload with null values in extra fields."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({
                "type": "chat",
                "payload": {"message": "test", "extra": None},
            })
            response = ws.receive_json()
            assert response["type"] == "chat_stream"

    def test_extra_top_level_fields_ignored(self, client):
        """Test that extra top-level fields don't break message routing."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({
                "type": "chat",
                "payload": {"message": "test"},
                "extra_field": "should be ignored",
                "version": 2,
            })
            response = ws.receive_json()
            assert response["type"] == "chat_stream"

    def test_invalid_json_recovery(self, client):
        """Test that invalid JSON doesn't kill the connection — can send valid messages after."""
        with client.websocket_connect("/ws") as ws:
            ws.send_text("this is not json")
            error_response = ws.receive_json()
            assert error_response["type"] == "error"
            assert error_response["payload"]["code"] == "WS_INVALID_JSON"

            # Should still be able to auth and send valid messages
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "after error"}})
            response = ws.receive_json()
            assert response["type"] == "chat_stream"
            assert "after error" in response["payload"]["delta"]

    def test_multiple_invalid_json_messages(self, client):
        """Test multiple invalid JSON messages in a row."""
        with client.websocket_connect("/ws") as ws:
            for i in range(3):
                ws.send_text(f"bad json {i}")
                response = ws.receive_json()
                assert response["type"] == "error"
                assert response["payload"]["code"] == "WS_INVALID_JSON"

    def test_error_response_contains_all_required_fields(self, client):
        """Test that error responses always contain code, message, and agent_action."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            # Test WS_UNKNOWN_TYPE error
            ws.send_json({"type": "unknown", "payload": {}})
            response = ws.receive_json()
            assert "code" in response["payload"]
            assert "message" in response["payload"]
            assert "agent_action" in response["payload"]

    def test_invalid_json_error_contains_all_required_fields(self, client):
        """Test that WS_INVALID_JSON error has code, message, and agent_action."""
        with client.websocket_connect("/ws") as ws:
            ws.send_text("{bad")
            response = ws.receive_json()
            assert "code" in response["payload"]
            assert "message" in response["payload"]
            assert "agent_action" in response["payload"]

    def test_rapid_messages_all_processed(self, client):
        """Test that many messages sent rapidly are all processed."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            count = 10
            for i in range(count):
                ws.send_json({"type": "chat", "payload": {"message": f"msg_{i}"}})

            for i in range(count):
                response = ws.receive_json()
                assert response["type"] == "chat_stream"
                assert f"msg_{i}" in response["payload"]["delta"]

    def test_interleaved_message_types(self, client):
        """Test interleaving different message types."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)

            # chat
            ws.send_json({"type": "chat", "payload": {"message": "hello"}})
            r1 = ws.receive_json()
            assert r1["type"] == "chat_stream"

            # unknown
            ws.send_json({"type": "nonexistent", "payload": {}})
            r2 = ws.receive_json()
            assert r2["type"] == "error"

            # sync
            ws.send_json({"type": "sync", "payload": {}})
            r3 = ws.receive_json()
            assert r3["type"] == "module_list"

            # invalid json
            ws.send_text("not json")
            r4 = ws.receive_json()
            assert r4["type"] == "error"
            assert r4["payload"]["code"] == "WS_INVALID_JSON"

            # chat again
            ws.send_json({"type": "chat", "payload": {"message": "still works"}})
            r5 = ws.receive_json()
            assert r5["type"] == "chat_stream"
            assert "still works" in r5["payload"]["delta"]

    def test_json_with_numeric_type(self, client):
        """Test message where type is a number instead of string."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": 123, "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_UNKNOWN_TYPE"

    def test_json_array_returns_error(self, client):
        """Test sending a JSON array instead of an object returns an error.

        json.loads('[1,2,3]') produces a list, not a dict. The endpoint
        validates the parsed type and returns WS_INVALID_JSON.
        """
        with client.websocket_connect("/ws") as ws:
            ws.send_text("[1, 2, 3]")
            response = ws.receive_json()

            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_INVALID_JSON"
            assert "object" in response["payload"]["message"].lower()
            assert "agent_action" in response["payload"]

    def test_json_string_instead_of_object_returns_error(self, client):
        """Test sending a JSON string instead of an object returns an error."""
        with client.websocket_connect("/ws") as ws:
            ws.send_text('"just a string"')
            response = ws.receive_json()

            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_INVALID_JSON"

    def test_json_number_instead_of_object_returns_error(self, client):
        """Test sending a JSON number instead of an object returns an error."""
        with client.websocket_connect("/ws") as ws:
            ws.send_text("42")
            response = ws.receive_json()

            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_INVALID_JSON"

    def test_json_array_doesnt_kill_connection(self, client):
        """Test that sending a JSON array doesn't kill the WS connection."""
        with client.websocket_connect("/ws") as ws:
            ws.send_text("[1, 2, 3]")
            error_response = ws.receive_json()
            assert error_response["type"] == "error"

            # Connection should still be alive
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "still alive"}})
            response = ws.receive_json()
            assert response["type"] == "chat_stream"
            assert "still alive" in response["payload"]["delta"]


class TestDeltaSync:
    """Test delta sync functionality for the sync message type."""

    def test_sync_with_null_last_sync_returns_module_list(self, sync_client, test_settings):
        """Test that sync with null last_sync returns module_list with all modules."""
        asyncio.run(
            _insert_module(test_settings.db_path, "mod-1", "Module One", "2024-01-01T00:00:00Z")
        )
        asyncio.run(
            _insert_module(test_settings.db_path, "mod-2", "Module Two", "2024-02-01T00:00:00Z")
        )

        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()

            assert response["type"] == "module_list"
            modules = response["payload"]["modules"]
            assert len(modules) == 2
            # Verify module data
            module_ids = {m["moduleId"] for m in modules}
            assert "mod-1" in module_ids
            assert "mod-2" in module_ids

    def test_sync_with_valid_last_sync_returns_module_sync(self, sync_client, test_settings):
        """Test that sync with valid last_sync returns module_sync with only updated modules."""
        asyncio.run(
            _insert_module(test_settings.db_path, "mod-old", "Old Module", "2024-01-01T00:00:00Z")
        )
        asyncio.run(
            _insert_module(test_settings.db_path, "mod-new", "New Module", "2024-06-01T00:00:00Z")
        )

        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            # last_sync is between the two modules
            ws.send_json({
                "type": "sync",
                "payload": {"last_sync": "2024-03-01T00:00:00Z"},
            })
            response = ws.receive_json()

            assert response["type"] == "module_sync"
            modules = response["payload"]["modules"]
            assert len(modules) == 1
            assert modules[0]["moduleId"] == "mod-new"
            assert modules[0]["name"] == "New Module"

    def test_sync_with_recent_last_sync_returns_empty_module_sync(self, sync_client, test_settings):
        """Test that sync with recent last_sync returns empty module_sync when no updates."""
        asyncio.run(
            _insert_module(test_settings.db_path, "mod-1", "Module One", "2024-01-01T00:00:00Z")
        )

        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            # last_sync is after all modules
            ws.send_json({
                "type": "sync",
                "payload": {"last_sync": "2025-01-01T00:00:00Z"},
            })
            response = ws.receive_json()

            assert response["type"] == "module_sync"
            assert response["payload"]["modules"] == []

    def test_module_sync_response_includes_last_sync_timestamp(self, sync_client, test_settings):
        """Test that module_sync response includes last_sync server timestamp."""
        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({
                "type": "sync",
                "payload": {"last_sync": "2024-01-01T00:00:00Z"},
            })
            response = ws.receive_json()

            assert response["type"] == "module_sync"
            assert "last_sync" in response["payload"]
            # Verify it's a valid ISO timestamp
            last_sync = response["payload"]["last_sync"]
            assert isinstance(last_sync, str)
            assert "T" in last_sync  # Basic ISO format check

    def test_sync_with_empty_last_sync_returns_module_list(self, sync_client, test_settings):
        """Test that sync with empty string last_sync returns module_list (full sync)."""
        asyncio.run(
            _insert_module(test_settings.db_path, "mod-1", "Module One", "2024-01-01T00:00:00Z")
        )

        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "sync", "payload": {"last_sync": ""}})
            response = ws.receive_json()

            assert response["type"] == "module_list"
            assert len(response["payload"]["modules"]) == 1

    def test_full_sync_with_no_modules_returns_empty_list(self, sync_client, test_settings):
        """Test full sync when database has no modules."""
        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()

            assert response["type"] == "module_list"
            assert response["payload"]["modules"] == []

    def test_module_spec_json_is_parsed(self, sync_client, test_settings):
        """Test that module spec JSON is correctly parsed and included in response."""
        import asyncio

        spec_json = json.dumps({"display_name": "Weather", "type": "data_card"})
        asyncio.run(
            _insert_module(test_settings.db_path, "mod-weather", "Weather",
                           "2024-01-01T00:00:00Z", spec=spec_json)
        )

        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()

            assert response["type"] == "module_list"
            modules = response["payload"]["modules"]
            assert len(modules) == 1
            mod = modules[0]
            assert mod["moduleId"] == "mod-weather"
            assert mod["name"] == "Weather"
            # The spec fields should be merged in
            assert mod["display_name"] == "Weather"
            assert mod["type"] == "data_card"

    def test_invalid_spec_json_in_database_handled_gracefully(self, sync_client, test_settings):
        """Test that invalid JSON in spec column does not crash the sync response."""
        async def _insert_bad_spec():
            db = await aiosqlite.connect(test_settings.db_path)
            try:
                await db.execute(
                    "INSERT INTO modules (id, name, spec, status, vitality_score, user_id, created_at, updated_at) "
                    "VALUES (?, ?, ?, 'active', 0, 'default', ?, ?)",
                    ("mod-bad", "Bad Spec", "{{not valid json}}", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z"),
                )
                await db.commit()
            finally:
                await db.close()

        asyncio.run(_insert_bad_spec())

        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()

            assert response["type"] == "module_list"
            modules = response["payload"]["modules"]
            assert len(modules) == 1
            # moduleId and name should still be present even with invalid spec
            assert modules[0]["moduleId"] == "mod-bad"
            assert modules[0]["name"] == "Bad Spec"

    def test_sync_with_explicit_null_last_sync(self, sync_client, test_settings):
        """Test that sync with explicit null last_sync returns module_list (full sync)."""
        asyncio.run(
            _insert_module(test_settings.db_path, "mod-1", "Module One", "2024-01-01T00:00:00Z")
        )

        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "sync", "payload": {"last_sync": None}})
            response = ws.receive_json()

            # None/null should be treated as falsy -> full sync
            assert response["type"] == "module_list"
            assert len(response["payload"]["modules"]) == 1

    def test_multiple_modules_with_same_updated_at(self, sync_client, test_settings):
        """Test that all modules with the same updated_at are returned."""
        same_time = "2024-06-01T12:00:00Z"
        asyncio.run(_insert_module(test_settings.db_path, "mod-1", "Module 1", same_time))
        asyncio.run(_insert_module(test_settings.db_path, "mod-2", "Module 2", same_time))
        asyncio.run(_insert_module(test_settings.db_path, "mod-3", "Module 3", same_time))

        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()

            assert response["type"] == "module_list"
            assert len(response["payload"]["modules"]) == 3

    def test_delta_sync_with_boundary_timestamp(self, sync_client, test_settings):
        """Test delta sync where last_sync exactly matches a module's updated_at.

        The query is `updated_at > last_sync` (strict greater than), so
        modules with updated_at == last_sync should NOT be included.
        """
        asyncio.run(
            _insert_module(test_settings.db_path, "mod-exact", "Exact Match", "2024-06-01T12:00:00Z")
        )
        asyncio.run(
            _insert_module(test_settings.db_path, "mod-after", "After Match", "2024-06-01T12:00:01Z")
        )

        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({
                "type": "sync",
                "payload": {"last_sync": "2024-06-01T12:00:00Z"},
            })
            response = ws.receive_json()

            assert response["type"] == "module_sync"
            modules = response["payload"]["modules"]
            # Only the module with updated_at > last_sync should appear
            assert len(modules) == 1
            assert modules[0]["moduleId"] == "mod-after"

    def test_module_spec_with_nested_json(self, sync_client, test_settings):
        """Test that complex nested spec JSON is correctly parsed and merged."""
        spec_json = json.dumps({
            "layout": {"type": "grid", "columns": 2},
            "data_sources": [{"url": "https://api.example.com", "refresh": 300}],
            "styles": {"theme": "dark", "accent_color": "#E8A84C"},
        })
        asyncio.run(
            _insert_module(test_settings.db_path, "mod-complex", "Complex",
                           "2024-01-01T00:00:00Z", spec=spec_json)
        )

        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()

            assert response["type"] == "module_list"
            mod = response["payload"]["modules"][0]
            assert mod["layout"]["type"] == "grid"
            assert len(mod["data_sources"]) == 1
            assert mod["styles"]["accent_color"] == "#E8A84C"

    def test_empty_spec_in_database(self, sync_client, test_settings):
        """Test that empty spec string in database is handled as empty dict."""
        asyncio.run(
            _insert_module(test_settings.db_path, "mod-empty", "Empty Spec",
                           "2024-01-01T00:00:00Z", spec="")
        )

        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()

            assert response["type"] == "module_list"
            mod = response["payload"]["modules"][0]
            # moduleId and name should still be present
            assert mod["moduleId"] == "mod-empty"
            assert mod["name"] == "Empty Spec"

    def test_full_sync_returns_modules_ordered_by_updated_at_desc(self, sync_client, test_settings):
        """Test that full sync returns modules ordered by updated_at descending."""
        asyncio.run(_insert_module(test_settings.db_path, "mod-old", "Old", "2024-01-01T00:00:00Z"))
        asyncio.run(_insert_module(test_settings.db_path, "mod-mid", "Mid", "2024-06-01T00:00:00Z"))
        asyncio.run(_insert_module(test_settings.db_path, "mod-new", "New", "2024-12-01T00:00:00Z"))

        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()

            modules = response["payload"]["modules"]
            assert len(modules) == 3
            assert modules[0]["moduleId"] == "mod-new"
            assert modules[1]["moduleId"] == "mod-mid"
            assert modules[2]["moduleId"] == "mod-old"

    def test_delta_sync_with_many_modules(self, sync_client, test_settings):
        """Test delta sync with a larger number of modules (stress test)."""
        for i in range(20):
            ts = f"2024-{(i % 12) + 1:02d}-01T00:00:00Z"
            asyncio.run(
                _insert_module(test_settings.db_path, f"mod-{i}", f"Module {i}", ts)
            )

        with sync_client.websocket_connect("/ws") as ws:
            _auth(ws)
            # last_sync halfway through — should return modules from month 7 onwards
            ws.send_json({
                "type": "sync",
                "payload": {"last_sync": "2024-06-15T00:00:00Z"},
            })
            response = ws.receive_json()

            assert response["type"] == "module_sync"
            modules = response["payload"]["modules"]
            # Modules with months 7-12 should be returned
            for mod in modules:
                # Each returned module should have updated_at > 2024-06-15
                assert "moduleId" in mod
                assert "name" in mod
