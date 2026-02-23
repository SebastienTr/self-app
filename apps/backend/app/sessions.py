"""Session management helpers — CRUD operations for the sessions table.

Handles pairing tokens and real session tokens.
Pairing tokens (is_pairing=1) are temporary, consumed during first connection.
Real session tokens (is_pairing=0) persist indefinitely in V1 (no expiration).

All functions use per-request DB connections (NOT session-scoped).
"""

import uuid
from datetime import UTC, datetime

from app.db import get_connection
from app.logging import log


async def create_session(
    db_path: str,
    token: str,
    user_id: str = "default",
    is_pairing: int = 0,
) -> dict:
    """Create a new session in the sessions table.

    Args:
        db_path: Path to SQLite database.
        token: The session token (UUID v4).
        user_id: User identifier (default: 'default').
        is_pairing: 1 if this is a pairing token, 0 for real session.

    Returns:
        Dict with session fields: id, token, user_id, created_at, last_seen, is_pairing.
    """
    session_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    db = await get_connection(db_path)
    try:
        await db.execute(
            "INSERT INTO sessions (id, token, user_id, created_at, last_seen, is_pairing) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (session_id, token, user_id, now, now, is_pairing),
        )
        await db.commit()

        log.info(
            "session_created",
            session_id=session_id,
            is_pairing=bool(is_pairing),
        )

        return {
            "id": session_id,
            "token": token,
            "user_id": user_id,
            "created_at": now,
            "last_seen": now,
            "is_pairing": is_pairing,
        }
    finally:
        await db.close()


async def get_session_by_token(db_path: str, token: str) -> dict | None:
    """Look up a session by its token.

    Args:
        db_path: Path to SQLite database.
        token: The session token to look up.

    Returns:
        Session dict or None if not found.
    """
    db = await get_connection(db_path)
    try:
        cursor = await db.execute(
            "SELECT id, token, user_id, created_at, last_seen, is_pairing "
            "FROM sessions WHERE token = ?",
            (token,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None

        return {
            "id": row[0],
            "token": row[1],
            "user_id": row[2],
            "created_at": row[3],
            "last_seen": row[4],
            "is_pairing": row[5],
        }
    finally:
        await db.close()


async def update_session_last_seen(db_path: str, session_id: str) -> None:
    """Update the last_seen timestamp for a session.

    Args:
        db_path: Path to SQLite database.
        session_id: The session's primary key.
    """
    now = datetime.now(UTC).isoformat()
    db = await get_connection(db_path)
    try:
        await db.execute(
            "UPDATE sessions SET last_seen = ? WHERE id = ?",
            (now, session_id),
        )
        await db.commit()
    finally:
        await db.close()


async def invalidate_session(db_path: str, session_id: str) -> None:
    """Delete a session from the sessions table.

    Args:
        db_path: Path to SQLite database.
        session_id: The session's primary key.
    """
    db = await get_connection(db_path)
    try:
        await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        await db.commit()
        log.info("session_invalidated", session_id=session_id)
    finally:
        await db.close()


async def create_pairing_token(db_path: str) -> str:
    """Generate a pairing token and store it in the sessions table.

    Creates a session with is_pairing=1. This token is displayed to the user
    so they can enter it in the mobile app for initial pairing.

    Args:
        db_path: Path to SQLite database.

    Returns:
        The generated pairing token (UUID v4).
    """
    token = str(uuid.uuid4())
    await create_session(db_path, token, is_pairing=1)
    log.info("pairing_token_created", token=token)
    return token


async def consume_pairing_token(
    db_path: str,
    pairing_token: str,
    session_token: str,
) -> dict | None:
    """Consume a pairing token and create a real session.

    If the pairing token exists and is_pairing=1, deletes it and creates
    a new real session with the provided session_token.

    Args:
        db_path: Path to SQLite database.
        pairing_token: The pairing token to consume.
        session_token: The real session token to create.

    Returns:
        The new session dict, or None if pairing token is invalid.
    """
    db = await get_connection(db_path)
    try:
        # Find the pairing token
        cursor = await db.execute(
            "SELECT id FROM sessions WHERE token = ? AND is_pairing = 1",
            (pairing_token,),
        )
        row = await cursor.fetchone()
        if row is None:
            log.info(
                "pairing_token_invalid",
                agent_action="Pairing token not found or already consumed",
            )
            return None

        pairing_id = row[0]

        # Delete the pairing token
        await db.execute("DELETE FROM sessions WHERE id = ?", (pairing_id,))
        await db.commit()
    finally:
        await db.close()

    # Create the real session (opens its own connection)
    session = await create_session(db_path, session_token)
    log.info(
        "pairing_token_consumed",
        pairing_token=pairing_token,
        session_id=session["id"],
    )
    return session


async def get_existing_pairing_token(db_path: str) -> str | None:
    """Get an existing pairing token if one exists.

    Args:
        db_path: Path to SQLite database.

    Returns:
        The pairing token string, or None if no pairing token exists.
    """
    db = await get_connection(db_path)
    try:
        cursor = await db.execute(
            "SELECT token FROM sessions WHERE is_pairing = 1 LIMIT 1"
        )
        row = await cursor.fetchone()
        return row[0] if row else None
    finally:
        await db.close()


async def has_active_client_session(db_path: str, within_minutes: int = 5) -> bool:
    """Check if there's an active (non-pairing) client session seen recently.

    Args:
        db_path: Path to SQLite database.
        within_minutes: Consider sessions active if last_seen within this many minutes.

    Returns:
        True if an active session exists.
    """
    db = await get_connection(db_path)
    try:
        # Use strftime format without timezone offset for reliable SQLite datetime arithmetic
        cutoff = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S")
        cursor = await db.execute(
            "SELECT COUNT(*) FROM sessions WHERE is_pairing = 0 AND last_seen > datetime(?, '-' || ? || ' minutes')",
            (cutoff, str(within_minutes)),
        )
        row = await cursor.fetchone()
        return row[0] > 0 if row else False
    finally:
        await db.close()
