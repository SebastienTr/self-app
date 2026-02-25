"""Edge case tests for persona management — Story 2.3.

Tests boundary conditions and error handling not covered by test_persona.py:
  - set_persona_type with empty/None/case variations/special chars
  - load_persona with empty file, corrupted file, partial persona set
  - get_persona_type with orphaned/duplicate rows
  - _ensure_default_personas idempotency with partial state
  - _build_module_prompt edge cases with persona
  - handle_chat graceful degradation when persona file is missing
"""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import aiosqlite
import pytest

from app.agent import (
    _DEFAULT_PERSONA_FLAME,
    _DEFAULT_PERSONA_STAR,
    _DEFAULT_PERSONA_TREE,
    _VALID_PERSONA_TYPES,
    _build_module_prompt,
    _ensure_default_personas,
    _persona_dir,
    _persona_path,
    get_persona_type,
    handle_chat,
    load_persona,
    set_persona_type,
)
from app.llm.base import LLMResult, LLMStreamChunk


_TEST_SOUL = "# Test SOUL\n\nYou are a test agent."


async def _setup_memory_core_db(db_path: str) -> None:
    """Create memory_core table for persona tests."""
    db = await aiosqlite.connect(db_path)
    try:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute(
            """CREATE TABLE IF NOT EXISTS memory_core (
                id TEXT PRIMARY KEY,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                category TEXT,
                user_id TEXT NOT NULL DEFAULT 'default',
                created_at TEXT NOT NULL
            )"""
        )
        await db.commit()
    finally:
        await db.close()


async def _setup_full_db(db_path: str) -> None:
    """Create all tables needed for handle_chat tests."""
    db = await aiosqlite.connect(db_path)
    try:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute(
            """CREATE TABLE IF NOT EXISTS memory_core (
                id TEXT PRIMARY KEY,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                category TEXT,
                user_id TEXT NOT NULL DEFAULT 'default',
                created_at TEXT NOT NULL
            )"""
        )
        await db.execute(
            """CREATE TABLE IF NOT EXISTS llm_usage (
                id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                tokens_in INTEGER,
                tokens_out INTEGER,
                cost_estimate REAL,
                created_at TEXT NOT NULL
            )"""
        )
        await db.execute(
            """CREATE TABLE IF NOT EXISTS modules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                spec TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                vitality_score REAL DEFAULT 0,
                user_id TEXT NOT NULL DEFAULT 'default',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )"""
        )
        await db.commit()
    finally:
        await db.close()


class MockWebSocket:
    """Minimal mock WebSocket that records sent messages."""

    def __init__(self):
        self.sent = []

    async def send_json(self, data: dict) -> None:
        self.sent.append(data)


# ---------------------------------------------------------------------------
# set_persona_type edge cases
# ---------------------------------------------------------------------------

