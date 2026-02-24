"""Comprehensive tests for the LLM provider abstraction layer (Story 1.3).

Tests cover: LLMResult, LLMProvider Protocol, CLIProvider base, all CLI providers,
API providers, provider registry, circuit breaker, retry logic, rate limiter,
and /health endpoint integration.

All external calls (subprocess, API clients) are mocked — no real CLI or API calls.
"""

import asyncio
import importlib
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.llm import (
    PROVIDER_REGISTRY,
    get_available_providers,
    get_provider,
)
from app.llm.api_anthropic import AnthropicAPI
from app.llm.api_deepseek import DeepSeekAPI
from app.llm.base import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    CLIProvider,
    LLMResult,
)
from app.llm.cli_claude import ClaudeCodeCLI
from app.llm.cli_codex import CodexCLI
from app.llm.cli_kimi import KimiCLI
from app.llm.rate_limiter import RateLimiter, RateLimitExceededError

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_subprocess_success():
    """Mock asyncio.create_subprocess_exec returning success."""

    async def _factory(stdout=b'{"result": "ok"}', returncode=0):
        proc = AsyncMock()
        proc.communicate = AsyncMock(return_value=(stdout, b""))
        proc.returncode = returncode
        proc.kill = MagicMock()
        return proc

    return _factory


@pytest.fixture
def claude_cli():
    return ClaudeCodeCLI()


@pytest.fixture
def codex_cli():
    return CodexCLI()


@pytest.fixture
def kimi_cli():
    return KimiCLI()


@pytest.fixture
def anthropic_api():
    return AnthropicAPI(api_key="test-key-123")


@pytest.fixture
def deepseek_api():
    return DeepSeekAPI(api_key="test-key-456")


@pytest.fixture
def circuit_breaker():
    return CircuitBreaker(failure_threshold=3, window_seconds=300, cooldown_seconds=60)


@pytest.fixture
def rate_limiter():
    return RateLimiter(max_calls_per_minute=3)


# ---------------------------------------------------------------------------
# Task 1: LLMResult dataclass tests
# ---------------------------------------------------------------------------


class TestLLMResult:
    """Test LLMResult dataclass."""

    def test_create_llm_result(self):
        result = LLMResult(
            content="Hello",
            provider="test",
            model="test-model",
            tokens_in=10,
            tokens_out=20,
            latency_ms=100,
            cost_estimate=0.01,
        )
        assert result.content == "Hello"
        assert result.provider == "test"
        assert result.model == "test-model"
        assert result.tokens_in == 10
        assert result.tokens_out == 20
        assert result.latency_ms == 100
        assert result.cost_estimate == 0.01

    def test_llm_result_with_none_tokens(self):
        result = LLMResult(
            content="Test",
            provider="p",
            model="m",
            tokens_in=None,
            tokens_out=None,
            latency_ms=50,
            cost_estimate=None,
        )
        assert result.tokens_in is None
        assert result.tokens_out is None
        assert result.cost_estimate is None


# ---------------------------------------------------------------------------
# Task 1: LLMProvider Protocol tests
# ---------------------------------------------------------------------------


class TestLLMProviderProtocol:
    """Test LLMProvider Protocol compliance for all providers."""

    def test_claude_cli_has_name(self, claude_cli):
        assert hasattr(claude_cli, "name")
        assert claude_cli.name == "claude-cli"

    def test_codex_cli_has_name(self, codex_cli):
        assert hasattr(codex_cli, "name")
        assert codex_cli.name == "codex-cli"

    def test_kimi_cli_has_name(self, kimi_cli):
        assert hasattr(kimi_cli, "name")
        assert kimi_cli.name == "kimi-cli"

    def test_anthropic_api_has_name(self, anthropic_api):
        assert hasattr(anthropic_api, "name")
        assert anthropic_api.name == "anthropic-api"

    def test_deepseek_api_has_name(self, deepseek_api):
        assert hasattr(deepseek_api, "name")
        assert deepseek_api.name == "deepseek-api"

    def test_all_providers_have_execute(self):
        for cls in [ClaudeCodeCLI, CodexCLI, KimiCLI, AnthropicAPI, DeepSeekAPI]:
            assert hasattr(cls, "execute")

    def test_all_providers_have_health_check(self):
        for cls in [ClaudeCodeCLI, CodexCLI, KimiCLI, AnthropicAPI, DeepSeekAPI]:
            assert hasattr(cls, "health_check")


