"""Edge case, boundary condition, and integration tests for the LLM module (Story 1.3).

Complements the existing 60 tests in test_llm.py with additional coverage for:
- Circuit breaker boundary conditions and state transitions
- Rate limiter edge cases and error attributes
- CLI provider parse_output malformed input handling
- API provider retry/error edge cases for DeepSeek and Anthropic
- Provider registry edge cases and exports
- _is_transient_cli_error utility function
- Health endpoint error handling
- LLMProvider runtime_checkable Protocol verification

All external calls (subprocess, API clients) are mocked -- no real CLI or API calls.
"""

import asyncio
import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.llm import (
    _API_PROVIDERS,
    _CLI_PROVIDERS,
    PROVIDER_REGISTRY,
    get_available_providers,
    get_provider,
)
from app.llm.api_anthropic import DEFAULT_MAX_TOKENS, AnthropicAPI
from app.llm.api_anthropic import DEFAULT_MODEL as ANTHROPIC_DEFAULT_MODEL
from app.llm.api_deepseek import DEFAULT_MODEL as DEEPSEEK_DEFAULT_MODEL
from app.llm.api_deepseek import DeepSeekAPI
from app.llm.base import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    LLMProvider,
    LLMResult,
    _is_transient_cli_error,
)
from app.llm.cli_claude import ClaudeCodeCLI
from app.llm.cli_codex import CodexCLI
from app.llm.cli_kimi import KimiCLI
from app.llm.rate_limiter import RateLimiter, RateLimitExceededError

# ---------------------------------------------------------------------------
# _is_transient_cli_error tests
# ---------------------------------------------------------------------------


class TestIsTransientCLIError:
    """Tests for the _is_transient_cli_error helper function."""

    def test_rate_limit_keyword(self):
        assert _is_transient_cli_error(1, "Error: rate limit exceeded") is True

    def test_too_many_requests_keyword(self):
        assert _is_transient_cli_error(1, "too many requests, please retry") is True

    def test_temporary_keyword(self):
        assert _is_transient_cli_error(1, "temporary failure, try again") is True

    def test_503_keyword(self):
        assert _is_transient_cli_error(1, "HTTP 503 Service Unavailable") is True

    def test_502_keyword(self):
        assert _is_transient_cli_error(1, "502 Bad Gateway") is True

    def test_504_keyword(self):
        assert _is_transient_cli_error(1, "504 Gateway Timeout") is True

    def test_case_insensitive(self):
        assert _is_transient_cli_error(1, "RATE LIMIT exceeded") is True

    def test_empty_stderr_not_transient(self):
        assert _is_transient_cli_error(1, "") is False

    def test_non_transient_error(self):
        assert _is_transient_cli_error(1, "invalid API key") is False

    def test_auth_error_not_transient(self):
        assert _is_transient_cli_error(1, "401 Unauthorized") is False

    def test_permission_denied_not_transient(self):
        assert _is_transient_cli_error(1, "403 Forbidden") is False

    def test_generic_error_not_transient(self):
        assert _is_transient_cli_error(1, "something went wrong") is False

    def test_returncode_is_ignored(self):
        """The returncode parameter is not used in the current implementation."""
        assert _is_transient_cli_error(0, "rate limit") is True
        assert _is_transient_cli_error(255, "rate limit") is True


# ---------------------------------------------------------------------------
# Circuit breaker boundary and edge case tests
# ---------------------------------------------------------------------------


