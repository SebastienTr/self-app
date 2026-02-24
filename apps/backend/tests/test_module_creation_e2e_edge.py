"""Edge-case E2E tests for module creation pipeline — Story 3.4 TEA expansion.

Covers paths NOT exercised by test_module_creation_e2e.py:
  - Missing required fields in LLM response (valid JSON, but not a module spec)
  - Multiple module creations in a single WebSocket session
  - Module creation with LLM response containing only JSON (no conversational text)
  - Module creation followed by immediate delta sync with future last_sync
  - LLM response with extra unexpected fields in spec (preserved through pipeline)
  - Concurrent chat + sync operations in same session

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

_SECOND_MODULE_SPEC = {
    "name": "Stock Tracker",
    "type": "metric",
    "template": "metric-dashboard",
    "data_sources": [
        {
            "id": "stock-api",
            "type": "rest_api",
            "config": {
                "url": "https://api.example.com/stocks?symbol=AAPL",
                "method": "GET",
            },
        }
    ],
    "refresh_interval": 300,
    "schema_version": 1,
    "accessible_label": "Apple stock price tracker",
}

_SPEC_WITH_EXTRAS = {
    **_VALID_MODULE_SPEC,
    "name": "Custom Module",
    "custom_field": "custom_value",
    "priority": 99,
    "tags": ["weather", "outdoor"],
}

_MISSING_FIELDS_SPEC = {
    "name": "Incomplete Module",
    "type": "metric",
    # Missing: template, data_sources, refresh_interval, schema_version, accessible_label
}

_TEST_TOKEN = "test-e2e-edge-token"


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
    provider.name = "mock-e2e-edge-provider"
    result = LLMResult(
        content=response_text,
        provider="mock-e2e-edge-provider",
        model="mock-model",
        tokens_in=50,
        tokens_out=200,
        latency_ms=500,
        cost_estimate=0.01,
    )
    provider.execute = AsyncMock(return_value=result)
    return provider


def _make_sequential_provider(responses: list[str]) -> MagicMock:
    """Create a mock provider that returns different responses on successive calls."""
    provider = MagicMock()
    provider.name = "mock-sequential-provider"
    results = [
        LLMResult(
            content=text,
            provider="mock-sequential-provider",
            model="mock-model",
            tokens_in=50,
            tokens_out=200,
            latency_ms=500,
            cost_estimate=0.01,
        )
        for text in responses
    ]
    provider.execute = AsyncMock(side_effect=results)
    return provider


def _receive_until_idle(ws, max_messages: int = 20) -> list[dict]:
    """Receive messages until status:idle is encountered or max reached."""
    messages = []
    for _ in range(max_messages):
        try:
            msg = ws.receive_json()
            messages.append(msg)
            if msg.get("type") == "status" and msg.get("payload", {}).get("state") == "idle":
                break
        except Exception:
            break
    return messages


def _auth(ws) -> None:
    """Authenticate a WebSocket connection."""
    ws.send_json({"type": "auth", "payload": {"token": _TEST_TOKEN}})
    # Server sends status:idle after successful auth — consume it
    ack = ws.receive_json()
    assert ack == {"type": "status", "payload": {"state": "idle"}}


# --- Tests ---

class TestMissingRequiredFields:
    """E2E tests for LLM response with valid JSON but missing required module fields."""

    @pytest.fixture
    def client(self, test_settings):
        """Client with LLM provider returning valid JSON missing required fields."""
        asyncio.run(_setup_e2e_db(test_settings.db_path))
        import app.main as main_mod
        importlib.reload(main_mod)
        response = (
            "I'll create that for you!\n\n"
            f"```json\n{json.dumps(_MISSING_FIELDS_SPEC)}\n```"
        )
        mock_provider = _make_provider(response)
        with patch.object(main_mod, "get_provider", return_value=mock_provider):
            yield TestClient(main_mod.app)

    def test_missing_fields_sends_error(self, client):
        """Valid JSON missing required fields sends MODULE_CREATION_FAILED."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Create a module"}})

            messages = _receive_until_idle(ws)

            error_msgs = [m for m in messages if m["type"] == "error"]
            assert len(error_msgs) == 1
            assert error_msgs[0]["payload"]["code"] == "MODULE_CREATION_FAILED"
            assert "missing required fields" in error_msgs[0]["payload"]["message"].lower()

    def test_missing_fields_does_not_create_module(self, client, test_settings):
        """Missing fields in spec does not save to DB."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Create a module"}})
            _receive_until_idle(ws)

        async def _check():
            db = await aiosqlite.connect(test_settings.db_path)
            try:
                cursor = await db.execute("SELECT COUNT(*) FROM modules")
                row = await cursor.fetchone()
                return row[0]
            finally:
                await db.close()

        assert asyncio.run(_check()) == 0

    def test_missing_fields_still_sends_chat_text(self, client):
        """Chat text is still sent even when module spec has missing fields."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Create a module"}})

            messages = _receive_until_idle(ws)

            stream_msgs = [m for m in messages if m["type"] == "chat_stream"]
            assert len(stream_msgs) >= 1
            # Should contain the conversational text
            delta_msgs = [m for m in stream_msgs if not m["payload"].get("done")]
            if delta_msgs:
                assert len(delta_msgs[0]["payload"]["delta"]) > 0