# ---------------------------------------------------------------------------
# Task 1: CLIProvider base class tests
# ---------------------------------------------------------------------------


class TestCLIProviderBase:
    """Test CLIProvider abstract base class functionality."""

    def test_cli_provider_is_abstract(self):
        with pytest.raises(TypeError):
            CLIProvider()  # type: ignore[abstract]

    async def test_cli_health_check_found(self, claude_cli):
        """Test health_check returns True when CLI binary is found."""
        proc = AsyncMock()
        proc.communicate = AsyncMock(return_value=(b"/usr/bin/claude", b""))
        proc.returncode = 0

        with patch("app.llm.base.asyncio.create_subprocess_exec", return_value=proc):
            result = await claude_cli.health_check()
        assert result is True

    async def test_cli_health_check_not_found(self, claude_cli):
        """Test health_check returns False when CLI binary is not found."""
        proc = AsyncMock()
        proc.communicate = AsyncMock(return_value=(b"", b""))
        proc.returncode = 1

        with patch("app.llm.base.asyncio.create_subprocess_exec", return_value=proc):
            result = await claude_cli.health_check()
        assert result is False

    async def test_cli_health_check_exception(self, claude_cli):
        """Test health_check returns False on exception."""
        with patch(
            "app.llm.base.asyncio.create_subprocess_exec",
            side_effect=OSError("not found"),
        ):
            result = await claude_cli.health_check()
        assert result is False

    async def test_cli_execute_success(self, claude_cli):
        """Test CLIProvider.execute() wraps subprocess call with timing."""
        stdout = (
            b'{"type":"result","result":"Hello world",'
            b'"model":"claude-sonnet-4-20250514","tokens_in":10,"tokens_out":5}'
        )
        proc = AsyncMock()
        proc.communicate = AsyncMock(return_value=(stdout, b""))
        proc.returncode = 0
        proc.kill = MagicMock()

        with patch("app.llm.base.asyncio.create_subprocess_exec", return_value=proc):
            result = await claude_cli.execute("test prompt")

        assert isinstance(result, LLMResult)
        assert result.provider == "claude-cli"
        assert result.latency_ms >= 0

    async def test_cli_execute_timeout(self, claude_cli):
        """Test CLIProvider.execute() handles timeout (retries once then raises)."""
        proc = AsyncMock()
        proc.communicate = AsyncMock(side_effect=TimeoutError())
        proc.kill = MagicMock()

        with (
            patch("app.llm.base.asyncio.create_subprocess_exec", return_value=proc),
            patch("app.llm.base.asyncio.sleep", new_callable=AsyncMock),
        ):
            with pytest.raises(asyncio.TimeoutError):
                await claude_cli.execute("test prompt")
        # kill called twice (once per attempt)
        assert proc.kill.call_count == 2

    async def test_cli_execute_nonzero_exit(self, claude_cli):
        """Test CLIProvider.execute() raises on non-zero exit code."""
        proc = AsyncMock()
        proc.communicate = AsyncMock(return_value=(b"", b"Error occurred"))
        proc.returncode = 1
        proc.kill = MagicMock()

        with patch("app.llm.base.asyncio.create_subprocess_exec", return_value=proc):
            with pytest.raises(RuntimeError, match="CLI exited with code 1"):
                await claude_cli.execute("test prompt")


# ---------------------------------------------------------------------------
# Task 2: CLI provider implementations — _build_command tests
# ---------------------------------------------------------------------------