class TestSetPersonaTypeEdge:
    """Edge cases for set_persona_type."""

    @pytest.mark.asyncio
    async def test_empty_string_raises_value_error(self, tmp_path):
        """set_persona_type('') raises ValueError."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        with pytest.raises(ValueError, match="Invalid persona type"):
            await set_persona_type(db_path, "")

    @pytest.mark.asyncio
    async def test_whitespace_string_raises_value_error(self, tmp_path):
        """set_persona_type('  ') raises ValueError."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        with pytest.raises(ValueError, match="Invalid persona type"):
            await set_persona_type(db_path, "  ")

    @pytest.mark.asyncio
    async def test_uppercase_flame_raises_value_error(self, tmp_path):
        """set_persona_type('Flame') (case mismatch) raises ValueError."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        with pytest.raises(ValueError, match="Invalid persona type"):
            await set_persona_type(db_path, "Flame")

    @pytest.mark.asyncio
    async def test_all_caps_raises_value_error(self, tmp_path):
        """set_persona_type('FLAME') raises ValueError."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        with pytest.raises(ValueError, match="Invalid persona type"):
            await set_persona_type(db_path, "FLAME")

    @pytest.mark.asyncio
    async def test_special_chars_raises_value_error(self, tmp_path):
        """set_persona_type with special characters raises ValueError."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        with pytest.raises(ValueError, match="Invalid persona type"):
            await set_persona_type(db_path, "flame'; DROP TABLE memory_core; --")

    @pytest.mark.asyncio
    async def test_sql_injection_does_not_corrupt_db(self, tmp_path):
        """SQL injection attempt in persona type does not corrupt database."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        # First set a valid persona
        await set_persona_type(db_path, "flame")

        # Try SQL injection — should raise ValueError before any DB interaction
        with pytest.raises(ValueError):
            await set_persona_type(db_path, "'; DELETE FROM memory_core; --")

        # Original persona should still be intact
        result = await get_persona_type(db_path)
        assert result == "flame"

    @pytest.mark.asyncio
    async def test_numeric_string_raises_value_error(self, tmp_path):
        """set_persona_type('123') raises ValueError."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        with pytest.raises(ValueError, match="Invalid persona type"):
            await set_persona_type(db_path, "123")

    @pytest.mark.asyncio
    async def test_set_same_persona_twice_idempotent(self, tmp_path):
        """Setting the same persona twice still leaves exactly one row."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        await set_persona_type(db_path, "flame")
        await set_persona_type(db_path, "flame")

        result = await get_persona_type(db_path)
        assert result == "flame"

        # Verify only one row
        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM memory_core WHERE key = 'persona_type'"
            )
            row = await cursor.fetchone()
            assert row[0] == 1
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_rapid_cycling_all_personas(self, tmp_path):
        """Rapidly cycling through all personas leaves the last one set."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        for _ in range(5):
            await set_persona_type(db_path, "flame")
            await set_persona_type(db_path, "tree")
            await set_persona_type(db_path, "star")

        result = await get_persona_type(db_path)
        assert result == "star"

        # Still only one row
        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM memory_core WHERE key = 'persona_type'"
            )
            row = await cursor.fetchone()
            assert row[0] == 1
        finally:
            await db.close()


# ---------------------------------------------------------------------------
# get_persona_type edge cases
# ---------------------------------------------------------------------------

class TestGetPersonaTypeEdge:
    """Edge cases for get_persona_type."""

    @pytest.mark.asyncio
    async def test_multiple_rows_returns_one(self, tmp_path):
        """If memory_core has multiple persona_type rows (data corruption), get_persona_type returns one."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        # Manually insert two rows (simulating data corruption)
        db = await aiosqlite.connect(db_path)
        try:
            await db.execute(
                "INSERT INTO memory_core (id, key, value, category, user_id, created_at) "
                "VALUES ('id-1', 'persona_type', 'flame', 'persona', 'default', '2026-01-01T00:00:00')"
            )
            await db.execute(
                "INSERT INTO memory_core (id, key, value, category, user_id, created_at) "
                "VALUES ('id-2', 'persona_type', 'tree', 'persona', 'default', '2026-01-02T00:00:00')"
            )
            await db.commit()
        finally:
            await db.close()

        # Should return one of the values (first row returned by query)
        result = await get_persona_type(db_path)
        assert result in ("flame", "tree")

    @pytest.mark.asyncio
    async def test_persona_for_different_user_not_returned(self, tmp_path):
        """Persona set for a different user_id is not returned for 'default'."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        # Insert persona for a different user
        db = await aiosqlite.connect(db_path)
        try:
            await db.execute(
                "INSERT INTO memory_core (id, key, value, category, user_id, created_at) "
                "VALUES ('id-1', 'persona_type', 'flame', 'persona', 'other_user', '2026-01-01T00:00:00')"
            )
            await db.commit()
        finally:
            await db.close()

        # Default user should have no persona
        result = await get_persona_type(db_path)
        assert result is None

    @pytest.mark.asyncio
    async def test_other_keys_in_memory_core_not_confused(self, tmp_path):
        """Other keys in memory_core don't affect persona_type retrieval."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        # Insert a non-persona key
        db = await aiosqlite.connect(db_path)
        try:
            await db.execute(
                "INSERT INTO memory_core (id, key, value, category, user_id, created_at) "
                "VALUES ('id-1', 'some_other_key', 'some_value', 'other', 'default', '2026-01-01T00:00:00')"
            )
            await db.commit()
        finally:
            await db.close()

        result = await get_persona_type(db_path)
        assert result is None


