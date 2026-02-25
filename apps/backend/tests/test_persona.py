"""Tests for persona management in agent.py — Story 2.3.

Tests persona file loading, memory_core persona storage, and integration:
  - _ensure_default_personas: creates 3 files, idempotent
  - load_persona: flame/tree/star content, None for null, graceful degradation
  - get_persona_type/set_persona_type: memory_core CRUD
"""

import asyncio
from pathlib import Path
from unittest.mock import patch

import aiosqlite
import pytest

from app.agent import (
    _DEFAULT_PERSONA_FLAME,
    _DEFAULT_PERSONA_TREE,
    _DEFAULT_PERSONA_STAR,
    _ensure_default_personas,
    _persona_dir,
    _persona_path,
    get_persona_type,
    load_persona,
    set_persona_type,
)


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


class TestPersonaDir:
    """Tests for _persona_dir helper."""

    def test_returns_personas_subdirectory(self, tmp_path):
        """_persona_dir returns Path(data_dir) / 'personas'."""
        result = _persona_dir(str(tmp_path))
        assert result == tmp_path / "personas"

    def test_returns_path_object(self, tmp_path):
        """_persona_dir returns a Path object."""
        result = _persona_dir(str(tmp_path))
        assert isinstance(result, Path)


class TestPersonaPath:
    """Tests for _persona_path helper."""

    def test_returns_persona_file_path(self, tmp_path):
        """_persona_path returns Path(data_dir) / 'personas' / '{type}.md'."""
        result = _persona_path(str(tmp_path), "flame")
        assert result == tmp_path / "personas" / "flame.md"

    def test_tree_persona_path(self, tmp_path):
        result = _persona_path(str(tmp_path), "tree")
        assert result == tmp_path / "personas" / "tree.md"

    def test_star_persona_path(self, tmp_path):
        result = _persona_path(str(tmp_path), "star")
        assert result == tmp_path / "personas" / "star.md"


class TestEnsureDefaultPersonas:
    """Tests for _ensure_default_personas."""

    @pytest.mark.asyncio
    async def test_creates_three_persona_files(self, tmp_path):
        """_ensure_default_personas creates flame.md, tree.md, star.md."""
        await _ensure_default_personas(str(tmp_path))

        personas_dir = tmp_path / "personas"
        assert (personas_dir / "flame.md").exists()
        assert (personas_dir / "tree.md").exists()
        assert (personas_dir / "star.md").exists()

    @pytest.mark.asyncio
    async def test_creates_personas_directory(self, tmp_path):
        """_ensure_default_personas creates the personas/ directory."""
        await _ensure_default_personas(str(tmp_path))

        personas_dir = tmp_path / "personas"
        assert personas_dir.is_dir()

    @pytest.mark.asyncio
    async def test_idempotent_does_not_overwrite(self, tmp_path):
        """Running _ensure_default_personas twice does not overwrite existing files."""
        await _ensure_default_personas(str(tmp_path))

        # Modify a file
        flame_path = tmp_path / "personas" / "flame.md"
        flame_path.write_text("Custom flame content", encoding="utf-8")

        # Run again
        await _ensure_default_personas(str(tmp_path))

        # File should NOT be overwritten
        content = flame_path.read_text(encoding="utf-8")
        assert content == "Custom flame content"

    @pytest.mark.asyncio
    async def test_flame_content_matches_default(self, tmp_path):
        """flame.md contains the default flame persona content."""
        await _ensure_default_personas(str(tmp_path))

        flame_path = tmp_path / "personas" / "flame.md"
        content = flame_path.read_text(encoding="utf-8")
        assert content == _DEFAULT_PERSONA_FLAME

    @pytest.mark.asyncio
    async def test_tree_content_matches_default(self, tmp_path):
        """tree.md contains the default tree persona content."""
        await _ensure_default_personas(str(tmp_path))

        tree_path = tmp_path / "personas" / "tree.md"
        content = tree_path.read_text(encoding="utf-8")
        assert content == _DEFAULT_PERSONA_TREE

    @pytest.mark.asyncio
    async def test_star_content_matches_default(self, tmp_path):
        """star.md contains the default star persona content."""
        await _ensure_default_personas(str(tmp_path))

        star_path = tmp_path / "personas" / "star.md"
        content = star_path.read_text(encoding="utf-8")
        assert content == _DEFAULT_PERSONA_STAR