class TestCircuitBreakerEdgeCases:
    """Additional circuit breaker boundary conditions not in test_llm.py."""

    def test_check_in_closed_state_does_not_raise(self):
        cb = CircuitBreaker()
        cb.check()  # Should not raise

    def test_record_success_in_closed_state_is_noop(self):
        """record_success when already closed should not change state."""
        cb = CircuitBreaker()
        cb.record_success()
        assert cb.state == "closed"
        assert cb._failures == []
        assert cb._opened_at is None

    def test_circuit_breaker_open_error_message_content(self):
        cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=60)
        for _ in range(3):
            cb.record_failure()
        with pytest.raises(CircuitBreakerOpenError, match="Circuit breaker is open"):
            cb.check()

    def test_failures_beyond_threshold_stay_open(self):
        """Additional failures beyond threshold don't change the state from open."""
        cb = CircuitBreaker(failure_threshold=3)
        for _ in range(5):
            cb.record_failure()
        assert cb.state == "open"

    def test_exact_cooldown_boundary(self):
        """At exactly the cooldown period, state should transition to half_open."""
        cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=60)
        for _ in range(3):
            cb.record_failure()
        # Set opened_at to exactly 60s ago
        cb._opened_at = time.monotonic() - 60
        assert cb.state == "half_open"

    def test_just_before_cooldown_stays_open(self):
        """Just before cooldown expires, circuit should remain open."""
        cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=60)
        for _ in range(3):
            cb.record_failure()
        cb._opened_at = time.monotonic() - 59.9
        assert cb.state == "open"

    def test_half_open_check_does_not_raise(self):
        """check() in half_open state should allow the request."""
        cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=60)
        for _ in range(3):
            cb.record_failure()
        cb._opened_at = time.monotonic() - 61
        assert cb.state == "half_open"
        cb.check()  # Should not raise

    def test_multiple_open_close_cycles(self):
        """Test circuit can go through multiple open-close cycles."""
        cb = CircuitBreaker(failure_threshold=2, cooldown_seconds=1)

        # Cycle 1: open
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        # Transition to half_open
        cb._opened_at = time.monotonic() - 2
        assert cb.state == "half_open"

        # Close on success
        cb.record_success()
        assert cb.state == "closed"

        # Cycle 2: open again
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        # Transition to half_open
        cb._opened_at = time.monotonic() - 2
        assert cb.state == "half_open"

        # Failure reopens
        cb.record_failure()
        assert cb.state == "open"

    def test_custom_thresholds(self):
        cb = CircuitBreaker(failure_threshold=1, window_seconds=10, cooldown_seconds=5)
        cb.record_failure()
        assert cb.state == "open"

    def test_default_thresholds(self):
        cb = CircuitBreaker()
        assert cb._failure_threshold == 3
        assert cb._window_seconds == 300
        assert cb._cooldown_seconds == 60

    def test_circuit_breaker_open_error_is_exception(self):
        assert issubclass(CircuitBreakerOpenError, Exception)

    def test_failures_cleared_on_success_after_halfopen(self):
        """After transitioning from half_open to closed, failures should be cleared."""
        cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=1)
        for _ in range(3):
            cb.record_failure()
        cb._opened_at = time.monotonic() - 2
        cb.record_success()
        assert cb._failures == []
        assert cb._opened_at is None

    def test_opened_at_is_none_initially(self):
        cb = CircuitBreaker()
        assert cb._opened_at is None

    def test_opened_at_set_when_circuit_opens(self):
        cb = CircuitBreaker(failure_threshold=1)
        cb.record_failure()
        assert cb._opened_at is not None
        assert isinstance(cb._opened_at, float)


# ---------------------------------------------------------------------------
# Rate limiter edge case tests
# ---------------------------------------------------------------------------


class TestRateLimiterEdgeCases:
    """Additional rate limiter boundary conditions."""

    def test_rate_limit_exceeded_error_has_code(self):
        err = RateLimitExceededError(10)
        assert err.code == "LLM_RATE_LIMITED"

    def test_rate_limit_exceeded_error_message_format(self):
        err = RateLimitExceededError(5)
        assert "LLM_RATE_LIMITED" in str(err)
        assert "5 calls/minute" in str(err)

    def test_rate_limit_exceeded_error_is_exception(self):
        assert issubclass(RateLimitExceededError, Exception)

    def test_default_max_calls_is_10(self):
        rl = RateLimiter()
        assert rl._max_calls == 10

    def test_exact_limit_boundary(self):
        """Exactly at the limit should still be allowed (last call at limit)."""
        rl = RateLimiter(max_calls_per_minute=2)
        rl.check()  # 1st
        rl.check()  # 2nd -- at limit
        with pytest.raises(RateLimitExceededError):
            rl.check()  # 3rd -- exceeds limit

    def test_zero_limit_rejects_immediately(self):
        """A rate limiter with max_calls=0 should reject every call."""
        rl = RateLimiter(max_calls_per_minute=0)
        with pytest.raises(RateLimitExceededError):
            rl.check()

    def test_large_limit_allows_many_calls(self):
        rl = RateLimiter(max_calls_per_minute=1000)
        for _ in range(100):
            rl.check()  # Should not raise

    def test_timestamps_cleaned_on_check(self):
        """Expired timestamps should be removed during check."""
        rl = RateLimiter(max_calls_per_minute=2)
        # Simulate two old timestamps
        rl._timestamps = [time.monotonic() - 120, time.monotonic() - 120]
        rl.check()
        # After check, old timestamps should be removed, only the new one remains
        assert len(rl._timestamps) == 1

    def test_timestamps_not_added_when_rejected(self):
        """When rejected, no new timestamp should be added."""
        rl = RateLimiter(max_calls_per_minute=1)
        rl.check()  # 1st -- allowed
        count_before = len(rl._timestamps)
        with pytest.raises(RateLimitExceededError):
            rl.check()
        # No new timestamp should have been added
        assert len(rl._timestamps) == count_before

    def test_concurrent_rapid_calls(self):
        """Rapid sequential calls within a tight window."""
        rl = RateLimiter(max_calls_per_minute=5)
        for i in range(5):
            rl.check()
        with pytest.raises(RateLimitExceededError):
            rl.check()