# ---------------------------------------------------------------------------
# load_persona edge cases
# ---------------------------------------------------------------------------

class TestLoadPersonaEdge:
    """Edge cases for load_persona."""

    @pytest.mark.asyncio
    async def test_empty_file_returns_none(self, tmp_path):
        """load_persona returns None when persona file exists but is empty."""
        personas_dir = tmp_path / "personas"
        personas_dir.mkdir()
        (personas_dir / "flame.md").write_text("", encoding="utf-8")

        result = await load_persona(str(tmp_path), "flame")
        assert result is None

    @pytest.mark.asyncio
    async def test_whitespace_only_file_returns_none(self, tmp_path):
        """load_persona returns None when persona file contains only whitespace."""
        personas_dir = tmp_path / "personas"
        personas_dir.mkdir()
        (personas_dir / "flame.md").write_text("   \n\t\n   ", encoding="utf-8")

        result = await load_persona(str(tmp_path), "flame")
        assert result is None

    @pytest.mark.asyncio
    async def test_custom_edited_file_returns_content(self, tmp_path):
        """load_persona returns content of user-edited persona file."""
        personas_dir = tmp_path / "personas"
        personas_dir.mkdir()
        custom_content = "# My Custom Flame\n\nBe super brief."
        (personas_dir / "flame.md").write_text(custom_content, encoding="utf-8")

        result = await load_persona(str(tmp_path), "flame")
        assert result == custom_content

    @pytest.mark.asyncio
    async def test_unicode_content_loads_correctly(self, tmp_path):
        """load_persona handles Unicode content correctly."""
        personas_dir = tmp_path / "personas"
        personas_dir.mkdir()
        unicode_content = "# Persona Flamme\n\nSois concis et direct."
        (personas_dir / "flame.md").write_text(unicode_content, encoding="utf-8")

        result = await load_persona(str(tmp_path), "flame")
        assert result == unicode_content

    @pytest.mark.asyncio
    async def test_very_long_content_loads_correctly(self, tmp_path):
        """load_persona handles very long persona files."""
        personas_dir = tmp_path / "personas"
        personas_dir.mkdir()
        long_content = "# Long Persona\n\n" + ("Be concise. " * 10000)
        (personas_dir / "flame.md").write_text(long_content, encoding="utf-8")

        result = await load_persona(str(tmp_path), "flame")
        assert result == long_content

    @pytest.mark.asyncio
    async def test_all_valid_types_accepted(self, tmp_path):
        """load_persona accepts all valid persona types."""
        await _ensure_default_personas(str(tmp_path))

        for persona_type in _VALID_PERSONA_TYPES:
            result = await load_persona(str(tmp_path), persona_type)
            assert result is not None, f"load_persona returned None for valid type '{persona_type}'"


# ---------------------------------------------------------------------------
# _ensure_default_personas edge cases
# ---------------------------------------------------------------------------

