"""Tests for session management helpers (sessions.py).

Tests CRUD operations for sessions including pairing tokens.
"""

import asyncio

import aiosqlite
import pytest

from app.sessions import (
    create_session,
    get_session_by_token,
    update_session_last_seen,
    invalidate_session,
    create_pairing_token,
    consume_pairing_token,
)


async def _setup_sessions_table(db_path: str) -> None:
    """Create sessions table matching migrations 001 + 002."""
    db = await aiosqlite.connect(db_path)
    try:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute(
            """CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                token TEXT UNIQUE NOT NULL,
                user_id TEXT NOT NULL DEFAULT 'default',
                created_at TEXT NOT NULL,
                last_seen TEXT NOT NULL,
                is_pairing INTEGER DEFAULT 0
            )"""
        )
        await db.execute(
            "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)"
        )
        await db.execute("INSERT OR IGNORE INTO schema_version (version) VALUES (2)")
        await db.commit()
    finally:
        await db.close()


@pytest.fixture
def db_path(test_settings, tmp_path):
    """Set up a test database with sessions table."""
    asyncio.run(_setup_sessions_table(test_settings.db_path))
    return test_settings.db_path


class TestCreateSession:
    """Test create_session function."""

    def test_creates_session_with_correct_fields(self, db_path):
        async def _run():
            session = await create_session(db_path, "test-token-123")
            assert session["token"] == "test-token-123"
            assert session["user_id"] == "default"
            assert "id" in session
            assert "created_at" in session
            assert "last_seen" in session
            assert session["is_pairing"] == 0

        asyncio.run(_run())

    def test_creates_session_with_custom_user_id(self, db_path):
        async def _run():
            session = await create_session(db_path, "token-1", user_id="user-42")
            assert session["user_id"] == "user-42"

        asyncio.run(_run())

    def test_session_has_timestamps(self, db_path):
        async def _run():
            session = await create_session(db_path, "token-ts")
            assert "T" in session["created_at"]  # ISO format
            assert "T" in session["last_seen"]

        asyncio.run(_run())

    def test_created_at_and_last_seen_are_same_on_creation(self, db_path):
        async def _run():
            session = await create_session(db_path, "token-same")
            assert session["created_at"] == session["last_seen"]

        asyncio.run(_run())

    def test_duplicate_token_raises(self, db_path):
        async def _run():
            await create_session(db_path, "dup-token")
            with pytest.raises(Exception):
                await create_session(db_path, "dup-token")

        asyncio.run(_run())


class TestGetSessionByToken:
    """Test get_session_by_token function."""

    def test_returns_session_for_valid_token(self, db_path):
        async def _run():
            created = await create_session(db_path, "valid-token")
            found = await get_session_by_token(db_path, "valid-token")
            assert found is not None
            assert found["token"] == "valid-token"
            assert found["id"] == created["id"]

        asyncio.run(_run())

    def test_returns_none_for_unknown_token(self, db_path):
        async def _run():
            found = await get_session_by_token(db_path, "nonexistent-token")
            assert found is None

        asyncio.run(_run())

    def test_returns_none_for_empty_token(self, db_path):
        async def _run():
            found = await get_session_by_token(db_path, "")
            assert found is None

        asyncio.run(_run())


class TestUpdateSessionLastSeen:
    """Test update_session_last_seen function."""

    def test_updates_last_seen_timestamp(self, db_path):
        async def _run():
            session = await create_session(db_path, "update-token")
            original_last_seen = session["last_seen"]

            # Small delay to ensure different timestamp
            import time
            time.sleep(0.01)

            await update_session_last_seen(db_path, session["id"])
            updated = await get_session_by_token(db_path, "update-token")
            assert updated is not None
            assert updated["last_seen"] >= original_last_seen

        asyncio.run(_run())

    def test_does_not_update_created_at(self, db_path):
        async def _run():
            session = await create_session(db_path, "keep-created")
            original_created_at = session["created_at"]

            await update_session_last_seen(db_path, session["id"])
            updated = await get_session_by_token(db_path, "keep-created")
            assert updated is not None
            assert updated["created_at"] == original_created_at

        asyncio.run(_run())


class TestInvalidateSession:
    """Test invalidate_session function."""

    def test_deletes_session(self, db_path):
        async def _run():
            session = await create_session(db_path, "delete-me")
            await invalidate_session(db_path, session["id"])
            found = await get_session_by_token(db_path, "delete-me")
            assert found is None

        asyncio.run(_run())

    def test_does_not_raise_for_nonexistent_session(self, db_path):
        async def _run():
            # Should not raise
            await invalidate_session(db_path, "nonexistent-id")

        asyncio.run(_run())


class TestCreatePairingToken:
    """Test create_pairing_token function."""

    def test_returns_uuid_string(self, db_path):
        async def _run():
            token = await create_pairing_token(db_path)
            assert isinstance(token, str)
            assert len(token) == 36  # UUID v4 format

        asyncio.run(_run())

    def test_creates_session_with_is_pairing_flag(self, db_path):
        async def _run():
            token = await create_pairing_token(db_path)
            session = await get_session_by_token(db_path, token)
            assert session is not None
            assert session["is_pairing"] == 1

        asyncio.run(_run())

    def test_returns_unique_tokens(self, db_path):
        async def _run():
            tokens = set()
            for _ in range(10):
                t = await create_pairing_token(db_path)
                tokens.add(t)
            assert len(tokens) == 10

        asyncio.run(_run())


class TestConsumePairingToken:
    """Test consume_pairing_token function."""

    def test_creates_real_session_from_pairing_token(self, db_path):
        async def _run():
            pairing_token = await create_pairing_token(db_path)
            session = await consume_pairing_token(db_path, pairing_token, "real-session-token")
            assert session is not None
            assert session["token"] == "real-session-token"
            assert session["is_pairing"] == 0

        asyncio.run(_run())

    def test_deletes_pairing_token_after_consumption(self, db_path):
        async def _run():
            pairing_token = await create_pairing_token(db_path)
            await consume_pairing_token(db_path, pairing_token, "session-token")
            # Pairing token should be gone
            found = await get_session_by_token(db_path, pairing_token)
            assert found is None

        asyncio.run(_run())

    def test_returns_none_for_invalid_pairing_token(self, db_path):
        async def _run():
            session = await consume_pairing_token(db_path, "bad-token", "session-token")
            assert session is None

        asyncio.run(_run())

    def test_returns_none_for_non_pairing_token(self, db_path):
        async def _run():
            # Create a real session (not pairing)
            await create_session(db_path, "real-token")
            # Try to consume it as a pairing token — should fail
            session = await consume_pairing_token(db_path, "real-token", "new-session")
            assert session is None

        asyncio.run(_run())

    def test_consumed_pairing_token_cannot_be_reused(self, db_path):
        async def _run():
            pairing_token = await create_pairing_token(db_path)
            await consume_pairing_token(db_path, pairing_token, "session-1")
            # Second consumption should fail
            session = await consume_pairing_token(db_path, pairing_token, "session-2")
            assert session is None

        asyncio.run(_run())