class TestClaudeCodeCLI:
    """Test ClaudeCodeCLI provider."""

    def test_build_command(self, claude_cli):
        cmd = claude_cli._build_command("hello world")
        assert cmd == ["claude", "-p", "hello world", "--output-format", "json", "--model", "claude-sonnet-4-6"]

    def test_parse_output(self, claude_cli):
        stdout = (
            '{"type":"result","result":"Hello",'
            '"model":"claude-sonnet-4-20250514","tokens_in":10,"tokens_out":5}'
        )
        result = claude_cli._parse_output(stdout)
        assert result.content == "Hello"
        assert result.provider == "claude-cli"
        assert result.model == "claude-sonnet-4-20250514"
        assert result.tokens_in == 10
        assert result.tokens_out == 5


class TestCodexCLI:
    """Test CodexCLI provider."""

    def test_build_command(self, codex_cli):
        cmd = codex_cli._build_command("hello world")
        assert cmd == ["codex", "exec", "hello world", "--json"]

    def test_parse_output(self, codex_cli):
        stdout = '{"content":"Hello from codex","model":"codex-1"}\n'
        result = codex_cli._parse_output(stdout)
        assert result.content == "Hello from codex"
        assert result.provider == "codex-cli"
        assert result.model == "codex-1"


class TestKimiCLI:
    """Test KimiCLI provider."""

    def test_build_command(self, kimi_cli):
        cmd = kimi_cli._build_command("hello world")
        assert cmd == ["kimi", "--print", "-p", "hello world", "--output-format=stream-json"]

    def test_parse_output(self, kimi_cli):
        stdout = '{"content":"Hello from kimi","model":"kimi-1"}\n'
        result = kimi_cli._parse_output(stdout)
        assert result.content == "Hello from kimi"
        assert result.provider == "kimi-cli"
        assert result.model == "kimi-1"


# ---------------------------------------------------------------------------
# Task 3: API provider implementations
# ---------------------------------------------------------------------------


class TestAnthropicAPI:
    """Test AnthropicAPI provider."""

    def test_init_with_key(self, anthropic_api):
        assert anthropic_api.name == "anthropic-api"

    async def test_health_check_with_key(self, anthropic_api):
        result = await anthropic_api.health_check()
        assert result is True

    async def test_health_check_without_key(self):
        provider = AnthropicAPI(api_key="")
        result = await provider.health_check()
        assert result is False

    async def test_execute(self, anthropic_api):
        """Test AnthropicAPI.execute() calls SDK and returns LLMResult."""
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Hello from Anthropic")]
        mock_response.model = "claude-sonnet-4-20250514"
        mock_response.usage = MagicMock(input_tokens=15, output_tokens=25)

        anthropic_api._client = AsyncMock()
        anthropic_api._client.messages = AsyncMock()
        anthropic_api._client.messages.create = AsyncMock(return_value=mock_response)

        result = await anthropic_api.execute("test prompt")

        assert isinstance(result, LLMResult)
        assert result.content == "Hello from Anthropic"
        assert result.provider == "anthropic-api"
        assert result.model == "claude-sonnet-4-20250514"
        assert result.tokens_in == 15
        assert result.tokens_out == 25
        assert result.latency_ms >= 0


class TestDeepSeekAPI:
    """Test DeepSeekAPI provider."""

    def test_init_with_key(self, deepseek_api):
        assert deepseek_api.name == "deepseek-api"

    async def test_health_check_with_key(self, deepseek_api):
        result = await deepseek_api.health_check()
        assert result is True

    async def test_health_check_without_key(self):
        provider = DeepSeekAPI(api_key="")
        result = await provider.health_check()
        assert result is False

    async def test_execute(self, deepseek_api):
        """Test DeepSeekAPI.execute() calls SDK and returns LLMResult."""
        mock_choice = MagicMock()
        mock_choice.message = MagicMock(content="Hello from DeepSeek")
        mock_usage = MagicMock(prompt_tokens=12, completion_tokens=18)
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.model = "deepseek-chat"
        mock_response.usage = mock_usage

        deepseek_api._client = AsyncMock()
        deepseek_api._client.chat = AsyncMock()
        deepseek_api._client.chat.completions = AsyncMock()
        deepseek_api._client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await deepseek_api.execute("test prompt")

        assert isinstance(result, LLMResult)
        assert result.content == "Hello from DeepSeek"
        assert result.provider == "deepseek-api"
        assert result.model == "deepseek-chat"
        assert result.tokens_in == 12
        assert result.tokens_out == 18
        assert result.latency_ms >= 0