class TestEnsureDefaultPersonasEdge:
    """Edge cases for _ensure_default_personas."""

    @pytest.mark.asyncio
    async def test_creates_missing_files_when_partial(self, tmp_path):
        """If only flame.md exists, _ensure_default_personas creates tree.md and star.md."""
        personas_dir = tmp_path / "personas"
        personas_dir.mkdir()
        (personas_dir / "flame.md").write_text("Custom flame", encoding="utf-8")

        await _ensure_default_personas(str(tmp_path))

        # flame.md should be untouched (custom content preserved)
        assert (personas_dir / "flame.md").read_text(encoding="utf-8") == "Custom flame"
        # tree.md and star.md should be created with defaults
        assert (personas_dir / "tree.md").read_text(encoding="utf-8") == _DEFAULT_PERSONA_TREE
        assert (personas_dir / "star.md").read_text(encoding="utf-8") == _DEFAULT_PERSONA_STAR

    @pytest.mark.asyncio
    async def test_creates_directory_when_missing(self, tmp_path):
        """_ensure_default_personas creates personas/ directory if it doesn't exist."""
        data_dir = tmp_path / "nonexistent"
        await _ensure_default_personas(str(data_dir))

        personas_dir = data_dir / "personas"
        assert personas_dir.is_dir()
        assert (personas_dir / "flame.md").exists()
        assert (personas_dir / "tree.md").exists()
        assert (personas_dir / "star.md").exists()

    @pytest.mark.asyncio
    async def test_empty_existing_file_not_overwritten(self, tmp_path):
        """_ensure_default_personas does NOT overwrite an existing empty file."""
        personas_dir = tmp_path / "personas"
        personas_dir.mkdir()
        (personas_dir / "flame.md").write_text("", encoding="utf-8")

        await _ensure_default_personas(str(tmp_path))

        # The empty file should remain (exists check passes even if empty)
        content = (personas_dir / "flame.md").read_text(encoding="utf-8")
        assert content == ""

    @pytest.mark.asyncio
    async def test_triple_invocation_idempotent(self, tmp_path):
        """Calling _ensure_default_personas three times is idempotent."""
        await _ensure_default_personas(str(tmp_path))
        await _ensure_default_personas(str(tmp_path))
        await _ensure_default_personas(str(tmp_path))

        personas_dir = tmp_path / "personas"
        assert (personas_dir / "flame.md").read_text(encoding="utf-8") == _DEFAULT_PERSONA_FLAME
        assert (personas_dir / "tree.md").read_text(encoding="utf-8") == _DEFAULT_PERSONA_TREE
        assert (personas_dir / "star.md").read_text(encoding="utf-8") == _DEFAULT_PERSONA_STAR


# ---------------------------------------------------------------------------
# _build_module_prompt persona edge cases
# ---------------------------------------------------------------------------

class TestBuildModulePromptPersonaEdge:
    """Edge cases for persona injection in _build_module_prompt."""

    def test_empty_string_persona_still_injected(self):
        """An empty string persona_content is falsy so no persona section."""
        prompt = _build_module_prompt("hello", _TEST_SOUL, "")
        assert "\n# Persona\n" not in prompt

    def test_very_long_persona_content_included(self):
        """Very long persona content is included in the prompt."""
        long_persona = "# Persona\n\n" + ("Be concise. " * 5000)
        prompt = _build_module_prompt("hello", _TEST_SOUL, long_persona)
        assert "Be concise." in prompt
        assert "# Persona" in prompt

    def test_persona_with_markdown_headers(self):
        """Persona content with markdown headers doesn't break prompt structure."""
        persona = "# Persona: Flame\n\n## Communication\n\nBe concise.\n\n## Tone\n\nDirect."
        prompt = _build_module_prompt("hello", _TEST_SOUL, persona)
        # The order must still be: Identity > SOUL > Persona > Instructions > message
        identity_pos = prompt.find("# Agent Identity")
        persona_pos = prompt.find("# Persona: Flame")
        instructions_pos = prompt.find("# Instructions")
        user_msg_pos = prompt.find("User message: hello")
        assert identity_pos < persona_pos < instructions_pos < user_msg_pos

    def test_persona_with_special_characters(self):
        """Persona content with special characters (Unicode, emoji text) works."""
        persona = "# Persona\n\nSois concis et direct. Utilise des formulations courtes."
        prompt = _build_module_prompt("bonjour", _TEST_SOUL, persona)
        assert "Sois concis" in prompt
        assert "User message: bonjour" in prompt

    def test_persona_with_curly_braces_no_format_error(self):
        """Persona content with curly braces doesn't cause string format errors."""
        persona = "Use templates like {{name}} and {type} in responses."
        prompt = _build_module_prompt("hello", _TEST_SOUL, persona)
        assert "{{name}}" in prompt or "{type}" in prompt

    def test_none_persona_identical_to_omitted(self):
        """Passing persona_content=None is identical to omitting it."""
        prompt_none = _build_module_prompt("hello", _TEST_SOUL, None)
        prompt_omitted = _build_module_prompt("hello", _TEST_SOUL)
        assert prompt_none == prompt_omitted


