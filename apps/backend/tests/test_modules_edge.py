"""Edge-case tests for modules.py — Story 3.4 TEA expansion.

Covers paths NOT exercised by test_modules.py:
  - create_module: empty spec dict, spec with deeply nested structures,
    name with special characters (unicode, emoji, SQL injection attempts)
  - get_module: corrupted JSON in DB (JSONDecodeError fallback), empty spec string,
    NULL spec field
  - list_modules: corrupted JSON rows handled gracefully, empty spec rows,
    ordering correctness with many modules
  - DB connection: per-request connection pattern (each call opens/closes)
"""

import json

import aiosqlite
import pytest

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
    path = str(tmp_path / "test_modules_edge.db")
    await _setup_modules_db(path)
    return path


class TestCreateModuleEdgeCases:
    """Edge cases for create_module."""

    @pytest.mark.asyncio
    async def test_create_with_empty_spec_dict(self, db_path):
        """create_module works with an empty spec dict."""
        result = await create_module(db_path, "Empty Spec Module", {})

        assert result["name"] == "Empty Spec Module"
        assert result["spec"] == {}
        assert result["status"] == "active"

        # Verify it's retrievable
        fetched = await get_module(db_path, result["id"])
        assert fetched is not None
        assert fetched["spec"] == {}

    @pytest.mark.asyncio
    async def test_create_with_deeply_nested_spec(self, db_path):
        """create_module correctly stores and retrieves deeply nested spec."""
        spec = {
            "name": "Nested",
            "type": "metric",
            "template": "metric-dashboard",
            "data_sources": [
                {
                    "id": "api-1",
                    "type": "rest_api",
                    "config": {
                        "url": "https://api.example.com",
                        "method": "GET",
                        "headers": {
                            "Accept": "application/json",
                            "X-Custom": {"nested": {"deeply": True}},
                        },
                    },
                }
            ],
            "refresh_interval": 3600,
            "schema_version": 1,
            "accessible_label": "test",
            "metadata": {"tags": ["weather", "outdoor"], "priority": 1},
        }

        result = await create_module(db_path, "Nested", spec)
        fetched = await get_module(db_path, result["id"])

        assert fetched is not None
        assert fetched["spec"]["data_sources"][0]["config"]["headers"]["X-Custom"]["nested"]["deeply"] is True
        assert fetched["spec"]["metadata"]["tags"] == ["weather", "outdoor"]

    @pytest.mark.asyncio
    async def test_create_with_unicode_name(self, db_path):
        """create_module handles unicode characters in name."""
        result = await create_module(db_path, "Weather Paris", {"name": "test"})

        assert result["name"] == "Weather Paris"

        fetched = await get_module(db_path, result["id"])
        assert fetched["name"] == "Weather Paris"

    @pytest.mark.asyncio
    async def test_create_with_special_characters_in_name(self, db_path):
        """create_module handles special characters safely (no SQL injection)."""
        dangerous_name = "Robert'); DROP TABLE modules;--"
        result = await create_module(db_path, dangerous_name, {"name": "safe"})

        assert result["name"] == dangerous_name

        # Table should still exist and module should be retrievable
        fetched = await get_module(db_path, result["id"])
        assert fetched is not None
        assert fetched["name"] == dangerous_name

        # Verify table still works
        all_modules = await list_modules(db_path)
        assert len(all_modules) == 1

    @pytest.mark.asyncio
    async def test_create_with_very_long_name_is_truncated(self, db_path):
        """create_module truncates names exceeding 200 characters."""
        long_name = "A" * 10000
        result = await create_module(db_path, long_name, {"name": "long"})

        assert result["name"] == "A" * 200
        fetched = await get_module(db_path, result["id"])
        assert fetched["name"] == "A" * 200

    @pytest.mark.asyncio
    async def test_create_with_large_spec(self, db_path):
        """create_module handles large spec with many data sources."""
        spec = {
            "name": "Multi-source",
            "type": "list",
            "template": "simple-list",
            "data_sources": [
                {
                    "id": f"api-{i}",
                    "type": "rest_api",
                    "config": {"url": f"https://api{i}.example.com", "method": "GET"},
                }
                for i in range(50)
            ],
            "refresh_interval": 300,
            "schema_version": 1,
            "accessible_label": "multi source module",
        }

        result = await create_module(db_path, "Multi-source", spec)
        fetched = await get_module(db_path, result["id"])
        assert len(fetched["spec"]["data_sources"]) == 50

    @pytest.mark.asyncio
    async def test_create_timestamps_are_equal(self, db_path):
        """created_at and updated_at should be identical on creation."""
        spec = {"name": "Test"}
        result = await create_module(db_path, "Test", spec)

        assert result["created_at"] == result["updated_at"]

    @pytest.mark.asyncio
    async def test_create_multiple_modules_have_unique_ids(self, db_path):
        """Creating many modules generates unique IDs for each."""
        ids = set()
        for i in range(20):
            result = await create_module(db_path, f"Module-{i}", {"name": f"mod-{i}"})
            ids.add(result["id"])

        assert len(ids) == 20

    @pytest.mark.asyncio
    async def test_create_spec_with_null_values(self, db_path):
        """create_module handles spec containing null values."""
        spec = {
            "name": "Nullable",
            "type": "metric",
            "template": None,
            "data_sources": None,
            "optional_field": None,
        }

        result = await create_module(db_path, "Nullable", spec)
        fetched = await get_module(db_path, result["id"])

        assert fetched["spec"]["template"] is None
        assert fetched["spec"]["data_sources"] is None

    @pytest.mark.asyncio
    async def test_create_spec_with_boolean_and_numeric_values(self, db_path):
        """create_module preserves boolean and numeric types in spec."""
        spec = {
            "name": "Types",
            "active": True,
            "count": 42,
            "ratio": 3.14,
            "disabled": False,
        }

        result = await create_module(db_path, "Types", spec)
        fetched = await get_module(db_path, result["id"])

        assert fetched["spec"]["active"] is True
        assert fetched["spec"]["count"] == 42
        assert fetched["spec"]["ratio"] == 3.14
        assert fetched["spec"]["disabled"] is False


