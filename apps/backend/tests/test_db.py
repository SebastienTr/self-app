"""Tests for the database module with migration runner (Tasks 3 & 4)."""

import os
from pathlib import Path

import aiosqlite

from app.db import get_connection, get_schema_version, run_migrations

# Path to the real migrations directory
MIGRATIONS_DIR = str(Path(__file__).parent.parent / "migrations")


def _path_exists(path: str) -> bool:
    """Check if a file path exists (sync helper for tests)."""
    return Path(path).exists()


def _write_migration_file(migrations_dir: str, filename: str, content: str) -> None:
    """Write a migration SQL file (sync helper for tests)."""
    with open(os.path.join(migrations_dir, filename), "w") as f:
        f.write(content)


class TestGetConnection:
    """Test database connection setup."""

    async def test_creates_connection(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        db = await get_connection(db_path)
        assert db is not None
        await db.close()

    async def test_enables_wal_mode(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        db = await get_connection(db_path)
        cursor = await db.execute("PRAGMA journal_mode;")
        row = await cursor.fetchone()
        assert row[0] == "wal"
        await db.close()

    async def test_sets_wal_autocheckpoint(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        db = await get_connection(db_path)
        cursor = await db.execute("PRAGMA wal_autocheckpoint;")
        row = await cursor.fetchone()
        assert row[0] == 1000
        await db.close()

    async def test_sets_journal_size_limit(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        db = await get_connection(db_path)
        cursor = await db.execute("PRAGMA journal_size_limit;")
        row = await cursor.fetchone()
        assert row[0] == 10485760
        await db.close()

    async def test_creates_db_file(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        assert not _path_exists(db_path)
        db = await get_connection(db_path)
        await db.close()
        assert _path_exists(db_path)


class TestRunMigrations:
    """Test the migration runner."""

    async def test_applies_all_migrations(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        count = await run_migrations(db_path, MIGRATIONS_DIR)
        assert count == 3

    async def test_creates_schema_version_table(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        await run_migrations(db_path, MIGRATIONS_DIR)
        async with aiosqlite.connect(db_path) as db:
            cursor = await db.execute("SELECT MAX(version) FROM schema_version;")
            row = await cursor.fetchone()
            assert row[0] == 3

    async def test_creates_all_tables(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        await run_migrations(db_path, MIGRATIONS_DIR)
        expected_tables = {
            "modules",
            "memory_core",
            "memory_episodic",
            "sessions",
            "schema_version",
            "llm_usage",
        }
        async with aiosqlite.connect(db_path) as db:
            cursor = await db.execute(
                "SELECT name FROM sqlite_master "
                "WHERE type='table' AND name NOT LIKE 'sqlite_%';"
            )
            rows = await cursor.fetchall()
            actual_tables = {row[0] for row in rows}
            assert expected_tables.issubset(actual_tables)

    async def test_idempotent_migration(self, tmp_path):
        """Running migrations twice applies them only once."""
        db_path = str(tmp_path / "test.db")
        count1 = await run_migrations(db_path, MIGRATIONS_DIR)
        count2 = await run_migrations(db_path, MIGRATIONS_DIR)
        assert count1 == 3
        assert count2 == 0

    async def test_creates_backup_before_migration(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        # Create an existing db first
        async with aiosqlite.connect(db_path) as db:
            await db.execute("CREATE TABLE dummy (id INTEGER);")
            await db.commit()
        await run_migrations(db_path, MIGRATIONS_DIR)
        # Check that a backup file was created
        backup_files = [f for f in os.listdir(tmp_path) if f.startswith("test.db.backup-")]
        assert len(backup_files) >= 1

    async def test_no_backup_for_fresh_db(self, tmp_path):
        """No backup needed when running on a brand new database."""
        db_path = str(tmp_path / "test.db")
        await run_migrations(db_path, MIGRATIONS_DIR)
        backup_files = [f for f in os.listdir(tmp_path) if f.startswith("test.db.backup-")]
        assert len(backup_files) == 0

    async def test_migration_files_applied_in_order(self, tmp_path):
        """Migrations are applied in numerical order."""
        migrations_dir = str(tmp_path / "migrations")
        os.makedirs(migrations_dir)

        # Write two migration files (using sync helper)
        _write_migration_file(
            migrations_dir,
            "001_first.sql",
            "CREATE TABLE IF NOT EXISTS schema_version "
            "(version INTEGER PRIMARY KEY);\n"
            "INSERT INTO schema_version (version) VALUES (1);\n",
        )
        _write_migration_file(
            migrations_dir,
            "002_second.sql",
            "CREATE TABLE IF NOT EXISTS extra (id TEXT PRIMARY KEY);\n"
            "INSERT INTO schema_version (version) VALUES (2);\n",
        )

        db_path = str(tmp_path / "test.db")
        count = await run_migrations(db_path, migrations_dir)
        assert count == 2

        async with aiosqlite.connect(db_path) as db:
            cursor = await db.execute("SELECT MAX(version) FROM schema_version;")
            row = await cursor.fetchone()
            assert row[0] == 2

            # Verify extra table exists (from migration 002)
            cursor = await db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='extra';"
            )
            row = await cursor.fetchone()
            assert row is not None


class TestGetSchemaVersion:
    """Test schema version retrieval."""

    async def test_returns_zero_for_fresh_db(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        async with aiosqlite.connect(db_path) as db:
            version = await get_schema_version(db)
            assert version == 0

    async def test_returns_version_after_migration(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        await run_migrations(db_path, MIGRATIONS_DIR)
        async with aiosqlite.connect(db_path) as db:
            version = await get_schema_version(db)
            assert version == 3


class TestDryRun:
    """Test --dry-run support."""

    async def test_dry_run_does_not_apply_migrations(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        pending = await run_migrations(db_path, MIGRATIONS_DIR, dry_run=True)
        assert pending == 3
        # DB should not have the tables
        async with aiosqlite.connect(db_path) as db:
            cursor = await db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='modules';"
            )
            row = await cursor.fetchone()
            assert row is None


class TestModulesTableSchema:
    """Verify the modules table schema from 001_init.sql."""

    async def test_modules_has_user_id_default(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        await run_migrations(db_path, MIGRATIONS_DIR)
        async with aiosqlite.connect(db_path) as db:
            cursor = await db.execute("PRAGMA table_info(modules);")
            columns = {row[1]: row[4] for row in await cursor.fetchall()}
            assert columns["user_id"] == "'default'"

    async def test_all_tables_have_user_id(self, tmp_path):
        """NFR29: All tables include user_id DEFAULT 'default'."""
        db_path = str(tmp_path / "test.db")
        await run_migrations(db_path, MIGRATIONS_DIR)
        tables_with_user_id = [
            "modules",
            "memory_core",
            "memory_episodic",
            "sessions",
            "llm_usage",
        ]
        async with aiosqlite.connect(db_path) as db:
            for table in tables_with_user_id:
                cursor = await db.execute(f"PRAGMA table_info({table});")  # noqa: E501
                columns = {row[1] for row in await cursor.fetchall()}
                assert "user_id" in columns, f"Table {table} missing user_id column"
