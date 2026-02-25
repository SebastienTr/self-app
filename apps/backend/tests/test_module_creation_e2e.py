"""End-to-end integration tests for module creation pipeline (Story 3.4).

Simulates the full flow:
  User sends chat → agent → LLM (mocked) → parse → validate → save → module_created WS message

Tests:
  - Happy path: full module creation with status sequence
  - Error path: invalid JSON from LLM sends MODULE_CREATION_FAILED
  - Sync after creation: newly created module appears in sync response
  - Regular chat: messages without module spec are normal chat_stream responses

Uses Starlette TestClient for real WebSocket testing through the full stack.
"""

import asyncio
import importlib
import json
from unittest.mock import AsyncMock, MagicMock, patch

import aiosqlite
import pytest
from starlette.testclient import TestClient

from app.llm.base import LLMResult
from app.sessions import create_session


# --- Test data ---

_VALID_MODULE_SPEC = {
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
}

_MODULE_CREATION_LLM_RESPONSE = (
    "I'll create a weather module for you. Let me find the right data sources...\n\n"
    f"```json\n{json.dumps(_VALID_MODULE_SPEC)}\n```"
)

_REGULAR_CHAT_RESPONSE = "Hello! I'm Self, your AI assistant. How can I help you today?"

_INVALID_JSON_LLM_RESPONSE = (
    "Sure, let me create that module!\n\n"
    "```json\n"
    '{"name": "Bad Module", "type": "metric" INVALID_JSON_HERE}\n'
    "```"
)

_TEST_TOKEN = "test-e2e-token"


# --- Helpers ---

