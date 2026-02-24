"""Tests for SOUL.md management functions in agent.py.

Tests load_soul, _ensure_default_soul, _soul_path, and default content validation.
Also includes integration tests for SOUL persistence across sessions.

Story 2.2: Agent Identity Persistence (AC: #1, #3, #4, #5)
"""

import asyncio
from pathlib import Path
from unittest.mock import patch

import pytest

from app.agent import (
    _DEFAULT_SOUL_CONTENT,
    _ensure_default_soul,
    _soul_path,
    load_soul,
)


class TestSoulPath:
    """Tests for _soul_path helper."""

    def test_returns_path_object(self):
        """_soul_path returns a Path object."""
        result = _soul_path("data")
        assert isinstance(result, Path)

    def test_returns_correct_path(self):
        """_soul_path returns Path(data_dir) / 'SOUL.md'."""
        result = _soul_path("data")
        assert result == Path("data") / "SOUL.md"

    def test_handles_nested_data_dir(self):
        """_soul_path handles nested directory paths."""
        result = _soul_path("/var/app/data")
        assert result == Path("/var/app/data") / "SOUL.md"

    def test_handles_relative_path(self):
        """_soul_path handles relative paths."""
        result = _soul_path("./runtime/data")
        assert result == Path("./runtime/data") / "SOUL.md"


class TestDefaultSoulContent:
    """Tests for _DEFAULT_SOUL_CONTENT constant."""

    def test_contains_name_section(self):
        """Default SOUL content contains a Name section."""
        assert "## Name" in _DEFAULT_SOUL_CONTENT

    def test_contains_personality_section(self):
        """Default SOUL content contains a Personality section."""
        assert "## Personality" in _DEFAULT_SOUL_CONTENT

    def test_contains_communication_style_section(self):
        """Default SOUL content contains a Communication Style section."""
        assert "## Communication Style" in _DEFAULT_SOUL_CONTENT

    def test_contains_agent_name_self(self):
        """Default SOUL content names the agent 'Self'."""
        assert "Self" in _DEFAULT_SOUL_CONTENT

    def test_contains_knowledge_section(self):
        """Default SOUL content contains a Knowledge section."""
        assert "Knowledge" in _DEFAULT_SOUL_CONTENT

    def test_contains_values_section(self):
        """Default SOUL content contains a Values section."""
        assert "## Values" in _DEFAULT_SOUL_CONTENT

    def test_not_empty(self):
        """Default SOUL content is not empty."""
        assert len(_DEFAULT_SOUL_CONTENT.strip()) > 0


class TestEnsureDefaultSoul:
    """Tests for _ensure_default_soul function."""

    @pytest.mark.asyncio
    async def test_creates_file_in_correct_path(self, tmp_path):
        """_ensure_default_soul creates SOUL.md in the specified data directory."""
        data_dir = str(tmp_path)
        await _ensure_default_soul(data_dir)

        soul_file = tmp_path / "SOUL.md"
        assert soul_file.exists()

    @pytest.mark.asyncio
    async def test_returns_default_content(self, tmp_path):
        """_ensure_default_soul returns the default SOUL content."""
        data_dir = str(tmp_path)
        result = await _ensure_default_soul(data_dir)

        assert result == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_file_content_matches_default(self, tmp_path):
        """_ensure_default_soul writes _DEFAULT_SOUL_CONTENT to file."""
        data_dir = str(tmp_path)
        await _ensure_default_soul(data_dir)

        soul_file = tmp_path / "SOUL.md"
        content = soul_file.read_text(encoding="utf-8")
        assert content == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_creates_data_dir_if_missing(self, tmp_path):
        """_ensure_default_soul creates the data directory if it does not exist."""
        data_dir = str(tmp_path / "nested" / "data")
        await _ensure_default_soul(data_dir)

        soul_file = Path(data_dir) / "SOUL.md"
        assert soul_file.exists()


