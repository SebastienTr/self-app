"""FastAPI application entry point with lifespan management.

Handles startup (logging, migrations, DB health) and shutdown.
"""

import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from app.config import settings
from app.db import get_connection, get_schema_version, run_migrations
from app.logging import log, setup_logging

# Module-level state populated during lifespan
_state: dict = {
    "start_time": 0.0,
    "migrations_applied": 0,
    "schema_version": 0,
}

# Resolve migrations directory relative to the app package
_MIGRATIONS_DIR = str(Path(__file__).parent.parent / "migrations")


def _ensure_data_dir() -> None:
    """Create the data directory if it does not exist."""
    os.makedirs(settings.self_data_dir, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown logic."""
    _state["start_time"] = time.monotonic()

    # Initialize structured logging
    setup_logging(settings.self_log_level)

    # Ensure data directory exists
    _ensure_data_dir()

    # Run database migrations
    migrations_applied = await run_migrations(settings.db_path, _MIGRATIONS_DIR)
    _state["migrations_applied"] = migrations_applied

    # Read schema version and perform WAL checkpoint cleanup
    db = await get_connection(settings.db_path)
    try:
        _state["schema_version"] = await get_schema_version(db)
        # Clean WAL file on startup to reclaim space from previous runs
        await db.execute("PRAGMA wal_checkpoint(TRUNCATE);")
    finally:
        await db.close()

    log.info(
        "backend_started",
        migrations_applied=migrations_applied,
        schema_version=_state["schema_version"],
        provider=settings.self_llm_provider,
        log_level=settings.self_log_level,
    )

    yield

    # Cleanup on shutdown (nothing to clean up currently)


app = FastAPI(title="self-app backend", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health():
    """Health check endpoint returning system status information."""
    uptime = time.monotonic() - _state["start_time"]
    return {
        "status": "ok",
        "schema_version": _state["schema_version"],
        "migrations_applied": _state["migrations_applied"],
        "uptime": round(uptime, 1),
    }
