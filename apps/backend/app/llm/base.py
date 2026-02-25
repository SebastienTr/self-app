"""LLM provider abstraction layer: Protocol, base classes, and shared types.

Defines LLMProvider Protocol, LLMResult dataclass, CLIProvider abstract base class,
and CircuitBreaker for failure management.
"""

import abc
import asyncio
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from app.logging import log


@dataclass
class LLMStreamChunk:
    """A single chunk from a streaming LLM response."""

    delta: str
    accumulated: str
    done: bool
    tokens_in: int | None = field(default=None)
    tokens_out: int | None = field(default=None)
    model: str | None = field(default=None)
    provider: str | None = field(default=None)
    latency_ms: int | None = field(default=None)


@dataclass
class LLMResult:
    """Result of an LLM call — carries content, metadata, and cost info."""

    content: str
    provider: str
    model: str
    tokens_in: int | None
    tokens_out: int | None
    latency_ms: int
    cost_estimate: float | None


class CircuitBreakerOpenError(Exception):
    """Raised when the circuit breaker is open and rejecting requests."""

    pass


class CircuitBreaker:
    """Circuit breaker: CLOSED -> 3 failures in window -> OPEN -> cooldown -> HALF_OPEN.

    HALF_OPEN -> success -> CLOSED
    HALF_OPEN -> failure -> OPEN (restart cooldown)
    """

    def __init__(
        self,
        failure_threshold: int = 3,
        window_seconds: float = 300,
        cooldown_seconds: float = 60,
    ):
        self._failure_threshold = failure_threshold
        self._window_seconds = window_seconds
        self._cooldown_seconds = cooldown_seconds
        self._failures: list[float] = []
        self._state = "closed"
        self._opened_at: float | None = None

    @property
    def state(self) -> str:
        """Return current circuit breaker state, checking for cooldown expiry."""
        if self._state == "open" and self._opened_at is not None:
            if time.monotonic() - self._opened_at >= self._cooldown_seconds:
                return "half_open"
        return self._state

    def check(self) -> None:
        """Check if a request is allowed. Raises CircuitBreakerOpenError if circuit is open."""
        current = self.state
        if current == "open":
            raise CircuitBreakerOpenError(
                f"Circuit breaker is open. Cooldown remaining: "
                f"{self._cooldown_seconds - (time.monotonic() - (self._opened_at or 0)):.0f}s"
            )
        # half_open or closed — allow the request

    def record_failure(self) -> None:
        """Record a failure. Opens circuit after threshold failures within window."""
        now = time.monotonic()

        if self.state == "half_open":
            # Half-open failure => reopen
            self._state = "open"
            self._opened_at = now
            log.warning(
                "circuit_breaker_state_change",
                transition="reopened",
                new_state="open",
                agent_action="Circuit breaker reopened after half-open failure",
            )
            return

        # In closed state — track failures within window
        self._failures.append(now)
        # Remove failures outside the window
        cutoff = now - self._window_seconds
        self._failures = [f for f in self._failures if f > cutoff]

        if len(self._failures) >= self._failure_threshold:
            self._state = "open"
            self._opened_at = now
            log.warning(
                "circuit_breaker_state_change",
                transition="opened",
                new_state="open",
                failure_count=len(self._failures),
                agent_action="Provider is unhealthy. Check logs or change SELF_LLM_PROVIDER",
            )

    def record_success(self) -> None:
        """Record a success. Closes circuit if in half-open state."""
        if self.state == "half_open":
            self._state = "closed"
            self._failures = []
            self._opened_at = None
            log.info(
                "circuit_breaker_state_change",
                transition="closed",
                new_state="closed",
                agent_action="Provider recovered - circuit breaker closed",
            )


@runtime_checkable
class LLMProvider(Protocol):
    """Protocol that all LLM providers must satisfy."""

    name: str

    async def execute(self, prompt: str, tools: list | None = None) -> LLMResult: ...

    def stream(self, prompt: str) -> AsyncIterator[LLMStreamChunk]: ...

    async def health_check(self) -> bool: ...


