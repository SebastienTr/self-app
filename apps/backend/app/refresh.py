"""Module refresh execution — fetch data, compare, update DB, push.

Orchestrates the refresh pipeline for a single module:
  1. Load module from DB
  2. Call fetch_module_data() to get fresh data from external sources
  3. Compare fetched data with existing spec.data
  4. On change: update spec, updated_at, last_refreshed_at → push module_updated
  5. On no change: bump updated_at, last_refreshed_at only (no push)
  6. On failure: set last_refresh_error (no updated_at change)

Module isolation: entire refresh is wrapped in try/except so one module's
failure never propagates to others (NFR20).
"""

import json
from collections.abc import Callable, Coroutine
from datetime import UTC, datetime
from typing import Any

from app.data_fetch import fetch_module_data
from app.db import get_connection
from app.logging import log

# Type for the push function: async (module_id, spec) -> None
PushFn = Callable[[str, dict], Coroutine[Any, Any, None]] | None

# Type for the failure push function: async (module_id, error) -> None
FailPushFn = Callable[[str, str], Coroutine[Any, Any, None]] | None

# Type for the fetch function (injectable for testing)
FetchFn = Callable[..., Coroutine[Any, Any, dict | None]] | None


async def refresh_module(
    module_id: str,
    db_path: str,
    push_fn: PushFn = None,
    *,
    fetch_fn: FetchFn = None,
    fail_push_fn: FailPushFn = None,
) -> bool:
    """Execute a single module refresh cycle.

    Args:
        module_id: UUID of the module to refresh.
        db_path: Path to SQLite database.
        push_fn: Optional async callable to push updates to WS clients.
        fetch_fn: Optional fetch function override (for testing).
        fail_push_fn: Optional async callable to push failure notifications to WS clients.

    Returns:
        True if refresh succeeded, False on failure.
    """
    try:
        # 1. Load module from DB
        db = await get_connection(db_path)
        try:
            cursor = await db.execute(
                "SELECT id, name, spec, status FROM modules WHERE id = ?",
                (module_id,),
            )
            row = await cursor.fetchone()
        finally:
            await db.close()

        if not row:
            log.warning(
                "refresh_module_not_found",
                module_id=module_id,
                agent_action="Module not found in DB. May have been deleted.",
            )
            return False

        try:
            spec = json.loads(row[2]) if row[2] else {}
        except (json.JSONDecodeError, TypeError):
            spec = {}

        module = {
            "id": row[0],
            "name": row[1],
            "spec": spec,
            "status": row[3],
        }

        # 2. Fetch fresh data
        effective_fetch = fetch_fn or fetch_module_data
        fetched_data = await effective_fetch(module)

        if fetched_data is None:
            # All sources failed — record error
            now = datetime.now(UTC).isoformat()
            db = await get_connection(db_path)
            try:
                await db.execute(
                    "UPDATE modules SET last_refresh_error = ? WHERE id = ?",
                    (f"All data sources failed at {now}", module_id),
                )
                await db.commit()
            finally:
                await db.close()

            log.warning(
                "refresh_module_failed",
                module_id=module_id,
                agent_action="All data sources failed. Check data source URLs and network.",
            )

            # Notify mobile clients of the failure (AC #3)
            if fail_push_fn is not None:
                try:
                    await fail_push_fn(module_id, f"All data sources failed at {now}")
                except Exception as e:
                    log.warning(
                        "refresh_fail_push_failed",
                        module_id=module_id,
                        error=str(e),
                    )

            return False

        # 3. Compare fetched data with existing spec.data
        existing_data = spec.get("data")
        data_changed = fetched_data != existing_data

        # 4. Update DB
        now = datetime.now(UTC).isoformat()

        if data_changed:
            spec["data"] = fetched_data
            spec_json = json.dumps(spec)
        else:
            spec_json = None  # We still bump timestamps even without spec change

        db = await get_connection(db_path)
        try:
            if data_changed:
                await db.execute(
                    "UPDATE modules SET spec = ?, updated_at = ?, "
                    "last_refreshed_at = ?, last_refresh_error = NULL WHERE id = ?",
                    (spec_json, now, now, module_id),
                )
            else:
                await db.execute(
                    "UPDATE modules SET updated_at = ?, "
                    "last_refreshed_at = ?, last_refresh_error = NULL WHERE id = ?",
                    (now, now, module_id),
                )
            await db.commit()
        finally:
            await db.close()

        # 5. Push update to clients (only if data changed)
        if data_changed and push_fn is not None:
            try:
                await push_fn(module_id, spec)
            except Exception as e:
                log.warning(
                    "refresh_push_failed",
                    module_id=module_id,
                    error=str(e),
                    agent_action="Module updated in DB but WS push failed. "
                    "Client will get data on next sync.",
                )

        log.info(
            "refresh_module_success",
            module_id=module_id,
            data_changed=data_changed,
        )
        return True

    except Exception as e:
        # Module isolation: never propagate to caller
        log.error(
            "refresh_module_error",
            module_id=module_id,
            error=str(e),
            agent_action="Unexpected error during module refresh. Module isolated.",
        )
        return False
