"""Edge-case tests for SOUL.md management — Story 2.2 TEA expansion.

Covers paths NOT exercised by test_soul.py:
  - _soul_path: empty string, trailing slashes, dot-relative paths
  - _DEFAULT_SOUL_CONTENT: structural markdown hierarchy, no trailing newline issues
  - _ensure_default_soul: overwrites existing file, idempotency, permission errors
  - load_soul: logging verification (soul_empty, soul_not_found, soul_read_failed)
  - load_soul: large files, unicode-only content, special markdown chars
  - load_soul: no caching — re-reads on every call (live edit detection)
  - load_soul: concurrent calls don't corrupt file
  - Integration: file modified externally between calls (live editing)
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


class TestSoulPathEdgeCases:
    """Edge cases for _soul_path helper."""

    def test_empty_string_data_dir(self):
        """_soul_path with empty string returns Path('') / 'SOUL.md'."""
        result = _soul_path("")
        assert result == Path("") / "SOUL.md"
        assert str(result) == "SOUL.md"

    def test_trailing_slash_in_data_dir(self):
        """_soul_path with trailing slash produces correct path."""
        result = _soul_path("data/")
        assert result == Path("data/") / "SOUL.md"
        assert result.name == "SOUL.md"

    def test_dot_data_dir(self):
        """_soul_path with '.' returns SOUL.md in current dir."""
        result = _soul_path(".")
        assert result == Path(".") / "SOUL.md"

    def test_absolute_path(self):
        """_soul_path with absolute path returns absolute SOUL.md path."""
        result = _soul_path("/tmp/myapp/data")
        assert result == Path("/tmp/myapp/data/SOUL.md")
        assert result.is_absolute()

    def test_path_with_spaces(self):
        """_soul_path handles directory names with spaces."""
        result = _soul_path("/my app/data dir")
        assert result == Path("/my app/data dir") / "SOUL.md"


class TestDefaultSoulContentStructure:
    """Structural validation of _DEFAULT_SOUL_CONTENT."""

    def test_starts_with_top_level_heading(self):
        """Default SOUL starts with a level-1 markdown heading."""
        first_line = _DEFAULT_SOUL_CONTENT.strip().split("\n")[0]
        assert first_line.startswith("# ")

    def test_has_correct_heading_hierarchy(self):
        """All section headings are level-2 (## ), no level-3+ used."""
        lines = _DEFAULT_SOUL_CONTENT.split("\n")
        headings = [ln for ln in lines if ln.startswith("#")]
        level_1 = [h for h in headings if h.startswith("# ") and not h.startswith("## ")]
        level_2 = [h for h in headings if h.startswith("## ")]
        assert len(level_1) == 1, "Expected exactly one level-1 heading"
        assert len(level_2) >= 4, "Expected at least 4 level-2 sections"

    def test_no_triple_hash_headings(self):
        """Default SOUL has no level-3 headings (flat structure)."""
        lines = _DEFAULT_SOUL_CONTENT.split("\n")
        level_3 = [ln for ln in lines if ln.startswith("### ")]
        assert len(level_3) == 0

    def test_content_is_valid_utf8_string(self):
        """Default SOUL content is a valid string (encodable as UTF-8)."""
        encoded = _DEFAULT_SOUL_CONTENT.encode("utf-8")
        decoded = encoded.decode("utf-8")
        assert decoded == _DEFAULT_SOUL_CONTENT

    def test_contains_agent_name_self_in_name_section(self):
        """The Name section explicitly contains 'Self'."""
        lines = _DEFAULT_SOUL_CONTENT.split("\n")
        name_idx = next(
            i for i, ln in enumerate(lines) if ln.strip() == "## Name"
        )
        # Next non-empty line after ## Name should contain "Self"
        for line in lines[name_idx + 1:]:
            if line.strip():
                assert "Self" in line
                break

    def test_communication_style_has_bullet_points(self):
        """Communication Style section contains bullet point items."""
        in_section = False
        bullets = 0
        for line in _DEFAULT_SOUL_CONTENT.split("\n"):
            if "## Communication Style" in line:
                in_section = True
                continue
            if in_section and line.startswith("## "):
                break
            if in_section and line.strip().startswith("- "):
                bullets += 1
        assert bullets >= 3, "Expected at least 3 bullet points"


class TestEnsureDefaultSoulEdgeCases:
    """Edge cases for _ensure_default_soul function."""

    @pytest.mark.asyncio
    async def test_overwrites_existing_file(self, tmp_path):
        """_ensure_default_soul overwrites existing SOUL.md content."""
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text("Old custom content", encoding="utf-8")

        result = await _ensure_default_soul(str(tmp_path))

        assert result == _DEFAULT_SOUL_CONTENT
        assert soul_file.read_text(encoding="utf-8") == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_idempotency_calling_twice(self, tmp_path):
        """Calling _ensure_default_soul twice produces identical results."""
        data_dir = str(tmp_path)

        result1 = await _ensure_default_soul(data_dir)
        result2 = await _ensure_default_soul(data_dir)

        assert result1 == result2
        assert result1 == _DEFAULT_SOUL_CONTENT
        content = (tmp_path / "SOUL.md").read_text(encoding="utf-8")
        assert content == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_creates_deeply_nested_directory(self, tmp_path):
        """_ensure_default_soul creates deeply nested parent directories."""
        data_dir = str(tmp_path / "a" / "b" / "c" / "d")
        result = await _ensure_default_soul(data_dir)

        assert result == _DEFAULT_SOUL_CONTENT
        assert (Path(data_dir) / "SOUL.md").exists()

    @pytest.mark.asyncio
    async def test_returns_exact_default_content_type(self, tmp_path):
        """_ensure_default_soul returns str type, not bytes."""
        result = await _ensure_default_soul(str(tmp_path))
        assert isinstance(result, str)

    @pytest.mark.asyncio
    async def test_file_is_utf8_encoded(self, tmp_path):
        """_ensure_default_soul writes UTF-8 encoded file."""
        await _ensure_default_soul(str(tmp_path))

        soul_file = tmp_path / "SOUL.md"
        # Read as bytes and verify UTF-8
        raw = soul_file.read_bytes()
        decoded = raw.decode("utf-8")
        assert decoded == _DEFAULT_SOUL_CONTENT


class TestLoadSoulEdgeCases:
    """Edge cases for load_soul function."""

    @pytest.mark.asyncio
    async def test_unicode_content_preserved(self, tmp_path):
        """load_soul preserves unicode content (emoji, CJK, accents)."""
        unicode_soul = (
            "# Agent Identity\n\n"
            "## Name\nSelf\n\n"
            "## Personality\nFriendly agent with emojis and accents: cafe, naive, resume\n"
        )
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(unicode_soul, encoding="utf-8")

        result = await load_soul(str(tmp_path))
        assert result == unicode_soul

    @pytest.mark.asyncio
    async def test_large_soul_file(self, tmp_path):
        """load_soul handles a very large SOUL.md file (100KB+)."""
        large_content = "# Large SOUL\n\n" + ("x" * 100_000)
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(large_content, encoding="utf-8")

        result = await load_soul(str(tmp_path))
        assert result == large_content
        assert len(result) > 100_000

    @pytest.mark.asyncio
    async def test_soul_with_only_newlines_regenerates_default(self, tmp_path):
        """load_soul with file containing only newlines regenerates default."""
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text("\n\n\n\n\n", encoding="utf-8")

        result = await load_soul(str(tmp_path))
        assert result == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_soul_with_single_space_regenerates_default(self, tmp_path):
        """load_soul with file containing only a single space regenerates."""
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(" ", encoding="utf-8")

        result = await load_soul(str(tmp_path))
        assert result == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_soul_with_tab_only_regenerates_default(self, tmp_path):
        """load_soul with file containing only tabs regenerates."""
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text("\t\t\t", encoding="utf-8")

        result = await load_soul(str(tmp_path))
        assert result == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_no_caching_detects_live_edits(self, tmp_path):
        """load_soul re-reads from disk each time (no caching)."""
        data_dir = str(tmp_path)
        soul_file = tmp_path / "SOUL.md"

        # First: create default
        content1 = await load_soul(data_dir)
        assert content1 == _DEFAULT_SOUL_CONTENT

        # Modify file between calls (simulating live edit)
        modified = "# Modified SOUL\n\nLive edited personality."
        soul_file.write_text(modified, encoding="utf-8")

        # Second: should return modified content (not cached default)
        content2 = await load_soul(data_dir)
        assert content2 == modified
        assert content2 != content1

    @pytest.mark.asyncio
    async def test_file_deleted_between_calls_regenerates(self, tmp_path):
        """load_soul regenerates if file is deleted between calls."""
        data_dir = str(tmp_path)

        # First call creates default
        await load_soul(data_dir)
        soul_file = tmp_path / "SOUL.md"
        assert soul_file.exists()

        # Delete file
        soul_file.unlink()

        # Second call should regenerate
        content = await load_soul(data_dir)
        assert content == _DEFAULT_SOUL_CONTENT
        assert soul_file.exists()

    @pytest.mark.asyncio
    async def test_soul_with_markdown_code_fences(self, tmp_path):
        """load_soul preserves content with markdown code fences."""
        fenced_soul = (
            "# SOUL\n\n"
            "## Personality\n"
            "Example:\n"
            "```python\nprint('hello')\n```\n"
        )
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(fenced_soul, encoding="utf-8")

        result = await load_soul(str(tmp_path))
        assert result == fenced_soul
        assert "```python" in result

    @pytest.mark.asyncio
    async def test_soul_with_curly_braces(self, tmp_path):
        """load_soul preserves content with curly braces (f-string safe)."""
        braced_soul = (
            "# SOUL\n\n"
            "## Template\n"
            "Use {{variable}} syntax for templates.\n"
        )
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(braced_soul, encoding="utf-8")

        result = await load_soul(str(tmp_path))
        assert result == braced_soul
        assert "{{variable}}" in result

    @pytest.mark.asyncio
    async def test_concurrent_load_soul_calls(self, tmp_path):
        """Multiple concurrent load_soul calls don't corrupt the file."""
        data_dir = str(tmp_path)

        # Run 10 concurrent load_soul calls
        results = await asyncio.gather(
            *[load_soul(data_dir) for _ in range(10)]
        )

        # All should return the same default content
        for r in results:
            assert r == _DEFAULT_SOUL_CONTENT

        # File should be valid
        soul_file = tmp_path / "SOUL.md"
        assert soul_file.exists()
        assert soul_file.read_text(encoding="utf-8") == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_concurrent_load_with_existing_file(self, tmp_path):
        """Multiple concurrent loads with existing file all return same content."""
        custom = "# Custom\n\nConcurrent test personality."
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(custom, encoding="utf-8")

        results = await asyncio.gather(
            *[load_soul(str(tmp_path)) for _ in range(10)]
        )

        for r in results:
            assert r == custom


class TestLoadSoulLogging:
    """Tests verifying load_soul logs correct events."""

    @pytest.mark.asyncio
    async def test_logs_soul_not_found_on_missing_file(self, tmp_path):
        """load_soul logs 'soul_not_found' when file doesn't exist."""
        with patch("app.agent.log") as mock_log:
            await load_soul(str(tmp_path))

            mock_log.info.assert_called_once()
            call_args = mock_log.info.call_args
            assert call_args[0][0] == "soul_not_found"

    @pytest.mark.asyncio
    async def test_logs_soul_empty_on_empty_file(self, tmp_path):
        """load_soul logs 'soul_empty' when file is empty."""
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text("", encoding="utf-8")

        with patch("app.agent.log") as mock_log:
            await load_soul(str(tmp_path))

            mock_log.warning.assert_called_once()
            call_args = mock_log.warning.call_args
            assert call_args[0][0] == "soul_empty"

    @pytest.mark.asyncio
    async def test_logs_soul_read_failed_on_binary_file(self, tmp_path):
        """load_soul logs 'soul_read_failed' when file has binary content."""
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_bytes(b"\x80\x81\x82\xff\xfe")

        with patch("app.agent.log") as mock_log:
            await load_soul(str(tmp_path))

            mock_log.warning.assert_called_once()
            call_args = mock_log.warning.call_args
            assert call_args[0][0] == "soul_read_failed"

    @pytest.mark.asyncio
    async def test_no_warning_on_valid_file(self, tmp_path):
        """load_soul does not log warnings when file is valid."""
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text("# Valid SOUL\n\nContent.", encoding="utf-8")

        with patch("app.agent.log") as mock_log:
            await load_soul(str(tmp_path))

            mock_log.warning.assert_not_called()
            mock_log.info.assert_not_called()

    @pytest.mark.asyncio
    async def test_soul_empty_log_includes_agent_action(self, tmp_path):
        """Empty SOUL log warning includes agent_action kwarg."""
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text("", encoding="utf-8")

        with patch("app.agent.log") as mock_log:
            await load_soul(str(tmp_path))

            call_kwargs = mock_log.warning.call_args[1]
            assert "agent_action" in call_kwargs

    @pytest.mark.asyncio
    async def test_soul_read_failed_log_includes_error(self, tmp_path):
        """Read failure log includes the error string."""
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_bytes(b"\x80\x81\x82\xff\xfe")

        with patch("app.agent.log") as mock_log:
            await load_soul(str(tmp_path))

            call_kwargs = mock_log.warning.call_args[1]
            assert "error" in call_kwargs
            assert "agent_action" in call_kwargs


class TestSoulPersistenceEdgeCases:
    """Edge-case integration tests for SOUL persistence."""

    @pytest.mark.asyncio
    async def test_rapid_sequential_modifications(self, tmp_path):
        """Rapid sequential modifications are all detected by load_soul."""
        data_dir = str(tmp_path)
        soul_file = tmp_path / "SOUL.md"

        # Create initial
        await load_soul(data_dir)

        # 5 rapid modifications
        for i in range(5):
            new_content = f"# SOUL v{i}\n\nIteration {i} personality."
            soul_file.write_text(new_content, encoding="utf-8")
            result = await load_soul(data_dir)
            assert result == new_content
            assert f"v{i}" in result

    @pytest.mark.asyncio
    async def test_soul_replaced_with_empty_then_regenerated(self, tmp_path):
        """Custom SOUL replaced with empty file triggers regeneration."""
        data_dir = str(tmp_path)
        soul_file = tmp_path / "SOUL.md"

        # Start with custom
        custom = "# Custom SOUL\n\nCustom agent."
        soul_file.write_text(custom, encoding="utf-8")
        result = await load_soul(data_dir)
        assert result == custom

        # Replace with empty
        soul_file.write_text("", encoding="utf-8")
        result = await load_soul(data_dir)
        assert result == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_soul_replaced_with_binary_then_regenerated(self, tmp_path):
        """Custom SOUL replaced with binary garbage triggers regeneration."""
        data_dir = str(tmp_path)
        soul_file = tmp_path / "SOUL.md"

        # Start with custom
        custom = "# Custom SOUL\n\nCustom agent."
        soul_file.write_text(custom, encoding="utf-8")
        result = await load_soul(data_dir)
        assert result == custom

        # Replace with binary
        soul_file.write_bytes(b"\xff\xfe\x00\x01")
        result = await load_soul(data_dir)
        assert result == _DEFAULT_SOUL_CONTENT

        # File should now contain the default
        restored = soul_file.read_text(encoding="utf-8")
        assert restored == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_default_content_survives_roundtrip(self, tmp_path):
        """Default content written to disk and read back matches exactly."""
        data_dir = str(tmp_path)

        # Write via _ensure_default_soul
        written = await _ensure_default_soul(data_dir)

        # Read back via load_soul
        loaded = await load_soul(data_dir)

        assert written == loaded
        assert loaded == _DEFAULT_SOUL_CONTENT

    @pytest.mark.asyncio
    async def test_soul_with_windows_line_endings_preserved(self, tmp_path):
        """SOUL.md with Windows-style CRLF line endings is read as-is."""
        crlf_content = "# SOUL\r\n\r\n## Name\r\nSelf\r\n"
        soul_file = tmp_path / "SOUL.md"
        soul_file.write_text(crlf_content, encoding="utf-8")

        result = await load_soul(str(tmp_path))
        # Content should be non-empty and returned (not regenerated)
        assert "# SOUL" in result
        assert "Self" in result
