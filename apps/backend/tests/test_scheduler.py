"""Tests for scheduler.py — RefreshScheduler lifecycle.

Tests start/stop lifecycle, register/unregister modules, and
verify refresh is called at correct intervals using asyncio time mocking.
"""

import asyncio

import aiosqlite
import pytest

from app.scheduler import RefreshScheduler


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


async def _insert_module(db_path: str, module_id: str, spec_json: str) -> None:
    """Insert a module row directly."""
    db = await aiosqlite.connect(db_path)
    try:
        await db.execute(
            "INSERT INTO modules (id, name, spec, status, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (module_id, f"Module {module_id}", spec_json, "active",
             "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"),
        )
        await db.commit()
    finally:
        await db.close()


@pytest.fixture
async def db_path(tmp_path):
    """Create a temp DB with modules table."""
    path = str(tmp_path / "test_scheduler.db")
    await _setup_db(path)
    return path


class TestSchedulerLifecycle:
    """Start/stop lifecycle tests."""

    @pytest.mark.asyncio
    async def test_start_with_no_modules(self, db_path):
        """Scheduler starts with no modules and no tasks created."""
        call_log = []

        async def mock_refresh(module_id, db_p, push_fn):
            call_log.append(module_id)
            return True

        scheduler = RefreshScheduler(refresh_fn=mock_refresh)
        await scheduler.start(db_path)

        assert len(scheduler._tasks) == 0

        await scheduler.stop()

    @pytest.mark.asyncio
    async def test_start_loads_modules_with_refresh_interval(self, db_path):
        """Scheduler loads modules with refreshInterval > 0 from DB on start."""
        import json

        spec_with_refresh = json.dumps({
            "data_sources": [{"id": "s1", "type": "http_json", "config": {"url": "http://test"}}],
            "refresh_interval": 60,
        })
        spec_no_refresh = json.dumps({
            "data_sources": [{"id": "s2", "type": "http_json", "config": {"url": "http://test"}}],
            "refresh_interval": 0,
        })
        spec_no_sources = json.dumps({
            "data_sources": [],
            "refresh_interval": 300,
        })

        await _insert_module(db_path, "mod-refresh", spec_with_refresh)
        await _insert_module(db_path, "mod-no-refresh", spec_no_refresh)
        await _insert_module(db_path, "mod-no-sources", spec_no_sources)

        refresh_calls = []

        async def mock_refresh(module_id, db_p, push_fn):
            refresh_calls.append(module_id)
            return True

        scheduler = RefreshScheduler(refresh_fn=mock_refresh)
        await scheduler.start(db_path)

        # Only mod-refresh should be registered (has both refresh_interval > 0 and data_sources)
        assert "mod-refresh" in scheduler._tasks
        assert "mod-no-refresh" not in scheduler._tasks
        assert "mod-no-sources" not in scheduler._tasks

        await scheduler.stop()

    @pytest.mark.asyncio
    async def test_stop_cancels_all_tasks(self, db_path):
        """stop() cancels all running refresh tasks."""
        async def mock_refresh(module_id, db_p, push_fn):
            await asyncio.sleep(3600)
            return True

        scheduler = RefreshScheduler(refresh_fn=mock_refresh)
        scheduler.register_module("mod-1", 60, db_path)
        scheduler.register_module("mod-2", 120, db_path)

        assert len(scheduler._tasks) == 2

        await scheduler.stop()

        assert len(scheduler._tasks) == 0


class TestSchedulerRegisterUnregister:
    """Register and unregister module tests."""

    @pytest.mark.asyncio
    async def test_register_creates_task(self, db_path):
        """register_module creates an asyncio.Task for the module."""
        async def mock_refresh(module_id, db_p, push_fn):
            await asyncio.sleep(3600)
            return True

        scheduler = RefreshScheduler(refresh_fn=mock_refresh)
        scheduler.register_module("mod-new", 60, db_path)

        assert "mod-new" in scheduler._tasks
        assert isinstance(scheduler._tasks["mod-new"], asyncio.Task)

        await scheduler.stop()

    @pytest.mark.asyncio
    async def test_register_replaces_existing_task(self, db_path):
        """register_module for an existing module cancels old task and creates new one."""
        async def mock_refresh(module_id, db_p, push_fn):
            await asyncio.sleep(3600)
            return True

        scheduler = RefreshScheduler(refresh_fn=mock_refresh)
        scheduler.register_module("mod-1", 60, db_path)
        old_task = scheduler._tasks["mod-1"]

        scheduler.register_module("mod-1", 120, db_path)
        new_task = scheduler._tasks["mod-1"]

        assert old_task is not new_task
        # Yield to event loop so cancellation completes
        await asyncio.sleep(0)
        assert old_task.cancelled() or old_task.done()

        await scheduler.stop()

    @pytest.mark.asyncio
    async def test_unregister_removes_task(self, db_path):
        """unregister_module cancels and removes the module's task."""
        async def mock_refresh(module_id, db_p, push_fn):
            await asyncio.sleep(3600)
            return True

        scheduler = RefreshScheduler(refresh_fn=mock_refresh)
        scheduler.register_module("mod-1", 60, db_path)

        assert "mod-1" in scheduler._tasks

        scheduler.unregister_module("mod-1")

        assert "mod-1" not in scheduler._tasks

        await scheduler.stop()

    @pytest.mark.asyncio
    async def test_unregister_nonexistent_module_no_error(self, db_path):
        """unregister_module for a non-registered module does not raise."""
        scheduler = RefreshScheduler(refresh_fn=lambda *a: None)
        scheduler.unregister_module("nonexistent")
        # Should not raise
        await scheduler.stop()


class TestSchedulerRefreshExecution:
    """Verify refresh function is called."""

    @pytest.mark.asyncio
    async def test_refresh_called_after_register(self, db_path):
        """Refresh function is called shortly after registration (first immediate run)."""
        calls = []

        async def mock_refresh(module_id, db_p, push_fn):
            calls.append(module_id)
            return True

        scheduler = RefreshScheduler(refresh_fn=mock_refresh)
        scheduler.register_module("mod-1", 3600, db_path)

        # Give the event loop time to execute the task
        await asyncio.sleep(0.1)

        assert "mod-1" in calls

        await scheduler.stop()

    @pytest.mark.asyncio
    async def test_refresh_failure_does_not_stop_task(self, db_path):
        """If refresh raises an exception, the task continues looping."""
        call_count = 0

        async def failing_refresh(module_id, db_p, push_fn):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("Simulated failure")
            return True

        # Use very short interval so we get multiple calls quickly
        scheduler = RefreshScheduler(refresh_fn=failing_refresh)
        scheduler.register_module("mod-1", 0.05, db_path)

        await asyncio.sleep(0.2)

        # Should have been called multiple times despite the first failure
        assert call_count >= 2

        await scheduler.stop()

    @pytest.mark.asyncio
    async def test_push_fn_passed_to_refresh(self, db_path):
        """The push_fn is passed through to the refresh function."""
        received_push_fn = []

        async def mock_refresh(module_id, db_p, push_fn):
            received_push_fn.append(push_fn)
            return True

        scheduler = RefreshScheduler(refresh_fn=mock_refresh)

        async def my_push(module_id, spec):
            pass

        scheduler.set_push_fn(my_push)
        scheduler.register_module("mod-1", 3600, db_path)

        await asyncio.sleep(0.1)

        assert len(received_push_fn) >= 1
        assert received_push_fn[0] is my_push

        await scheduler.stop()