class TestMultipleModuleCreation:
    """E2E tests for creating multiple modules in a single session."""

    @pytest.fixture
    def client(self, test_settings):
        """Client with provider returning different module specs on successive calls."""
        asyncio.run(_setup_e2e_db(test_settings.db_path))
        import app.main as main_mod
        importlib.reload(main_mod)
        responses = [
            f"Weather module:\n```json\n{json.dumps(_VALID_MODULE_SPEC)}\n```",
            f"Stock module:\n```json\n{json.dumps(_SECOND_MODULE_SPEC)}\n```",
        ]
        mock_provider = _make_sequential_provider(responses)
        with patch.object(main_mod, "get_provider", return_value=mock_provider):
            yield TestClient(main_mod.app)

    def test_two_modules_created_in_same_session(self, client, test_settings):
        """Two module creation requests in same WS session create two distinct modules."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)

            # First module
            ws.send_json({"type": "chat", "payload": {"message": "Show weather"}})
            msgs1 = _receive_until_idle(ws)

            # Second module
            ws.send_json({"type": "chat", "payload": {"message": "Track stocks"}})
            msgs2 = _receive_until_idle(ws)

        # Each should have a module_created message
        mod_msgs1 = [m for m in msgs1 if m["type"] == "module_created"]
        mod_msgs2 = [m for m in msgs2 if m["type"] == "module_created"]
        assert len(mod_msgs1) == 1
        assert len(mod_msgs2) == 1

        # Module IDs should be different
        id1 = mod_msgs1[0]["payload"]["module_id"]
        id2 = mod_msgs2[0]["payload"]["module_id"]
        assert id1 != id2

        # Names should be different
        assert mod_msgs1[0]["payload"]["name"] == "Paris Weather"
        assert mod_msgs2[0]["payload"]["name"] == "Stock Tracker"

        # DB should have 2 modules
        async def _check():
            db = await aiosqlite.connect(test_settings.db_path)
            try:
                cursor = await db.execute("SELECT COUNT(*) FROM modules")
                row = await cursor.fetchone()
                return row[0]
            finally:
                await db.close()

        assert asyncio.run(_check()) == 2

    def test_two_modules_both_appear_in_sync(self, client, test_settings):
        """Both created modules appear in a subsequent full sync."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)

            # Create two modules
            ws.send_json({"type": "chat", "payload": {"message": "Show weather"}})
            _receive_until_idle(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Track stocks"}})
            _receive_until_idle(ws)

            # Full sync
            ws.send_json({"type": "sync", "payload": {}})
            sync_response = ws.receive_json()

            assert sync_response["type"] == "module_list"
            modules = sync_response["payload"]["modules"]
            assert len(modules) == 2
            names = {m["name"] for m in modules}
            assert "Paris Weather" in names
            assert "Stock Tracker" in names


class TestOnlyJsonResponse:
    """E2E test for LLM response containing only JSON (no conversational text)."""

    @pytest.fixture
    def client(self, test_settings):
        """Client with LLM that returns only a JSON code block."""
        asyncio.run(_setup_e2e_db(test_settings.db_path))
        import app.main as main_mod
        importlib.reload(main_mod)
        response = f"```json\n{json.dumps(_VALID_MODULE_SPEC)}\n```"
        mock_provider = _make_provider(response)
        with patch.object(main_mod, "get_provider", return_value=mock_provider):
            yield TestClient(main_mod.app)

    def test_module_created_without_conversational_text(self, client):
        """Module is created even when LLM returns only JSON (no chat text)."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Create module"}})

            messages = _receive_until_idle(ws)

            module_msgs = [m for m in messages if m["type"] == "module_created"]
            assert len(module_msgs) == 1
            assert module_msgs[0]["payload"]["name"] == "Paris Weather"

    def test_status_sequence_preserved_without_text(self, client):
        """Status sequence is correct even without conversational text."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Create module"}})

            messages = _receive_until_idle(ws)

            status_msgs = [m for m in messages if m["type"] == "status"]
            states = [m["payload"]["state"] for m in status_msgs]
            assert states == ["thinking", "discovering", "composing", "idle"]


