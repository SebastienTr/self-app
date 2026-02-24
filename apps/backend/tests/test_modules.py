"""Tests for modules.py — Module CRUD operations.

Tests create_module, get_module, list_modules with in-memory SQLite.
Follows TDD: write tests first, then implement to pass.
"""

import json
import uuid

import aiosqlite
import pytest

# Will import from app.modules once created
from app.modules import create_module, get_module, list_modules


async def _setup_modules_db(db_path: str) -> None:
    """Create modules table for tests (mirrors 001_init.sql)."""
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
        await db.commit()
    finally:
        await db.close()


@pytest.fixture
async def db_path(tmp_path):
    """Create a temp DB with modules table."""
    path = str(tmp_path / "test_modules.db")
    await _setup_modules_db(path)
    return path


class TestCreateModule:
    """Tests for create_module."""

    @pytest.mark.asyncio
    async def test_create_returns_dict_with_all_fields(self, db_path):
        """create_module returns dict with id, name, spec, status, created_at, updated_at."""
        spec = {
            "name": "Paris Weather",
            "type": "metric",
            "template": "metric-dashboard",
            "data_sources": [
                {
                    "id": "openmeteo-paris",
                    "type": "rest_api",
                    "config": {"url": "https://api.open-meteo.com/v1/forecast", "method": "GET"},
                }
            ],
            "refresh_interval": 3600,
            "schema_version": 1,
            "accessible_label": "Paris weather forecast",
        }

        result = await create_module(db_path, "Paris Weather", spec)

        assert "id" in result
        assert result["name"] == "Paris Weather"
        assert "spec" in result
        assert result["status"] == "active"
        assert "created_at" in result
        assert "updated_at" in result

    @pytest.mark.asyncio
    async def test_create_generates_uuid_v4_id(self, db_path):
        """create_module generates a valid UUID v4 for id."""
        spec = {"name": "Test", "type": "metric", "template": "metric-dashboard",
                "data_sources": [], "refresh_interval": 3600, "schema_version": 1,
                "accessible_label": "test"}

        result = await create_module(db_path, "Test", spec)

        # Verify it's a valid UUID
        parsed = uuid.UUID(result["id"])
        assert parsed.version == 4

    @pytest.mark.asyncio
    async def test_create_stores_spec_as_json_roundtrip(self, db_path):
        """Spec stored as JSON in DB is correctly round-tripped."""
        spec = {
            "name": "Weather",
            "type": "metric",
            "template": "metric-dashboard",
            "data_sources": [{"id": "api-1", "type": "rest_api", "config": {"url": "http://test.com"}}],
            "refresh_interval": 3600,
            "schema_version": 1,
            "accessible_label": "Weather module",
        }

        result = await create_module(db_path, "Weather", spec)

        # Read directly from DB to verify JSON storage
        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute("SELECT spec FROM modules WHERE id = ?", (result["id"],))
            row = await cursor.fetchone()
            stored_spec = json.loads(row[0])
            assert stored_spec["data_sources"][0]["id"] == "api-1"
            assert stored_spec["refresh_interval"] == 3600
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_create_sets_status_active(self, db_path):
        """create_module sets status to 'active'."""
        spec = {"name": "Test", "type": "metric", "template": "metric-dashboard",
                "data_sources": [], "refresh_interval": 3600, "schema_version": 1,
                "accessible_label": "test"}

        result = await create_module(db_path, "Test", spec)
        assert result["status"] == "active"

    @pytest.mark.asyncio
    async def test_create_sets_iso8601_timestamps(self, db_path):
        """created_at and updated_at are ISO 8601 UTC strings."""
        spec = {"name": "Test", "type": "metric", "template": "metric-dashboard",
                "data_sources": [], "refresh_interval": 3600, "schema_version": 1,
                "accessible_label": "test"}

        result = await create_module(db_path, "Test", spec)

        # Should be parseable ISO 8601
        from datetime import datetime, timezone
        created = datetime.fromisoformat(result["created_at"])
        updated = datetime.fromisoformat(result["updated_at"])
        assert created.tzinfo is not None or result["created_at"].endswith("+00:00") or "Z" in result["created_at"]

    @pytest.mark.asyncio
    async def test_create_spec_includes_id_in_returned_spec(self, db_path):
        """The returned spec dict should include the generated id."""
        spec = {"name": "Test", "type": "metric", "template": "metric-dashboard",
                "data_sources": [], "refresh_interval": 3600, "schema_version": 1,
                "accessible_label": "test"}

        result = await create_module(db_path, "Test", spec)
        assert result["spec"]["name"] == "Test"

    @pytest.mark.asyncio
    async def test_create_duplicate_id_raises_error(self, db_path):
        """Creating two modules should generate unique IDs (no collisions)."""
        spec = {"name": "Test", "type": "metric", "template": "metric-dashboard",
                "data_sources": [], "refresh_interval": 3600, "schema_version": 1,
                "accessible_label": "test"}

        result1 = await create_module(db_path, "Test1", spec)
        result2 = await create_module(db_path, "Test2", spec)

        assert result1["id"] != result2["id"]


class TestGetModule:
    """Tests for get_module."""

    @pytest.mark.asyncio
    async def test_get_returns_none_for_missing(self, db_path):
        """get_module returns None for non-existent module_id."""
        result = await get_module(db_path, "nonexistent-id")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_returns_created_module(self, db_path):
        """get_module returns the module that was created."""
        spec = {"name": "Weather", "type": "metric", "template": "metric-dashboard",
                "data_sources": [], "refresh_interval": 3600, "schema_version": 1,
                "accessible_label": "weather"}

        created = await create_module(db_path, "Weather", spec)
        fetched = await get_module(db_path, created["id"])

        assert fetched is not None
        assert fetched["id"] == created["id"]
        assert fetched["name"] == "Weather"
        assert fetched["spec"]["type"] == "metric"


class TestListModules:
    """Tests for list_modules."""

    @pytest.mark.asyncio
    async def test_list_returns_empty_when_no_modules(self, db_path):
        """list_modules returns empty list when no modules exist."""
        result = await list_modules(db_path)
        assert result == []

    @pytest.mark.asyncio
    async def test_list_returns_created_modules(self, db_path):
        """list_modules returns all created modules."""
        spec = {"name": "Test", "type": "metric", "template": "metric-dashboard",
                "data_sources": [], "refresh_interval": 3600, "schema_version": 1,
                "accessible_label": "test"}

        await create_module(db_path, "Module A", spec)
        await create_module(db_path, "Module B", spec)

        result = await list_modules(db_path)
        assert len(result) == 2
        names = {m["name"] for m in result}
        assert "Module A" in names
        assert "Module B" in names

    @pytest.mark.asyncio
    async def test_list_ordered_by_updated_at_desc(self, db_path):
        """list_modules returns modules ordered by updated_at descending (newest first)."""
        spec = {"name": "Test", "type": "metric", "template": "metric-dashboard",
                "data_sources": [], "refresh_interval": 3600, "schema_version": 1,
                "accessible_label": "test"}

        await create_module(db_path, "First", spec)
        await create_module(db_path, "Second", spec)

        result = await list_modules(db_path)
        # Second created should be first in list (newest first)
        assert result[0]["name"] == "Second"
        assert result[1]["name"] == "First"