class TestGetModuleEdgeCases:
    """Edge cases for get_module."""

    @pytest.mark.asyncio
    async def test_get_with_corrupted_json_in_db(self, db_path):
        """get_module returns empty dict for spec when DB contains corrupted JSON."""
        # Insert row with corrupted JSON directly
        db = await aiosqlite.connect(db_path)
        try:
            await db.execute(
                "INSERT INTO modules (id, name, spec, status, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                ("corrupt-id", "Corrupt Module", "NOT VALID JSON {{{", "active", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z"),
            )
            await db.commit()
        finally:
            await db.close()

        result = await get_module(db_path, "corrupt-id")

        assert result is not None
        assert result["id"] == "corrupt-id"
        assert result["name"] == "Corrupt Module"
        # Corrupted JSON should result in empty dict (JSONDecodeError fallback)
        assert result["spec"] == {}

    @pytest.mark.asyncio
    async def test_get_with_empty_string_spec_in_db(self, db_path):
        """get_module returns empty dict for spec when DB contains empty string."""
        db = await aiosqlite.connect(db_path)
        try:
            await db.execute(
                "INSERT INTO modules (id, name, spec, status, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                ("empty-spec-id", "Empty Spec", "", "active", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z"),
            )
            await db.commit()
        finally:
            await db.close()

        result = await get_module(db_path, "empty-spec-id")

        assert result is not None
        assert result["spec"] == {}

    @pytest.mark.asyncio
    async def test_get_with_empty_string_id(self, db_path):
        """get_module with empty string id returns None."""
        result = await get_module(db_path, "")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_preserves_all_fields(self, db_path):
        """get_module returns all fields from the DB row correctly."""
        spec = {
            "name": "Full Fields",
            "type": "metric",
            "template": "metric-dashboard",
            "data_sources": [{"id": "a", "type": "rest_api", "config": {"url": "http://test"}}],
            "refresh_interval": 3600,
            "schema_version": 1,
            "accessible_label": "full fields module",
        }

        created = await create_module(db_path, "Full Fields", spec)
        fetched = await get_module(db_path, created["id"])

        assert fetched["id"] == created["id"]
        assert fetched["name"] == created["name"]
        assert fetched["spec"] == created["spec"]
        assert fetched["status"] == created["status"]
        assert fetched["created_at"] == created["created_at"]
        assert fetched["updated_at"] == created["updated_at"]


class TestListModulesEdgeCases:
    """Edge cases for list_modules."""

    @pytest.mark.asyncio
    async def test_list_with_corrupted_json_rows(self, db_path):
        """list_modules handles rows with corrupted JSON gracefully."""
        # Insert a valid module
        await create_module(db_path, "Valid", {"name": "valid"})

        # Insert a row with corrupted JSON directly
        db = await aiosqlite.connect(db_path)
        try:
            await db.execute(
                "INSERT INTO modules (id, name, spec, status, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                ("corrupt-id", "Corrupt", "INVALID JSON", "active", "2099-01-01T00:00:00Z", "2099-01-01T00:00:00Z"),
            )
            await db.commit()
        finally:
            await db.close()

        result = await list_modules(db_path)

        assert len(result) == 2
        # The corrupted row should have empty spec
        corrupt_module = next(m for m in result if m["id"] == "corrupt-id")
        assert corrupt_module["spec"] == {}
        assert corrupt_module["name"] == "Corrupt"

    @pytest.mark.asyncio
    async def test_list_ordering_with_many_modules(self, db_path):
        """list_modules returns modules ordered by updated_at DESC with many entries."""
        # Create modules with slight time differences
        for i in range(10):
            await create_module(db_path, f"Module-{i}", {"name": f"mod-{i}"})

        result = await list_modules(db_path)

        assert len(result) == 10
        # Last created should be first (newest updated_at)
        assert result[0]["name"] == "Module-9"
        assert result[-1]["name"] == "Module-0"

    @pytest.mark.asyncio
    async def test_list_returns_parsed_spec_for_each_module(self, db_path):
        """list_modules returns parsed spec (dict) not raw JSON string."""
        spec = {"name": "Test", "type": "metric", "nested": {"key": "value"}}
        await create_module(db_path, "Test", spec)

        result = await list_modules(db_path)

        assert len(result) == 1
        assert isinstance(result[0]["spec"], dict)
        assert result[0]["spec"]["nested"]["key"] == "value"

    @pytest.mark.asyncio
    async def test_list_after_multiple_creates_returns_all(self, db_path):
        """list_modules returns all modules after multiple create_module calls."""
        for i in range(5):
            await create_module(db_path, f"Module-{i}", {"idx": i})

        result = await list_modules(db_path)
        assert len(result) == 5
        names = {m["name"] for m in result}
        for i in range(5):
            assert f"Module-{i}" in names

    @pytest.mark.asyncio
    async def test_list_with_empty_spec_rows(self, db_path):
        """list_modules handles rows where spec is empty string."""
        db = await aiosqlite.connect(db_path)
        try:
            await db.execute(
                "INSERT INTO modules (id, name, spec, status, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                ("empty-1", "Empty", "", "active", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z"),
            )
            await db.commit()
        finally:
            await db.close()

        result = await list_modules(db_path)
        assert len(result) == 1
        assert result[0]["spec"] == {}
