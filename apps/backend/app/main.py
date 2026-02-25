"""FastAPI application entry point with lifespan management.

Handles startup (logging, migrations, DB health) and shutdown.
The WebSocket endpoint (/ws) is the ONLY communication channel
between mobile and backend (except /health for Docker healthcheck).

Authentication: All WS messages require prior auth via { type: "auth" } message.

Story 4-0: Writer loop pattern — all server→client messages are routed through
the AgentTaskManager buffer. A writer asyncio.Task drains the buffer using
push-based queue.get() and sends via ws.send_json with seq envelope wrapping.
"""

import asyncio
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
from app.refresh import refresh_module
from app.scheduler import RefreshScheduler
from app.task_manager import task_manager

# Module-level state populated during lifespan
_state: dict = {
    "start_time": 0.0,
    "migrations_applied": 0,
    "schema_version": 0,
}


def _preview_log_text(value: str, limit: int = 180) -> str:
    compact = value.replace("\n", "\\n")
    if len(compact) <= limit:
        return compact
    return compact[:limit] + "...[truncated]"


def _summarize_payload_for_log(payload: object) -> object:
    if not isinstance(payload, dict):
        return payload
    summary: dict[str, object] = {}
    for key, value in payload.items():
        if isinstance(value, str):
            summary[key] = _preview_log_text(value)
        elif isinstance(value, list):
            summary[key] = f"[list:{len(value)}]"
        elif isinstance(value, dict):
            summary[key] = "[object]"
        else:
            summary[key] = value
    return summary

# Background refresh scheduler (Story 4-1)
_scheduler = RefreshScheduler(refresh_fn=refresh_module)


async def _push_module_update(module_id: str, spec: dict) -> None:
    """Push a module_updated message to all active WS sessions.

    Bridge between the scheduler and the WebSocket push system.
    Iterates all sessions that have a writer queue and pushes via
    the task manager's buffer_and_notify.
    """
    payload = {
        "type": "module_updated",
        "payload": {"module_id": module_id, "spec": spec},
    }
    # Push to all sessions with active writer queues
    for sid in task_manager.active_session_ids():
        try:
            await task_manager.buffer_and_notify(sid, payload)
        except Exception as e:
            log.warning(
                "push_module_update_failed",
                session_id=sid,
                module_id=module_id,
                error=str(e),
            )


async def _push_module_refresh_failed(module_id: str, error: str) -> None:
    """Push a module_refresh_failed message to all active WS sessions.

    Bridge between the scheduler and the WebSocket push system for failure
    notifications. Sets dataStatus to 'error' on mobile (AC #3).
    """
    payload = {
        "type": "module_refresh_failed",
        "payload": {"module_id": module_id, "error": error},
    }
    for sid in task_manager.active_session_ids():
        try:
            await task_manager.buffer_and_notify(sid, payload)
        except Exception as e:
            log.warning(
                "push_module_refresh_failed_error",
                session_id=sid,
                module_id=module_id,
                error=str(e),
            )

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

    # Ensure SOUL.md identity file exists (creates default on first boot)
    soul_content = await agent.load_soul(settings.self_data_dir)
    soul_is_default = soul_content == agent._DEFAULT_SOUL_CONTENT
    if soul_is_default:
        log.info("soul_loaded", status="default")
    else:
        log.info("soul_loaded", status="custom")

    # Ensure persona instruction files exist (creates defaults on first boot)
    await agent.ensure_default_personas(settings.self_data_dir)

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

    # Start background refresh scheduler (Story 4-1)
    _scheduler.set_push_fn(_push_module_update)
    _scheduler.set_fail_push_fn(_push_module_refresh_failed)
    await _scheduler.start(settings.db_path)

    # Register hook so new modules are auto-registered with scheduler (AC #6)
    def _on_module_created(module_id: str, refresh_interval: int) -> None:
        _scheduler.register_module(module_id, refresh_interval, settings.db_path)

    agent.set_on_module_created_hook(_on_module_created)

    log.info(
        "backend_started",
        migrations_applied=migrations_applied,
        schema_version=_state["schema_version"],
        provider=settings.self_llm_provider,
        log_level=settings.self_log_level,
    )

    yield

    # Stop background refresh scheduler before other cleanup
    await _scheduler.stop()

    # Cleanup background chat workers on process shutdown
    await task_manager.cancel_all_workers()


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