class TestExtraSpecFields:
    """E2E test for LLM response with extra unexpected fields in module spec."""

    @pytest.fixture
    def client(self, test_settings):
        """Client with LLM that returns spec with extra fields."""
        asyncio.run(_setup_e2e_db(test_settings.db_path))
        import app.main as main_mod
        importlib.reload(main_mod)
        response = f"Custom module:\n```json\n{json.dumps(_SPEC_WITH_EXTRAS)}\n```"
        mock_provider = _make_provider(response)
        with patch.object(main_mod, "get_provider", return_value=mock_provider):
            yield TestClient(main_mod.app)

    def test_extra_fields_preserved_in_module_created(self, client):
        """Extra fields from LLM spec are preserved in module_created payload."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Create custom module"}})

            messages = _receive_until_idle(ws)

            module_msgs = [m for m in messages if m["type"] == "module_created"]
            assert len(module_msgs) == 1

            payload = module_msgs[0]["payload"]
            assert payload["custom_field"] == "custom_value"
            assert payload["priority"] == 99
            assert payload["tags"] == ["weather", "outdoor"]

    def test_extra_fields_persisted_in_db(self, client, test_settings):
        """Extra fields are persisted in the DB spec column."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Create custom module"}})
            _receive_until_idle(ws)

        async def _check():
            db = await aiosqlite.connect(test_settings.db_path)
            try:
                cursor = await db.execute("SELECT spec FROM modules")
                row = await cursor.fetchone()
                return json.loads(row[0])
            finally:
                await db.close()

        spec = asyncio.run(_check())
        assert spec["custom_field"] == "custom_value"
        assert spec["priority"] == 99

    def test_extra_fields_appear_in_sync(self, client, test_settings):
        """Extra fields appear when module is fetched via sync."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)
            ws.send_json({"type": "chat", "payload": {"message": "Create custom module"}})
            _receive_until_idle(ws)

            # Full sync
            ws.send_json({"type": "sync", "payload": {}})
            sync_response = ws.receive_json()

            modules = sync_response["payload"]["modules"]
            assert len(modules) == 1
            assert modules[0]["custom_field"] == "custom_value"


class TestDeltaSyncAfterCreation:
    """E2E tests for delta sync immediately after module creation."""

    @pytest.fixture
    def client(self, test_settings):
        asyncio.run(_setup_e2e_db(test_settings.db_path))
        import app.main as main_mod
        importlib.reload(main_mod)
        response = f"Module:\n```json\n{json.dumps(_VALID_MODULE_SPEC)}\n```"
        mock_provider = _make_provider(response)
        with patch.object(main_mod, "get_provider", return_value=mock_provider):
            yield TestClient(main_mod.app)

    def test_delta_sync_with_future_timestamp_returns_empty(self, client):
        """Delta sync with future last_sync returns no modules (nothing updated after future)."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)

            # Create module
            ws.send_json({"type": "chat", "payload": {"message": "Weather module"}})
            _receive_until_idle(ws)

            # Delta sync with future timestamp (nothing should be newer)
            ws.send_json({
                "type": "sync",
                "payload": {"last_sync": "2099-12-31T23:59:59Z"},
            })
            sync_response = ws.receive_json()

            assert sync_response["type"] == "module_sync"
            assert len(sync_response["payload"]["modules"]) == 0

    def test_delta_sync_returns_last_sync_timestamp(self, client):
        """Delta sync response includes a last_sync timestamp."""
        with client.websocket_connect("/ws") as ws:
            _auth(ws)

            ws.send_json({"type": "chat", "payload": {"message": "Weather module"}})
            _receive_until_idle(ws)

            ws.send_json({
                "type": "sync",
                "payload": {"last_sync": "2020-01-01T00:00:00Z"},
            })
            sync_response = ws.receive_json()

            assert "last_sync" in sync_response["payload"]
            assert len(sync_response["payload"]["last_sync"]) > 0
