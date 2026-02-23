"""Database module with async SQLite connection and migration runner.

Uses aiosqlite for async access. WAL mode is enabled for concurrent reads.
Migration files are numbered SQL files in the migrations/ directory.
"""

import os
import shutil
from datetime import UTC, datetime
from pathlib import Path

import aiosqlite

from app.logging import log


def _ensure_parent_dir(db_path: str) -> None:
    """Create the parent directory for the database file if needed."""
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)


def _db_file_has_content(db_path: str) -> bool:
    """Check if a database file exists and has content."""
    return os.path.exists(db_path) and os.path.getsize(db_path) > 0


def _read_sql_file(path: str) -> str:
    """Read a SQL migration file."""
    return Path(path).read_text(encoding="utf-8")


def _discover_migrations(migrations_dir: str) -> list[tuple[int, str]]:
    """Find and sort migration SQL files by their numeric prefix.

    Args:
        migrations_dir: Directory to scan for *.sql files.

    Returns:
        Sorted list of (version_number, file_path) tuples.
    """
    if not os.path.isdir(migrations_dir):
        return []

    migrations = []
    for filename in os.listdir(migrations_dir):
        if not filename.endswith(".sql"):
            continue
        # Extract number prefix (e.g., "001" from "001_init.sql")
        parts = filename.split("_", 1)
        if parts and parts[0].isdigit():
            version = int(parts[0])
            migrations.append((version, os.path.join(migrations_dir, filename)))

    return sorted(migrations, key=lambda x: x[0])


def _split_sql_statements(sql: str) -> list[str]:
    """Split a SQL script into individual statements.

    Splits on semicolons, removes standalone comment-only lines and blank
    lines from each chunk, then keeps chunks that still contain SQL.

    Note: inline comments (e.g., ``col TEXT, -- description``) are preserved
    because SQLite handles them correctly.
    """
    statements = []
    for chunk in sql.split(";"):
        # Keep lines that are not blank and not standalone comments
        lines = []
        for line in chunk.splitlines():
            stripped = line.strip()
            if stripped and not stripped.startswith("--"):
                lines.append(line)
        if lines:
            statements.append("\n".join(lines))
    return statements


def _create_backup(db_path: str) -> str:
    """Create a timestamped backup of the database file.

    Args:
        db_path: Path to the database file.

    Returns:
        Path to the backup file.
    """
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    backup_path = f"{db_path}.backup-{timestamp}"
    shutil.copy2(db_path, backup_path)
    log.info("database_backup_created", backup_path=backup_path)
    return backup_path


async def get_connection(db_path: str) -> aiosqlite.Connection:
    """Create an async SQLite connection with WAL mode and optimized PRAGMAs.

    Args:
        db_path: Path to the SQLite database file.

    Returns:
        An open aiosqlite connection.
    """
    _ensure_parent_dir(db_path)

    db = await aiosqlite.connect(db_path)
    await db.execute("PRAGMA journal_mode=WAL;")
    await db.execute("PRAGMA wal_autocheckpoint=1000;")
    await db.execute("PRAGMA journal_size_limit=10485760;")
    return db


async def get_schema_version(db: aiosqlite.Connection) -> int:
    """Get the current schema version from the database.

    Returns 0 if the schema_version table does not exist.
    """
    try:
        cursor = await db.execute("SELECT MAX(version) FROM schema_version;")
        row = await cursor.fetchone()
        return row[0] if row and row[0] is not None else 0
    except aiosqlite.OperationalError:
        return 0


async def run_migrations(
    db_path: str,
    migrations_dir: str = "migrations",
    *,
    dry_run: bool = False,
) -> int:
    """Run pending database migrations.

    Reads numbered SQL files from migrations_dir (e.g., 001_init.sql, 002_add_index.sql),
    determines which have already been applied by checking schema_version,
    and applies pending ones in order, each wrapped in a transaction.

    Args:
        db_path: Path to the SQLite database file.
        migrations_dir: Directory containing numbered SQL migration files.
        dry_run: If True, report pending migrations without executing them.

    Returns:
        Number of migrations applied (or pending, if dry_run).
    """
    # Discover migration files sorted by number
    migration_files = _discover_migrations(migrations_dir)
    if not migration_files:
        log.info("no_migrations_found", migrations_dir=migrations_dir)
        return 0

    # Check if DB already exists (for backup decision) before opening connection
    db_exists = _db_file_has_content(db_path)

    db = await get_connection(db_path)
    try:
        current_version = await get_schema_version(db)

        # Filter to only pending migrations
        pending = [
            (num, path) for num, path in migration_files if num > current_version
        ]

        if not pending:
            log.info(
                "migrations_up_to_date",
                schema_version=current_version,
            )
            return 0

        if dry_run:
            for num, path in pending:
                log.info(
                    "pending_migration",
                    migration=os.path.basename(path),
                    version=num,
                    agent_action="Run without --dry-run to apply",
                )
            return len(pending)

        # Backup existing database before applying migrations
        if db_exists:
            await db.close()
            _create_backup(db_path)
            db = await get_connection(db_path)

        # Apply each pending migration wrapped in an explicit transaction
        applied = 0
        for num, path in pending:
            sql = _read_sql_file(path)
            try:
                await db.execute("BEGIN;")
                # Execute each statement individually within the transaction
                for statement in _split_sql_statements(sql):
                    await db.execute(statement)
                await db.execute("COMMIT;")
                applied += 1
                log.info(
                    "migration_applied",
                    migration=os.path.basename(path),
                    version=num,
                )
            except Exception as e:
                # Rollback the failed transaction to preserve DB consistency
                try:
                    await db.execute("ROLLBACK;")
                except Exception:
                    pass  # ROLLBACK may fail if no transaction is active
                log.error(
                    "migration_failed",
                    migration=os.path.basename(path),
                    version=num,
                    error=str(e),
                    agent_action=(
                        "Check migration SQL syntax. "
                        "Run with dry_run=True to preview pending migrations"
                    ),
                )
                raise

        return applied
    finally:
        await db.close()