# ---------------------------------------------------------------------------
# CLI provider parse_output edge cases
# ---------------------------------------------------------------------------


class TestCLIProviderParseOutputEdgeCases:
    """Tests for malformed/edge case CLI output parsing."""

    def test_claude_parse_output_missing_fields_uses_defaults(self):
        """Missing optional fields should use defaults."""
        cli = ClaudeCodeCLI()
        result = cli._parse_output('{"type":"result"}')
        assert result.content == ""
        assert result.model == "unknown"
        assert result.tokens_in is None
        assert result.tokens_out is None

    def test_claude_parse_output_malformed_json_raises(self):
        cli = ClaudeCodeCLI()
        with pytest.raises(json.JSONDecodeError):
            cli._parse_output("not valid json")

    def test_claude_parse_output_empty_string_raises(self):
        cli = ClaudeCodeCLI()
        with pytest.raises(json.JSONDecodeError):
            cli._parse_output("")

    def test_codex_parse_output_multi_line_jsonl(self):
        """Codex takes the last non-empty line from JSONL."""
        cli = CodexCLI()
        stdout = '{"content":"line1","model":"m1"}\n{"content":"line2","model":"m2"}\n'
        result = cli._parse_output(stdout)
        assert result.content == "line2"
        assert result.model == "m2"

    def test_codex_parse_output_empty_lines_ignored(self):
        cli = CodexCLI()
        stdout = '\n\n{"content":"final","model":"m"}\n\n'
        result = cli._parse_output(stdout)
        assert result.content == "final"

    def test_codex_parse_output_empty_string(self):
        """Empty string should result in empty dict defaults."""
        cli = CodexCLI()
        result = cli._parse_output("")
        assert result.content == ""
        assert result.model == "unknown"

    def test_codex_parse_output_single_line(self):
        cli = CodexCLI()
        result = cli._parse_output('{"content":"hello","model":"c1"}')
        assert result.content == "hello"

    def test_kimi_parse_output_multi_line_jsonl(self):
        """Kimi takes the last non-empty line from JSONL stream."""
        cli = KimiCLI()
        stdout = '{"content":"partial1","model":"k1"}\n{"content":"final","model":"k2"}\n'
        result = cli._parse_output(stdout)
        assert result.content == "final"
        assert result.model == "k2"

    def test_kimi_parse_output_empty_string(self):
        cli = KimiCLI()
        result = cli._parse_output("")
        assert result.content == ""
        assert result.model == "unknown"

    def test_kimi_parse_output_malformed_last_line_raises(self):
        cli = KimiCLI()
        with pytest.raises(json.JSONDecodeError):
            cli._parse_output('{"content":"ok","model":"k"}\nnot_json')

    def test_claude_parse_output_unicode_content(self):
        cli = ClaudeCodeCLI()
        result = cli._parse_output(
            json.dumps({"result": "Hello \u4e16\u754c", "model": "claude-test"})
        )
        assert result.content == "Hello \u4e16\u754c"

    def test_codex_parse_output_missing_fields_uses_defaults(self):
        cli = CodexCLI()
        result = cli._parse_output("{}")
        assert result.content == ""
        assert result.model == "unknown"
        assert result.tokens_in is None
        assert result.tokens_out is None

    def test_kimi_parse_output_missing_fields_uses_defaults(self):
        cli = KimiCLI()
        result = cli._parse_output("{}")
        assert result.content == ""
        assert result.model == "unknown"
        assert result.tokens_in is None
        assert result.tokens_out is None


# ---------------------------------------------------------------------------
# CLIProvider base class additional edge cases
# ---------------------------------------------------------------------------


