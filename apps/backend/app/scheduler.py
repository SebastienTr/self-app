"""Cron-based background refresh scheduler for module data sources.

Uses asyncio.Task per module — no external scheduler library.
Each module gets its own task that loops: refresh → sleep(interval) → repeat.

Design decisions (Story 4-1):
  - asyncio-based, not APScheduler/Celery — single-process FastAPI app
  - First refresh fires immediately on registration (no initial delay)
  - Refresh failure never crashes the task — logged and retried next cycle
  - push_fn is optional (set via set_push_fn) — scheduler works without WS clients
"""

import asyncio
import json
from collections.abc import Callable, Coroutine
from typing import Any

from app.db import get_connection
from app.logging import log

# Type for the refresh function: async (module_id, db_path, push_fn) -> bool
RefreshFn = Callable[[str, str, Any], Coroutine[Any, Any, bool]]

# Type for the push function: async (module_id, spec) -> None
PushFn = Callable[[str, dict], Coroutine[Any, Any, None]] | None

# Type for the failure push function: async (module_id, error) -> None
FailPushFn = Callable[[str, str], Coroutine[Any, Any, None]] | None


class RefreshScheduler:
    """Manages per-module refresh tasks using asyncio.

    Each registered module gets its own asyncio.Task that loops:
      1. Call refresh_fn(module_id, db_path, push_fn)
      2. Sleep for refresh_interval seconds
      3. Repeat

    The scheduler is started during FastAPI lifespan and stopped on shutdown.
    """

    def __init__(self, refresh_fn: RefreshFn):
        self._refresh_fn = refresh_fn
        self._tasks: dict[str, asyncio.Task] = {}
        self._push_fn: PushFn = None
        self._fail_push_fn: FailPushFn = None
        self._db_path: str | None = None

    def set_push_fn(self, push_fn: PushFn) -> None:
        """Set the push function for broadcasting module updates to WS clients.

        Args:
            push_fn: Async callable (module_id, spec) -> None.
        """
        self._push_fn = push_fn

    def set_fail_push_fn(self, fail_push_fn: FailPushFn) -> None:
        """Set the push function for broadcasting refresh failures to WS clients.

        Args:
            fail_push_fn: Async callable (module_id, error) -> None.
        """
        self._fail_push_fn = fail_push_fn

    async def start(self, db_path: str) -> None:
        """Load modules from DB and start refresh tasks for eligible ones.

        A module is eligible for refresh if:
          - spec.refresh_interval > 0
          - spec.data_sources is non-empty

        Args:
            db_path: Path to SQLite database.
        """
        self._db_path = db_path

        db = await get_connection(db_path)
        try:
            cursor = await db.execute(
                "SELECT id, spec FROM modules WHERE status = 'active'"
            )
            rows = await cursor.fetchall()
        finally:
            await db.close()

        registered = 0
        for row in rows:
            module_id = row[0]
            try:
                spec = json.loads(row[1]) if row[1] else {}
            except (json.JSONDecodeError, TypeError):
                continue

            refresh_interval = spec.get("refresh_interval", 0)
            data_sources = spec.get("data_sources") or []

            if refresh_interval > 0 and len(data_sources) > 0:
                self.register_module(module_id, refresh_interval, db_path)
                registered += 1

        log.info(
            "scheduler_started",
            modules_registered=registered,
            total_modules=len(rows),
        )

    def register_module(
        self, module_id: str, refresh_interval: float, db_path: str | None = None
    ) -> None:
        """Register or re-register a module for periodic refresh.

        If the module is already registered, the old task is cancelled
        and replaced with a new one using the updated interval.

        Args:
            module_id: Module UUID.
            refresh_interval: Interval in seconds between refreshes.
            db_path: Optional DB path override (uses stored path if None).
        """
        effective_db_path = db_path or self._db_path
        if effective_db_path is None:
            log.error(
                "scheduler_register_no_db",
                module_id=module_id,
                agent_action="Scheduler has no db_path. Call start() first or pass db_path.",
            )
            return

        # Cancel existing task if any
        if module_id in self._tasks:
            old_task = self._tasks.pop(module_id)
            if not old_task.done():
                old_task.cancel()

        task = asyncio.create_task(
            self._refresh_loop(module_id, refresh_interval, effective_db_path)
        )
        self._tasks[module_id] = task

        log.info(
            "scheduler_module_registered",
            module_id=module_id,
            refresh_interval=refresh_interval,
        )

    def unregister_module(self, module_id: str) -> None:
        """Remove a module from the scheduler.

        Cancels the running refresh task if it exists.

        Args:
            module_id: Module UUID to unregister.
        """
        task = self._tasks.pop(module_id, None)
        if task and not task.done():
            task.cancel()
            log.info("scheduler_module_unregistered", module_id=module_id)

    async def stop(self) -> None:
        """Cancel all running refresh tasks gracefully."""
        tasks = list(self._tasks.values())
        self._tasks.clear()

        for task in tasks:
            if not task.done():
                task.cancel()

        for task in tasks:
            try:
                await asyncio.wait_for(task, timeout=1.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
            except Exception:
                pass

        log.info("scheduler_stopped", tasks_cancelled=len(tasks))

    async def _refresh_loop(
        self, module_id: str, interval: float, db_path: str
    ) -> None:
        """Internal loop: refresh module → sleep → repeat.

        First refresh fires immediately (no initial delay).
        Exceptions in refresh_fn are caught and logged — never crash the loop.

        Args:
            module_id: Module UUID.
            interval: Sleep interval in seconds between refreshes.
            db_path: Path to SQLite database.
        """
        while True:
            try:
                kwargs: dict = {}
                if self._fail_push_fn is not None:
                    kwargs["fail_push_fn"] = self._fail_push_fn
                await self._refresh_fn(
                    module_id, db_path, self._push_fn, **kwargs
                )
            except asyncio.CancelledError:
                raise  # Let cancellation propagate
            except Exception as e:
                log.error(
                    "scheduler_refresh_error",
                    module_id=module_id,
                    error=str(e),
                    agent_action="Refresh failed, will retry next cycle.",
                )

            try:
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                break
