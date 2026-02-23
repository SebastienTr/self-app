"""Anthropic API provider — uses the anthropic Python SDK (AsyncAnthropic).

Executes LLM calls via the Anthropic Messages API with retry on transient errors.
"""

import asyncio
import time

import anthropic

from app.llm.base import LLMResult
from app.logging import log

# Default model — can be overridden via constructor
DEFAULT_MODEL = "claude-sonnet-4-20250514"
DEFAULT_MAX_TOKENS = 4096

# Transient error types that trigger retry
_TRANSIENT_ERRORS = (
    anthropic.RateLimitError,
    anthropic.InternalServerError,
    anthropic.APIConnectionError,
    anthropic.APITimeoutError,
)


class AnthropicAPI:
    """Anthropic API provider using AsyncAnthropic client."""

    name = "anthropic-api"

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL):
        self._client = anthropic.AsyncAnthropic(api_key=api_key)
        self._model = model

    async def execute(self, prompt: str, tools: list | None = None) -> LLMResult:
        """Execute an LLM call via the Anthropic Messages API with retry."""
        last_error: Exception | None = None

        for attempt in range(1, 3):  # max 2 attempts
            try:
                return await self._execute_once(prompt)
            except _TRANSIENT_ERRORS as e:
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

        raise last_error  # type: ignore[misc]

    async def _execute_once(self, prompt: str) -> LLMResult:
        """Execute a single API call."""
        start = time.monotonic()
        response = await self._client.messages.create(
            model=self._model,
            max_tokens=DEFAULT_MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        latency_ms = int((time.monotonic() - start) * 1000)
        return LLMResult(
            content=response.content[0].text,
            provider=self.name,
            model=response.model,
            tokens_in=response.usage.input_tokens,
            tokens_out=response.usage.output_tokens,
            latency_ms=latency_ms,
            cost_estimate=None,  # Cost calculation deferred
        )

    async def health_check(self) -> bool:
        """Verify API key is set and non-empty."""
        return bool(self._client.api_key)