async def _setup_e2e_db(db_path: str) -> None:
    """Create all necessary tables and a test session for E2E tests."""
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
            """CREATE TABLE IF NOT EXISTS memory_core (
                id TEXT PRIMARY KEY,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                category TEXT,
                user_id TEXT NOT NULL DEFAULT 'default',
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
    await create_session(db_path, _TEST_TOKEN)


def _make_provider(response_text: str) -> MagicMock:
    """Create a mock LLM provider returning a specific response."""
    provider = MagicMock()
    provider.name = "mock-e2e-provider"
    result = LLMResult(
        content=response_text,
        provider="mock-e2e-provider",
        model="mock-model",
        tokens_in=50,
        tokens_out=200,
        latency_ms=500,
        cost_estimate=0.01,
    )
    provider.execute = AsyncMock(return_value=result)
    return provider


def _receive_n(ws, n: int) -> list[dict]:
    """Receive exactly n messages from WebSocket."""
    messages = []
    for _ in range(n):
        messages.append(ws.receive_json())
    return messages


def _auth(ws) -> None:
    """Authenticate a WebSocket connection."""
    ws.send_json({"type": "auth", "payload": {"token": _TEST_TOKEN}})
    # Server sends status:idle after successful auth — consume it
    ack = ws.receive_json()
    assert ack["type"] == "status"
    assert ack["payload"]["state"] == "idle"


# --- Fixtures ---

@pytest.fixture
def module_creation_client(test_settings):
    """Client with LLM provider that returns a module creation response."""
    asyncio.run(_setup_e2e_db(test_settings.db_path))
    import app.main as main_mod
    importlib.reload(main_mod)
    mock_provider = _make_provider(_MODULE_CREATION_LLM_RESPONSE)
    with patch.object(main_mod, "get_provider", return_value=mock_provider):
        yield TestClient(main_mod.app)


@pytest.fixture
def regular_chat_client(test_settings):
    """Client with LLM provider that returns a regular chat response."""
    asyncio.run(_setup_e2e_db(test_settings.db_path))
    import app.main as main_mod
    importlib.reload(main_mod)
    mock_provider = _make_provider(_REGULAR_CHAT_RESPONSE)
    with patch.object(main_mod, "get_provider", return_value=mock_provider):
        yield TestClient(main_mod.app)


@pytest.fixture
def invalid_json_client(test_settings):
    """Client with LLM provider that returns invalid JSON in a code fence."""
    asyncio.run(_setup_e2e_db(test_settings.db_path))
    import app.main as main_mod
    importlib.reload(main_mod)
    mock_provider = _make_provider(_INVALID_JSON_LLM_RESPONSE)
    with patch.object(main_mod, "get_provider", return_value=mock_provider):
        yield TestClient(main_mod.app)


# --- Tests ---

class TestModuleCreationE2E:
    """End-to-end tests for the module creation pipeline."""

    def test_full_module_creation_flow(self, module_creation_client):
        """Full flow: chat -> LLM -> parse -> validate -> save -> module_created.

        Expected message sequence (7 messages):
        1. status:thinking
        2. chat_stream (conversational text, done=False)
        3. chat_stream (done=True)
        4. status:discovering
        5. status:composing
        6. module_created
        7. status:idle
        """
        with module_creation_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Show me the weather in Paris"}})

            messages = _receive_n(ws, 7)
            types = [m["type"] for m in messages]

            # Verify message sequence
            assert types == [
                "status",       # thinking
                "chat_stream",  # conversational text
                "chat_stream",  # done signal
                "status",       # discovering
                "status",       # composing
                "module_created",
                "status",       # idle
            ]

    def test_status_message_sequence(self, module_creation_client):
        """Status messages follow: thinking -> discovering -> composing -> idle."""
        with module_creation_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Track the weather"}})

            messages = _receive_n(ws, 7)
            status_msgs = [m for m in messages if m["type"] == "status"]
            states = [m["payload"]["state"] for m in status_msgs]

            assert states == ["thinking", "discovering", "composing", "idle"]

    def test_module_created_payload_structure(self, module_creation_client):
        """module_created payload has all required fields in snake_case."""
        with module_creation_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Weather module please"}})

            messages = _receive_n(ws, 7)
            module_msgs = [m for m in messages if m["type"] == "module_created"]
            assert len(module_msgs) == 1

            payload = module_msgs[0]["payload"]
            # Server-generated UUID
            assert "module_id" in payload
            # LLM-generated fields
            assert payload["name"] == "Paris Weather"
            assert payload["type"] == "metric"
            assert payload["template"] == "metric-dashboard"
            assert payload["refresh_interval"] == 3600
            assert payload["schema_version"] == 1
            assert payload["accessible_label"] == "Paris weather forecast showing current temperature"
            assert len(payload["data_sources"]) == 1

    def test_module_saved_to_db(self, module_creation_client, test_settings):
        """Module is persisted to SQLite modules table."""
        with module_creation_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Create weather"}})
            _receive_n(ws, 7)

        # Verify in DB
        async def _check_db():
            db = await aiosqlite.connect(test_settings.db_path)
            try:
                cursor = await db.execute("SELECT id, name, spec, status FROM modules")
                rows = await cursor.fetchall()
                return rows
            finally:
                await db.close()

        rows = asyncio.run(_check_db())
        assert len(rows) == 1
        assert rows[0][1] == "Paris Weather"
        assert rows[0][3] == "active"

        # Verify spec JSON is valid
        spec = json.loads(rows[0][2])
        assert spec["type"] == "metric"
        assert spec["template"] == "metric-dashboard"

    def test_chat_stream_includes_conversational_text(self, module_creation_client):
        """chat_stream delta includes the LLM's conversational text (not JSON)."""
        with module_creation_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Weather please"}})

            messages = _receive_n(ws, 7)
            stream_msgs = [m for m in messages if m["type"] == "chat_stream"]

            # First stream message should have conversational text
            delta = stream_msgs[0]["payload"]["delta"]
            assert "weather module" in delta.lower() or "data sources" in delta.lower()
            # Should NOT contain the JSON code fence
            assert "```json" not in delta