class TestCLIProviderBaseEdgeCases:
    """Additional CLIProvider base class tests."""

    def test_cli_binary_attributes(self):
        assert ClaudeCodeCLI._cli_binary == "claude"
        assert CodexCLI._cli_binary == "codex"
        assert KimiCLI._cli_binary == "kimi"

    def test_cli_timeout_default(self):
        assert ClaudeCodeCLI._timeout == 60
        assert CodexCLI._timeout == 60
        assert KimiCLI._timeout == 60

    async def test_cli_execute_retries_on_transient_stderr(self):
        """Test that CLI execute retries when stderr contains a transient keyword."""
        cli = ClaudeCodeCLI()

        # First call: transient error (rate limit in stderr)
        proc_fail = AsyncMock()
        proc_fail.communicate = AsyncMock(
            return_value=(b"", b"Error: rate limit exceeded")
        )
        proc_fail.returncode = 1
        proc_fail.kill = MagicMock()

        # Second call: success
        stdout_ok = (
            b'{"type":"result","result":"Success",'
            b'"model":"test","tokens_in":1,"tokens_out":1}'
        )
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
            result = await cli.execute("test")

        assert result.content == "Success"
        mock_sleep.assert_awaited_once_with(2)
        assert call_count == 2

    async def test_cli_execute_no_retry_on_non_transient_error(self):
        """Test that non-transient CLI errors are not retried."""
        cli = ClaudeCodeCLI()

        proc = AsyncMock()
        proc.communicate = AsyncMock(
            return_value=(b"", b"Invalid API key")
        )
        proc.returncode = 1
        proc.kill = MagicMock()

        with patch("app.llm.base.asyncio.create_subprocess_exec", return_value=proc):
            with pytest.raises(RuntimeError, match="CLI exited with code 1"):
                await cli.execute("test")

    async def test_cli_execute_sets_latency_ms(self):
        """Test that latency_ms is set by _execute_once."""
        cli = ClaudeCodeCLI()

        stdout = (
            b'{"type":"result","result":"Hello",'
            b'"model":"test","tokens_in":1,"tokens_out":1}'
        )
        proc = AsyncMock()
        proc.communicate = AsyncMock(return_value=(stdout, b""))
        proc.returncode = 0
        proc.kill = MagicMock()

        with patch("app.llm.base.asyncio.create_subprocess_exec", return_value=proc):
            result = await cli.execute("test")

        assert result.latency_ms >= 0
        assert isinstance(result.latency_ms, int)

    async def test_cli_health_check_uses_which(self):
        """Verify health_check calls 'which' with the correct binary name."""
        cli = CodexCLI()
        proc = AsyncMock()
        proc.communicate = AsyncMock(return_value=(b"/usr/bin/codex", b""))
        proc.returncode = 0

        with patch("app.llm.base.asyncio.create_subprocess_exec", return_value=proc) as mock_exec:
            result = await cli.health_check()

        assert result is True
        mock_exec.assert_called_once_with(
            "which", "codex",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

    async def test_kimi_health_check_uses_which(self):
        """Verify Kimi health_check calls 'which kimi'."""
        cli = KimiCLI()
        proc = AsyncMock()
        proc.communicate = AsyncMock(return_value=(b"", b""))
        proc.returncode = 1

        with patch("app.llm.base.asyncio.create_subprocess_exec", return_value=proc) as mock_exec:
            result = await cli.health_check()

        assert result is False
        mock_exec.assert_called_once_with(
            "which", "kimi",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )


# ---------------------------------------------------------------------------
# API provider edge case tests: Anthropic
# ---------------------------------------------------------------------------


class TestAnthropicAPIEdgeCases:
    """Edge case tests for AnthropicAPI."""

    def test_default_model(self):
        assert ANTHROPIC_DEFAULT_MODEL == "claude-sonnet-4-20250514"

    def test_default_max_tokens(self):
        assert DEFAULT_MAX_TOKENS == 4096

    def test_custom_model_override(self):
        provider = AnthropicAPI(api_key="key", model="claude-opus-4-20250514")
        assert provider._model == "claude-opus-4-20250514"

    def test_default_model_when_not_specified(self):
        provider = AnthropicAPI(api_key="key")
        assert provider._model == ANTHROPIC_DEFAULT_MODEL

    async def test_health_check_with_none_like_empty_key(self):
        """Health check with empty string returns False."""
        provider = AnthropicAPI(api_key="")
        assert await provider.health_check() is False

    async def test_execute_retry_on_connection_error(self):
        """Test retry on connection error (transient)."""
        import anthropic

        provider = AnthropicAPI(api_key="test-key")

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Success")]
        mock_response.model = "claude-test"
        mock_response.usage = MagicMock(input_tokens=1, output_tokens=1)

        conn_error = anthropic.APIConnectionError(request=MagicMock())

        provider._client = AsyncMock()
        provider._client.messages = AsyncMock()
        provider._client.messages.create = AsyncMock(
            side_effect=[conn_error, mock_response]
        )

        with patch("app.llm.api_anthropic.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            result = await provider.execute("test")

        assert result.content == "Success"
        mock_sleep.assert_awaited_once_with(2)

    async def test_execute_retry_on_internal_server_error(self):
        """Test retry on 500 internal server error (transient)."""
        import anthropic

        provider = AnthropicAPI(api_key="test-key")

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="OK")]
        mock_response.model = "claude-test"
        mock_response.usage = MagicMock(input_tokens=1, output_tokens=1)

        server_err_response = MagicMock()
        server_err_response.status_code = 500
        server_err_response.headers = {}
        server_error = anthropic.InternalServerError(
            message="internal error",
            response=server_err_response,
            body=None,
        )

        provider._client = AsyncMock()
        provider._client.messages = AsyncMock()
        provider._client.messages.create = AsyncMock(
            side_effect=[server_error, mock_response]
        )

        with patch("app.llm.api_anthropic.asyncio.sleep", new_callable=AsyncMock):
            result = await provider.execute("test")

        assert result.content == "OK"

    async def test_execute_no_retry_on_bad_request(self):
        """Test no retry on 400 bad request."""
        import anthropic

        provider = AnthropicAPI(api_key="test-key")

        bad_response = MagicMock()
        bad_response.status_code = 400
        bad_response.headers = {}
        bad_error = anthropic.BadRequestError(
            message="bad request",
            response=bad_response,
            body=None,
        )

        provider._client = AsyncMock()
        provider._client.messages = AsyncMock()
        provider._client.messages.create = AsyncMock(side_effect=bad_error)

        with pytest.raises(anthropic.BadRequestError):
            await provider.execute("test")

    async def test_execute_raises_after_two_transient_failures(self):
        """If both attempts fail with transient error, should raise."""
        import anthropic

        provider = AnthropicAPI(api_key="test-key")

        rate_response = MagicMock()
        rate_response.status_code = 429
        rate_response.headers = {}
        rate_error = anthropic.RateLimitError(
            message="rate limited",
            response=rate_response,
            body=None,
        )

        provider._client = AsyncMock()
        provider._client.messages = AsyncMock()
        provider._client.messages.create = AsyncMock(
            side_effect=[rate_error, rate_error]
        )

        with (
            patch("app.llm.api_anthropic.asyncio.sleep", new_callable=AsyncMock),
            pytest.raises(anthropic.RateLimitError),
        ):
            await provider.execute("test")