class TestLoadPersona:
    """Tests for load_persona."""

    @pytest.mark.asyncio
    async def test_loads_flame_persona(self, tmp_path):
        """load_persona('flame') returns flame persona content."""
        await _ensure_default_personas(str(tmp_path))

        content = await load_persona(str(tmp_path), "flame")
        assert content is not None
        assert "Flame" in content
        assert "Autonomous" in content

    @pytest.mark.asyncio
    async def test_loads_tree_persona(self, tmp_path):
        """load_persona('tree') returns tree persona content."""
        await _ensure_default_personas(str(tmp_path))

        content = await load_persona(str(tmp_path), "tree")
        assert content is not None
        assert "Tree" in content
        assert "Collaborative" in content

    @pytest.mark.asyncio
    async def test_loads_star_persona(self, tmp_path):
        """load_persona('star') returns star persona content."""
        await _ensure_default_personas(str(tmp_path))

        content = await load_persona(str(tmp_path), "star")
        assert content is not None
        assert "Star" in content
        assert "Balanced" in content

    @pytest.mark.asyncio
    async def test_none_persona_type_returns_none(self, tmp_path):
        """load_persona(data_dir, None) returns None."""
        content = await load_persona(str(tmp_path), None)
        assert content is None

    @pytest.mark.asyncio
    async def test_empty_persona_type_returns_none(self, tmp_path):
        """load_persona(data_dir, '') returns None."""
        content = await load_persona(str(tmp_path), "")
        assert content is None

    @pytest.mark.asyncio
    async def test_invalid_persona_type_returns_none(self, tmp_path):
        """load_persona('invalid') returns None and logs warning."""
        content = await load_persona(str(tmp_path), "invalid")
        assert content is None

    @pytest.mark.asyncio
    async def test_missing_file_returns_none(self, tmp_path):
        """load_persona with missing file returns None gracefully."""
        # Don't create persona files — directory doesn't exist
        content = await load_persona(str(tmp_path), "flame")
        assert content is None


class TestGetPersonaType:
    """Tests for get_persona_type."""

    @pytest.mark.asyncio
    async def test_no_entry_returns_none(self, tmp_path):
        """get_persona_type with no entry in memory_core returns None."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        result = await get_persona_type(db_path)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_stored_persona(self, tmp_path):
        """get_persona_type returns the stored persona type."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        # Insert persona directly
        db = await aiosqlite.connect(db_path)
        try:
            await db.execute(
                "INSERT INTO memory_core (id, key, value, category, user_id, created_at) "
                "VALUES ('test-id', 'persona_type', 'flame', 'persona', 'default', '2026-01-01T00:00:00')"
            )
            await db.commit()
        finally:
            await db.close()

        result = await get_persona_type(db_path)
        assert result == "flame"


class TestSetPersonaType:
    """Tests for set_persona_type."""

    @pytest.mark.asyncio
    async def test_set_flame_then_get(self, tmp_path):
        """set_persona_type('flame') followed by get_persona_type returns 'flame'."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        await set_persona_type(db_path, "flame")
        result = await get_persona_type(db_path)
        assert result == "flame"

    @pytest.mark.asyncio
    async def test_overwrites_previous_persona(self, tmp_path):
        """set_persona_type('tree') overwrites previous 'flame' persona."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        await set_persona_type(db_path, "flame")
        await set_persona_type(db_path, "tree")
        result = await get_persona_type(db_path)
        assert result == "tree"

    @pytest.mark.asyncio
    async def test_set_star_persona(self, tmp_path):
        """set_persona_type('star') works correctly."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        await set_persona_type(db_path, "star")
        result = await get_persona_type(db_path)
        assert result == "star"

    @pytest.mark.asyncio
    async def test_invalid_persona_raises_value_error(self, tmp_path):
        """set_persona_type('invalid') raises ValueError."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        with pytest.raises(ValueError, match="Invalid persona type"):
            await set_persona_type(db_path, "invalid")

    @pytest.mark.asyncio
    async def test_only_one_row_after_multiple_sets(self, tmp_path):
        """After multiple set_persona_type calls, only one row exists in memory_core."""
        db_path = str(tmp_path / "test.db")
        await _setup_memory_core_db(db_path)

        await set_persona_type(db_path, "flame")
        await set_persona_type(db_path, "tree")
        await set_persona_type(db_path, "star")

        db = await aiosqlite.connect(db_path)
        try:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM memory_core WHERE key = 'persona_type'"
            )
            row = await cursor.fetchone()
            assert row[0] == 1
        finally:
            await db.close()
