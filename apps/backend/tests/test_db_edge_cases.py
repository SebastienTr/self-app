"""Additional edge-case and error-path tests for the database module.

Covers helper functions, error handling, migration edge cases, backup behavior,
and schema validation not covered by the existing test_db.py.
"""

import os
from pathlib import Path

import aiosqlite
import pytest

from app.db import (
    _create_backup,
    _db_file_has_content,
    _discover_migrations,
    _ensure_parent_dir,
    _read_sql_file,
    get_connection,
    get_schema_version,
    run_migrations,
)


def _path_exists(path: str) -> bool:
    """Check if a file path exists (sync helper for tests, avoids ASYNC240)."""
    return Path(path).exists()

# Path to the real migrations directory
MIGRATIONS_DIR = str(Path(__file__).parent.parent / "migrations")


def _write_migration_file(migrations_dir: str, filename: str, content: str) -> None:
    """Write a migration SQL file (sync helper for tests)."""
    with open(os.path.join(migrations_dir, filename), "w") as f:
        f.write(content)


# ---------------------------------------------------------------------------
# Helper function tests
# ---------------------------------------------------------------------------


class TestEnsureParentDir:
    """Test the _ensure_parent_dir helper."""

    def test_creates_single_parent(self, tmp_path):
        db_path = str(tmp_path / "newdir" / "test.db")
        _ensure_parent_dir(db_path)
        assert (tmp_path / "newdir").is_dir()

    def test_creates_nested_parents(self, tmp_path):
        db_path = str(tmp_path / "a" / "b" / "c" / "test.db")
        _ensure_parent_dir(db_path)
        assert (tmp_path / "a" / "b" / "c").is_dir()

    def test_existing_dir_no_error(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        # tmp_path already exists
        _ensure_parent_dir(db_path)  # Should not raise


class TestDbFileHasContent:
    """Test the _db_file_has_content helper."""

    def test_nonexistent_file_returns_false(self, tmp_path):
        assert _db_file_has_content(str(tmp_path / "nofile.db")) is False

    def test_empty_file_returns_false(self, tmp_path):
        empty = tmp_path / "empty.db"
        empty.touch()
        assert _db_file_has_content(str(empty)) is False

    def test_file_with_content_returns_true(self, tmp_path):
        filled = tmp_path / "filled.db"
        filled.write_bytes(b"some data")
        assert _db_file_has_content(str(filled)) is True


class TestReadSqlFile:
    """Test the _read_sql_file helper."""

    def test_reads_file_content(self, tmp_path):
        sql_file = tmp_path / "test.sql"
        sql_file.write_text("CREATE TABLE test (id INTEGER);", encoding="utf-8")
        content = _read_sql_file(str(sql_file))
        assert content == "CREATE TABLE test (id INTEGER);"

    def test_reads_utf8_content(self, tmp_path):
        sql_file = tmp_path / "unicode.sql"
        sql_file.write_text("-- Comment with accents: cafe\n", encoding="utf-8")
        content = _read_sql_file(str(sql_file))
        assert "cafe" in content


class TestDiscoverMigrations:
    """Test the _discover_migrations helper."""

    def test_empty_directory(self, tmp_path):
        migrations_dir = str(tmp_path / "migrations")
        os.makedirs(migrations_dir)
        result = _discover_migrations(migrations_dir)
        assert result == []

    def test_nonexistent_directory(self, tmp_path):
        result = _discover_migrations(str(tmp_path / "nonexistent"))
        assert result == []

    def test_ignores_non_sql_files(self, tmp_path):
        migrations_dir = str(tmp_path / "migrations")
        os.makedirs(migrations_dir)
        (tmp_path / "migrations" / "readme.md").write_text("docs")
        (tmp_path / "migrations" / "001_init.sql").write_text("SQL")
        result = _discover_migrations(migrations_dir)
        assert len(result) == 1
        assert result[0][0] == 1

    def test_ignores_files_without_numeric_prefix(self, tmp_path):
        migrations_dir = str(tmp_path / "migrations")
        os.makedirs(migrations_dir)
        (tmp_path / "migrations" / "init.sql").write_text("SQL")
        (tmp_path / "migrations" / "001_real.sql").write_text("SQL")
        result = _discover_migrations(migrations_dir)
        assert len(result) == 1

    def test_sorts_by_version_number(self, tmp_path):
        migrations_dir = str(tmp_path / "migrations")
        os.makedirs(migrations_dir)
        (tmp_path / "migrations" / "003_third.sql").write_text("SQL")
        (tmp_path / "migrations" / "001_first.sql").write_text("SQL")
        (tmp_path / "migrations" / "002_second.sql").write_text("SQL")
        result = _discover_migrations(migrations_dir)
        assert [v for v, _ in result] == [1, 2, 3]

    def test_handles_large_version_numbers(self, tmp_path):
        migrations_dir = str(tmp_path / "migrations")
        os.makedirs(migrations_dir)
        (tmp_path / "migrations" / "100_big.sql").write_text("SQL")
        result = _discover_migrations(migrations_dir)
        assert result[0][0] == 100


class TestCreateBackup:
    """Test the _create_backup helper."""

    def test_creates_backup_file(self, tmp_path):
        from app.logging import setup_logging

        setup_logging("warning")  # suppress log output in tests

        db_file = tmp_path / "test.db"
        db_file.write_text("original content")
        backup_path = _create_backup(str(db_file))
        assert os.path.exists(backup_path)

    def test_backup_has_correct_content(self, tmp_path):
        from app.logging import setup_logging

        setup_logging("warning")

        db_file = tmp_path / "test.db"
        db_file.write_text("original content")
        backup_path = _create_backup(str(db_file))
        assert Path(backup_path).read_text() == "original content"

    def test_backup_filename_contains_timestamp(self, tmp_path):
        from app.logging import setup_logging

        setup_logging("warning")

        db_file = tmp_path / "test.db"
        db_file.write_text("data")
        backup_path = _create_backup(str(db_file))
        assert ".backup-" in backup_path
        # Timestamp format: YYYYMMDDTHHMMSSZ
        basename = os.path.basename(backup_path)
        ts_part = basename.split(".backup-")[1]
        assert ts_part.endswith("Z")
        assert "T" in ts_part


# ---------------------------------------------------------------------------
# Connection edge cases
# ---------------------------------------------------------------------------


class TestGetConnectionEdgeCases:
    """Edge cases for the get_connection function."""

    async def test_creates_parent_directories_for_db(self, tmp_path):
        db_path = str(tmp_path / "new" / "nested" / "test.db")
        db = await get_connection(db_path)
        assert db is not None
        await db.close()
        assert _path_exists(db_path)

    async def test_multiple_connections_same_file(self, tmp_path):
        """Multiple connections to the same WAL-mode DB should work."""
        db_path = str(tmp_path / "test.db")
        db1 = await get_connection(db_path)
        db2 = await get_connection(db_path)
        try:
            # Both connections should be functional
            cursor1 = await db1.execute("PRAGMA journal_mode;")
            row1 = await cursor1.fetchone()
            assert row1[0] == "wal"

            cursor2 = await db2.execute("PRAGMA journal_mode;")
            row2 = await cursor2.fetchone()
            assert row2[0] == "wal"
        finally:
            await db1.close()
            await db2.close()


# ---------------------------------------------------------------------------
# Migration runner edge cases
# ---------------------------------------------------------------------------


class TestRunMigrationsEdgeCases:
    """Edge-case and error-path tests for run_migrations."""

    async def test_no_migrations_dir_returns_zero(self, tmp_path):
        """Missing migrations directory should return 0 (no migrations found)."""
        db_path = str(tmp_path / "test.db")
        count = await run_migrations(db_path, str(tmp_path / "nonexistent"))
        assert count == 0

    async def test_empty_migrations_dir_returns_zero(self, tmp_path):
        """Empty migrations directory should return 0."""
        db_path = str(tmp_path / "test.db")
        migrations_dir = str(tmp_path / "migrations")
        os.makedirs(migrations_dir)
        count = await run_migrations(db_path, migrations_dir)
        assert count == 0

    async def test_invalid_sql_raises_exception(self, tmp_path):
        """Migration with invalid SQL should raise an exception."""
        db_path = str(tmp_path / "test.db")
        migrations_dir = str(tmp_path / "migrations")
        os.makedirs(migrations_dir)

        _write_migration_file(
            migrations_dir,
            "001_bad.sql",
            "THIS IS NOT VALID SQL AT ALL;",
        )

        from app.logging import setup_logging

        setup_logging("warning")

        with pytest.raises(Exception):
            await run_migrations(db_path, migrations_dir)

    async def test_incremental_migration_applies_only_new(self, tmp_path):
        """Running with one migration, then adding another, should only apply the new one."""
        db_path = str(tmp_path / "test.db")
        migrations_dir = str(tmp_path / "migrations")
        os.makedirs(migrations_dir)

        # First migration
        _write_migration_file(
            migrations_dir,
            "001_init.sql",
            "CREATE TABLE IF NOT EXISTS schema_version "
            "(version INTEGER PRIMARY KEY);\n"
            "INSERT INTO schema_version (version) VALUES (1);\n"
            "CREATE TABLE first_table (id TEXT PRIMARY KEY);\n",
        )

        count1 = await run_migrations(db_path, migrations_dir)
        assert count1 == 1

        # Add second migration
        _write_migration_file(
            migrations_dir,
            "002_add.sql",
            "CREATE TABLE second_table (id TEXT PRIMARY KEY);\n"
            "INSERT INTO schema_version (version) VALUES (2);\n",
        )

        count2 = await run_migrations(db_path, migrations_dir)
        assert count2 == 1  # Only the new one applied

        # Verify both tables exist
        async with aiosqlite.connect(db_path) as db:
            cursor = await db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
            )
            tables = {row[0] for row in await cursor.fetchall()}
            assert "first_table" in tables
            assert "second_table" in tables

    async def test_backup_created_for_incremental_migration(self, tmp_path):
        """Backup should be created when applying new migrations to existing DB."""
        from app.logging import setup_logging

        setup_logging("warning")

        db_path = str(tmp_path / "test.db")
        migrations_dir = str(tmp_path / "migrations")
        os.makedirs(migrations_dir)

        _write_migration_file(
            migrations_dir,
            "001_init.sql",
            "CREATE TABLE IF NOT EXISTS schema_version "
            "(version INTEGER PRIMARY KEY);\n"
            "INSERT INTO schema_version (version) VALUES (1);\n",
        )

        # First run (no backup for fresh DB)
        await run_migrations(db_path, migrations_dir)

        # Add second migration
        _write_migration_file(
            migrations_dir,
            "002_add.sql",
            "CREATE TABLE new_stuff (id TEXT);\n"
            "INSERT INTO schema_version (version) VALUES (2);\n",
        )

        # Second run (should create backup of existing DB)
        await run_migrations(db_path, migrations_dir)

        backup_files = [
            f for f in os.listdir(tmp_path) if f.startswith("test.db.backup-")
        ]
        assert len(backup_files) >= 1

    async def test_dry_run_returns_pending_count_without_changes(self, tmp_path):
        """Dry run on custom migrations returns correct pending count."""
        db_path = str(tmp_path / "test.db")
        migrations_dir = str(tmp_path / "migrations")
        os.makedirs(migrations_dir)

        _write_migration_file(
            migrations_dir,
            "001_a.sql",
            "CREATE TABLE IF NOT EXISTS schema_version "
            "(version INTEGER PRIMARY KEY);\n"
            "INSERT INTO schema_version (version) VALUES (1);\n",
        )
        _write_migration_file(
            migrations_dir,
            "002_b.sql",
            "CREATE TABLE b (id TEXT);\n"
            "INSERT INTO schema_version (version) VALUES (2);\n",
        )

        from app.logging import setup_logging

        setup_logging("warning")

        pending = await run_migrations(db_path, migrations_dir, dry_run=True)
        assert pending == 2

        # Verify nothing was applied
        async with aiosqlite.connect(db_path) as db:
            version = await get_schema_version(db)
            assert version == 0

    async def test_dry_run_after_partial_migration(self, tmp_path):
        """Dry run after some migrations are applied shows only remaining."""
        db_path = str(tmp_path / "test.db")
        migrations_dir = str(tmp_path / "migrations")
        os.makedirs(migrations_dir)

        _write_migration_file(
            migrations_dir,
            "001_init.sql",
            "CREATE TABLE IF NOT EXISTS schema_version "
            "(version INTEGER PRIMARY KEY);\n"
            "INSERT INTO schema_version (version) VALUES (1);\n",
        )

        # Apply first migration
        await run_migrations(db_path, migrations_dir)

        # Add second migration
        _write_migration_file(
            migrations_dir,
            "002_extra.sql",
            "CREATE TABLE extra (id TEXT);\n"
            "INSERT INTO schema_version (version) VALUES (2);\n",
        )

        from app.logging import setup_logging

        setup_logging("warning")

        pending = await run_migrations(db_path, migrations_dir, dry_run=True)
        assert pending == 1


class TestGetSchemaVersionEdgeCases:
    """Additional edge cases for get_schema_version."""

    async def test_returns_max_version(self, tmp_path):
        """Should return the MAX version, not just the latest insert."""
        db_path = str(tmp_path / "test.db")
        async with aiosqlite.connect(db_path) as db:
            await db.execute(
                "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);"
            )
            await db.execute("INSERT INTO schema_version (version) VALUES (1);")
            await db.execute("INSERT INTO schema_version (version) VALUES (3);")
            await db.execute("INSERT INTO schema_version (version) VALUES (2);")
            await db.commit()
            version = await get_schema_version(db)
            assert version == 3

    async def test_returns_zero_for_empty_schema_version_table(self, tmp_path):
        """Empty schema_version table should return 0."""
        db_path = str(tmp_path / "test.db")
        async with aiosqlite.connect(db_path) as db:
            await db.execute(
                "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);"
            )
            await db.commit()
            version = await get_schema_version(db)
            assert version == 0