# ---------------------------------------------------------------------------
# API provider edge case tests: DeepSeek
# ---------------------------------------------------------------------------


class TestDeepSeekAPIEdgeCases:
    """Edge case tests for DeepSeekAPI."""

    def test_default_model(self):
        assert DEEPSEEK_DEFAULT_MODEL == "deepseek-chat"

    def test_custom_model_override(self):
        provider = DeepSeekAPI(api_key="key", model="deepseek-coder")
        assert provider._model == "deepseek-coder"

    def test_default_model_when_not_specified(self):
        provider = DeepSeekAPI(api_key="key")
        assert provider._model == DEEPSEEK_DEFAULT_MODEL

    async def test_health_check_with_empty_key(self):
        provider = DeepSeekAPI(api_key="")
        assert await provider.health_check() is False

    async def test_execute_retry_on_rate_limit(self):
        """Test DeepSeek retries on rate limit error."""
        import openai

        provider = DeepSeekAPI(api_key="test-key")

        mock_choice = MagicMock()
        mock_choice.message = MagicMock(content="Success after retry")
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.model = "deepseek-chat"
        mock_response.usage = MagicMock(prompt_tokens=1, completion_tokens=1)

        rate_response = MagicMock()
        rate_response.status_code = 429
        rate_response.headers = {}
        rate_response.json.return_value = {"error": {"message": "rate limited"}}
        rate_error = openai.RateLimitError(
            message="rate limited",
            response=rate_response,
            body=None,
        )

        provider._client = AsyncMock()
        provider._client.chat = AsyncMock()
        provider._client.chat.completions = AsyncMock()
        provider._client.chat.completions.create = AsyncMock(
            side_effect=[rate_error, mock_response]
        )

        with patch("app.llm.api_deepseek.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            result = await provider.execute("test")

        assert result.content == "Success after retry"
        mock_sleep.assert_awaited_once_with(2)

    async def test_execute_no_retry_on_auth_error(self):
        """Test DeepSeek does NOT retry on auth error."""
        import openai

        provider = DeepSeekAPI(api_key="bad-key")

        auth_response = MagicMock()
        auth_response.status_code = 401
        auth_response.headers = {}
        auth_response.json.return_value = {"error": {"message": "invalid key"}}
        auth_error = openai.AuthenticationError(
            message="invalid key",
            response=auth_response,
            body=None,
        )

        provider._client = AsyncMock()
        provider._client.chat = AsyncMock()
        provider._client.chat.completions = AsyncMock()
        provider._client.chat.completions.create = AsyncMock(side_effect=auth_error)

        with pytest.raises(openai.AuthenticationError):
            await provider.execute("test")

    async def test_execute_with_none_content(self):
        """Test DeepSeek handles None content (converts to empty string)."""
        provider = DeepSeekAPI(api_key="test-key")

        mock_choice = MagicMock()
        mock_choice.message = MagicMock(content=None)
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.model = "deepseek-chat"
        mock_response.usage = MagicMock(prompt_tokens=5, completion_tokens=0)

        provider._client = AsyncMock()
        provider._client.chat = AsyncMock()
        provider._client.chat.completions = AsyncMock()
        provider._client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await provider.execute("test")
        assert result.content == ""

    async def test_execute_with_null_usage(self):
        """Test DeepSeek handles null usage (tokens are None)."""
        provider = DeepSeekAPI(api_key="test-key")

        mock_choice = MagicMock()
        mock_choice.message = MagicMock(content="response")
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.model = "deepseek-chat"
        mock_response.usage = None

        provider._client = AsyncMock()
        provider._client.chat = AsyncMock()
        provider._client.chat.completions = AsyncMock()
        provider._client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await provider.execute("test")
        assert result.tokens_in is None
        assert result.tokens_out is None
        assert result.content == "response"

    async def test_execute_retry_on_connection_error(self):
        """Test DeepSeek retries on connection error."""
        import openai

        provider = DeepSeekAPI(api_key="test-key")

        mock_choice = MagicMock()
        mock_choice.message = MagicMock(content="OK")
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.model = "deepseek-chat"
        mock_response.usage = MagicMock(prompt_tokens=1, completion_tokens=1)

        conn_error = openai.APIConnectionError(request=MagicMock())

        provider._client = AsyncMock()
        provider._client.chat = AsyncMock()
        provider._client.chat.completions = AsyncMock()
        provider._client.chat.completions.create = AsyncMock(
            side_effect=[conn_error, mock_response]
        )

        with patch("app.llm.api_deepseek.asyncio.sleep", new_callable=AsyncMock):
            result = await provider.execute("test")

        assert result.content == "OK"

    async def test_execute_raises_after_two_transient_failures(self):
        """If both DeepSeek attempts fail with transient error, should raise."""
        import openai

        provider = DeepSeekAPI(api_key="test-key")

        rate_response = MagicMock()
        rate_response.status_code = 429
        rate_response.headers = {}
        rate_response.json.return_value = {"error": {"message": "rate limited"}}
        rate_error = openai.RateLimitError(
            message="rate limited",
            response=rate_response,
            body=None,
        )

        provider._client = AsyncMock()
        provider._client.chat = AsyncMock()
        provider._client.chat.completions = AsyncMock()
        provider._client.chat.completions.create = AsyncMock(
            side_effect=[rate_error, rate_error]
        )

        with (
            patch("app.llm.api_deepseek.asyncio.sleep", new_callable=AsyncMock),
            pytest.raises(openai.RateLimitError),
        ):
            await provider.execute("test")


# ---------------------------------------------------------------------------
# Provider registry edge case tests
# ---------------------------------------------------------------------------


class TestProviderRegistryEdgeCases:
    """Edge case tests for provider registry and factory."""

    def test_get_provider_empty_string_raises(self):
        with pytest.raises(ValueError, match="Unknown provider"):
            get_provider("")

    def test_get_provider_case_sensitive(self):
        """Provider names are case-sensitive."""
        with pytest.raises(ValueError, match="Unknown provider"):
            get_provider("Claude-CLI")

    def test_get_provider_api_key_ignored_for_cli(self):
        """API key parameter is ignored for CLI providers."""
        provider = get_provider("claude-cli", api_key="some-key")
        assert isinstance(provider, ClaudeCodeCLI)

    def test_get_provider_error_message_lists_available(self):
        """Error message should list available providers."""
        with pytest.raises(ValueError, match="anthropic-api"):
            get_provider("nonexistent")

    def test_cli_providers_set(self):
        assert _CLI_PROVIDERS == {"claude-cli", "codex-cli", "kimi-cli"}

    def test_api_providers_set(self):
        assert _API_PROVIDERS == {"anthropic-api", "deepseek-api"}

    def test_registry_types_match_classes(self):
        assert PROVIDER_REGISTRY["claude-cli"] is ClaudeCodeCLI
        assert PROVIDER_REGISTRY["codex-cli"] is CodexCLI
        assert PROVIDER_REGISTRY["kimi-cli"] is KimiCLI
        assert PROVIDER_REGISTRY["anthropic-api"] is AnthropicAPI
        assert PROVIDER_REGISTRY["deepseek-api"] is DeepSeekAPI

    async def test_get_available_providers_health_check_exception(self):
        """If a provider's health_check raises, it should be marked unhealthy."""
        with patch("app.llm.base.asyncio.create_subprocess_exec") as mock_exec:
            mock_exec.side_effect = OSError("cannot find which")

            providers = await get_available_providers()

        # All CLI providers should be unhealthy (exception during health_check)
        by_name = {p["name"]: p for p in providers}
        for cli_name in ["claude-cli", "codex-cli", "kimi-cli"]:
            assert by_name[cli_name]["healthy"] is False

    async def test_get_available_providers_returns_correct_structure(self):
        """Each provider dict should have exactly name, type, healthy keys."""
        with patch("app.llm.base.asyncio.create_subprocess_exec") as mock_exec:
            proc = AsyncMock()
            proc.communicate = AsyncMock(return_value=(b"", b""))
            proc.returncode = 1
            mock_exec.return_value = proc

            providers = await get_available_providers()

        for p in providers:
            assert set(p.keys()) == {"name", "type", "healthy"}

    def test_get_provider_returns_new_instance_each_time(self):
        """Each call to get_provider should return a new instance."""
        p1 = get_provider("claude-cli")
        p2 = get_provider("claude-cli")
        assert p1 is not p2

    def test_get_provider_api_with_different_keys(self):
        """API providers should accept different keys."""
        p1 = get_provider("anthropic-api", api_key="key1")
        p2 = get_provider("anthropic-api", api_key="key2")
        assert p1 is not p2


# ---------------------------------------------------------------------------
# LLMProvider Protocol runtime_checkable tests
# ---------------------------------------------------------------------------


class TestLLMProviderProtocol:
    """Test LLMProvider as a runtime_checkable Protocol."""

    def test_claude_cli_is_llm_provider(self):
        assert isinstance(ClaudeCodeCLI(), LLMProvider)

    def test_codex_cli_is_llm_provider(self):
        assert isinstance(CodexCLI(), LLMProvider)

    def test_kimi_cli_is_llm_provider(self):
        assert isinstance(KimiCLI(), LLMProvider)

    def test_anthropic_api_is_llm_provider(self):
        assert isinstance(AnthropicAPI(api_key="key"), LLMProvider)

    def test_deepseek_api_is_llm_provider(self):
        assert isinstance(DeepSeekAPI(api_key="key"), LLMProvider)

    def test_arbitrary_class_not_llm_provider(self):
        """A random class should not satisfy LLMProvider."""

        class NotAProvider:
            pass

        assert not isinstance(NotAProvider(), LLMProvider)


# ---------------------------------------------------------------------------
# LLMResult edge cases
# ---------------------------------------------------------------------------


class TestLLMResultEdgeCases:
    """Additional LLMResult dataclass edge cases."""

    def test_llm_result_zero_latency(self):
        result = LLMResult(
            content="", provider="p", model="m",
            tokens_in=0, tokens_out=0, latency_ms=0, cost_estimate=0.0,
        )
        assert result.latency_ms == 0
        assert result.tokens_in == 0
        assert result.cost_estimate == 0.0

    def test_llm_result_large_values(self):
        result = LLMResult(
            content="x" * 100000, provider="p", model="m",
            tokens_in=1000000, tokens_out=1000000,
            latency_ms=999999, cost_estimate=100.0,
        )
        assert len(result.content) == 100000
        assert result.tokens_in == 1000000

    def test_llm_result_equality(self):
        """Dataclass equality: two LLMResults with same values should be equal."""
        r1 = LLMResult(
            content="a", provider="p", model="m",
            tokens_in=1, tokens_out=2, latency_ms=100, cost_estimate=0.01,
        )
        r2 = LLMResult(
            content="a", provider="p", model="m",
            tokens_in=1, tokens_out=2, latency_ms=100, cost_estimate=0.01,
        )
        assert r1 == r2

    def test_llm_result_inequality(self):
        r1 = LLMResult(
            content="a", provider="p", model="m",
            tokens_in=1, tokens_out=2, latency_ms=100, cost_estimate=0.01,
        )
        r2 = LLMResult(
            content="b", provider="p", model="m",
            tokens_in=1, tokens_out=2, latency_ms=100, cost_estimate=0.01,
        )
        assert r1 != r2

    def test_llm_result_negative_latency_allowed(self):
        """Dataclass does not validate values, so negative latency is technically allowed."""
        result = LLMResult(
            content="", provider="p", model="m",
            tokens_in=None, tokens_out=None, latency_ms=-1, cost_estimate=None,
        )
        assert result.latency_ms == -1


# ---------------------------------------------------------------------------
# Module exports (__all__) tests
# ---------------------------------------------------------------------------


class TestModuleExports:
    """Test that __all__ exports from app.llm are correct."""

    def test_all_exports_exist(self):
        import app.llm

        for name in app.llm.__all__:
            assert hasattr(app.llm, name), f"{name} listed in __all__ but not found"

    def test_key_exports_accessible(self):
        """Verify that the main exports can be imported directly."""
        from app.llm import (  # noqa: F401, F811
            PROVIDER_REGISTRY,
            CircuitBreaker,
            CircuitBreakerOpenError,
            CLIProvider,
            LLMProvider,
            LLMResult,
            RateLimiter,
            RateLimitExceededError,
            get_available_providers,
            get_provider,
        )


# ---------------------------------------------------------------------------
# Integration: CLI execute + circuit breaker interaction pattern
# ---------------------------------------------------------------------------


class TestCLIExecuteCircuitBreakerIntegration:
    """Test that a provider's execute can be guarded by a circuit breaker."""

    async def test_circuit_breaker_guards_execute(self):
        """Demonstrate the pattern: check circuit breaker before execute."""
        cb = CircuitBreaker(failure_threshold=2, cooldown_seconds=60)
        cli = ClaudeCodeCLI()

        # Simulate 2 failures opening the circuit
        proc_fail = AsyncMock()
        proc_fail.communicate = AsyncMock(return_value=(b"", b"error"))
        proc_fail.returncode = 2
        proc_fail.kill = MagicMock()

        with patch("app.llm.base.asyncio.create_subprocess_exec", return_value=proc_fail):
            for _ in range(2):
                try:
                    cb.check()
                    await cli.execute("test")
                except RuntimeError:
                    cb.record_failure()

        assert cb.state == "open"

        # Circuit is open; check should raise before we even call execute
        with pytest.raises(CircuitBreakerOpenError):
            cb.check()

    async def test_circuit_breaker_resets_after_successful_half_open_execute(self):
        """In half-open state, a successful execute should close the circuit."""
        cb = CircuitBreaker(failure_threshold=2, cooldown_seconds=1)

        # Open the circuit
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        # Wait for cooldown
        cb._opened_at = time.monotonic() - 2
        assert cb.state == "half_open"

        # Simulate successful execute
        cli = ClaudeCodeCLI()
        stdout_ok = (
            b'{"type":"result","result":"recovered",'
            b'"model":"test","tokens_in":1,"tokens_out":1}'
        )
        proc_ok = AsyncMock()
        proc_ok.communicate = AsyncMock(return_value=(stdout_ok, b""))
        proc_ok.returncode = 0
        proc_ok.kill = MagicMock()

        with patch("app.llm.base.asyncio.create_subprocess_exec", return_value=proc_ok):
            cb.check()  # Should pass in half_open
            result = await cli.execute("test")
            cb.record_success()

        assert result.content == "recovered"
        assert cb.state == "closed"


# ---------------------------------------------------------------------------
# Integration: Rate limiter + provider execute interaction pattern
# ---------------------------------------------------------------------------


class TestRateLimiterProviderIntegration:
    """Test rate limiter guarding provider execute."""

    async def test_rate_limiter_blocks_execute_after_limit(self):
        """Demonstrate the pattern: check rate limiter before execute."""
        rl = RateLimiter(max_calls_per_minute=2)
        cli = ClaudeCodeCLI()

        stdout_ok = (
            b'{"type":"result","result":"ok",'
            b'"model":"test","tokens_in":1,"tokens_out":1}'
        )
        proc_ok = AsyncMock()
        proc_ok.communicate = AsyncMock(return_value=(stdout_ok, b""))
        proc_ok.returncode = 0
        proc_ok.kill = MagicMock()

        with patch("app.llm.base.asyncio.create_subprocess_exec", return_value=proc_ok):
            # 2 calls should work
            for _ in range(2):
                rl.check()
                await cli.execute("test")

            # 3rd should be blocked by rate limiter
            with pytest.raises(RateLimitExceededError):
                rl.check()


# ---------------------------------------------------------------------------
# Health endpoint edge cases
# ---------------------------------------------------------------------------


class TestHealthEndpointEdgeCases:
    """Additional /health endpoint edge case tests."""

    @pytest.fixture
    async def client(self, tmp_path, monkeypatch):
        """Create test client with isolated temp database."""
        import importlib

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

    async def test_health_returns_all_5_providers(self, client):
        """Health endpoint should list all 5 registered providers."""
        with patch("app.main.get_available_providers", new_callable=AsyncMock) as mock:
            mock.return_value = [
                {"name": "claude-cli", "type": "cli", "healthy": False},
                {"name": "codex-cli", "type": "cli", "healthy": False},
                {"name": "kimi-cli", "type": "cli", "healthy": False},
                {"name": "anthropic-api", "type": "api", "healthy": False},
                {"name": "deepseek-api", "type": "api", "healthy": False},
            ]
            resp = await client.get("/health")

        data = resp.json()
        assert len(data["providers"]) == 5
        names = {p["name"] for p in data["providers"]}
        assert names == {"claude-cli", "codex-cli", "kimi-cli", "anthropic-api", "deepseek-api"}

    async def test_health_response_has_all_required_fields(self, client):
        """Health response should have all required top-level fields."""
        with patch("app.main.get_available_providers", new_callable=AsyncMock) as mock:
            mock.return_value = []
            resp = await client.get("/health")

        data = resp.json()
        expected_keys = {
            "status", "schema_version", "migrations_applied",
            "uptime", "providers", "pairing_available",
        }
        assert set(data.keys()) == expected_keys

    async def test_health_status_is_ok(self, client):
        with patch("app.main.get_available_providers", new_callable=AsyncMock) as mock:
            mock.return_value = []
            resp = await client.get("/health")

        assert resp.json()["status"] == "ok"

    async def test_health_uptime_is_positive(self, client):
        with patch("app.main.get_available_providers", new_callable=AsyncMock) as mock:
            mock.return_value = []
            resp = await client.get("/health")

        assert resp.json()["uptime"] >= 0
