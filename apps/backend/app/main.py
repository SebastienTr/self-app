"""FastAPI application entry point with lifespan management.

Handles startup (logging, migrations, DB health) and shutdown.
The WebSocket endpoint (/ws) is the ONLY communication channel
between mobile and backend (except /health for Docker healthcheck).

Authentication: All WS messages require prior auth via { type: "auth" } message.
"""

import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.config import settings
from app import agent
from app.db import get_connection, get_schema_version, run_migrations
from app.llm import get_available_providers, get_provider
from app.logging import log, setup_logging
from app.sessions import (
    consume_pairing_token,
    create_pairing_token,
    create_session,
    get_existing_pairing_token,
    get_session_by_token,
    has_active_client_session,
    invalidate_session,
    update_session_last_seen,
)

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


async def _ensure_pairing_token() -> None:
    """Ensure a pairing token exists after startup.

    If a pairing token already exists (from a previous startup), reuse it.
    Otherwise generate a new one and log it clearly.
    Also writes the token to .run/pairing-token for dev tooling (self.sh).
    """
    existing = await get_existing_pairing_token(settings.db_path)
    if existing:
        token = existing
        log.info(
            "pairing_token_available",
            token=token,
            agent_action="Copy this token to pair your mobile app",
        )
    else:
        token = await create_pairing_token(settings.db_path)
        log.info(
            "pairing_token_generated",
            token=token,
            agent_action="Copy this token to pair your mobile app",
        )

    # Write token to .run/ for self.sh dev tooling (best-effort, non-critical)
    try:
        run_dir = Path(__file__).parent.parent.parent.parent / ".run"
        run_dir.mkdir(exist_ok=True)
        (run_dir / "pairing-token").write_text(token)
    except OSError:
        log.warning(
            "pairing_token_file_write_failed",
            agent_action="Could not write pairing token to .run/pairing-token. Manual copy from logs still works.",
        )


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

    # Generate pairing token for mobile app connection
    await _ensure_pairing_token()

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

    # Check if pairing is available (pairing token exists and no recent active session)
    pairing_available = False
    try:
        existing = await get_existing_pairing_token(settings.db_path)
        if existing:
            active = await has_active_client_session(settings.db_path)
            pairing_available = not active
    except Exception:
        # If DB isn't set up yet (e.g., in tests without migrations), default to False
        pass

    return {
        "status": "ok",
        "schema_version": _state["schema_version"],
        "migrations_applied": _state["migrations_applied"],
        "uptime": round(uptime, 1),
        "providers": providers,
        "pairing_available": pairing_available,
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


async def _handle_sync(ws: WebSocket, payload: dict) -> None:
    """Handle sync message with delta sync support.

    If last_sync is null/empty: respond with module_list (full sync).
    If last_sync has a value: respond with module_sync (delta — only updated modules).
    """
    last_sync = payload.get("last_sync")
    server_now = datetime.now(UTC).isoformat()

    db = await get_connection(settings.db_path)
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
    finally:
        await db.close()


async def _handle_auth(
    ws: WebSocket, payload: dict
) -> tuple[bool, str | None]:
    """Handle auth message — verify token or consume pairing token.

    Returns:
        (authenticated: bool, session_id: str | None)
    """
    token = payload.get("token", "")
    pairing_token = payload.get("pairing_token")

    # Case 1: Pairing flow — mobile sends both a new session token and the pairing token
    if pairing_token:
        session = await consume_pairing_token(settings.db_path, pairing_token, token)
        if session:
            log.info("auth_pairing_success", session_id=session["id"])
            return True, session["id"]
        else:
            await ws.send_json({
                "type": "error",
                "payload": {
                    "code": "AUTH_PAIRING_FAILED",
                    "message": "Pairing token is invalid or has already been used.",
                    "agent_action": "Check pairing token from backend logs or /health endpoint",
                },
            })
            return False, None

    # Case 2: Existing session token
    if token:
        session = await get_session_by_token(settings.db_path, token)
        if session and session["is_pairing"] == 0:
            await update_session_last_seen(settings.db_path, session["id"])
            log.info("auth_success", session_id=session["id"])
            return True, session["id"]

    # Case 3: Invalid or missing token
    await ws.send_json({
        "type": "error",
        "payload": {
            "code": "AUTH_INVALID_TOKEN",
            "message": "Invalid session token. Re-pair with backend.",
            "agent_action": "Clear stored token and show pairing screen",
        },
    })
    return False, None


async def _handle_auth_reset(
    ws: WebSocket, session_id: str
) -> str | None:
    """Handle auth_reset — invalidate current session and create a new one.

    Returns:
        New session_id or None on failure.
    """
    # Invalidate old session
    await invalidate_session(settings.db_path, session_id)

    # Create new session with new token
    new_token = str(uuid.uuid4())
    new_session = await create_session(settings.db_path, new_token)

    await ws.send_json({
        "type": "status",
        "payload": {"state": "idle"},
    })

    log.info(
        "auth_reset_success",
        old_session_id=session_id,
        new_session_id=new_session["id"],
    )

    return new_session["id"]


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """WebSocket endpoint — the sole mobile-backend communication channel.

    Authentication gate:
      - First message MUST be { type: "auth", payload: { token: "..." } }
      - All subsequent messages are only processed if authenticated
      - auth_reset is only available when authenticated

    Message routing (after auth):
      - chat → agent.handle_chat() (LLM streaming via agent.py)
      - log  → forward to backend structured logging
      - sync → delta sync (module_list for full, module_sync for delta)
      - auth_reset → invalidate session, create new one
      - *    → error with WS_UNKNOWN_TYPE

    """
    await ws.accept()
    log.info("ws_connected")

    authenticated = False
    session_id: str | None = None

    # Obtain LLM provider once per WebSocket connection (not per message)
    provider = get_provider()

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

            # --- Auth message handling ---
            if msg_type == "auth":
                auth_result, sid = await _handle_auth(ws, payload)
                if auth_result:
                    authenticated = True
                    session_id = sid
                    # Send status so client can infer auth success
                    await ws.send_json({
                        "type": "status",
                        "payload": {"state": "idle"},
                    })
                continue

            # --- Auth gate: reject all non-auth messages if not authenticated ---
            if not authenticated:
                await ws.send_json({
                    "type": "error",
                    "payload": {
                        "code": "AUTH_REQUIRED",
                        "message": "Authentication required. Send auth message first.",
                        "agent_action": "Send { type: 'auth', payload: { token: '...' } } before other messages",
                    },
                })
                continue

            # --- Authenticated message routing ---
            if msg_type == "auth_reset":
                new_sid = await _handle_auth_reset(ws, session_id)
                if new_sid:
                    session_id = new_sid
            elif msg_type == "chat":
                await agent.handle_chat(
                    ws, payload.get("message", ""), provider, settings.db_path
                )
            elif msg_type == "log":
                log.info("mobile_log", mobile_payload=payload)
            elif msg_type == "sync":
                await _handle_sync(ws, payload)
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