# ---------------------------------------------------------------------------
# Task 4: Provider registry tests
# ---------------------------------------------------------------------------


class TestProviderRegistry:
    """Test provider registry and factory functions."""

    def test_registry_has_5_providers(self):
        assert len(PROVIDER_REGISTRY) == 5

    def test_registry_contains_all_providers(self):
        expected = {"claude-cli", "codex-cli", "kimi-cli", "anthropic-api", "deepseek-api"}
        assert set(PROVIDER_REGISTRY.keys()) == expected

    def test_get_provider_claude_cli(self):
        provider = get_provider("claude-cli")
        assert isinstance(provider, ClaudeCodeCLI)

    def test_get_provider_codex_cli(self):
        provider = get_provider("codex-cli")
        assert isinstance(provider, CodexCLI)

    def test_get_provider_kimi_cli(self):
        provider = get_provider("kimi-cli")
        assert isinstance(provider, KimiCLI)

    def test_get_provider_anthropic_api(self):
        provider = get_provider("anthropic-api", api_key="test-key")
        assert isinstance(provider, AnthropicAPI)

    def test_get_provider_deepseek_api(self):
        provider = get_provider("deepseek-api", api_key="test-key")
        assert isinstance(provider, DeepSeekAPI)

    def test_get_provider_unknown_raises(self):
        with pytest.raises(ValueError, match="Unknown provider"):
            get_provider("unknown-provider")

    async def test_get_available_providers_returns_5(self):
        """Test that get_available_providers returns 5 providers."""
        with patch("app.llm.base.asyncio.create_subprocess_exec") as mock_exec:
            # Mock 'which' to return not found for all CLI providers
            proc = AsyncMock()
            proc.communicate = AsyncMock(return_value=(b"", b""))
            proc.returncode = 1
            mock_exec.return_value = proc

            providers = await get_available_providers()
        assert len(providers) == 5

    async def test_get_available_providers_types(self):
        """Test providers have correct types (cli/api)."""
        with patch("app.llm.base.asyncio.create_subprocess_exec") as mock_exec:
            proc = AsyncMock()
            proc.communicate = AsyncMock(return_value=(b"", b""))
            proc.returncode = 1
            mock_exec.return_value = proc

            providers = await get_available_providers()

        by_name = {p["name"]: p for p in providers}
        assert by_name["claude-cli"]["type"] == "cli"
        assert by_name["codex-cli"]["type"] == "cli"
        assert by_name["kimi-cli"]["type"] == "cli"
        assert by_name["anthropic-api"]["type"] == "api"
        assert by_name["deepseek-api"]["type"] == "api"


# ---------------------------------------------------------------------------
# Task 5: Circuit breaker tests
# ---------------------------------------------------------------------------


