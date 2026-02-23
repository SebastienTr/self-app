"""Tests for structured logging module (Task 2)."""

import json

import structlog

from app.logging import setup_logging


class TestSetupLogging:
    """Test logging configuration."""

    def test_setup_logging_configures_structlog(self):
        setup_logging("info")
        log = structlog.get_logger()
        assert log is not None

    def test_setup_logging_with_debug_level(self):
        setup_logging("debug")
        log = structlog.get_logger()
        assert log is not None

    def test_log_output_is_json(self, capsys):
        setup_logging("info")
        log = structlog.get_logger()
        log.info("test_event", key="value")
        captured = capsys.readouterr()
        # structlog JSON output goes to stdout
        parsed = json.loads(captured.out.strip())
        assert parsed["event"] == "test_event"
        assert parsed["key"] == "value"

    def test_log_includes_timestamp(self, capsys):
        setup_logging("info")
        log = structlog.get_logger()
        log.info("timestamp_test")
        captured = capsys.readouterr()
        parsed = json.loads(captured.out.strip())
        assert "timestamp" in parsed

    def test_log_includes_log_level(self, capsys):
        setup_logging("info")
        log = structlog.get_logger()
        log.info("level_test")
        captured = capsys.readouterr()
        parsed = json.loads(captured.out.strip())
        assert parsed["level"] == "info"

    def test_error_log_with_agent_action(self, capsys):
        setup_logging("info")
        log = structlog.get_logger()
        log.error(
            "migration_failed",
            migration="001_init.sql",
            error="syntax error",
            agent_action="Check migration SQL syntax",
        )
        captured = capsys.readouterr()
        parsed = json.loads(captured.out.strip())
        assert parsed["event"] == "migration_failed"
        assert parsed["agent_action"] == "Check migration SQL syntax"
        assert parsed["level"] == "error"

    def test_log_module_exports_logger(self):
        from app.logging import log

        assert log is not None


class TestLogLevelFiltering:
    """Test that log level filtering works."""

    def test_debug_filtered_at_info_level(self, capsys):
        setup_logging("info")
        log = structlog.get_logger()
        log.debug("should_not_appear")
        captured = capsys.readouterr()
        assert captured.out.strip() == ""

    def test_debug_appears_at_debug_level(self, capsys):
        setup_logging("debug")
        log = structlog.get_logger()
        log.debug("should_appear")
        captured = capsys.readouterr()
        assert "should_appear" in captured.out