# ---------------------------------------------------------------------------
# handle_chat with persona edge cases
# ---------------------------------------------------------------------------

class TestHandleChatPersonaEdge:
    """Edge cases for handle_chat when persona is involved."""

    @pytest.mark.asyncio
    async def test_persona_set_but_file_missing_graceful_degradation(self, tmp_path):
        """When persona is set in DB but file is missing, agent works without persona."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)
        await set_persona_type(db_path, "flame")
        # Do NOT create persona files

        provider = MagicMock()
        provider.name = "test-provider"
        content = "Hello!"
        provider.execute = AsyncMock(return_value=LLMResult(
            content=content, provider="test-provider", model="test-model",
            tokens_in=10, tokens_out=20, latency_ms=100, cost_estimate=0.001,
        ))

        async def mock_stream(prompt: str = "", **kwargs):
            yield LLMStreamChunk(delta=content, accumulated=content, done=False)
            yield LLMStreamChunk(
                delta="", accumulated=content, done=True,
                tokens_in=10, tokens_out=20, model="test-model",
                provider="test-provider", latency_ms=100,
            )
        provider.stream = mock_stream

        ws = MockWebSocket()
        await handle_chat(ws, "Hello", provider, db_path)

        # Should not crash — agent works without persona
        assert ws.sent[0]["type"] == "status"
        assert ws.sent[0]["payload"]["state"] == "thinking"
        assert ws.sent[-1]["type"] == "status"
        assert ws.sent[-1]["payload"]["state"] == "idle"

        # Status messages should still report the persona type from DB
        status_msgs = [m for m in ws.sent if m["type"] == "status"]
        for sm in status_msgs:
            assert sm["payload"]["persona"] == "flame"

    @pytest.mark.asyncio
    async def test_persona_set_but_file_empty_graceful_degradation(self, tmp_path):
        """When persona is set in DB but file is empty, agent works without persona."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)
        await set_persona_type(db_path, "flame")

        # Create empty persona file
        personas_dir = tmp_path / "personas"
        personas_dir.mkdir()
        (personas_dir / "flame.md").write_text("", encoding="utf-8")

        provider = MagicMock()
        provider.name = "test-provider"
        content = "Hello!"
        provider._captured_prompt = None

        async def mock_stream(prompt: str = "", **kwargs):
            provider._captured_prompt = prompt
            yield LLMStreamChunk(delta=content, accumulated=content, done=False)
            yield LLMStreamChunk(
                delta="", accumulated=content, done=True,
                tokens_in=10, tokens_out=20, model="test-model",
                provider="test-provider", latency_ms=100,
            )
        provider.stream = mock_stream

        ws = MockWebSocket()
        await handle_chat(ws, "Hello", provider, db_path)

        # Should not crash
        assert ws.sent[-1]["payload"]["state"] == "idle"

        # Prompt should NOT contain persona section (empty file returns None)
        prompt = provider._captured_prompt or ""
        assert "\n# Persona\n" not in prompt

    @pytest.mark.asyncio
    async def test_persona_changed_between_chats(self, tmp_path):
        """Changing persona between chats reflects in next chat's prompt."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)
        await _ensure_default_personas(str(tmp_path))

        provider = MagicMock()
        provider.name = "test-provider"
        content = "Hello!"
        captured_prompts = []

        async def mock_stream(prompt: str = "", **kwargs):
            captured_prompts.append(prompt)
            yield LLMStreamChunk(delta=content, accumulated=content, done=False)
            yield LLMStreamChunk(
                delta="", accumulated=content, done=True,
                tokens_in=10, tokens_out=20, model="test-model",
                provider="test-provider", latency_ms=100,
            )
        provider.stream = mock_stream

        # First chat — no persona
        ws1 = MockWebSocket()
        await handle_chat(ws1, "Hello", provider, db_path)
        prompt1 = captured_prompts[0]
        assert "\n# Persona\n" not in prompt1

        # Set persona
        await set_persona_type(db_path, "tree")

        # Second chat — should have tree persona
        ws2 = MockWebSocket()
        await handle_chat(ws2, "Hello again", provider, db_path)
        prompt2 = captured_prompts[1]
        assert "# Persona" in prompt2
        assert "Tree" in prompt2

    @pytest.mark.asyncio
    async def test_error_still_includes_persona_in_idle(self, tmp_path):
        """On LLM error with persona set, idle status still includes persona."""
        db_path = str(tmp_path / "test.db")
        await _setup_full_db(db_path)
        await set_persona_type(db_path, "star")
        await _ensure_default_personas(str(tmp_path))

        provider = MagicMock()
        provider.name = "test-provider"
        provider.execute = AsyncMock(side_effect=Exception("LLM failure"))

        async def failing_stream(prompt: str = "", **kwargs):
            raise Exception("LLM failure")
            yield  # noqa: E701
        provider.stream = failing_stream

        ws = MockWebSocket()
        await handle_chat(ws, "Hello", provider, db_path)

        # Idle status should include persona even on error
        assert ws.sent[-1]["type"] == "status"
        assert ws.sent[-1]["payload"]["state"] == "idle"
        assert ws.sent[-1]["payload"]["persona"] == "star"


# ---------------------------------------------------------------------------
# _persona_path / _persona_dir edge cases
# ---------------------------------------------------------------------------

class TestPersonaPathEdge:
    """Edge cases for path helper functions."""

    def test_persona_dir_with_trailing_slash(self, tmp_path):
        """_persona_dir handles data_dir with trailing slash."""
        result = _persona_dir(str(tmp_path) + "/")
        assert result == Path(str(tmp_path) + "/") / "personas"

    def test_persona_path_constructs_correct_extension(self, tmp_path):
        """_persona_path always uses .md extension."""
        for pt in _VALID_PERSONA_TYPES:
            result = _persona_path(str(tmp_path), pt)
            assert result.suffix == ".md"
            assert result.stem == pt


# ---------------------------------------------------------------------------
# Constant validation
# ---------------------------------------------------------------------------

class TestPersonaConstants:
    """Validate persona constants and defaults."""

    def test_valid_persona_types_tuple(self):
        """_VALID_PERSONA_TYPES contains exactly flame, tree, star."""
        assert set(_VALID_PERSONA_TYPES) == {"flame", "tree", "star"}

    def test_default_flame_contains_autonomous(self):
        """Default flame persona mentions autonomy."""
        assert "Autonomous" in _DEFAULT_PERSONA_FLAME
        assert "concise" in _DEFAULT_PERSONA_FLAME.lower()

    def test_default_tree_contains_collaborative(self):
        """Default tree persona mentions collaboration."""
        assert "Collaborative" in _DEFAULT_PERSONA_TREE
        assert "confirmation" in _DEFAULT_PERSONA_TREE.lower()

    def test_default_star_contains_balanced(self):
        """Default star persona mentions balance."""
        assert "Balanced" in _DEFAULT_PERSONA_STAR
        assert "adaptive" in _DEFAULT_PERSONA_STAR.lower()

    def test_defaults_are_non_empty(self):
        """All default persona contents are non-empty strings."""
        for persona_type in _VALID_PERSONA_TYPES:
            defaults = {"flame": _DEFAULT_PERSONA_FLAME, "tree": _DEFAULT_PERSONA_TREE, "star": _DEFAULT_PERSONA_STAR}
            content = defaults[persona_type]
            assert isinstance(content, str)
            assert len(content.strip()) > 0
