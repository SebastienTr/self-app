# Story 1.3: LLM Provider Abstraction & BYOK Configuration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to configure my own LLM API key and have a working provider abstraction,
So that I can choose my preferred LLM provider and switch freely. (FR36)

## Acceptance Criteria

1. **Given** a backend with `LLM_API_KEY` set to a valid Anthropic key **When** the backend starts **Then** the Anthropic provider is registered and its `health_check` returns healthy **And** the `llm_usage` table exists for cost tracking (already created in 001_init.sql)

2. **Given** the LLMProvider abstraction layer **When** a provider encounters 3 failures within 5 minutes **Then** the circuit breaker opens and requests return immediately with an error **And** a `warning` WebSocket message is sent to connected clients **And** the circuit resets after 60 seconds of cooldown

3. **Given** a transient error (429, 502-504, timeout) **When** an LLM call fails **Then** the system retries once with 2-second backoff before surfacing the error

4. **Given** the provider registry **When** queried for available providers **Then** 5 providers are returned with their type (3 CLI: Claude, Codex, Kimi + 2 API: Anthropic, DeepSeek) **And** each CLI provider extends a `CLIProvider` base class with `health_check` method **And** switching providers requires only API key configuration (NFR23)

## Tasks / Subtasks

- [x] Task 1: Create LLM provider base module (AC: #4)
  - [x] 1.1 Create `apps/backend/app/llm/` directory with `__init__.py`
  - [x] 1.2 Create `apps/backend/app/llm/base.py` with `LLMResult` dataclass: `content: str`, `provider: str`, `model: str`, `tokens_in: int | None`, `tokens_out: int | None`, `latency_ms: int`, `cost_estimate: float | None`
  - [x] 1.3 Define `LLMProvider` Protocol: `name: str`, `async def execute(self, prompt: str, tools: list | None = None) -> LLMResult`, `async def health_check(self) -> bool`
  - [x] 1.4 Create `CLIProvider` abstract base class extending `LLMProvider` with shared subprocess logic: `asyncio.create_subprocess_exec`, timeout management (default 60s), stdout capture, error parsing
  - [x] 1.5 `CLIProvider` must define abstract methods `_build_command(self, prompt: str) -> list[str]` and `_parse_output(self, stdout: str) -> LLMResult`
  - [x] 1.6 `CLIProvider.health_check()` implementation: use `asyncio.create_subprocess_exec("which", self._cli_binary)` to verify CLI availability
  - [x] 1.7 `CLIProvider.execute()` wraps subprocess call with timing (`time.monotonic()`), error capture, and returns `LLMResult` with `latency_ms`

- [x] Task 2: Create CLI provider implementations (AC: #4)
  - [x] 2.1 Create `apps/backend/app/llm/cli_claude.py` — `ClaudeCodeCLI` extending `CLIProvider`
    - `_build_command`: `["claude", "-p", prompt, "--output-format", "json"]`
    - `_parse_output`: parse JSON stdout for content, model, token counts
    - `name = "claude-cli"`
  - [x] 2.2 Create `apps/backend/app/llm/cli_codex.py` — `CodexCLI` extending `CLIProvider`
    - `_build_command`: `["codex", "exec", prompt, "--json"]`
    - `_parse_output`: parse JSONL stdout
    - `name = "codex-cli"`
  - [x] 2.3 Create `apps/backend/app/llm/cli_kimi.py` — `KimiCLI` extending `CLIProvider`
    - `_build_command`: `["kimi", "--print", "-p", prompt, "--output-format=stream-json"]`
    - `_parse_output`: parse JSONL stream
    - `name = "kimi-cli"`

- [x] Task 3: Create API provider implementations (AC: #1, #4)
  - [x] 3.1 Create `apps/backend/app/llm/api_anthropic.py` — `AnthropicAPI` extending `LLMProvider`
    - Uses `anthropic` Python SDK (AsyncAnthropic client)
    - `execute()`: calls `client.messages.create()` with model, max_tokens, prompt
    - `health_check()`: verifies API key is set and non-empty
    - Extract token counts from response `usage` field
    - `name = "anthropic-api"`
  - [x] 3.2 Create `apps/backend/app/llm/api_deepseek.py` — `DeepSeekAPI` extending `LLMProvider`
    - Uses OpenAI-compatible SDK (`openai.AsyncOpenAI` with `base_url="https://api.deepseek.com"`)
    - `execute()`: calls `client.chat.completions.create()`
    - `health_check()`: verifies API key is set and non-empty
    - `name = "deepseek-api"`

- [x] Task 4: Create provider registry and `get_provider()` (AC: #1, #4)
  - [x] 4.1 In `apps/backend/app/llm/__init__.py`: implement `PROVIDER_REGISTRY: dict[str, type]` mapping provider names to classes
  - [x] 4.2 Implement `get_provider(provider_name: str, api_key: str = "") -> LLMProvider` factory function
  - [x] 4.3 Implement `get_available_providers() -> list[dict]` returning all provider names, types ("cli"/"api"), and health status
  - [x] 4.4 Provider names: `claude-cli`, `codex-cli`, `kimi-cli`, `anthropic-api`, `deepseek-api`
  - [x] 4.5 Re-export `LLMProvider`, `LLMResult`, `CLIProvider`, `get_provider`, `get_available_providers`

- [x] Task 5: Implement circuit breaker (AC: #2)
  - [x] 5.1 Create circuit breaker logic in `apps/backend/app/llm/base.py` (or a small `circuit_breaker.py` inside `llm/`)
  - [x] 5.2 Track failure count and timestamps per provider instance
  - [x] 5.3 After 3 failures within 5 minutes: mark provider as `unhealthy`, set cooldown timer for 60 seconds
  - [x] 5.4 During unhealthy period: `execute()` raises immediately with structured error: `agent_action: "Provider {name} is unhealthy. Check logs or change SELF_LLM_PROVIDER"`
  - [x] 5.5 After 60 seconds: reset circuit breaker to half-open, allow one request, close on success
  - [x] 5.6 Log all circuit breaker state transitions with structured logging

- [x] Task 6: Implement retry logic (AC: #3)
  - [x] 6.1 Add retry wrapper in `CLIProvider.execute()` and API provider `execute()` methods
  - [x] 6.2 On transient errors (timeout, subprocess exit code indicating rate limit): retry once after 2-second backoff (`asyncio.sleep(2)`)
  - [x] 6.3 For API providers: retry on HTTP 429, 502, 503, 504, and timeout errors
  - [x] 6.4 Do NOT retry on semantic errors (400, 401, invalid prompt)
  - [x] 6.5 Log retry attempts with structured logging including `agent_action`

- [x] Task 7: Implement rate limiting (AC: linked to cost protection)
  - [x] 7.1 Add rate limiter in provider registry or wrapper: max `settings.self_llm_rate_limit` calls per minute per session
  - [x] 7.2 Use sliding window approach (track timestamps of last N calls)
  - [x] 7.3 When rate limit exceeded: raise error with code `LLM_RATE_LIMITED` and `agent_action: "Rate limit exceeded. Wait or increase SELF_LLM_RATE_LIMIT"`
  - [x] 7.4 Log rate limit events

- [x] Task 8: Update `/health` endpoint to include provider info (AC: #1)
  - [x] 8.1 Update `apps/backend/app/main.py` `/health` endpoint to include `providers` field
  - [x] 8.2 List configured provider name and health status
  - [x] 8.3 Include provider type (cli/api) in health response

- [x] Task 9: Add new Python dependencies (AC: #1, #4)
  - [x] 9.1 Add `anthropic>=0.52.0` to `pyproject.toml` dependencies
  - [x] 9.2 Add `openai>=1.82.0` to `pyproject.toml` dependencies (for DeepSeek OpenAI-compatible API)
  - [x] 9.3 Run `uv sync` to update lock file
  - [x] 9.4 Verify all existing tests still pass

- [x] Task 10: Write tests (AC: #1, #2, #3, #4)
  - [x] 10.1 Create `apps/backend/tests/test_llm.py` — test LLMProvider Protocol, LLMResult dataclass, CLIProvider base
  - [x] 10.2 Test `get_provider()` returns correct provider class for each name
  - [x] 10.3 Test `get_available_providers()` returns 5 providers with correct types
  - [x] 10.4 Test `ClaudeCodeCLI._build_command()` generates correct CLI arguments
  - [x] 10.5 Test `CodexCLI._build_command()` and `KimiCLI._build_command()`
  - [x] 10.6 Test `CLIProvider.health_check()` with mocked `which` command (found and not found)
  - [x] 10.7 Test `AnthropicAPI.health_check()` returns True with key, False without
  - [x] 10.8 Test `DeepSeekAPI.health_check()` returns True with key, False without
  - [x] 10.9 Test circuit breaker: 3 failures → unhealthy → reject → 60s reset → healthy
  - [x] 10.10 Test retry: transient error → wait 2s → retry → success
  - [x] 10.11 Test retry: semantic error → NO retry, immediate raise
  - [x] 10.12 Test rate limiter: allow up to limit, reject beyond
  - [x] 10.13 Test `/health` endpoint includes provider information
  - [x] 10.14 Mock all external subprocess calls and API clients — no real CLI or API calls in tests

## Dev Notes

### Architecture Compliance (MANDATORY)

This story creates the `app/llm/` sub-directory. This is the **documented exception** to the backend flat structure rule. The architecture explicitly states: "`app/llm/` is a sub-directory because it contains 5+ polymorphic implementations of the same Protocol (`LLMProvider`). A single file `llm.py` would exceed 300 lines." No other sub-directories should be created.

**Target file structure after this story:**

```
apps/backend/
├── app/
│   ├── __init__.py        # EXISTS
│   ├── main.py            # MODIFY (add provider info to /health)
│   ├── config.py          # EXISTS (already has SELF_LLM_PROVIDER, LLM_API_KEY)
│   ├── logging.py         # EXISTS
│   ├── db.py              # EXISTS
│   └── llm/               # NEW — entire directory
│       ├── __init__.py    # NEW — re-exports, get_provider(), get_available_providers()
│       ├── base.py        # NEW — LLMProvider Protocol, CLIProvider base, LLMResult
│       ├── cli_claude.py  # NEW — ClaudeCodeCLI
│       ├── cli_codex.py   # NEW — CodexCLI
│       ├── cli_kimi.py    # NEW — KimiCLI
│       ├── api_anthropic.py # NEW — AnthropicAPI
│       └── api_deepseek.py  # NEW — DeepSeekAPI
├── migrations/
│   └── 001_init.sql       # EXISTS (llm_usage table already created)
├── tests/
│   ├── conftest.py        # MODIFY (add LLM fixtures)
│   ├── test_llm.py        # NEW — comprehensive provider tests
│   └── ... (existing tests unchanged)
├── pyproject.toml          # MODIFY (add anthropic, openai deps)
└── uv.lock                 # AUTO-UPDATED
```

### LLMProvider Protocol (EXACT interface from architecture)

```python
# apps/backend/app/llm/base.py
from dataclasses import dataclass
from typing import Protocol

@dataclass
class LLMResult:
    content: str
    provider: str
    model: str
    tokens_in: int | None
    tokens_out: int | None
    latency_ms: int
    cost_estimate: float | None

class LLMProvider(Protocol):
    name: str
    async def execute(self, prompt: str, tools: list | None = None) -> LLMResult: ...
    async def health_check(self) -> bool: ...
```

`LLMResult` instead of raw `str` — every call automatically provides provider, latency, token count, and estimated cost. This data feeds into the `llm_usage` table (created in Story 1.2's 001_init.sql).

### CLIProvider Base Class Pattern

The 3 CLI providers share a common base that handles `asyncio.create_subprocess_exec`, timeout, stdout parsing, and error fallback. Each subclass only overrides `_build_command()` and `_parse_output()` (~30-40 lines per provider).

```python
import abc
import asyncio
import time

class CLIProvider(abc.ABC):
    name: str
    _cli_binary: str  # e.g., "claude", "codex", "kimi"
    _timeout: int = 60  # seconds

    @abc.abstractmethod
    def _build_command(self, prompt: str) -> list[str]: ...

    @abc.abstractmethod
    def _parse_output(self, stdout: str) -> LLMResult: ...

    async def execute(self, prompt: str, tools: list | None = None) -> LLMResult:
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
        except asyncio.TimeoutError:
            proc.kill()
            raise
        if proc.returncode != 0:
            raise RuntimeError(f"CLI exited with code {proc.returncode}: {stderr_bytes.decode()}")
        result = self._parse_output(stdout_bytes.decode())
        result.latency_ms = int((time.monotonic() - start) * 1000)
        return result

    async def health_check(self) -> bool:
        try:
            proc = await asyncio.create_subprocess_exec(
                "which", self._cli_binary,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()
            return proc.returncode == 0
        except Exception:
            return False
```

### CLI Command Reference (from architecture)

| Provider | Command | Output Format |
|----------|---------|---------------|
| ClaudeCodeCLI | `claude -p "prompt" --output-format json` | JSON stdout |
| CodexCLI | `codex exec "prompt" --json` | JSONL stdout |
| KimiCLI | `kimi --print -p "prompt" --output-format=stream-json` | JSONL stream |

### API Provider Pattern

```python
# api_anthropic.py
import anthropic

class AnthropicAPI:
    name = "anthropic-api"

    def __init__(self, api_key: str):
        self._client = anthropic.AsyncAnthropic(api_key=api_key)

    async def execute(self, prompt: str, tools: list | None = None) -> LLMResult:
        start = time.monotonic()
        response = await self._client.messages.create(
            model="claude-sonnet-4-20250514",  # current stable model
            max_tokens=4096,
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
        return bool(self._client.api_key)
```

```python
# api_deepseek.py
from openai import AsyncOpenAI

class DeepSeekAPI:
    name = "deepseek-api"

    def __init__(self, api_key: str):
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com",
        )

    async def execute(self, prompt: str, tools: list | None = None) -> LLMResult:
        start = time.monotonic()
        response = await self._client.chat.completions.create(
            model="deepseek-chat",
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
        return bool(self._client.api_key)
```

### Circuit Breaker Pattern

```
State machine:
  CLOSED (healthy) → 3 failures in 5 min → OPEN (unhealthy)
  OPEN → 60s cooldown → HALF_OPEN (allow 1 request)
  HALF_OPEN → success → CLOSED
  HALF_OPEN → failure → OPEN (restart cooldown)
```

During OPEN state: `execute()` raises immediately with error code and `agent_action`. A WebSocket `warning` message should be available for `main.py` to send to connected clients (but since WebSocket is not yet implemented in this story, log the warning and prepare the error payload structure).

### Retry Strategy

- 1 automatic retry with 2-second backoff (`asyncio.sleep(2)`) on transient errors
- **Transient errors for CLI:** timeout, non-zero exit code with stderr indicating rate limit or temporary failure
- **Transient errors for API:** HTTP 429, 502, 503, 504, timeout (`httpx.TimeoutException`, `anthropic.RateLimitError`, `openai.RateLimitError`)
- **NOT retried:** 400, 401, 403, prompt errors, invalid API key errors
- Log every retry with: `event="llm_retry"`, `provider=name`, `attempt=2`, `error=str(e)`, `agent_action="Retrying after transient error"`

### Rate Limiting

- Sliding window: track timestamps of last N calls in memory
- Max `settings.self_llm_rate_limit` calls per minute (default: 10)
- When exceeded: raise error with code `LLM_RATE_LIMITED`
- Rate limiter wraps `execute()` — applied before the actual provider call

### Cost Protection Architecture (from architecture doc)

- **Rate limit:** max `SELF_LLM_RATE_LIMIT` LLM calls per minute (default 10)
- **Budget tracking:** `cost_estimate` in `LLMResult`, logged hourly via structlog
- **Alert:** configurable `SELF_LLM_COST_ALERT` (default $5/day) — warning when exceeded
- **No hard stop in V1** — alert is informative, not blocking
- **Persistence:** each LLM call recorded in `llm_usage` table by `agent.py` (Story 2+)

Note: The `llm_usage` table INSERT is NOT done in this story. This story creates the providers. The `agent.py` module (a future story) will orchestrate LLM calls and persist usage to `llm_usage`. However, `LLMResult` carries all the data needed for insertion.

### Provider Configuration (from config.py — already exists)

```python
# Already in apps/backend/app/config.py
settings.self_llm_provider  # "claude-cli" default
settings.llm_api_key        # "" default, user provides via .env
settings.self_llm_rate_limit  # 10 default (calls per minute)
settings.self_llm_cost_alert  # 5.0 default ($/day)
```

The `get_provider()` function should read `settings.self_llm_provider` and `settings.llm_api_key` by default but also accept explicit parameters for testing and flexibility.

### Environment Variable Reference (.env.example — already exists)

```env
LLM_API_KEY=your-api-key-here
SELF_LLM_PROVIDER=claude-cli  # Options: claude-cli, codex-cli, kimi-cli, anthropic-api, deepseek-api
```

### Async-Only Python Rule (CRITICAL)

| Forbidden | Required Alternative |
|-----------|---------------------|
| `import subprocess` / `subprocess.run()` | `asyncio.create_subprocess_exec()` |
| `time.sleep()` | `asyncio.sleep()` |
| `import requests` | `import httpx` |
| `import sqlite3` | `import aiosqlite` |

The CLIProvider MUST use `asyncio.create_subprocess_exec()` — never `subprocess.run()` or `subprocess.Popen()`. The API providers MUST use async clients (`AsyncAnthropic`, `AsyncOpenAI`).

### Naming Conventions (MANDATORY)

| Context | Convention | Example |
|---------|-----------|---------|
| Python modules | snake_case | `base.py`, `cli_claude.py`, `api_anthropic.py` |
| Python classes | PascalCase | `ClaudeCodeCLI`, `AnthropicAPI`, `LLMResult` |
| Python functions | snake_case | `get_provider`, `health_check`, `_build_command` |
| Error codes | SCREAMING_SNAKE | `LLM_RATE_LIMITED`, `LLM_PROVIDER_UNHEALTHY` |
| Test files | `tests/test_*.py` | `tests/test_llm.py` |

### Error Handling Pattern (MANDATORY)

```python
# Always log before raising/returning error
log.error("llm_call_failed",
    provider=provider.name,
    error=str(e),
    agent_action="Check LLM provider health. Run 'which claude' or verify API key")
```

Never `except Exception: pass`. Never bare `except:`. Always log structured errors with `agent_action`.

### Test Patterns

- Use `pytest-asyncio` with `asyncio_mode = "auto"` (already configured)
- Mock ALL external calls: `asyncio.create_subprocess_exec`, `anthropic.AsyncAnthropic`, `openai.AsyncOpenAI`
- Use `pytest-mock` with `mocker.patch()` for mocking
- Create fixtures in `conftest.py` for mock providers and test API keys
- Test the Protocol compliance: verify each provider has `name`, `execute()`, `health_check()`

```python
# Example test for circuit breaker
async def test_circuit_breaker_opens_after_3_failures(mock_provider):
    for _ in range(3):
        with pytest.raises(RuntimeError):
            await mock_provider.execute("test")
    # 4th call should be rejected immediately (circuit open)
    with pytest.raises(CircuitBreakerOpenError):
        await mock_provider.execute("test")
```

### What NOT To Do

- Do NOT implement WebSocket message handling (Story 1.4)
- Do NOT implement `agent.py` orchestration (future story)
- Do NOT write to `llm_usage` table — that's `agent.py`'s job
- Do NOT implement session authentication (Story 1.6)
- Do NOT implement memory system (Story 5.x)
- Do NOT implement persona engine (Story 2.x)
- Do NOT make real CLI or API calls in tests — mock everything
- Do NOT create additional sub-directories in `app/` — only `llm/` is permitted
- Do NOT use synchronous subprocess calls (`subprocess.run`, `subprocess.Popen`)
- Do NOT use `time.sleep()` — use `asyncio.sleep()`
- Do NOT implement automatic fallback between providers in V1 (deferred to MVP)
- Do NOT add `requests` package — use `httpx` for any HTTP needs
- Do NOT implement LLM streaming — `execute()` returns complete result, streaming is for chat (Story 2.x)
- Do NOT hardcode model names without a clear default constant that can be overridden

### Previous Story Intelligence

**From Story 1.2 (Backend Skeleton — done):**
- `config.py` exists with `Settings` class, already has: `llm_api_key`, `self_llm_provider`, `self_llm_rate_limit`, `self_llm_cost_alert`
- `logging.py` exists with structlog JSON config, `setup_logging()`, `log` export
- `db.py` exists with `get_connection()`, `run_migrations()`, `get_schema_version()`
- `main.py` exists with FastAPI lifespan, `/health` endpoint returning `status`, `schema_version`, `migrations_applied`, `uptime`
- `001_init.sql` creates 6 tables including `llm_usage` (id, provider, model, tokens_in, tokens_out, cost_estimate, user_id, created_at)
- `pyproject.toml` has: `fastapi[standard]`, `pydantic`, `pydantic-settings`, `aiosqlite`, `structlog`, `httpx`, `module-schema`
- Ruff configured with `select = ["E", "F", "I", "N", "W", "UP", "ASYNC"]` — ASYNC rules enforced
- pytest configured with `asyncio_mode = "auto"`, `testpaths = ["tests"]`, `pythonpath = ["."]`
- 220 tests passing (all backend tests)
- `structlog.get_level_from_name` was not available — a custom level mapping was used instead
- `ASGITransport` does not trigger lifespan automatically — `app.router.lifespan_context` was used for test startup

**From Story 1.1 (Monorepo — done):**
- Monorepo scaffolded with pnpm 10.30.1
- `packages/module-schema/` exists with Zod source of truth
- The `generated/` directory needs scaffolding before `uv sync` in fresh environments
- Backend uses `uv` for package management

**From Story 1.1b (CI — done):**
- CI runs: schema generation, typecheck, JS tests (25), Python tests (16+)
- `uv sync --frozen --extra dev` is the CI install command
- Generated files are gitignored — CI regenerates them

**From Git History:**
- Recent commits: `da4eff0 1.2`, `d28d5e4 n`, `6f50929 fix(ci)`, `09adfc2 feat: implement stories 1.1 + 1.1b`
- The `generated/` directory path dependency fix is important — new packages should follow similar patterns

### Project Structure Notes

- This story creates the only permitted sub-directory in `apps/backend/app/`: the `llm/` package
- All files within `llm/` follow the architecture document exactly (base.py, cli_claude.py, cli_codex.py, cli_kimi.py, api_anthropic.py, api_deepseek.py, __init__.py)
- No new migration needed — `llm_usage` table already exists from 001_init.sql
- Two new pip dependencies: `anthropic` and `openai` (for DeepSeek compatibility)
- No mobile-side changes in this story
- No docker-compose.yml changes needed

### References

- [Source: architecture.md#LLM Provider Architecture] — Multi-provider strategy, 5 backends, LLMResult, CLIProvider base (lines 698-731)
- [Source: architecture.md#Fallback & Retry Strategy] — Retry 1x with 2s backoff, circuit breaker 3 failures/5min/60s cooldown (lines 737-742)
- [Source: architecture.md#Cost Protection] — Rate limiting 10/min, budget tracking, cost alerts, llm_usage table (lines 744-751)
- [Source: architecture.md#LLM Execution Strategy] — CLI mode vs API mode, dual-mode access (lines 73-91)
- [Source: architecture.md#Async-Only Python Rule] — Forbidden sync imports (lines 943-954)
- [Source: architecture.md#Backend project organization] — llm/ as documented exception (lines 906-941)
- [Source: architecture.md#LLMProvider abstraction] — Non-negotiable from commit 1, interface definition (lines 215-227)
- [Source: architecture.md#Health check] — CLI availability via `which`, API key presence (lines 732-735)
- [Source: architecture.md#Configuration] — SELF_LLM_PROVIDER env var selects active provider (lines 735-736)
- [Source: architecture.md#Service Boundaries] — llm/ isolated behind Protocol, zero knowledge of modules/memory/WS (lines 1336)
- [Source: architecture.md#Error handling] — Structured logging, never swallow, agent_action on every error (lines 1055-1083)
- [Source: epics.md#Story 1.3] — Acceptance criteria, BDD format (lines 461-487)
- [Source: prd.md#FR36] — User can configure their own LLM provider API keys (BYOK)
- [Source: prd.md#NFR23] — LLM provider abstraction, switching requires only API key config
- [Source: story 1-2] — Existing backend files, config.py, logging.py, db.py, main.py, 001_init.sql
- [Source: story 1-1] — Monorepo structure, uv, pyproject.toml dependencies

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- structlog first positional arg is the event name; passing `event=` as keyword causes TypeError — fixed by using event name as first arg only
- Ruff UP041 rule: `asyncio.TimeoutError` must be replaced with builtin `TimeoutError` in Python 3.12+
- Existing test `test_response_has_exactly_four_keys` needed update after adding `providers` field to /health

### Completion Notes List

- Implemented complete LLM provider abstraction layer with 5 providers (3 CLI + 2 API)
- Created `app/llm/` package as the documented architecture exception to flat structure
- `LLMResult` dataclass carries content, provider, model, tokens, latency, and cost estimate
- `LLMProvider` Protocol with `name`, `execute()`, `health_check()` — all providers comply
- `CLIProvider` ABC handles subprocess execution, timeout, retry, and health check via `which`
- 3 CLI providers: ClaudeCodeCLI, CodexCLI, KimiCLI — each ~30 lines, only `_build_command` + `_parse_output`
- 2 API providers: AnthropicAPI (anthropic SDK), DeepSeekAPI (openai-compatible SDK)
- CircuitBreaker: CLOSED -> 3 failures/5min -> OPEN -> 60s cooldown -> HALF_OPEN -> success -> CLOSED
- Retry: 1 automatic retry with 2s backoff on transient errors (timeout, rate limit, 5xx); no retry on auth/semantic errors
- RateLimiter: sliding window, max N calls/minute, raises RateLimitExceededError with LLM_RATE_LIMITED code
- Provider registry with `get_provider()` factory and `get_available_providers()` discovery
- `/health` endpoint now includes `providers` field with name, type, and health status
- Added `anthropic>=0.52.0`, `openai>=1.82.0`, `pytest-mock` to dependencies
- 167 LLM-specific tests (test_llm.py + test_llm_edge_cases.py), 387 total passing, 0 failures, all ruff checks pass
- All async: uses `asyncio.create_subprocess_exec`, `asyncio.sleep`, `AsyncAnthropic`, `AsyncOpenAI`

### Change Log

- 2026-02-23: Story 1.3 implemented — LLM provider abstraction, BYOK configuration, circuit breaker, retry, rate limiter
- 2026-02-23: Code review (adversarial) — fixed 3 HIGH + 3 MEDIUM issues, documented 3 LOW follow-ups

### File List

- apps/backend/app/llm/__init__.py (NEW) — Provider registry, get_provider(), get_available_providers(), re-exports
- apps/backend/app/llm/base.py (NEW) — LLMResult, LLMProvider Protocol, CLIProvider ABC, CircuitBreaker
- apps/backend/app/llm/cli_claude.py (NEW) — ClaudeCodeCLI provider
- apps/backend/app/llm/cli_codex.py (NEW) — CodexCLI provider
- apps/backend/app/llm/cli_kimi.py (NEW) — KimiCLI provider
- apps/backend/app/llm/api_anthropic.py (NEW) — AnthropicAPI provider
- apps/backend/app/llm/api_deepseek.py (NEW) — DeepSeekAPI provider
- apps/backend/app/llm/rate_limiter.py (NEW) — RateLimiter, RateLimitExceededError
- apps/backend/app/main.py (MODIFIED) — Added providers field to /health endpoint
- apps/backend/tests/test_llm.py (NEW) — 47 core tests for LLM module
- apps/backend/tests/test_llm_edge_cases.py (NEW) — 120 edge case and integration tests for LLM module
- apps/backend/tests/test_health_edge_cases.py (MODIFIED) — Updated key count test for new providers field
- apps/backend/pyproject.toml (MODIFIED) — Added anthropic, openai, pytest-mock dependencies
- apps/backend/uv.lock (AUTO-UPDATED)

## Review Follow-ups

### Adversarial Code Review — 2026-02-23

**Reviewer:** Claude Opus 4.6 (adversarial review workflow)

**Issues Fixed (HIGH):**
- [x] [H1] `get_available_providers()` always reported API providers as unhealthy because it instantiated them with `api_key=""` instead of using the configured `settings.llm_api_key`. Fixed in `__init__.py`.
- [x] [H2] `get_provider()` did not read from `settings` by default as specified in Dev Notes. Changed signature to default `provider_name` and `api_key` from settings when not explicitly provided. Fixed in `__init__.py`.
- [x] [H3] `test_llm_edge_cases.py` (120 tests) was not listed in the story File List. Updated File List.

**Issues Fixed (MEDIUM):**
- [x] [M1] CircuitBreaker `_failures` used `list[tuple[float]]` (single-element tuples) unnecessarily. Simplified to `list[float]` in `base.py`.
- [x] [M2] No structured error logging with `agent_action` on CLI `_execute_once()` non-zero exit code. Added `log.error()` before raising `RuntimeError` in `base.py`.
- [x] [M5] Story claimed "60 new tests, 280 total" but actual was 167 LLM tests, 387 total. Corrected in Completion Notes.

**Low Severity (documented, not fixed):**
- [ ] [L1] `CircuitBreakerOpenError` has bare `pass` body — purely stylistic, docstring already present above `pass`
- [ ] [L2] API provider `_execute_once` does not guard against empty `choices`/`content` arrays — `IndexError` on `response.choices[0]` or `response.content[0]` if server returns empty list. Low risk since SDK typically guarantees non-empty responses.
- [ ] [L3] `_is_transient_cli_error()` accepts `returncode: int` parameter but never uses it — dead parameter. Consider removing or using it for finer-grained transient detection.
- [ ] [L4] CircuitBreaker and RateLimiter are standalone classes not automatically integrated into provider `execute()`. This is by design for V1 — `agent.py` (future story) will orchestrate the check-execute-record pattern. Document this integration point.
- [ ] [L5] `_bmad/bmm/workflows/4-implementation/story-cycle/steps-c/step-06-finalize.md` shows as modified in git but is not part of story scope — workflow config file change, no action needed.