def _is_transient_cli_error(returncode: int, stderr: str) -> bool:
    """Check if a CLI error is transient and retryable."""
    # Exit code 1 with rate limit or temporary failure indication
    transient_keywords = ["rate limit", "too many requests", "temporary", "503", "502", "504"]
    stderr_lower = stderr.lower()
    return any(kw in stderr_lower for kw in transient_keywords)


class CLIProvider(abc.ABC):
    """Abstract base class for CLI-based LLM providers.

    Handles asyncio subprocess execution, timeout, stdout parsing, and retry.
    Subclasses override _build_command() and _parse_output() only.
    """

    name: str
    _cli_binary: str
    _timeout: int = 60

    @abc.abstractmethod
    def _build_command(self, prompt: str) -> list[str]:
        """Build the CLI command to execute."""
        ...

    @abc.abstractmethod
    def _parse_output(self, stdout: str) -> LLMResult:
        """Parse CLI stdout into an LLMResult."""
        ...

    async def execute(self, prompt: str, tools: list | None = None) -> LLMResult:
        """Execute an LLM call via CLI subprocess with retry on transient errors."""
        last_error: Exception | None = None

        for attempt in range(1, 3):  # max 2 attempts (1 original + 1 retry)
            try:
                result = await self._execute_once(prompt)
                return result
            except TimeoutError as e:
                last_error = e
                if attempt == 1:
                    log.warning(
                        "llm_retry",
                        provider=self.name,
                        attempt=2,
                        error=str(e),
                        agent_action="Retrying after transient error",
                    )
                    await asyncio.sleep(2)
                    continue
                raise
            except RuntimeError as e:
                # Check if this is a transient CLI error
                error_msg = str(e)
                if attempt == 1 and _is_transient_cli_error(0, error_msg):
                    log.warning(
                        "llm_retry",
                        provider=self.name,
                        attempt=2,
                        error=error_msg,
                        agent_action="Retrying after transient error",
                    )
                    await asyncio.sleep(2)
                    last_error = e
                    continue
                raise

        # Should not reach here, but just in case
        raise last_error  # type: ignore[misc]

    async def _execute_once(self, prompt: str) -> LLMResult:
        """Execute a single CLI subprocess call."""
        cmd = self._build_command(prompt)
        start = time.monotonic()
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=self._timeout
            )
        except TimeoutError:
            proc.kill()
            raise
        if proc.returncode != 0:
            error_msg = stderr_bytes.decode()
            log.error(
                "llm_cli_execution_failed",
                provider=self.name,
                exit_code=proc.returncode,
                error=error_msg,
                agent_action=(
                    f"Check LLM provider health. "
                    f"Run 'which {self._cli_binary}' or verify CLI installation"
                ),
            )
            raise RuntimeError(
                f"CLI exited with code {proc.returncode}: {error_msg}"
            )
        result = self._parse_output(stdout_bytes.decode())
        result.latency_ms = int((time.monotonic() - start) * 1000)
        return result

    async def stream(self, prompt: str) -> AsyncIterator[LLMStreamChunk]:
        """Default stream() for CLI providers — yields single chunk from execute().

        CLI providers cannot truly stream (subprocess blocks until completion).
        This fallback calls execute() and yields the full response as one chunk.
        """
        result = await self.execute(prompt=prompt)
        yield LLMStreamChunk(
            delta=result.content,
            accumulated=result.content,
            done=True,
            tokens_in=result.tokens_in,
            tokens_out=result.tokens_out,
            model=result.model,
            provider=result.provider,
            latency_ms=result.latency_ms,
        )

    async def health_check(self) -> bool:
        """Check if the CLI binary is available on the system."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "which",
                self._cli_binary,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()
            return proc.returncode == 0
        except Exception:
            return False
