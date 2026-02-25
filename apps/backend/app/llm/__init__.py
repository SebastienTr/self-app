"""LLM provider abstraction layer — registry, factory, and re-exports.

Provides get_provider() factory and get_available_providers() for discovery.
"""

from app.config import settings
from app.llm.api_anthropic import AnthropicAPI
from app.llm.api_deepseek import DeepSeekAPI
from app.llm.base import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    CLIProvider,
    LLMProvider,
    LLMResult,
    LLMStreamChunk,
)
from app.llm.cli_claude import ClaudeCodeCLI
from app.llm.cli_codex import CodexCLI
from app.llm.cli_kimi import KimiCLI
from app.llm.rate_limiter import RateLimiter, RateLimitExceededError

# Provider registry: maps provider names to their classes
PROVIDER_REGISTRY: dict[str, type] = {
    "claude-cli": ClaudeCodeCLI,
    "codex-cli": CodexCLI,
    "kimi-cli": KimiCLI,
    "anthropic-api": AnthropicAPI,
    "deepseek-api": DeepSeekAPI,
}

# CLI providers (instantiated without api_key)
_CLI_PROVIDERS = {"claude-cli", "codex-cli", "kimi-cli"}

# API providers (require api_key)
_API_PROVIDERS = {"anthropic-api", "deepseek-api"}


def get_provider(
    provider_name: str | None = None, api_key: str | None = None
) -> LLMProvider:
    """Create and return a provider instance by name.

    Reads from settings by default — explicit parameters override for testing.

    Args:
        provider_name: One of the registered provider names.
            Defaults to settings.self_llm_provider.
        api_key: API key for API providers (ignored for CLI providers).
            Defaults to settings.llm_api_key.

    Returns:
        An LLMProvider instance.

    Raises:
        ValueError: If provider_name is not in the registry.
    """
    resolved_name = provider_name if provider_name is not None else settings.self_llm_provider
    resolved_key = api_key if api_key is not None else settings.llm_api_key

    if resolved_name not in PROVIDER_REGISTRY:
        raise ValueError(
            f"Unknown provider: '{resolved_name}'. "
            f"Available: {', '.join(sorted(PROVIDER_REGISTRY.keys()))}"
        )

    cls = PROVIDER_REGISTRY[resolved_name]

    if resolved_name in _API_PROVIDERS:
        return cls(api_key=resolved_key)  # type: ignore[call-arg]
    return cls()  # type: ignore[call-arg]


async def get_available_providers() -> list[dict]:
    """Return all registered providers with their type and health status.

    Uses the configured API key from settings for API provider health checks.

    Returns:
        List of dicts with keys: name, type, healthy.
    """
    configured_key = settings.llm_api_key
    results = []
    for name, cls in PROVIDER_REGISTRY.items():
        provider_type = "cli" if name in _CLI_PROVIDERS else "api"

        # Instantiate provider for health check — use configured key for API providers
        if name in _API_PROVIDERS:
            instance = cls(api_key=configured_key)  # type: ignore[call-arg]
        else:
            instance = cls()  # type: ignore[call-arg]

        try:
            healthy = await instance.health_check()
        except Exception:
            healthy = False

        results.append({
            "name": name,
            "type": provider_type,
            "healthy": healthy,
        })

    return results


__all__ = [
    "CLIProvider",
    "CircuitBreaker",
    "CircuitBreakerOpenError",
    "LLMProvider",
    "LLMResult",
    "LLMStreamChunk",
    "PROVIDER_REGISTRY",
    "RateLimiter",
    "RateLimitExceededError",
    "get_available_providers",
    "get_provider",
]
