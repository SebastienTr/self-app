"""Tests for the 001_init.sql migration schema integrity.

Validates column definitions, constraints, types, NOT NULL enforcement,
DEFAULT values, and UNIQUE constraints for all tables created by the
initial migration. Ensures NFR29 multi-user readiness compliance.
"""

from pathlib import Path

import aiosqlite
import pytest

from app.db import run_migrations

MIGRATIONS_DIR = str(Path(__file__).parent.parent / "migrations")


@pytest.fixture
async def migrated_db(tmp_path):
    """Run migrations and return the database path."""
    db_path = str(tmp_path / "test.db")

    from app.logging import setup_logging

    setup_logging("warning")
    await run_migrations(db_path, MIGRATIONS_DIR)
    return db_path


async def _get_table_info(db_path: str, table: str) -> list[dict]:
    """Fetch PRAGMA table_info for a table and return as list of dicts."""
    async with aiosqlite.connect(db_path) as db:
        cursor = await db.execute(f"PRAGMA table_info({table});")
        rows = await cursor.fetchall()
        # Columns: cid, name, type, notnull, dflt_value, pk
        return [
            {
                "cid": r[0],
                "name": r[1],
                "type": r[2],
                "notnull": r[3],
                "default": r[4],
                "pk": r[5],
            }
            for r in rows
        ]


# ---------------------------------------------------------------------------
# modules table
# ---------------------------------------------------------------------------


class TestModulesTableSchema:
    """Validate the modules table schema."""

    async def test_has_all_expected_columns(self, migrated_db):
        info = await _get_table_info(migrated_db, "modules")
        columns = {r["name"] for r in info}
        expected = {
            "id",
            "name",
            "spec",
            "status",
            "vitality_score",
            "user_id",
            "created_at",
            "updated_at",
            "last_refreshed_at",
            "last_refresh_error",
        }
        assert expected == columns

    async def test_id_is_primary_key(self, migrated_db):
        info = await _get_table_info(migrated_db, "modules")
        id_col = next(r for r in info if r["name"] == "id")
        assert id_col["pk"] == 1

    async def test_id_is_text_type(self, migrated_db):
        info = await _get_table_info(migrated_db, "modules")
        id_col = next(r for r in info if r["name"] == "id")
        assert id_col["type"] == "TEXT"

    async def test_name_is_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "modules")
        name_col = next(r for r in info if r["name"] == "name")
        assert name_col["notnull"] == 1

    async def test_spec_is_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "modules")
        spec_col = next(r for r in info if r["name"] == "spec")
        assert spec_col["notnull"] == 1

    async def test_status_default_is_active(self, migrated_db):
        info = await _get_table_info(migrated_db, "modules")
        status_col = next(r for r in info if r["name"] == "status")
        assert status_col["default"] == "'active'"

    async def test_vitality_score_default_is_zero(self, migrated_db):
        info = await _get_table_info(migrated_db, "modules")
        vs_col = next(r for r in info if r["name"] == "vitality_score")
        assert vs_col["default"] == "0"

    async def test_vitality_score_type_is_real(self, migrated_db):
        info = await _get_table_info(migrated_db, "modules")
        vs_col = next(r for r in info if r["name"] == "vitality_score")
        assert vs_col["type"] == "REAL"

    async def test_user_id_default_is_default(self, migrated_db):
        info = await _get_table_info(migrated_db, "modules")
        uid_col = next(r for r in info if r["name"] == "user_id")
        assert uid_col["default"] == "'default'"

    async def test_user_id_is_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "modules")
        uid_col = next(r for r in info if r["name"] == "user_id")
        assert uid_col["notnull"] == 1

    async def test_created_at_is_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "modules")
        col = next(r for r in info if r["name"] == "created_at")
        assert col["notnull"] == 1

    async def test_updated_at_is_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "modules")
        col = next(r for r in info if r["name"] == "updated_at")
        assert col["notnull"] == 1


# ---------------------------------------------------------------------------
# memory_core table
# ---------------------------------------------------------------------------


