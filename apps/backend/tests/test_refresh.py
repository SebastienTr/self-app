"""Tests for refresh.py — module refresh execution logic.

Tests refresh_module with mocked data_fetch for:
  - Success: data changed → update DB + push
  - No change: same data → update updated_at but no push
  - Failure: fetch returns None → log error, no DB update
  - Isolation: one module failure doesn't affect others
  - DB verification: updated_at, last_refreshed_at, last_refresh_error
"""

import json

import aiosqlite
import pytest

from app.refresh import refresh_module


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


async def _get_module_row(db_path: str, module_id: str) -> dict | None:
    """Read a module row directly from DB."""
    db = await aiosqlite.connect(db_path)
    try:
        cursor = await db.execute(
            "SELECT id, name, spec, status, updated_at, last_refreshed_at, last_refresh_error "
            "FROM modules WHERE id = ?",
            (module_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return {
            "id": row[0],
            "name": row[1],
            "spec": json.loads(row[2]) if row[2] else {},
            "status": row[3],
            "updated_at": row[4],
            "last_refreshed_at": row[5],
            "last_refresh_error": row[6],
        }
    finally:
        await db.close()


@pytest.fixture
async def db_path(tmp_path):
    """Create a temp DB with modules table."""
    path = str(tmp_path / "test_refresh.db")
    await _setup_db(path)
    return path


class TestRefreshModuleSuccess:
    """Success scenarios for refresh_module."""

    @pytest.mark.asyncio
    async def test_data_changed_updates_db_and_pushes(self, db_path):
        """When fetched data differs from existing, DB is updated and push_fn is called."""
        spec = {
            "name": "Weather",
            "type": "metric",
            "data_sources": [{"id": "weather", "type": "http_json",
                              "config": {"url": "http://test"}}],
            "refresh_interval": 3600,
            "data": {"old": "data"},
        }
        await _insert_module(db_path, "mod-1", spec)

        push_calls = []

        async def mock_push(module_id, pushed_spec):
            push_calls.append((module_id, pushed_spec))

        async def mock_fetch(module, **kwargs):
            return {"weather": {"temp": 22}}

        result = await refresh_module(
            "mod-1", db_path, push_fn=mock_push, fetch_fn=mock_fetch
        )

        assert result is True

        # Verify DB updated
        row = await _get_module_row(db_path, "mod-1")
        assert row["updated_at"] != "2026-01-01T00:00:00Z"
        assert row["last_refreshed_at"] is not None
        assert row["last_refresh_error"] is None

        # Verify push was called
        assert len(push_calls) == 1
        assert push_calls[0][0] == "mod-1"

    @pytest.mark.asyncio
    async def test_success_updates_spec_data_field(self, db_path):
        """Fetched data is stored in spec.data field."""
        spec = {
            "name": "Module",
            "data_sources": [{"id": "s1", "type": "http_json",
                              "config": {"url": "http://test"}}],
            "refresh_interval": 60,
        }
        await _insert_module(db_path, "mod-1", spec)

        async def mock_fetch(module, **kwargs):
            return {"s1": {"value": 100}}

        await refresh_module("mod-1", db_path, push_fn=None, fetch_fn=mock_fetch)

        row = await _get_module_row(db_path, "mod-1")
        assert row["spec"]["data"] == {"s1": {"value": 100}}


class TestRefreshModuleNoChange:
    """No-change detection: same data → no push."""

    @pytest.mark.asyncio
    async def test_same_data_bumps_timestamp_but_no_push(self, db_path):
        """When fetched data is identical, updated_at is bumped but no push."""
        spec = {
            "name": "Stable",
            "data_sources": [{"id": "api", "type": "http_json",
                              "config": {"url": "http://test"}}],
            "refresh_interval": 300,
            "data": {"api": {"value": 42}},
        }
        await _insert_module(db_path, "mod-stable", spec)

        push_calls = []

        async def mock_push(module_id, pushed_spec):
            push_calls.append(module_id)

        async def mock_fetch(module, **kwargs):
            return {"api": {"value": 42}}

        result = await refresh_module(
            "mod-stable", db_path, push_fn=mock_push, fetch_fn=mock_fetch
        )

        assert result is True

        # updated_at should be bumped
        row = await _get_module_row(db_path, "mod-stable")
        assert row["updated_at"] != "2026-01-01T00:00:00Z"
        assert row["last_refreshed_at"] is not None

        # NO push (data unchanged)
        assert len(push_calls) == 0


class TestRefreshModuleFailure:
    """Failure scenarios for refresh_module."""

    @pytest.mark.asyncio
    async def test_fetch_returns_none_logs_error(self, db_path):
        """When fetch returns None (all sources failed), record error metadata."""
        spec = {
            "name": "Broken",
            "data_sources": [{"id": "bad", "type": "http_json",
                              "config": {"url": "http://broken"}}],
            "refresh_interval": 60,
        }
        await _insert_module(db_path, "mod-fail", spec)

        async def mock_fetch(module, **kwargs):
            return None

        result = await refresh_module(
            "mod-fail", db_path, push_fn=None, fetch_fn=mock_fetch
        )

        assert result is False

        # updated_at should NOT be changed (failure)
        row = await _get_module_row(db_path, "mod-fail")
        assert row["updated_at"] == "2026-01-01T00:00:00Z"
        assert row["last_refresh_error"] is not None

    @pytest.mark.asyncio
    async def test_module_not_found_returns_false(self, db_path):
        """refresh_module returns False when module doesn't exist in DB."""
        async def mock_fetch(module, **kwargs):
            return {"data": "ok"}

        result = await refresh_module(
            "nonexistent", db_path, push_fn=None, fetch_fn=mock_fetch
        )

        assert result is False


class TestRefreshModuleIsolation:
    """Module isolation: one failure doesn't affect others."""

    @pytest.mark.asyncio
    async def test_failure_isolated_from_other_modules(self, db_path):
        """Module A fails, Module B succeeds — B is updated, A has error."""
        spec_a = {
            "name": "Module A",
            "data_sources": [{"id": "a", "type": "http_json",
                              "config": {"url": "http://test-a"}}],
            "refresh_interval": 60,
        }
        spec_b = {
            "name": "Module B",
            "data_sources": [{"id": "b", "type": "http_json",
                              "config": {"url": "http://test-b"}}],
            "refresh_interval": 60,
        }
        await _insert_module(db_path, "mod-a", spec_a)
        await _insert_module(db_path, "mod-b", spec_b)

        call_count = {"a": 0, "b": 0}

        async def mock_fetch_a(module, **kwargs):
            call_count["a"] += 1
            return None  # Simulates failure

        async def mock_fetch_b(module, **kwargs):
            call_count["b"] += 1
            return {"b": {"result": "ok"}}

        # Refresh A (fails)
        result_a = await refresh_module(
            "mod-a", db_path, push_fn=None, fetch_fn=mock_fetch_a
        )
        # Refresh B (succeeds)
        result_b = await refresh_module(
            "mod-b", db_path, push_fn=None, fetch_fn=mock_fetch_b
        )

        assert result_a is False
        assert result_b is True

        # Verify A has error, B is updated
        row_a = await _get_module_row(db_path, "mod-a")
        assert row_a["updated_at"] == "2026-01-01T00:00:00Z"
        assert row_a["last_refresh_error"] is not None

        row_b = await _get_module_row(db_path, "mod-b")
        assert row_b["updated_at"] != "2026-01-01T00:00:00Z"
        assert row_b["last_refresh_error"] is None


class TestRefreshModulePushFnNone:
    """push_fn is None (no connected clients)."""

    @pytest.mark.asyncio
    async def test_push_fn_none_still_updates_db(self, db_path):
        """When push_fn is None, refresh still updates DB (AC #8)."""
        spec = {
            "name": "No Client",
            "data_sources": [{"id": "s1", "type": "http_json",
                              "config": {"url": "http://test"}}],
            "refresh_interval": 60,
        }
        await _insert_module(db_path, "mod-nc", spec)

        async def mock_fetch(module, **kwargs):
            return {"s1": {"data": "fresh"}}

        result = await refresh_module(
            "mod-nc", db_path, push_fn=None, fetch_fn=mock_fetch
        )

        assert result is True

        row = await _get_module_row(db_path, "mod-nc")
        assert row["updated_at"] != "2026-01-01T00:00:00Z"
        assert row["spec"]["data"] == {"s1": {"data": "fresh"}}
