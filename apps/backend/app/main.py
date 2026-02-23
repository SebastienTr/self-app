"""FastAPI application entry point with lifespan management.

Handles startup (logging, migrations, DB health) and shutdown.
The WebSocket endpoint (/ws) is the ONLY communication channel
between mobile and backend (except /health for Docker healthcheck).
"""

import json
import os
import time
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.config import settings
from app.db import get_connection, get_schema_version, run_migrations
from app.llm import get_available_providers
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
    """Health check endpoint returning system status and provider information."""
    uptime = time.monotonic() - _state["start_time"]
    providers = await get_available_providers()
    return {
        "status": "ok",
        "schema_version": _state["schema_version"],
        "migrations_applied": _state["migrations_applied"],
        "uptime": round(uptime, 1),
        "providers": providers,
    }


def _parse_module_rows(rows: list) -> list[dict]:
    """Parse module rows from the database into payload-ready dicts."""
    modules = []
    for row in rows:
        try:
            spec = json.loads(row[2]) if row[2] else {}
        except json.JSONDecodeError:
            spec = {}
        spec["moduleId"] = row[0]
        spec["name"] = row[1]
        modules.append(spec)
    return modules


async def _handle_sync(ws: WebSocket, payload: dict, db) -> None:
    """Handle sync message with delta sync support.

    If last_sync is null/empty: respond with module_list (full sync).
    If last_sync has a value: respond with module_sync (delta — only updated modules).

    Uses a shared DB connection from the WS session to avoid per-call overhead.
    """
    last_sync = payload.get("last_sync")
    server_now = datetime.now(UTC).isoformat()

    try:
        if not last_sync:
            # Full sync — return all modules
            cursor = await db.execute(
                "SELECT id, name, spec, status, vitality_score, user_id, created_at, updated_at "
                "FROM modules ORDER BY updated_at DESC"
            )
            rows = await cursor.fetchall()
            modules = _parse_module_rows(rows)

            await ws.send_json({
                "type": "module_list",
                "payload": {"modules": modules},
            })
            log.info(
                "sync_full",
                module_count=len(modules),
            )
        else:
            # Delta sync — only modules updated since last_sync
            cursor = await db.execute(
                "SELECT id, name, spec, status, vitality_score, user_id, created_at, updated_at "
                "FROM modules WHERE updated_at > ? ORDER BY updated_at DESC",
                (last_sync,),
            )
            rows = await cursor.fetchall()
            modules = _parse_module_rows(rows)

            await ws.send_json({
                "type": "module_sync",
                "payload": {
                    "modules": modules,
                    "last_sync": server_now,
                },
            })
            log.info(
                "sync_delta",
                module_count=len(modules),
                last_sync=last_sync,
            )
    except Exception as e:
        log.error(
            "sync_failed",
            error=str(e),
            agent_action="Check database connection and modules table",
        )
        # Fallback to empty response
        if not last_sync:
            await ws.send_json({
                "type": "module_list",
                "payload": {"modules": []},
            })
        else:
            await ws.send_json({
                "type": "module_sync",
                "payload": {"modules": [], "last_sync": server_now},
            })


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """WebSocket endpoint — the sole mobile-backend communication channel.

    Message routing:
      - chat → echo stub via chat_stream (full agent integration in later story)
      - log  → forward to backend structured logging
      - sync → delta sync (module_list for full, module_sync for delta)
      - *    → error with WS_UNKNOWN_TYPE

    Opens a single DB connection per WS session for efficient sync queries.
    """
    await ws.accept()
    log.info("ws_connected")

    # Open a session-scoped DB connection for sync queries
    db = await get_connection(settings.db_path)
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({
                    "type": "error",
                    "payload": {
                        "code": "WS_INVALID_JSON",
                        "message": "Invalid JSON received",
                        "agent_action": "Check message serialization on mobile client",
                    },
                })
                continue

            if not isinstance(msg, dict):
                await ws.send_json({
                    "type": "error",
                    "payload": {
                        "code": "WS_INVALID_JSON",
                        "message": "Message must be a JSON object, not "
                        + type(msg).__name__,
                        "agent_action": "Ensure messages are JSON objects with type and payload keys",
                    },
                })
                continue

            msg_type = msg.get("type")
            payload = msg.get("payload", {})

            if msg_type == "chat":
                # Stub: echo back as chat_stream (full agent integration later)
                await ws.send_json({
                    "type": "chat_stream",
                    "payload": {
                        "delta": f"Echo: {payload.get('message', '')}",
                        "done": True,
                    },
                })
            elif msg_type == "log":
                log.info("mobile_log", mobile_payload=payload)
            elif msg_type == "sync":
                await _handle_sync(ws, payload, db)
            else:
                await ws.send_json({
                    "type": "error",
                    "payload": {
                        "code": "WS_UNKNOWN_TYPE",
                        "message": f"Unknown message type: {msg_type}",
                        "agent_action": "Check WSMessage type enum in types/ws.ts",
                    },
                })
    except WebSocketDisconnect as e:
        log.info("ws_disconnected", close_code=e.code)
    finally:
        await db.close()
