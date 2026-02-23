"""Additional edge-case tests for the structured logging module.

Covers level fallback behavior, reconfiguration, ISO timestamp format,
and multiple log level filtering scenarios not covered by test_logging.py.
"""

import json

import structlog

from app.logging import _LOG_LEVEL_MAP, setup_logging


class TestSetupLoggingLevelFallback:
    """Test that unknown log levels fall back to INFO."""

    def test_unknown_level_defaults_to_info(self, capsys):
        setup_logging("nonexistent_level")
        log = structlog.get_logger()
        log.info("info_event")
        captured = capsys.readouterr()
        parsed = json.loads(captured.out.strip())
        assert parsed["event"] == "info_event"

    def test_unknown_level_filters_debug(self, capsys):
        """With unknown level (fallback to INFO), debug should be filtered."""
        setup_logging("banana")
        log = structlog.get_logger()
        log.debug("should_not_appear")
        captured = capsys.readouterr()
        assert captured.out.strip() == ""

    def test_case_insensitive_level(self, capsys):
        """Log level should be case-insensitive."""
        setup_logging("DEBUG")
        log = structlog.get_logger()
        log.debug("debug_event")
        captured = capsys.readouterr()
        assert "debug_event" in captured.out

    def test_mixed_case_level(self, capsys):
        setup_logging("Info")
        log = structlog.get_logger()
        log.info("mixed_case_test")
        captured = capsys.readouterr()
        assert "mixed_case_test" in captured.out


class TestLogLevelMap:
    """Test the _LOG_LEVEL_MAP contains expected entries."""

    def test_all_standard_levels_present(self):
        assert "debug" in _LOG_LEVEL_MAP
        assert "info" in _LOG_LEVEL_MAP
        assert "warning" in _LOG_LEVEL_MAP
        assert "error" in _LOG_LEVEL_MAP
        assert "critical" in _LOG_LEVEL_MAP

    def test_map_has_exactly_five_entries(self):
        assert len(_LOG_LEVEL_MAP) == 5


class TestLogLevelFiltering:
    """Test filtering at various log levels."""

    def test_warning_level_filters_info(self, capsys):
        setup_logging("warning")
        log = structlog.get_logger()
        log.info("should_not_appear")
        captured = capsys.readouterr()
        assert captured.out.strip() == ""

    def test_warning_level_passes_warning(self, capsys):
        setup_logging("warning")
        log = structlog.get_logger()
        log.warning("should_appear")
        captured = capsys.readouterr()
        assert "should_appear" in captured.out

    def test_error_level_filters_warning(self, capsys):
        setup_logging("error")
        log = structlog.get_logger()
        log.warning("should_not_appear")
        captured = capsys.readouterr()
        assert captured.out.strip() == ""

    def test_error_level_passes_error(self, capsys):
        setup_logging("error")
        log = structlog.get_logger()
        log.error("should_appear")
        captured = capsys.readouterr()
        assert "should_appear" in captured.out

    def test_critical_level_filters_error(self, capsys):
        setup_logging("critical")
        log = structlog.get_logger()
        log.error("should_not_appear")
        captured = capsys.readouterr()
        assert captured.out.strip() == ""

    def test_critical_level_passes_critical(self, capsys):
        setup_logging("critical")
        log = structlog.get_logger()
        log.critical("should_appear")
        captured = capsys.readouterr()
        assert "should_appear" in captured.out

    def test_debug_level_passes_all(self, capsys):
        setup_logging("debug")
        log = structlog.get_logger()
        log.debug("d")
        log.info("i")
        log.warning("w")
        log.error("e")
        captured = capsys.readouterr()
        lines = [line for line in captured.out.strip().split("\n") if line.strip()]
        assert len(lines) == 4


class TestLogOutputFormat:
    """Test detailed aspects of log output format."""

    def test_timestamp_is_iso_format(self, capsys):
        setup_logging("info")
        log = structlog.get_logger()
        log.info("ts_test")
        captured = capsys.readouterr()
        parsed = json.loads(captured.out.strip())
        ts = parsed["timestamp"]
        # ISO format should contain T or have typical ISO patterns
        # structlog ISO timestamps look like: 2024-01-15T10:30:00Z or similar
        assert "T" in ts or "-" in ts

    def test_multiple_custom_fields(self, capsys):
        setup_logging("info")
        log = structlog.get_logger()
        log.info("multi_field", field_a="a", field_b=42, field_c=True)
        captured = capsys.readouterr()
        parsed = json.loads(captured.out.strip())
        assert parsed["field_a"] == "a"
        assert parsed["field_b"] == 42
        assert parsed["field_c"] is True

    def test_warning_level_string_in_output(self, capsys):
        setup_logging("warning")
        log = structlog.get_logger()
        log.warning("warn_event")
        captured = capsys.readouterr()
        parsed = json.loads(captured.out.strip())
        assert parsed["level"] == "warning"

    def test_error_level_string_in_output(self, capsys):
        setup_logging("info")
        log = structlog.get_logger()
        log.error("err_event")
        captured = capsys.readouterr()
        parsed = json.loads(captured.out.strip())
        assert parsed["level"] == "error"


class TestLoggingReconfiguration:
    """Test that calling setup_logging multiple times reconfigures properly."""

    def test_reconfigure_from_info_to_debug(self, capsys):
        setup_logging("info")
        log1 = structlog.get_logger()
        log1.debug("hidden")
        captured1 = capsys.readouterr()
        assert captured1.out.strip() == ""

        setup_logging("debug")
        log2 = structlog.get_logger()
        log2.debug("visible")
        captured2 = capsys.readouterr()
        assert "visible" in captured2.out

    def test_reconfigure_from_debug_to_error(self, capsys):
        setup_logging("debug")
        log1 = structlog.get_logger()
        log1.info("visible")
        captured1 = capsys.readouterr()
        assert "visible" in captured1.out

        setup_logging("error")
        log2 = structlog.get_logger()
        log2.info("hidden_now")
        captured2 = capsys.readouterr()
        assert captured2.out.strip() == ""
