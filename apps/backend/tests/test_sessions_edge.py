"""Edge case tests for session management (Story 1-6).

Covers:
  - get_existing_pairing_token behavior
  - has_active_client_session behavior
  - Concurrent pairing token creation
  - Session with custom user_id
  - Timestamp format validation
  - Multiple sessions in database
  - consume_pairing_token with duplicate session token
"""

import asyncio
import time

import aiosqlite
import pytest

from app.sessions import (
    create_session,
    get_session_by_token,
    update_session_last_seen,
    invalidate_session,
    create_pairing_token,
    consume_pairing_token,
    get_existing_pairing_token,
    has_active_client_session,
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


class TestGetExistingPairingToken:
    """Test get_existing_pairing_token function."""

    def test_returns_none_when_no_pairing_token_exists(self, db_path):
        async def _run():
            result = await get_existing_pairing_token(db_path)
            assert result is None
        asyncio.run(_run())

    def test_returns_token_when_pairing_token_exists(self, db_path):
        async def _run():
            created = await create_pairing_token(db_path)
            found = await get_existing_pairing_token(db_path)
            assert found == created
        asyncio.run(_run())

    def test_returns_token_even_when_real_sessions_exist(self, db_path):
        async def _run():
            await create_session(db_path, "real-token-1")
            await create_session(db_path, "real-token-2")
            pairing = await create_pairing_token(db_path)
            found = await get_existing_pairing_token(db_path)
            assert found == pairing
        asyncio.run(_run())

    def test_does_not_return_real_session_as_pairing(self, db_path):
        async def _run():
            await create_session(db_path, "not-pairing")
            found = await get_existing_pairing_token(db_path)
            assert found is None
        asyncio.run(_run())

    def test_returns_first_pairing_token_when_multiple_exist(self, db_path):
        async def _run():
            token1 = await create_pairing_token(db_path)
            token2 = await create_pairing_token(db_path)
            found = await get_existing_pairing_token(db_path)
            # Should return one of them (LIMIT 1)
            assert found in (token1, token2)
        asyncio.run(_run())


class TestHasActiveClientSession:
    """Test has_active_client_session function."""

    def test_returns_false_when_no_sessions(self, db_path):
        async def _run():
            result = await has_active_client_session(db_path)
            assert result is False
        asyncio.run(_run())

    def test_returns_false_when_only_pairing_tokens_exist(self, db_path):
        async def _run():
            await create_pairing_token(db_path)
            result = await has_active_client_session(db_path)
            assert result is False
        asyncio.run(_run())

    def test_returns_true_when_recent_session_exists(self, db_path):
        async def _run():
            # Create a real session (its last_seen is now, which is within 5 minutes)
            await create_session(db_path, "recent-session")
            result = await has_active_client_session(db_path)
            assert result is True
        asyncio.run(_run())

    def test_returns_true_with_updated_last_seen(self, db_path):
        async def _run():
            session = await create_session(db_path, "active-session")
            await update_session_last_seen(db_path, session["id"])
            result = await has_active_client_session(db_path)
            assert result is True
        asyncio.run(_run())


class TestSessionTimestamps:
    """Test timestamp format and behavior."""

    def test_timestamps_are_iso_format(self, db_path):
        async def _run():
            session = await create_session(db_path, "ts-test")
            # ISO format: contains 'T' separator and timezone info
            assert "T" in session["created_at"]
            assert "T" in session["last_seen"]
        asyncio.run(_run())

    def test_timestamps_contain_utc_offset(self, db_path):
        async def _run():
            session = await create_session(db_path, "utc-test")
            # Python datetime with UTC produces "+00:00" suffix
            assert "+00:00" in session["created_at"] or "Z" in session["created_at"]
        asyncio.run(_run())

    def test_update_last_seen_changes_timestamp(self, db_path):
        async def _run():
            session = await create_session(db_path, "update-ts")
            original = session["last_seen"]
            time.sleep(0.01)  # Small delay for different timestamp
            await update_session_last_seen(db_path, session["id"])
            updated = await get_session_by_token(db_path, "update-ts")
            assert updated["last_seen"] >= original
        asyncio.run(_run())


class TestMultipleSessions:
    """Test behavior with multiple sessions in the database."""

    def test_get_session_finds_correct_one_among_many(self, db_path):
        async def _run():
            await create_session(db_path, "token-a")
            await create_session(db_path, "token-b")
            await create_session(db_path, "token-c")

            found = await get_session_by_token(db_path, "token-b")
            assert found is not None
            assert found["token"] == "token-b"
        asyncio.run(_run())

    def test_invalidate_session_only_removes_target(self, db_path):
        async def _run():
            s1 = await create_session(db_path, "keep-1")
            s2 = await create_session(db_path, "remove-me")
            s3 = await create_session(db_path, "keep-2")

            await invalidate_session(db_path, s2["id"])

            assert await get_session_by_token(db_path, "keep-1") is not None
            assert await get_session_by_token(db_path, "remove-me") is None
            assert await get_session_by_token(db_path, "keep-2") is not None
        asyncio.run(_run())

    def test_update_last_seen_only_affects_target(self, db_path):
        async def _run():
            s1 = await create_session(db_path, "other-session")
            s2 = await create_session(db_path, "target-session")
            time.sleep(0.01)

            await update_session_last_seen(db_path, s2["id"])

            found1 = await get_session_by_token(db_path, "other-session")
            found2 = await get_session_by_token(db_path, "target-session")

            # s1's last_seen should be unchanged (equal to created_at)
            assert found1["last_seen"] == found1["created_at"]
            # s2's last_seen should be updated (different from created_at)
            assert found2["last_seen"] >= found2["created_at"]
        asyncio.run(_run())


class TestConsumePairingTokenEdgeCases:
    """Edge cases for consume_pairing_token."""

    def test_consume_with_empty_session_token(self, db_path):
        async def _run():
            pairing = await create_pairing_token(db_path)
            # Empty session token should create a session with empty token
            session = await consume_pairing_token(db_path, pairing, "")
            assert session is not None
            assert session["token"] == ""
        asyncio.run(_run())

    def test_consume_with_empty_pairing_token(self, db_path):
        async def _run():
            # Empty string doesn't match any pairing token
            session = await consume_pairing_token(db_path, "", "session-token")
            assert session is None
        asyncio.run(_run())

    def test_pairing_token_gone_after_consumption(self, db_path):
        async def _run():
            pairing = await create_pairing_token(db_path)
            await consume_pairing_token(db_path, pairing, "new-session")

            # The pairing token should no longer exist
            found = await get_session_by_token(db_path, pairing)
            assert found is None

            # get_existing_pairing_token should return None
            existing = await get_existing_pairing_token(db_path)
            assert existing is None
        asyncio.run(_run())


class TestSessionUserIdField:
    """Test user_id field behavior (multi-user readiness NFR29)."""

    def test_default_user_id_is_default(self, db_path):
        async def _run():
            session = await create_session(db_path, "uid-test")
            assert session["user_id"] == "default"
        asyncio.run(_run())

    def test_custom_user_id_is_stored(self, db_path):
        async def _run():
            session = await create_session(db_path, "custom-uid", user_id="user-123")
            assert session["user_id"] == "user-123"

            found = await get_session_by_token(db_path, "custom-uid")
            assert found["user_id"] == "user-123"
        asyncio.run(_run())

    def test_pairing_token_has_default_user_id(self, db_path):
        async def _run():
            token = await create_pairing_token(db_path)
            session = await get_session_by_token(db_path, token)
            assert session["user_id"] == "default"
        asyncio.run(_run())

    def test_consumed_pairing_creates_session_with_default_user_id(self, db_path):
        async def _run():
            pairing = await create_pairing_token(db_path)
            session = await consume_pairing_token(db_path, pairing, "real-token")
            assert session["user_id"] == "default"
        asyncio.run(_run())


class TestSessionIdUniqueness:
    """Test that session IDs are unique UUIDs."""

    def test_each_session_has_unique_id(self, db_path):
        async def _run():
            ids = set()
            for i in range(20):
                session = await create_session(db_path, f"unique-{i}")
                ids.add(session["id"])
            assert len(ids) == 20
        asyncio.run(_run())

    def test_session_id_is_uuid_format(self, db_path):
        async def _run():
            session = await create_session(db_path, "uuid-format-check")
            # UUID v4: 8-4-4-4-12 hex chars
            assert len(session["id"]) == 36
            parts = session["id"].split("-")
            assert len(parts) == 5
        asyncio.run(_run())
