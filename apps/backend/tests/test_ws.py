"""WebSocket endpoint tests.

Tests the /ws endpoint for message routing, error handling,
and protocol compliance.

Uses Starlette's TestClient with websocket_connect for WS testing.
"""

import json

import pytest
from starlette.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Create a test client without triggering lifespan."""
    return TestClient(app)


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
            ws.send_json({"type": "chat", "payload": {"message": "Hello world"}})
            response = ws.receive_json()

            assert response["type"] == "chat_stream"
            assert response["payload"]["done"] is True
            assert "Hello world" in response["payload"]["delta"]

    def test_chat_message_follows_type_payload_format(self, client):
        """Test that chat_stream response follows { type, payload } format."""
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "chat", "payload": {"message": "Test"}})
            response = ws.receive_json()

            assert "type" in response
            assert "payload" in response
            assert isinstance(response["payload"], dict)

    def test_chat_message_with_empty_message(self, client):
        """Test chat with empty message field."""
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "chat", "payload": {"message": ""}})
            response = ws.receive_json()

            assert response["type"] == "chat_stream"
            assert response["payload"]["done"] is True


class TestLogMessage:
    """Test log message type handling."""

    def test_log_message_is_processed(self, client):
        """Test that a log message is accepted without error response."""
        with client.websocket_connect("/ws") as ws:
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
            ws.send_json({"type": "sync", "payload": {"last_sync": "2024-01-01T00:00:00Z"}})
            response = ws.receive_json()
            # If the log message caused an error, we'd get an error response first
            assert response["type"] == "module_list"


class TestSyncMessage:
    """Test sync message type handling."""

    def test_sync_receives_module_list_response(self, client):
        """Test that a sync message receives a module_list response."""
        with client.websocket_connect("/ws") as ws:
            ws.send_json({
                "type": "sync",
                "payload": {"last_sync": "2024-01-01T00:00:00Z"},
            })
            response = ws.receive_json()

            assert response["type"] == "module_list"
            assert response["payload"]["modules"] == []

    def test_sync_response_follows_type_payload_format(self, client):
        """Test that module_list response follows { type, payload } format."""
        with client.websocket_connect("/ws") as ws:
            ws.send_json({
                "type": "sync",
                "payload": {"last_sync": "2024-01-01T00:00:00Z"},
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
            ws.send_json({"type": "unknown_type", "payload": {}})
            response = ws.receive_json()

            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_UNKNOWN_TYPE"
            assert "unknown_type" in response["payload"]["message"]

    def test_unknown_type_error_has_agent_action(self, client):
        """Test that the error response includes agent_action field."""
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "bogus", "payload": {}})
            response = ws.receive_json()

            assert response["type"] == "error"
            assert "agent_action" in response["payload"]

    def test_missing_type_field_receives_error(self, client):
        """Test that a message with no type field gets an error."""
        with client.websocket_connect("/ws") as ws:
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
            ws.send_json({"type": "chat", "payload": {"message": "test"}})
            response = ws.receive_json()
            assert set(response.keys()) == {"type", "payload"}

    def test_module_list_response_format(self, client):
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "sync", "payload": {"last_sync": ""}})
            response = ws.receive_json()
            assert set(response.keys()) == {"type", "payload"}

    def test_error_response_format(self, client):
        with client.websocket_connect("/ws") as ws:
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
            ws.send_json({"type": "chat", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "chat_stream"
            assert response["payload"]["done"] is True
            # Empty message key should result in empty echo
            assert "Echo: " in response["payload"]["delta"]

    def test_missing_payload_key(self, client):
        """Test message with no payload key at all."""
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "chat"})
            response = ws.receive_json()
            # payload defaults to {} via msg.get("payload", {})
            assert response["type"] == "chat_stream"
            assert response["payload"]["done"] is True

    def test_auth_type_is_unknown(self, client):
        """Test that auth message type is not handled (returns error)."""
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "payload": {"token": "abc123"}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_UNKNOWN_TYPE"
            assert "auth" in response["payload"]["message"]

    def test_auth_reset_type_is_unknown(self, client):
        """Test that auth_reset message type is not handled (returns error)."""
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth_reset", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_UNKNOWN_TYPE"

    def test_module_action_type_is_unknown(self, client):
        """Test that module_action message type is not handled yet."""
        with client.websocket_connect("/ws") as ws:
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
            ws.send_json({"type": "", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_UNKNOWN_TYPE"

    def test_null_type(self, client):
        """Test message with null type."""
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": None, "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "error"
            assert response["payload"]["code"] == "WS_UNKNOWN_TYPE"

    def test_chat_with_unicode_message(self, client):
        """Test chat with unicode characters."""
        with client.websocket_connect("/ws") as ws:
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
            ws.send_json({"type": "chat", "payload": {"message": long_msg}})
            response = ws.receive_json()
            assert response["type"] == "chat_stream"
            assert long_msg in response["payload"]["delta"]

    def test_sync_with_empty_last_sync(self, client):
        """Test sync with empty string last_sync."""
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "sync", "payload": {"last_sync": ""}})
            response = ws.receive_json()
            assert response["type"] == "module_list"
            assert response["payload"]["modules"] == []

    def test_sync_with_missing_last_sync(self, client):
        """Test sync with no last_sync field in payload."""
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "sync", "payload": {}})
            response = ws.receive_json()
            assert response["type"] == "module_list"
            assert response["payload"]["modules"] == []

    def test_log_with_empty_context(self, client):
        """Test log with empty context object."""
        with client.websocket_connect("/ws") as ws:
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
            ws.send_json({
                "type": "chat",
                "payload": {"message": "test", "extra": None},
            })
            response = ws.receive_json()
            assert response["type"] == "chat_stream"

    def test_extra_top_level_fields_ignored(self, client):
        """Test that extra top-level fields don't break message routing."""
        with client.websocket_connect("/ws") as ws:
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

            # Should still be able to send valid messages
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
            ws.send_json({"type": "chat", "payload": {"message": "still alive"}})
            response = ws.receive_json()
            assert response["type"] == "chat_stream"
            assert "still alive" in response["payload"]["delta"]
