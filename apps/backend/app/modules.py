"""Module CRUD operations — create, get, list modules in the modules table.

Architecture mandates:
  - Per-request DB connections (never session-scoped — see fix(1-5))
  - Async-only (no sync I/O)
  - All functions use structured logging with agent_action
  - UUIDs are always generated server-side
"""

import json
import uuid
from datetime import UTC, datetime

from app.db import get_connection
from app.logging import log


async def create_module(db_path: str, name: str, spec: dict) -> dict:
    """Create a new module in the modules table.

    Generates a UUID v4 id, sets status='active', created_at/updated_at to
    ISO 8601 UTC. Serializes spec as JSON TEXT. Returns the full row as dict.

    Args:
        db_path: Path to the SQLite database file.
        name:    Module display name.
        spec:    Module specification dict (type, template, data_sources, etc.)

    Returns:
        Dict with id, name, spec (parsed), status, created_at, updated_at.
    """
    # Validate inputs to prevent oversized DB entries from unexpected LLM output
    if not name or not name.strip():
        name = "Unnamed Module"
    if len(name) > 200:
        name = name[:200]

    module_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()
    spec_json = json.dumps(spec)

    # Guard against unreasonably large specs (100KB limit)
    if len(spec_json) > 102400:
        raise ValueError(
            f"Module spec too large ({len(spec_json)} bytes). Maximum is 100KB."
        )

    db = await get_connection(db_path)
    try:
        await db.execute(
            "INSERT INTO modules (id, name, spec, status, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (module_id, name, spec_json, "active", now, now),
        )
        await db.commit()

        log.info(
            "module_created",
            module_id=module_id,
            module_name=name,
        )

        return {
            "id": module_id,
            "name": name,
            "spec": spec,
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }
    finally:
        await db.close()


async def get_module(db_path: str, module_id: str) -> dict | None:
    """Get a single module by id.

    Args:
        db_path:   Path to the SQLite database file.
        module_id: The UUID of the module to retrieve.

    Returns:
        Dict with id, name, spec (parsed), status, created_at, updated_at,
        or None if not found.
    """
    db = await get_connection(db_path)
    try:
        cursor = await db.execute(
            "SELECT id, name, spec, status, created_at, updated_at "
            "FROM modules WHERE id = ?",
            (module_id,),
        )
        row = await cursor.fetchone()

        if row is None:
            log.info("module_get", module_id=module_id, found=False)
            return None

        try:
            spec = json.loads(row[2]) if row[2] else {}
        except json.JSONDecodeError:
            spec = {}

        log.info("module_get", module_id=module_id, found=True)

        return {
            "id": row[0],
            "name": row[1],
            "spec": spec,
            "status": row[3],
            "created_at": row[4],
            "updated_at": row[5],
        }
    finally:
        await db.close()


async def list_modules(db_path: str) -> list[dict]:
    """List all modules ordered by updated_at descending.

    Args:
        db_path: Path to the SQLite database file.

    Returns:
        List of module dicts, each with id, name, spec (parsed), status,
        created_at, updated_at.
    """
    db = await get_connection(db_path)
    try:
        cursor = await db.execute(
            "SELECT id, name, spec, status, created_at, updated_at "
            "FROM modules ORDER BY updated_at DESC"
        )
        rows = await cursor.fetchall()

        modules = []
        for row in rows:
            try:
                spec = json.loads(row[2]) if row[2] else {}
            except json.JSONDecodeError:
                spec = {}

            modules.append({
                "id": row[0],
                "name": row[1],
                "spec": spec,
                "status": row[3],
                "created_at": row[4],
                "updated_at": row[5],
            })

        log.info("module_list_fetched", count=len(modules))

        return modules
    finally:
        await db.close()
