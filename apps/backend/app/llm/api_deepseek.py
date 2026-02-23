"""DeepSeek API provider — uses OpenAI-compatible SDK (AsyncOpenAI).

Executes LLM calls via the DeepSeek chat completions API with retry on transient errors.
"""

import asyncio
import time

import openai

from app.llm.base import LLMResult
from app.logging import log

# Default model — can be overridden via constructor
DEFAULT_MODEL = "deepseek-chat"

# Transient error types that trigger retry
_TRANSIENT_ERRORS = (
    openai.RateLimitError,
    openai.InternalServerError,
    openai.APIConnectionError,
    openai.APITimeoutError,
)


class DeepSeekAPI:
    """DeepSeek API provider using OpenAI-compatible AsyncOpenAI client."""

    name = "deepseek-api"

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL):
        self._client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com",
        )
        self._model = model

    async def execute(self, prompt: str, tools: list | None = None) -> LLMResult:
        """Execute an LLM call via the DeepSeek API with retry."""
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
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
        )
        latency_ms = int((time.monotonic() - start) * 1000)
        choice = response.choices[0]
        return LLMResult(
            content=choice.message.content or "",
            provider=self.name,
            model=response.model,
            tokens_in=response.usage.prompt_tokens if response.usage else None,
            tokens_out=response.usage.completion_tokens if response.usage else None,
            latency_ms=latency_ms,
            cost_estimate=None,
        )

    async def health_check(self) -> bool:
        """Verify API key is set and non-empty."""
        return bool(self._client.api_key)