class TestLoadSoul:
    """Tests for load_soul function."""

    @pytest.mark.asyncio
    async def test_no_existing_file_creates_default(self, tmp_path):
        """load_soul with no existing file creates default SOUL.md and returns content."""
        data_dir = str(tmp_path)
        result = await load_soul(data_dir)

        assert result == _DEFAULT_SOUL_CONTENT
        assert (tmp_path / "SOUL.md").exists()

    @pytest.mark.asyncio
    async def test_existing_valid_file_returns_content(self, tmp_path):
        """load_soul with existing valid SOUL.md returns existing content unchanged."""
        custom_content = "# Custom SOUL\n\nCustom personality."
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(custom_content, encoding="utf-8")

        result = await load_soul(str(tmp_path))

        assert result == custom_content

    @pytest.mark.asyncio
    async def test_empty_file_regenerates_default(self, tmp_path):
        """load_soul with empty file regenerates default and logs warning."""
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text("", encoding="utf-8")

        result = await load_soul(str(tmp_path))

        assert result == _DEFAULT_SOUL_CONTENT
        # Verify the file was overwritten with default content
        content = soul_file.read_text(encoding="utf-8")
        assert content == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_whitespace_only_file_regenerates_default(self, tmp_path):
        """load_soul with whitespace-only file regenerates default."""
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text("   \n\n  \t  ", encoding="utf-8")

        result = await load_soul(str(tmp_path))

        assert result == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_unreadable_file_regenerates_default(self, tmp_path):
        """load_soul with unreadable file (OSError) regenerates default and logs warning."""
        data_dir = str(tmp_path)

        # Create the file first, then mock read_text to raise OSError
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text("corrupted", encoding="utf-8")

        # Mock asyncio.to_thread to simulate read failure
        original_to_thread = asyncio.to_thread
        call_count = 0

        async def mock_to_thread(func, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call is the read — simulate failure
                raise OSError("Permission denied")
            # Subsequent calls (write) should work normally
            return await original_to_thread(func, *args, **kwargs)

        with patch("app.agent.asyncio.to_thread", side_effect=mock_to_thread):
            result = await load_soul(data_dir)

        assert result == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_unicode_decode_error_regenerates_default(self, tmp_path):
        """load_soul with file causing UnicodeDecodeError regenerates default."""
        # Write binary garbage that cannot be decoded as UTF-8
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_bytes(b"\x80\x81\x82\x83\xff\xfe")

        result = await load_soul(str(tmp_path))

        assert result == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_file_not_found_creates_default(self, tmp_path):
        """load_soul with missing file creates default SOUL.md."""
        data_dir = str(tmp_path)
        # Don't create any file

        result = await load_soul(data_dir)

        assert result == _DEFAULT_SOUL_CONTENT
        assert (tmp_path / "SOUL.md").exists()


class TestSoulPersistenceIntegration:
    """Integration tests for SOUL persistence across sessions."""

    @pytest.mark.asyncio
    async def test_create_then_load_preserves_content(self, tmp_path):
        """Create SOUL.md, then load — verify content preserved."""
        data_dir = str(tmp_path)

        # First load creates default
        content1 = await load_soul(data_dir)
        assert content1 == _DEFAULT_SOUL_CONTENT

        # Second load returns same content (not regenerated)
        content2 = await load_soul(data_dir)
        assert content2 == _DEFAULT_SOUL_CONTENT
        assert content1 == content2

    @pytest.mark.asyncio
    async def test_modified_content_persists_across_loads(self, tmp_path):
        """Modified SOUL.md content persists across load_soul calls."""
        data_dir = str(tmp_path)

        # First load creates default
        await load_soul(data_dir)

        # Modify the file (simulating agent self-modification in future stories)
        custom_content = "# Modified SOUL\n\nI have evolved."
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(custom_content, encoding="utf-8")

        # Load again — should return modified content
        result = await load_soul(data_dir)
        assert result == custom_content

    @pytest.mark.asyncio
    async def test_simulate_backend_restart_preserves_soul(self, tmp_path):
        """Simulate backend restart: load_soul twice with existing file returns same content."""
        data_dir = str(tmp_path)

        # First "boot" — creates SOUL.md
        content1 = await load_soul(data_dir)

        # Simulate restart — file already exists
        content2 = await load_soul(data_dir)

        assert content1 == content2
        assert content1 == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_deleted_between_sessions_regenerates(self, tmp_path):
        """If SOUL.md is deleted between sessions, it is regenerated."""
        data_dir = str(tmp_path)

        # First session
        await load_soul(data_dir)
        assert (tmp_path / "SOUL.md").exists()

        # Delete the file (simulating corruption/deletion)
        (tmp_path / "SOUL.md").unlink()
        assert not (tmp_path / "SOUL.md").exists()

        # Second session — should regenerate
        content = await load_soul(data_dir)
        assert content == _DEFAULT_SOUL_CONTENT
        assert (tmp_path / "SOUL.md").exists()