class TestMemoryCoreTableSchema:
    """Validate the memory_core table schema."""

    async def test_has_all_expected_columns(self, migrated_db):
        info = await _get_table_info(migrated_db, "memory_core")
        columns = {r["name"] for r in info}
        expected = {"id", "key", "value", "category", "user_id", "created_at"}
        assert expected == columns

    async def test_id_is_primary_key(self, migrated_db):
        info = await _get_table_info(migrated_db, "memory_core")
        id_col = next(r for r in info if r["name"] == "id")
        assert id_col["pk"] == 1

    async def test_key_is_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "memory_core")
        col = next(r for r in info if r["name"] == "key")
        assert col["notnull"] == 1

    async def test_value_is_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "memory_core")
        col = next(r for r in info if r["name"] == "value")
        assert col["notnull"] == 1

    async def test_category_is_nullable(self, migrated_db):
        info = await _get_table_info(migrated_db, "memory_core")
        col = next(r for r in info if r["name"] == "category")
        assert col["notnull"] == 0

    async def test_user_id_default_and_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "memory_core")
        uid_col = next(r for r in info if r["name"] == "user_id")
        assert uid_col["default"] == "'default'"
        assert uid_col["notnull"] == 1


# ---------------------------------------------------------------------------
# memory_episodic table
# ---------------------------------------------------------------------------


class TestMemoryEpisodicTableSchema:
    """Validate the memory_episodic table schema."""

    async def test_has_all_expected_columns(self, migrated_db):
        info = await _get_table_info(migrated_db, "memory_episodic")
        columns = {r["name"] for r in info}
        expected = {"id", "content", "embedding", "module_id", "user_id", "created_at"}
        assert expected == columns

    async def test_content_is_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "memory_episodic")
        col = next(r for r in info if r["name"] == "content")
        assert col["notnull"] == 1

    async def test_embedding_is_blob_type(self, migrated_db):
        info = await _get_table_info(migrated_db, "memory_episodic")
        col = next(r for r in info if r["name"] == "embedding")
        assert col["type"] == "BLOB"

    async def test_embedding_is_nullable(self, migrated_db):
        info = await _get_table_info(migrated_db, "memory_episodic")
        col = next(r for r in info if r["name"] == "embedding")
        assert col["notnull"] == 0

    async def test_module_id_is_nullable(self, migrated_db):
        info = await _get_table_info(migrated_db, "memory_episodic")
        col = next(r for r in info if r["name"] == "module_id")
        assert col["notnull"] == 0

    async def test_user_id_default_and_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "memory_episodic")
        uid_col = next(r for r in info if r["name"] == "user_id")
        assert uid_col["default"] == "'default'"
        assert uid_col["notnull"] == 1


# ---------------------------------------------------------------------------
# sessions table
# ---------------------------------------------------------------------------


class TestSessionsTableSchema:
    """Validate the sessions table schema."""

    async def test_has_all_expected_columns(self, migrated_db):
        info = await _get_table_info(migrated_db, "sessions")
        columns = {r["name"] for r in info}
        expected = {"id", "token", "user_id", "created_at", "last_seen", "is_pairing"}
        assert expected == columns

    async def test_id_is_primary_key(self, migrated_db):
        info = await _get_table_info(migrated_db, "sessions")
        id_col = next(r for r in info if r["name"] == "id")
        assert id_col["pk"] == 1

    async def test_token_is_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "sessions")
        col = next(r for r in info if r["name"] == "token")
        assert col["notnull"] == 1

    async def test_token_unique_constraint(self, migrated_db):
        """The token column should have a UNIQUE constraint."""
        async with aiosqlite.connect(migrated_db) as db:
            # Check index list for unique index on token
            cursor = await db.execute("PRAGMA index_list(sessions);")
            indexes = await cursor.fetchall()
            # Find unique indexes
            unique_indexes = [idx for idx in indexes if idx[2] == 1]  # unique flag
            # At least one unique index should cover token
            token_indexed = False
            for idx in unique_indexes:
                idx_cursor = await db.execute(f"PRAGMA index_info({idx[1]});")
                idx_cols = await idx_cursor.fetchall()
                for col_info in idx_cols:
                    if col_info[2] == "token":
                        token_indexed = True
            assert token_indexed, "sessions.token should have a UNIQUE constraint"

    async def test_last_seen_is_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "sessions")
        col = next(r for r in info if r["name"] == "last_seen")
        assert col["notnull"] == 1

    async def test_user_id_default_and_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "sessions")
        uid_col = next(r for r in info if r["name"] == "user_id")
        assert uid_col["default"] == "'default'"
        assert uid_col["notnull"] == 1