class TestCircuitBreaker:
    """Test circuit breaker pattern."""

    def test_initial_state_is_closed(self, circuit_breaker):
        assert circuit_breaker.state == "closed"

    def test_single_failure_stays_closed(self, circuit_breaker):
        circuit_breaker.record_failure()
        assert circuit_breaker.state == "closed"

    def test_two_failures_stays_closed(self, circuit_breaker):
        circuit_breaker.record_failure()
        circuit_breaker.record_failure()
        assert circuit_breaker.state == "closed"

    def test_three_failures_opens_circuit(self, circuit_breaker):
        circuit_breaker.record_failure()
        circuit_breaker.record_failure()
        circuit_breaker.record_failure()
        assert circuit_breaker.state == "open"

    def test_open_circuit_rejects_requests(self, circuit_breaker):
        for _ in range(3):
            circuit_breaker.record_failure()
        with pytest.raises(CircuitBreakerOpenError):
            circuit_breaker.check()

    def test_circuit_resets_after_cooldown(self, circuit_breaker):
        for _ in range(3):
            circuit_breaker.record_failure()
        assert circuit_breaker.state == "open"

        # Simulate cooldown elapsed
        circuit_breaker._opened_at = time.monotonic() - 61
        assert circuit_breaker.state == "half_open"

    def test_half_open_allows_one_request(self, circuit_breaker):
        for _ in range(3):
            circuit_breaker.record_failure()
        circuit_breaker._opened_at = time.monotonic() - 61

        # Should not raise (allows one request in half-open)
        circuit_breaker.check()

    def test_half_open_success_closes_circuit(self, circuit_breaker):
        for _ in range(3):
            circuit_breaker.record_failure()
        circuit_breaker._opened_at = time.monotonic() - 61

        circuit_breaker.record_success()
        assert circuit_breaker.state == "closed"

    def test_half_open_failure_reopens_circuit(self, circuit_breaker):
        for _ in range(3):
            circuit_breaker.record_failure()
        circuit_breaker._opened_at = time.monotonic() - 61

        # Check state is half_open
        assert circuit_breaker.state == "half_open"
        circuit_breaker.record_failure()
        assert circuit_breaker.state == "open"

    def test_failures_outside_window_dont_count(self, circuit_breaker):
        """Failures outside the 5-minute window should not trigger circuit open."""
        # Record 2 failures
        circuit_breaker.record_failure()
        circuit_breaker.record_failure()

        # Simulate time passing beyond window
        circuit_breaker._failures = [
            time.monotonic() - 400
            for _ in circuit_breaker._failures
        ]

        # One more failure should NOT open circuit since old ones are expired
        circuit_breaker.record_failure()
        assert circuit_breaker.state == "closed"


# ---------------------------------------------------------------------------
# Task 6: Retry logic tests
# ---------------------------------------------------------------------------


