"""Sliding-window rate limiter for LLM calls.

Tracks timestamps of recent calls and rejects when limit is exceeded.
"""

import time

from app.logging import log


class RateLimitExceededError(Exception):
    """Raised when the LLM call rate limit is exceeded."""

    def __init__(self, max_calls: int):
        self.code = "LLM_RATE_LIMITED"
        super().__init__(
            f"LLM_RATE_LIMITED: Rate limit exceeded ({max_calls} calls/minute). "
            f"Wait or increase SELF_LLM_RATE_LIMIT"
        )


class RateLimiter:
    """Sliding-window rate limiter: max N calls per 60-second window."""

    def __init__(self, max_calls_per_minute: int = 10):
        self._max_calls = max_calls_per_minute
        self._timestamps: list[float] = []

    def check(self) -> None:
        """Check if a call is allowed. Raises RateLimitExceededError if not."""
        now = time.monotonic()
        cutoff = now - 60.0

        # Remove expired timestamps
        self._timestamps = [ts for ts in self._timestamps if ts > cutoff]

        if len(self._timestamps) >= self._max_calls:
            log.warning(
                "llm_rate_limited",
                max_calls=self._max_calls,
                current_count=len(self._timestamps),
                agent_action="Rate limit exceeded. Wait or increase SELF_LLM_RATE_LIMIT",
            )
            raise RateLimitExceededError(self._max_calls)

        self._timestamps.append(now)