# ---------------------------------------------------------------------------
# schema_version table
# ---------------------------------------------------------------------------


class TestSchemaVersionTableSchema:
    """Validate the schema_version table schema."""

    async def test_has_version_column(self, migrated_db):
        info = await _get_table_info(migrated_db, "schema_version")
        columns = {r["name"] for r in info}
        assert columns == {"version"}

    async def test_version_is_primary_key(self, migrated_db):
        info = await _get_table_info(migrated_db, "schema_version")
        col = next(r for r in info if r["name"] == "version")
        assert col["pk"] == 1

    async def test_version_type_is_integer(self, migrated_db):
        info = await _get_table_info(migrated_db, "schema_version")
        col = next(r for r in info if r["name"] == "version")
        assert col["type"] == "INTEGER"

    async def test_schema_versions_present(self, migrated_db):
        async with aiosqlite.connect(migrated_db) as db:
            cursor = await db.execute("SELECT version FROM schema_version ORDER BY version;")
            rows = await cursor.fetchall()
            versions = [r[0] for r in rows]
            assert versions == [1, 2, 3]


# ---------------------------------------------------------------------------
# llm_usage table
# ---------------------------------------------------------------------------


class TestLlmUsageTableSchema:
    """Validate the llm_usage table schema."""

    async def test_has_all_expected_columns(self, migrated_db):
        info = await _get_table_info(migrated_db, "llm_usage")
        columns = {r["name"] for r in info}
        expected = {
            "id",
            "provider",
            "model",
            "tokens_in",
            "tokens_out",
            "cost_estimate",
            "user_id",
            "created_at",
        }
        assert expected == columns

    async def test_id_is_primary_key(self, migrated_db):
        info = await _get_table_info(migrated_db, "llm_usage")
        id_col = next(r for r in info if r["name"] == "id")
        assert id_col["pk"] == 1

    async def test_provider_is_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "llm_usage")
        col = next(r for r in info if r["name"] == "provider")
        assert col["notnull"] == 1

    async def test_model_is_nullable(self, migrated_db):
        info = await _get_table_info(migrated_db, "llm_usage")
        col = next(r for r in info if r["name"] == "model")
        assert col["notnull"] == 0

    async def test_tokens_in_is_integer_type(self, migrated_db):
        info = await _get_table_info(migrated_db, "llm_usage")
        col = next(r for r in info if r["name"] == "tokens_in")
        assert col["type"] == "INTEGER"

    async def test_tokens_out_is_integer_type(self, migrated_db):
        info = await _get_table_info(migrated_db, "llm_usage")
        col = next(r for r in info if r["name"] == "tokens_out")
        assert col["type"] == "INTEGER"

    async def test_cost_estimate_is_real_type(self, migrated_db):
        info = await _get_table_info(migrated_db, "llm_usage")
        col = next(r for r in info if r["name"] == "cost_estimate")
        assert col["type"] == "REAL"

    async def test_user_id_default_and_not_null(self, migrated_db):
        info = await _get_table_info(migrated_db, "llm_usage")
        uid_col = next(r for r in info if r["name"] == "user_id")
        assert uid_col["default"] == "'default'"
        assert uid_col["notnull"] == 1


# ---------------------------------------------------------------------------
# Cross-table NFR29 compliance
# ---------------------------------------------------------------------------