class TestModuleCreationErrorPath:
    """Error path tests for module creation."""

    def test_invalid_json_sends_module_creation_failed(self, invalid_json_client):
        """Invalid JSON in LLM response sends MODULE_CREATION_FAILED error."""
        with invalid_json_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Create a module"}})

            # Consume messages: thinking + chat_stream(s) + error + idle
            messages = []
            for _ in range(10):
                try:
                    msg = ws.receive_json()
                    messages.append(msg)
                    # Stop after idle
                    if msg.get("type") == "status" and msg.get("payload", {}).get("state") == "idle":
                        break
                except Exception:
                    break

            error_msgs = [m for m in messages if m["type"] == "error"]
            assert len(error_msgs) == 1
            assert error_msgs[0]["payload"]["code"] == "MODULE_CREATION_FAILED"
            assert "agent_action" in error_msgs[0]["payload"]

    def test_invalid_json_still_ends_with_idle(self, invalid_json_client):
        """Error path still ends with status:idle."""
        with invalid_json_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Create broken module"}})

            messages = []
            for _ in range(10):
                try:
                    msg = ws.receive_json()
                    messages.append(msg)
                    if msg.get("type") == "status" and msg.get("payload", {}).get("state") == "idle":
                        break
                except Exception:
                    break

            assert messages[-1]["type"] == "status"
            assert messages[-1]["payload"]["state"] == "idle"

    def test_invalid_json_does_not_save_to_db(self, invalid_json_client, test_settings):
        """Failed module creation should NOT save anything to the modules table."""
        with invalid_json_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Create bad module"}})

            messages = []
            for _ in range(10):
                try:
                    msg = ws.receive_json()
                    messages.append(msg)
                    if msg.get("type") == "status" and msg.get("payload", {}).get("state") == "idle":
                        break
                except Exception:
                    break

        # Verify DB is empty
        async def _check_db():
            db = await aiosqlite.connect(test_settings.db_path)
            try:
                cursor = await db.execute("SELECT COUNT(*) FROM modules")
                row = await cursor.fetchone()
                return row[0]
            finally:
                await db.close()

        count = asyncio.run(_check_db())
        assert count == 0


class TestModuleAppearsInSync:
    """Verify created module appears in subsequent sync responses."""

    def test_module_appears_in_full_sync(self, module_creation_client, test_settings):
        """After creation, full sync (no last_sync) includes the new module."""
        with module_creation_client.websocket_connect("/ws") as ws:
            _auth(ws)

            # Create module
            ws.send_json({"type": "chat", "payload": {"message": "Weather module"}})
            _receive_n(ws, 7)

            # Full sync
            ws.send_json({"type": "sync", "payload": {}})
            sync_response = ws.receive_json()

            assert sync_response["type"] == "module_list"
            modules = sync_response["payload"]["modules"]
            assert len(modules) == 1
            assert modules[0]["name"] == "Paris Weather"
            assert "moduleId" in modules[0]

    def test_module_appears_in_delta_sync(self, module_creation_client, test_settings):
        """After creation, delta sync (with old last_sync) includes the new module."""
        with module_creation_client.websocket_connect("/ws") as ws:
            _auth(ws)

            # Create module
            ws.send_json({"type": "chat", "payload": {"message": "Weather module"}})
            _receive_n(ws, 7)

            # Delta sync with old timestamp
            ws.send_json({
                "type": "sync",
                "payload": {"last_sync": "2020-01-01T00:00:00Z"},
            })
            sync_response = ws.receive_json()

            assert sync_response["type"] == "module_sync"
            modules = sync_response["payload"]["modules"]
            assert len(modules) == 1
            assert modules[0]["name"] == "Paris Weather"


class TestRegularChatStillWorks:
    """Verify regular chat (no module creation) is not broken."""

    def test_regular_chat_response(self, regular_chat_client):
        """Regular chat message without module spec works as before."""
        with regular_chat_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Hello"}})

            messages = _receive_n(ws, 4)  # thinking + stream(delta) + stream(done) + idle
            types = [m["type"] for m in messages]

            assert types == ["status", "chat_stream", "chat_stream", "status"]
            assert "module_created" not in types

    def test_regular_chat_no_modules_saved(self, regular_chat_client, test_settings):
        """Regular chat does not create any modules in the database."""
        with regular_chat_client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Hi there"}})
            _receive_n(ws, 4)

        async def _check_db():
            db = await aiosqlite.connect(test_settings.db_path)
            try:
                cursor = await db.execute("SELECT COUNT(*) FROM modules")
                row = await cursor.fetchone()
                return row[0]
            finally:
                await db.close()

        count = asyncio.run(_check_db())
        assert count == 0