async def _handle_sync(send, payload: dict) -> None:
    """Handle sync message with delta sync support.

    If last_sync is null/empty: respond with module_list (full sync).
    If last_sync has a value: respond with module_sync (delta — only updated modules).

    Args:
        send: Async callable to send messages (buffers through task manager).
        payload: The sync message payload.
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

            await send({
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

            await send({
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
            await send({
                "type": "module_list",
                "payload": {"modules": []},
            })
        else:
            await send({
                "type": "module_sync",
                "payload": {"modules": [], "last_sync": server_now},
            })
    finally:
        await db.close()


async def _handle_auth(
    send, payload: dict
) -> tuple[bool, str | None]:
    """Handle auth message — verify token or consume pairing token.

    Args:
        send: Async callable to send messages (buffers through task manager).
        payload: The auth message payload.

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
            await send({
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
    await send({
        "type": "error",
        "payload": {
            "code": "AUTH_INVALID_TOKEN",
            "message": "Invalid session token. Re-pair with backend.",
            "agent_action": "Clear stored token and show pairing screen",
        },
    })
    return False, None


async def _handle_auth_reset(
    send, session_id: str
) -> str | None:
    """Handle auth_reset — invalidate current session and create a new one.

    Args:
        send: Async callable to send messages (buffers through task manager).
        session_id: Current session ID to invalidate.

    Returns:
        New session_id or None on failure.
    """
    # Invalidate old session
    await invalidate_session(settings.db_path, session_id)

    # Create new session with new token
    new_token = str(uuid.uuid4())
    new_session = await create_session(settings.db_path, new_token)

    log.info(
        "auth_reset_success",
        old_session_id=session_id,
        new_session_id=new_session["id"],
    )

    return new_session["id"]


async def _writer_loop(
    ws: WebSocket, session_id: str, start_after_seq: int = 0
) -> None:
    """Writer loop — drains task manager buffer and sends to WebSocket.

    Push-based: awaits on writer queue (no polling). When notified,
    drains all pending messages from the buffer and sends each one
    with a seq envelope via ws.send_json.

    Runs as an asyncio.Task, cancelled on WebSocket disconnect.

    Args:
        ws: The WebSocket connection.
        session_id: Session identifier for buffer access.
    """
    writer_queue = task_manager.get_writer_queue(session_id)
    last_sent_seq = start_after_seq

    while True:
        # Block until notified of new messages
        await writer_queue.get()

        # Drain all pending messages from the buffer
        pending = task_manager.drain_buffer(session_id, last_sent_seq)
        for msg in pending:
            envelope = {**msg.payload, "seq": msg.seq}
            try:
                log.debug(
                    "ws_message_sent",
                    session_id=session_id,
                    seq=msg.seq,
                    msg_type=msg.payload.get("type"),
                    payload=_summarize_payload_for_log(msg.payload.get("payload")),
                )
                await ws.send_json(envelope)
            except WebSocketDisconnect:
                return
            last_sent_seq = msg.seq


async def _stop_task(task: asyncio.Task | None) -> None:
    """Cancel and await a background task, swallowing expected shutdown errors."""
    if task is None:
        return
    if not task.done():
        task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """WebSocket endpoint — the sole mobile-backend communication channel.

    Architecture (Story 4-0):
      - All server→client messages go through task manager buffer with seq numbers
      - Writer loop (asyncio.Task) drains buffer → ws.send_json with seq envelope
      - On disconnect: writer task cancelled, agent task continues
      - On sync with last_seq: replay missed messages from buffer

    Authentication gate:
      - First message MUST be { type: "auth", payload: { token: "..." } }
      - All subsequent messages are only processed if authenticated
      - auth_reset is only available when authenticated

    Message routing (after auth):
      - chat → enqueue to task manager (sequential processing)
      - log  → forward to backend structured logging
      - sync → replay missed messages + delta sync (module_list/module_sync)
      - auth_reset → invalidate session, create new one
      - *    → error with WS_UNKNOWN_TYPE
    """
    await ws.accept()
    log.info("ws_connected")

    authenticated = False
    session_id: str | None = None
    writer_task: asyncio.Task | None = None

    # Obtain LLM provider once per WebSocket connection (not per message)
    provider = get_provider()

    # Generate a temporary session_id for pre-auth messages
    # (replaced with real session_id after auth)
    tmp_session_id = f"pre-auth-{uuid.uuid4().hex[:8]}"

    async def send(payload: dict) -> None:
        """Buffer a message and notify the writer loop.

        Uses the current session_id (tmp or real) for buffer access.
        """
        sid = session_id if session_id else tmp_session_id
        log.debug(
            "send_start",
            sid=sid,
            msg_type=payload.get("type"),
            payload=_summarize_payload_for_log(payload.get("payload")),
        )
        seq = await task_manager.buffer_and_notify(sid, payload)
        log.debug("send_done", sid=sid, seq=seq)

    async def restart_writer_for(current_sid: str, after_seq: int = 0) -> None:
        """Restart the per-connection writer loop bound to the given session."""
        nonlocal writer_task
        await _stop_task(writer_task)
        # Fresh queue avoids stale state from prior connection's cancelled get()
        task_manager.reset_writer_queue(current_sid)
        writer_task = asyncio.create_task(
            _writer_loop(ws, current_sid, after_seq)
        )

    def ensure_chat_worker_for(current_sid: str) -> None:
        """Ensure a single background chat worker is running for the session."""
        existing = task_manager.get_chat_worker(current_sid)
        if existing is not None:
            return

        async def worker_send(payload: dict) -> None:
            await task_manager.buffer_and_notify(current_sid, payload)

        async def chat_worker() -> None:
            while True:
                message_text = await task_manager.dequeue_chat(current_sid)
                while True:
                    try:
                        await agent.handle_chat(
                            worker_send,
                            message_text,
                            provider,
                            settings.db_path,
                        )
                    except asyncio.CancelledError:
                        raise
                    except Exception as e:
                        # agent.handle_chat is defensive, but keep draining the
                        # queued backlog if anything escapes.
                        log.error(
                            "chat_worker_failed",
                            session_id=current_sid,
                            error=str(e),
                            agent_action="Unhandled error escaped the chat worker loop",
                        )

                    next_message = task_manager.try_dequeue_chat_nowait(current_sid)
                    if next_message is None:
                        return
                    message_text = next_message

        task = asyncio.create_task(chat_worker())

        def _on_done(done_task: asyncio.Task) -> None:
            task_manager.clear_chat_worker(current_sid, done_task)
            try:
                exc = done_task.exception()
            except asyncio.CancelledError:
                return
            if exc is not None:
                log.warning(
                    "chat_worker_terminated",
                    session_id=current_sid,
                    error=str(exc),
                )
            # Race guard: a chat can be enqueued while this worker is finishing,
            # after it already decided the queue was empty. If that happens,
            # ensure a fresh worker is spawned to drain the leftover message.
            if task_manager.has_pending_chat(current_sid):
                ensure_chat_worker_for(current_sid)

        task.add_done_callback(_on_done)
        task_manager.set_chat_worker(current_sid, task)

    # Start writer loop immediately (handles pre-auth messages too)
    writer_task = asyncio.create_task(
        _writer_loop(ws, tmp_session_id)
    )

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await send({
                    "type": "error",
                    "payload": {
                        "code": "WS_INVALID_JSON",
                        "message": "Invalid JSON received",
                        "agent_action": "Check message serialization on mobile client",
                    },
                })
                continue

            if not isinstance(msg, dict):
                await send({
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
            log.debug(
                "ws_message_received",
                session_id=session_id or tmp_session_id,
                msg_type=msg_type,
                payload=_summarize_payload_for_log(payload),
            )

            # --- Auth message handling ---
            if msg_type == "auth":
                auth_result, sid = await _handle_auth(send, payload)
                if auth_result:
                    authenticated = True
                    session_id = sid

                    existing_buffer = task_manager.drain_buffer(session_id, 0)
                    writer_cursor = (
                        existing_buffer[-1].seq if existing_buffer else 0
                    )

                    # Switch writer loop from temporary pre-auth session to the
                    # real session buffer. Pre-auth messages are not migrated.
                    await restart_writer_for(session_id, writer_cursor)
                    task_manager.cleanup_session(tmp_session_id)

                    # Load current persona for status message
                    persona_type = await agent.get_persona_type(settings.db_path)
                    # Send status so client can infer auth success
                    await send({
                        "type": "status",
                        "payload": {"state": "idle", "persona": persona_type},
                    })
                continue

            # --- Auth gate: reject all non-auth messages if not authenticated ---
            if not authenticated:
                await send({
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
                new_sid = await _handle_auth_reset(send, session_id)
                if new_sid:
                    session_id = new_sid
                    await restart_writer_for(session_id, 0)
                    persona_type = await agent.get_persona_type(settings.db_path)
                    await send({
                        "type": "status",
                        "payload": {"state": "idle", "persona": persona_type},
                    })
            elif msg_type == "chat":
                task_manager.enqueue_chat(session_id, payload.get("message", ""))
                ensure_chat_worker_for(session_id)
            elif msg_type == "log":
                log.info("mobile_log", mobile_payload=payload)
            elif msg_type == "sync":
                # Replay missed messages from buffer if the client provided last_seq
                if session_id and "last_seq" in payload:
                    raw_last_seq = payload.get("last_seq", 0)
                    try:
                        last_seq = int(raw_last_seq or 0)
                    except (TypeError, ValueError):
                        last_seq = 0

                    await _stop_task(writer_task)
                    missed = task_manager.drain_buffer(session_id, last_seq)
                    replay_cursor = last_seq
                    for m in missed:
                        envelope = {**m.payload, "seq": m.seq}
                        await ws.send_json(envelope)
                        replay_cursor = m.seq

                    # Restart writer from the replay cursor so replayed messages
                    # are not re-sent on the next writer wake-up.
                    writer_task = asyncio.create_task(
                        _writer_loop(ws, session_id, replay_cursor)
                    )

                # Then proceed with module delta sync
                await _handle_sync(send, payload)
            elif msg_type == "set_persona":
                persona = payload.get("persona", "")
                old_persona = await agent.get_persona_type(settings.db_path)
                try:
                    await agent.set_persona_type(settings.db_path, persona)
                    await send({
                        "type": "status",
                        "payload": {"state": "idle", "persona": persona},
                    })
                    log.info(
                        "persona_changed",
                        old_persona=old_persona,
                        new_persona=persona,
                    )
                except ValueError:
                    await send({
                        "type": "error",
                        "payload": {
                            "code": "PERSONA_INVALID",
                            "message": f"Invalid persona type: {persona}. Must be flame, tree, or star.",
                            "agent_action": "Check PersonaType enum in types/ws.ts",
                        },
                    })
            else:
                await send({
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
        # Cancel writer task on disconnect (agent tasks continue independently)
        await _stop_task(writer_task)
        # Clean up temporary session state (real session state persists for reconnect)
        task_manager.cleanup_session(tmp_session_id)