class TestNFR29MultiUserReadiness:
    """Verify all data tables have user_id with DEFAULT 'default' and NOT NULL."""

    TABLES_WITH_USER_ID = [
        "modules",
        "memory_core",
        "memory_episodic",
        "sessions",
        "llm_usage",
    ]

    @pytest.mark.parametrize("table", TABLES_WITH_USER_ID)
    async def test_user_id_is_text_type(self, migrated_db, table):
        info = await _get_table_info(migrated_db, table)
        uid_col = next(r for r in info if r["name"] == "user_id")
        assert uid_col["type"] == "TEXT", f"{table}.user_id should be TEXT"

    @pytest.mark.parametrize("table", TABLES_WITH_USER_ID)
    async def test_user_id_has_default_value(self, migrated_db, table):
        info = await _get_table_info(migrated_db, table)
        uid_col = next(r for r in info if r["name"] == "user_id")
        assert uid_col["default"] == "'default'", (
            f"{table}.user_id should default to 'default'"
        )

    @pytest.mark.parametrize("table", TABLES_WITH_USER_ID)
    async def test_user_id_is_not_null(self, migrated_db, table):
        info = await _get_table_info(migrated_db, table)
        uid_col = next(r for r in info if r["name"] == "user_id")
        assert uid_col["notnull"] == 1, f"{table}.user_id should be NOT NULL"


# ---------------------------------------------------------------------------
# Data insertion validation
# ---------------------------------------------------------------------------


class TestNotNullConstraintEnforcement:
    """Verify NOT NULL constraints are enforced at the database level."""

    async def test_modules_rejects_null_name(self, migrated_db):
        async with aiosqlite.connect(migrated_db) as db:
            with pytest.raises(aiosqlite.IntegrityError):
                await db.execute(
                    "INSERT INTO modules (id, name, spec, created_at, updated_at) "
                    "VALUES ('m1', NULL, '{}', '2024-01-01', '2024-01-01');"
                )
                await db.commit()

    async def test_modules_rejects_null_spec(self, migrated_db):
        async with aiosqlite.connect(migrated_db) as db:
            with pytest.raises(aiosqlite.IntegrityError):
                await db.execute(
                    "INSERT INTO modules (id, name, spec, created_at, updated_at) "
                    "VALUES ('m1', 'test', NULL, '2024-01-01', '2024-01-01');"
                )
                await db.commit()

    async def test_sessions_rejects_null_token(self, migrated_db):
        async with aiosqlite.connect(migrated_db) as db:
            with pytest.raises(aiosqlite.IntegrityError):
                await db.execute(
                    "INSERT INTO sessions (id, token, created_at, last_seen) "
                    "VALUES ('s1', NULL, '2024-01-01', '2024-01-01');"
                )
                await db.commit()

    async def test_sessions_rejects_duplicate_token(self, migrated_db):
        """UNIQUE constraint on token should prevent duplicate tokens."""
        async with aiosqlite.connect(migrated_db) as db:
            await db.execute(
                "INSERT INTO sessions (id, token, created_at, last_seen) "
                "VALUES ('s1', 'tok-abc', '2024-01-01', '2024-01-01');"
            )
            await db.commit()
            with pytest.raises(aiosqlite.IntegrityError):
                await db.execute(
                    "INSERT INTO sessions (id, token, created_at, last_seen) "
                    "VALUES ('s2', 'tok-abc', '2024-01-01', '2024-01-01');"
                )
                await db.commit()

    async def test_llm_usage_rejects_null_provider(self, migrated_db):
        async with aiosqlite.connect(migrated_db) as db:
            with pytest.raises(aiosqlite.IntegrityError):
                await db.execute(
                    "INSERT INTO llm_usage (id, provider, created_at) "
                    "VALUES ('u1', NULL, '2024-01-01');"
                )
                await db.commit()

    async def test_modules_accepts_insert_with_defaults(self, migrated_db):
        """Inserting with required fields only should use defaults for optional fields."""
        async with aiosqlite.connect(migrated_db) as db:
            await db.execute(
                "INSERT INTO modules (id, name, spec, created_at, updated_at) "
                "VALUES ('m1', 'test-mod', '{\"key\":\"val\"}', '2024-01-01', '2024-01-01');"
            )
            await db.commit()
            cursor = await db.execute(
                "SELECT status, vitality_score, user_id FROM modules WHERE id='m1';"
            )
            row = await cursor.fetchone()
            assert row[0] == "active"  # status default
            assert row[1] == 0  # vitality_score default
            assert row[2] == "default"  # user_id default