class TestRetryLogic:
    """Test retry logic for transient errors."""

    async def test_retry_on_timeout_then_success(self, claude_cli):
        """Test that transient timeout errors trigger retry with 2s backoff."""
        # First call times out, second succeeds
        stdout_ok = (
            b'{"type":"result","result":"Success",'
            b'"model":"claude-sonnet-4-20250514","tokens_in":5,"tokens_out":3}'
        )
        proc_fail = AsyncMock()
        proc_fail.communicate = AsyncMock(side_effect=TimeoutError())
        proc_fail.kill = MagicMock()

        proc_ok = AsyncMock()
        proc_ok.communicate = AsyncMock(return_value=(stdout_ok, b""))
        proc_ok.returncode = 0
        proc_ok.kill = MagicMock()

        call_count = 0

        async def mock_exec(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return proc_fail
            return proc_ok

        with (
            patch("app.llm.base.asyncio.create_subprocess_exec", side_effect=mock_exec),
            patch("app.llm.base.asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
        ):
            result = await claude_cli.execute("test")

        assert result.content == "Success"
        mock_sleep.assert_awaited_once_with(2)
        assert call_count == 2

    async def test_no_retry_on_semantic_error(self, claude_cli):
        """Test that non-transient errors are NOT retried."""
        proc = AsyncMock()
        proc.communicate = AsyncMock(return_value=(b"", b"Invalid API key"))
        proc.returncode = 2  # non-transient error code
        proc.kill = MagicMock()

        with patch("app.llm.base.asyncio.create_subprocess_exec", return_value=proc):
            with pytest.raises(RuntimeError, match="CLI exited with code 2"):
                await claude_cli.execute("test")

    async def test_api_retry_on_rate_limit(self, anthropic_api):
        """Test API provider retries on rate limit error."""
        import anthropic

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Success after retry")]
        mock_response.model = "claude-sonnet-4-20250514"
        mock_response.usage = MagicMock(input_tokens=5, output_tokens=3)

        anthropic_api._client = AsyncMock()
        anthropic_api._client.messages = AsyncMock()

        # Create a proper rate limit error
        rate_limit_response = MagicMock()
        rate_limit_response.status_code = 429
        rate_limit_response.headers = {}
        rate_limit_error = anthropic.RateLimitError(
            message="rate limited",
            response=rate_limit_response,
            body=None,
        )

        anthropic_api._client.messages.create = AsyncMock(
            side_effect=[rate_limit_error, mock_response]
        )

        with patch("app.llm.api_anthropic.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            result = await anthropic_api.execute("test")

        assert result.content == "Success after retry"
        mock_sleep.assert_awaited_once_with(2)

    async def test_api_no_retry_on_auth_error(self, anthropic_api):
        """Test API provider does NOT retry on auth error (401)."""
        import anthropic

        auth_response = MagicMock()
        auth_response.status_code = 401
        auth_response.headers = {}
        auth_error = anthropic.AuthenticationError(
            message="invalid api key",
            response=auth_response,
            body=None,
        )

        anthropic_api._client = AsyncMock()
        anthropic_api._client.messages = AsyncMock()
        anthropic_api._client.messages.create = AsyncMock(side_effect=auth_error)

        with pytest.raises(anthropic.AuthenticationError):
            await anthropic_api.execute("test")


# ---------------------------------------------------------------------------
# Task 7: Rate limiter tests
# ---------------------------------------------------------------------------


class TestRateLimiter:
    """Test rate limiter with sliding window."""

    def test_allows_within_limit(self, rate_limiter):
        for _ in range(3):
            rate_limiter.check()  # Should not raise

    def test_rejects_beyond_limit(self, rate_limiter):
        for _ in range(3):
            rate_limiter.check()
        with pytest.raises(RateLimitExceededError, match="LLM_RATE_LIMITED"):
            rate_limiter.check()

    def test_allows_after_window_expires(self, rate_limiter):
        for _ in range(3):
            rate_limiter.check()

        # Simulate time passing: set all timestamps to >60s ago
        rate_limiter._timestamps = [time.monotonic() - 61 for _ in rate_limiter._timestamps]

        # Should now allow
        rate_limiter.check()  # Should not raise

    def test_sliding_window_partial_expiry(self, rate_limiter):
        """Test that only expired timestamps are removed."""
        now = time.monotonic()
        rate_limiter._timestamps = [now - 61, now - 61, now - 1]  # 2 expired, 1 recent

        # Should allow 2 more calls (limit is 3, only 1 recent)
        rate_limiter.check()
        rate_limiter.check()

        # Now at limit
        with pytest.raises(RateLimitExceededError):
            rate_limiter.check()


# ---------------------------------------------------------------------------
# Task 8: Health endpoint integration tests
# ---------------------------------------------------------------------------


class TestHealthEndpointWithProviders:
    """Test /health endpoint includes provider information."""

    @pytest.fixture
    async def client(self, tmp_path, monkeypatch):
        """Create test client with isolated temp database."""
        monkeypatch.setenv("SELF_DATA_DIR", str(tmp_path))
        monkeypatch.setenv("SELF_DB_NAME", "test.db")
        monkeypatch.setenv("SELF_LOG_LEVEL", "warning")
        monkeypatch.setenv("SELF_LLM_PROVIDER", "claude-cli")

        import app.config

        importlib.reload(app.config)
        app.config.settings = app.config.Settings()

        import app.main

        importlib.reload(app.main)

        the_app = app.main.app
        async with the_app.router.lifespan_context(the_app):
            transport = ASGITransport(app=the_app)
            async with AsyncClient(transport=transport, base_url="http://test") as c:
                yield c

    async def test_health_includes_providers_field(self, client):
        with patch("app.main.get_available_providers", new_callable=AsyncMock) as mock:
            mock.return_value = [
                {"name": "claude-cli", "type": "cli", "healthy": False},
            ]
            response = await client.get("/health")
        data = response.json()
        assert "providers" in data

    async def test_health_provider_has_name_and_type(self, client):
        with patch("app.main.get_available_providers", new_callable=AsyncMock) as mock:
            mock.return_value = [
                {"name": "claude-cli", "type": "cli", "healthy": False},
                {"name": "anthropic-api", "type": "api", "healthy": True},
            ]
            response = await client.get("/health")
        data = response.json()
        providers = data["providers"]
        assert len(providers) >= 1
        assert "name" in providers[0]
        assert "type" in providers[0]
        assert "healthy" in providers[0]
