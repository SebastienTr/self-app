"""Integration tests for the refresh pipeline.

End-to-end: create module → scheduler picks it up → mock HTTP response
→ verify module_updated pushed to task manager buffer.
"""

import asyncio
import json

import aiosqlite
import pytest

from app.refresh import refresh_module
from app.scheduler import RefreshScheduler
from app.task_manager import AgentTaskManager


async def _setup_db(db_path: str) -> None:
    """Create tables for tests (mirrors migrations 001-003)."""
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
                updated_at TEXT NOT NULL,
                last_refreshed_at TEXT,
                last_refresh_error TEXT
            )"""
        )
        await db.execute(
            "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)"
        )
        await db.execute("INSERT INTO schema_version (version) VALUES (3)")
        await db.commit()
    finally:
        await db.close()


async def _insert_module(db_path: str, module_id: str, spec: dict) -> None:
    """Insert a module row."""
    db = await aiosqlite.connect(db_path)
    try:
        await db.execute(
            "INSERT INTO modules (id, name, spec, status, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (module_id, spec.get("name", "Test"), json.dumps(spec), "active",
             "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"),
        )
        await db.commit()
    finally:
        await db.close()


@pytest.fixture
async def db_path(tmp_path):
    """Create a temp DB with modules table."""
    path = str(tmp_path / "test_integration.db")
    await _setup_db(path)
    return path


class TestRefreshPipelineIntegration:
    """End-to-end refresh pipeline tests."""

    @pytest.mark.asyncio
    async def test_refresh_pushes_module_updated_to_task_manager(self, db_path):
        """Refresh with changed data pushes module_updated through task manager."""
        spec = {
            "name": "Weather",
            "type": "metric",
            "data_sources": [{"id": "weather", "type": "http_json",
                              "config": {"url": "http://test"}}],
            "refresh_interval": 3600,
        }
        await _insert_module(db_path, "mod-1", spec)

        # Set up a task manager with a session
        tm = AgentTaskManager()
        session_id = "test-session"

        # Create a push function that uses the task manager
        async def push_module_update(module_id: str, spec: dict):
            payload = {
                "type": "module_updated",
                "payload": {"module_id": module_id, "spec": spec},
            }
            await tm.buffer_and_notify(session_id, payload)

        async def mock_fetch(module, **kwargs):
            return {"weather": {"temp": 25}}

        result = await refresh_module(
            "mod-1", db_path, push_fn=push_module_update, fetch_fn=mock_fetch
        )

        assert result is True

        # Verify message was buffered
        messages = tm.drain_buffer(session_id, 0)
        assert len(messages) == 1
        assert messages[0].payload["type"] == "module_updated"
        assert messages[0].payload["payload"]["module_id"] == "mod-1"
        assert messages[0].payload["payload"]["spec"]["data"]["weather"]["temp"] == 25

    @pytest.mark.asyncio
    async def test_scheduler_registers_and_refreshes_module(self, db_path):
        """Scheduler registers a module and calls refresh_fn."""
        spec = {
            "name": "Auto Refresh",
            "data_sources": [{"id": "api", "type": "http_json",
                              "config": {"url": "http://test"}}],
            "refresh_interval": 3600,
        }
        await _insert_module(db_path, "mod-auto", spec)

        refresh_calls = []

        async def mock_refresh(module_id, db_p, push_fn):
            refresh_calls.append(module_id)
            return True

        scheduler = RefreshScheduler(refresh_fn=mock_refresh)
        await scheduler.start(db_path)

        # Give event loop time to execute the first refresh
        await asyncio.sleep(0.1)

        assert "mod-auto" in refresh_calls

        await scheduler.stop()

    @pytest.mark.asyncio
    async def test_runtime_module_registration(self, db_path):
        """New module registered at runtime is picked up by scheduler."""
        refresh_calls = []

        async def mock_refresh(module_id, db_p, push_fn):
            refresh_calls.append(module_id)
            return True

        scheduler = RefreshScheduler(refresh_fn=mock_refresh)
        await scheduler.start(db_path)

        # No modules in DB initially
        assert len(scheduler._tasks) == 0

        # Register a new module at runtime (simulates agent creating a module)
        scheduler.register_module("mod-new", 3600, db_path)

        await asyncio.sleep(0.1)

        assert "mod-new" in refresh_calls
        assert "mod-new" in scheduler._tasks

        await scheduler.stop()

    @pytest.mark.asyncio
    async def test_push_to_multiple_sessions(self, db_path):
        """Push function delivers to multiple active sessions."""
        spec = {
            "name": "Multi Session",
            "data_sources": [{"id": "api", "type": "http_json",
                              "config": {"url": "http://test"}}],
            "refresh_interval": 300,
        }
        await _insert_module(db_path, "mod-multi", spec)

        tm = AgentTaskManager()
        session_ids = ["session-1", "session-2", "session-3"]

        # Create writer queues for all sessions (simulates active WS connections)
        for sid in session_ids:
            tm.get_writer_queue(sid)

        async def push_module_update(module_id: str, pushed_spec: dict):
            """Push to all active sessions via task manager."""
            payload = {
                "type": "module_updated",
                "payload": {"module_id": module_id, "spec": pushed_spec},
            }
            for sid in session_ids:
                await tm.buffer_and_notify(sid, payload)

        async def mock_fetch(module, **kwargs):
            return {"api": {"value": "new"}}

        result = await refresh_module(
            "mod-multi", db_path, push_fn=push_module_update, fetch_fn=mock_fetch
        )

        assert result is True

        # All sessions should have the message
        for sid in session_ids:
            messages = tm.drain_buffer(sid, 0)
            assert len(messages) == 1
            assert messages[0].payload["type"] == "module_updated"

    @pytest.mark.asyncio
    async def test_no_push_when_no_sessions(self, db_path):
        """Refresh succeeds and updates DB even with no push_fn (AC #8)."""
        spec = {
            "name": "No Clients",
            "data_sources": [{"id": "api", "type": "http_json",
                              "config": {"url": "http://test"}}],
            "refresh_interval": 60,
        }
        await _insert_module(db_path, "mod-solo", spec)

        async def mock_fetch(module, **kwargs):
            return {"api": {"fresh": True}}

        # push_fn is None — no connected clients
        result = await refresh_module(
            "mod-solo", db_path, push_fn=None, fetch_fn=mock_fetch
        )

        assert result is True

        # DB should still be updated
        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute(
                "SELECT spec, updated_at FROM modules WHERE id = ?",
                ("mod-solo",),
            )
            row = await cursor.fetchone()
            spec_data = json.loads(row[0])
            assert spec_data["data"] == {"api": {"fresh": True}}
            assert row[1] != "2026-01-01T00:00:00Z"
        finally:
            await db.close()
