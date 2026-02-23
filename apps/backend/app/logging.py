"""Structured JSON logging configuration using structlog.

All log entries are JSON-formatted. Error logs MUST include an `agent_action`
field with specific debug instructions for the AI agent.
"""

import logging
import sys

import structlog

_LOG_LEVEL_MAP: dict[str, int] = {
    "debug": logging.DEBUG,
    "info": logging.INFO,
    "warning": logging.WARNING,
    "error": logging.ERROR,
    "critical": logging.CRITICAL,
}


def setup_logging(log_level: str = "info") -> None:
    """Configure structlog with JSON rendering and level filtering.

    Args:
        log_level: Minimum log level to emit (debug, info, warning, error, critical).
    """
    level = _LOG_LEVEL_MAP.get(log_level.lower(), logging.INFO)
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=False,
    )


log = structlog.get_logger()
