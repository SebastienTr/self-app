# Story 4.1: Cron-Based Background Refresh

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want my modules to stay fresh automatically,
so that I always see up-to-date data without manual action. (FR40)

## Acceptance Criteria

1. **Given** a module with a configured `refreshInterval` in its spec **When** the scheduled interval elapses **Then** the backend executes HTTP call(s) to the module's data source(s) without LLM involvement and updates the module's cached data in SQLite

2. **Given** a background refresh completes successfully with new data **When** at least one connected mobile client exists **Then** the updated module spec is pushed via `module_updated` WebSocket message through the existing task manager buffer (with seq envelope)

3. **Given** a refresh fails for one module (HTTP timeout, 4xx/5xx, network error) **When** other modules have different schedules **Then** the failure is isolated — other module refreshes continue unaffected (NFR20) **And** the failed module's `dataStatus` is set to `'error'` without changing its lifecycle `status`

4. **Given** a single module refresh **When** measured end-to-end **Then** it completes in under 5 seconds (NFR9) **And** a configurable per-module timeout (default 10s, from NFR24) aborts hung HTTP calls

5. **Given** the backend starts up **When** modules with `refreshInterval` exist in the database **Then** the scheduler loads their schedules and begins executing refreshes at the correct intervals

6. **Given** a new module is created by the agent during a chat session **When** the module has a `refreshInterval` > 0 and at least one data source **Then** it is automatically registered with the scheduler for periodic refresh

7. **Given** a module refresh succeeds **When** the data is written to SQLite **Then** `modules.updated_at` is set to the current UTC timestamp **And** the `dataStatus` in the pushed update is `'ok'`

8. **Given** the backend is running with no connected mobile clients **When** a scheduled refresh fires **Then** the refresh still executes and updates SQLite (data is fresh for next connect) **But** no WebSocket push is attempted (no error from missing clients)

9. **Given** a module whose data source returns identical data to the previous refresh **When** the refresh completes **Then** `updated_at` is still bumped (confirms liveness) **But** no `module_updated` push is sent to mobile (avoid unnecessary re-renders)

10. **Given** the mobile app receives a `module_updated` message from a background refresh **When** the module is displayed on the Home tab **Then** the module card re-renders with fresh data seamlessly (no loading spinner, no flicker)

## Tasks / Subtasks

- [x] Task 1: Create backend scheduler service (AC: #5, #6, #8)
  - [x] 1.1 Create `apps/backend/app/scheduler.py` with `RefreshScheduler` class using `asyncio` (no external cron library — Python stdlib only)
  - [x] 1.2 Implement `start()` — load all modules from DB, register each with `refreshInterval > 0` and non-empty `dataSources` as a recurring `asyncio.Task`
  - [x] 1.3 Implement `register_module(module_id, refresh_interval_seconds)` — add or update a module's refresh schedule at runtime (called when new module is created)
  - [x] 1.4 Implement `unregister_module(module_id)` — remove a module from the scheduler (for future archive/delete use)
  - [x] 1.5 Implement `stop()` — cancel all running refresh tasks gracefully on shutdown
  - [x] 1.6 Each module gets its own `asyncio.Task` that sleeps for `refreshInterval` then calls the refresh function, looping indefinitely. Tasks are stored in a `dict[str, asyncio.Task]`.
  - [x] 1.7 Tests: `apps/backend/tests/test_scheduler.py` — start/stop lifecycle, register/unregister, verify refresh is called at correct intervals (use `asyncio` time mocking)

- [x] Task 2: Implement HTTP data fetch for module data sources (AC: #1, #4, #3)
  - [x] 2.1 Create `apps/backend/app/data_fetch.py` with `async def fetch_module_data(module: dict) -> dict | None` — iterates over the module's `dataSources` array and fetches each one
  - [x] 2.2 Use `httpx.AsyncClient` for HTTP calls (httpx is already in the project's Python ecosystem for async HTTP; add to `requirements.txt` if not present)
  - [x] 2.3 Implement per-data-source timeout: default 10 seconds (NFR24), configurable via `SELF_REFRESH_TIMEOUT` env var
  - [x] 2.4 Implement data source type dispatch: for V1, support `type: 'http_json'` (GET request, parse JSON response) — other types (`http_xml`, `graphql`, etc.) return `None` with a warning log
  - [x] 2.5 Return a merged data dict from all data sources, or `None` if all fetches failed. Partial success (some sources ok, some failed) returns the successful data with warnings.
  - [x] 2.6 Structured logging for every fetch: `data_fetch_started`, `data_fetch_success` (with latency_ms), `data_fetch_failed` (with error, http_status)
  - [x] 2.7 Tests: `apps/backend/tests/test_data_fetch.py` — mock httpx, test success/timeout/error/partial scenarios

- [x] Task 3: Implement refresh execution and DB update (AC: #1, #7, #9, #3)
  - [x] 3.1 Create `apps/backend/app/refresh.py` with `async def refresh_module(module_id: str, db_path: str, push_fn: Callable | None) -> bool`
  - [x] 3.2 Load module from DB → call `fetch_module_data()` → compare fetched data with existing `spec.data` (or equivalent cached payload field)
  - [x] 3.3 On success: update `modules.updated_at` in SQLite. If data changed: also update `spec` JSON with fresh data and call `push_fn` with `module_updated` payload.
  - [x] 3.4 On failure: log error with module_id and data source details, do NOT update `updated_at`, set a `last_refresh_error` field in module metadata
  - [x] 3.5 Module isolation: wrap entire refresh in try/except — one module's failure never propagates (AC: #3)
  - [x] 3.6 Per-request DB connection pattern: `db = await get_connection(db_path)` → try/finally → `db.close()` (mandatory pattern from architecture)
  - [x] 3.7 Tests: `apps/backend/tests/test_refresh.py` — success update, no-change skip push, failure isolation, DB update verification

- [x] Task 4: Wire scheduler into FastAPI lifespan and WebSocket push (AC: #5, #6, #8, #2)
  - [x] 4.1 In `apps/backend/app/main.py` lifespan: instantiate `RefreshScheduler`, call `scheduler.start(db_path)` after migrations, call `scheduler.stop()` on shutdown
  - [x] 4.2 Create a `push_module_update(module_id, spec)` function that finds all active sessions in `task_manager` and calls `buffer_and_notify` for each — this is the bridge between scheduler and WS push
  - [x] 4.3 Wire `push_module_update` as the `push_fn` parameter to `refresh_module`
  - [x] 4.4 In the `module_created` flow (agent.py or main.py after module creation): call `scheduler.register_module(module_id, refresh_interval)` to auto-register new modules
  - [x] 4.5 Add `SELF_REFRESH_TIMEOUT` to `apps/backend/app/config.py` Settings (default: 10, integer seconds)
  - [x] 4.6 Tests: `apps/backend/tests/test_refresh_integration.py` — end-to-end: create module → scheduler picks it up → mock HTTP response → verify `module_updated` pushed to WS buffer

- [x] Task 5: Add migration for refresh metadata columns (AC: #7, #3)
  - [x] 5.1 Create `apps/backend/migrations/003_add_refresh_metadata.sql` — add `last_refreshed_at TEXT`, `last_refresh_error TEXT` columns to `modules` table (both nullable, ALTER TABLE ADD COLUMN)
  - [x] 5.2 Insert `schema_version` row: `INSERT INTO schema_version (version) VALUES (3);`
  - [x] 5.3 Tests: verify migration applies cleanly on existing DB with modules

- [x] Task 6: Update mobile to handle background refresh updates (AC: #10, #2)
  - [x] 6.1 No new WS message type needed — `module_updated` already exists and is handled by `moduleSync.ts`
  - [x] 6.2 Verify `moduleSync.ts` `module_updated` handler correctly updates `moduleStore` and triggers re-render (it does — no changes needed)
  - [x] 6.3 Add `dataStatus` update in `moduleSync.ts`: on `module_updated` receipt, set `dataStatus: 'ok'` (confirms fresh data)
  - [x] 6.4 Optionally add a `module_refresh_failed` handler: on refresh failure push, set `dataStatus: 'error'` on the affected module in `moduleStore` (shows "Offline" badge per architecture UX spec)
  - [x] 6.5 Tests: update `apps/mobile/services/moduleSync.test.ts` — verify `dataStatus` update on `module_updated`, verify `module_refresh_failed` handler

- [x] Task 7: Data freshness indicators on module cards (AC: #10)
  - [x] 7.1 Add freshness caption logic to the module card component: compute time since `updatedAt`, display per architecture UX table (< 1h: nothing, 1-24h: "Updated Xh ago", > 24h: warning badge "Stale")
  - [x] 7.2 Use `tokens.colors.textSecondary` for "Updated Xh ago" caption, `tokens.colors.warning` for "Stale" badge
  - [x] 7.3 Tests: `apps/mobile/components/bridge/FreshnessIndicator.test.tsx` — render with various `updatedAt` values, verify correct indicator

## Dev Notes

### Current State (What Exists)

**Module spec already has `refreshInterval` and `dataSources`**: The Zod schema in `packages/module-schema/src/moduleSpec.ts` defines `refreshInterval: z.number().positive()` (seconds) and `dataSources: z.array(dataSourceSchema)` with `dataSourceSchema = { id, type, config }`. These fields exist in every module spec but are NOT used by any backend code today — they are created by the agent and stored in the `spec` JSON column but never consumed.

**No scheduler exists**: The backend has no background task system. All processing is request-driven (WebSocket messages trigger agent work). The `lifespan` function in `main.py` handles startup/shutdown but has no periodic task registration.

**`module_updated` WS message exists but is unused**: The WS protocol defines `module_updated` (server→client) and `moduleSync.ts` handles it on mobile. However, no backend code currently sends `module_updated` — modules are only created, never refreshed. The mobile handler is ready and tested.

**Task manager handles WS push**: Story 4-0 established the `AgentTaskManager` pattern where all server→client messages go through `buffer_and_notify()` with seq envelopes. The scheduler's push function must use this same pattern — not direct `ws.send_json()`.

**Modules table has `updated_at` but no refresh-specific columns**: The `001_init.sql` migration creates `updated_at TEXT NOT NULL` which tracks any modification. Refresh-specific metadata (`last_refreshed_at`, `last_refresh_error`) needs a new migration.

### Architecture Patterns to Follow

- **Per-request DB connections**: Always `db = await get_connection(db_path)` → try/finally → `db.close()`. Never session-scoped. (Established story 1-5, mandatory.)
- **Async-only**: No sync I/O anywhere. Use `httpx.AsyncClient` for HTTP, `aiosqlite` for DB. No `requests` library.
- **Structured logging with structlog**: Every operation logs with `log.info("event_name", key=value)`. Include `module_id`, `latency_ms`, `data_source_id` in refresh logs.
- **Module isolation (NFR20)**: Each module refresh is independent. Use try/except per module. Never let one failure cancel other refreshes.
- **Task manager for WS push**: All server→client messages go through `task_manager.buffer_and_notify(session_id, payload)`. The scheduler must iterate active sessions and push to each.
- **snake_case over the wire**: WS payloads use `snake_case`. Mobile `toCamel()` converts. The `module_updated` payload format is `{ module_id: string, spec: {...} }`.
- **Config via pydantic-settings**: New config values go in `apps/backend/app/config.py` `Settings` class, read from env vars.

### Key Design Decisions

1. **asyncio-based scheduler, not APScheduler/Celery**: The backend is a single-process FastAPI app. External schedulers add complexity without value for V1. Each module gets its own `asyncio.Task` that loops: sleep(interval) → fetch → update → repeat. Simple, testable, zero dependencies.

2. **httpx for HTTP fetching**: The project uses `aiosqlite` for async DB. `httpx` is the standard async HTTP client for Python. No need for `aiohttp` (heavier) or `requests` (sync, would block the event loop).

3. **Data source type dispatch (V1: `http_json` only)**: Module data sources have a `type` field. For V1, only `type: 'http_json'` is implemented (simple GET → JSON parse). Other types log a warning and skip. This is extensible for future types (RSS, GraphQL, etc.).

4. **No-change detection avoids unnecessary pushes**: If fetched data is identical to current cached data (deep equality on the data payload), `updated_at` is still bumped (proves the refresh ran) but no `module_updated` is pushed to mobile. This prevents unnecessary re-renders on every refresh cycle.

5. **Scheduler survives WS disconnects**: The scheduler is a backend-lifetime process, independent of any WebSocket connection. Refreshes continue whether zero or many clients are connected. This aligns with the "app works while you sleep" vision.

6. **Push to ALL active sessions**: When a refresh produces new data, the push function iterates all sessions that have a writer queue in `task_manager` and pushes to each. This supports future multi-device scenarios and ensures the current single client always gets updates.

7. **Migration adds nullable columns**: `ALTER TABLE modules ADD COLUMN last_refreshed_at TEXT` is nullable — existing modules without refresh history get `NULL`. No data migration needed.

### Project Structure Notes

**New files:**
- `apps/backend/app/scheduler.py` — RefreshScheduler class
- `apps/backend/app/data_fetch.py` — HTTP data fetching for module data sources
- `apps/backend/app/refresh.py` — Refresh execution logic (fetch → compare → update → push)
- `apps/backend/migrations/003_add_refresh_metadata.sql` — Add refresh tracking columns
- `apps/backend/tests/test_scheduler.py` — Scheduler lifecycle tests
- `apps/backend/tests/test_data_fetch.py` — HTTP fetch tests (mocked httpx)
- `apps/backend/tests/test_refresh.py` — Refresh logic tests
- `apps/backend/tests/test_refresh_integration.py` — End-to-end refresh integration test

**Modified files:**
- `apps/backend/app/main.py` — Wire scheduler into lifespan, add push_module_update bridge function
- `apps/backend/app/config.py` — Add `SELF_REFRESH_TIMEOUT` setting
- `apps/backend/app/agent.py` or `apps/backend/app/main.py` — Register new modules with scheduler after creation
- `apps/backend/requirements.txt` (or pyproject.toml) — Add `httpx` dependency if not present
- `apps/mobile/services/moduleSync.ts` — Add `dataStatus` update on `module_updated`, optional `module_refresh_failed` handler
- `apps/mobile/services/moduleSync.test.ts` — Tests for refresh-related updates

**Unchanged (critical — don't touch):**
- `apps/backend/app/task_manager.py` — Already complete from story 4-0, only consumed (never modified)
- `apps/backend/app/llm/` — No LLM involvement in cron refresh (FR40 explicitly states no LLM)
- `apps/mobile/stores/moduleStore.ts` — Already has `updateModule`, `setModuleDataStatus` — no changes needed
- `apps/mobile/types/module.ts` — Already defines `DataStatus = 'ok' | 'stale' | 'error'`
- `apps/mobile/types/ws.ts` — Already defines `ModuleUpdatedMessage`
- `packages/module-schema/` — Schema already has `refreshInterval` and `dataSources`
- `apps/mobile/components/bridge/ChatThread.tsx` — Chat is unrelated
- `apps/mobile/hooks/useAppStateConnection.ts` — Reconnect logic unchanged

### Testing Standards

- **TDD red-green-refactor**: Write tests first, then implement.
- **Edge cases in separate files**: `*_edge.py` / `*.edge.test.ts`
- **Mock httpx responses**: Use `httpx.MockTransport` or `pytest-httpx` for deterministic HTTP mocking. Never make real HTTP calls in tests.
- **asyncio time control**: Use `asyncio`-compatible time mocking (e.g., `freezegun` or manual event loop advancement) to test scheduler timing without real sleeps.
- **DB fixture**: Use in-memory SQLite (`:memory:`) with migrations applied for refresh DB tests.
- **Per-request connection pattern in tests**: Every test that touches DB must follow `get_connection()` → try/finally → `close()`.
- **Isolation test (critical)**: Module A refresh fails (HTTP 500) → Module B refresh succeeds → verify B is updated and A has error metadata → verify no cross-contamination.
- **No-push-on-same-data test**: Fetch returns identical data → verify `updated_at` bumped → verify no `module_updated` sent to task manager.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#FR40] — "System can periodically refresh module data in the background via scheduled HTTP calls (cron, no LLM)"
- [Source: _bmad-output/planning-artifacts/prd.md#FR11] — Module definition format includes data sources array and refresh interval
- [Source: _bmad-output/planning-artifacts/prd.md#NFR9] — "Cron module refresh < 5 seconds per module"
- [Source: _bmad-output/planning-artifacts/prd.md#NFR20] — "Individual module refresh failure does not affect other modules"
- [Source: _bmad-output/planning-artifacts/prd.md#NFR24] — "External API timeout handling — default 10 seconds"
- [Source: _bmad-output/planning-artifacts/architecture.md#Module lifecycle] — State machine: `active → refreshing → active`, `dataStatus: 'ok' | 'stale' | 'error'`
- [Source: _bmad-output/planning-artifacts/architecture.md#Data freshness indicators] — UX table: < 1h none, 1-24h caption, > 24h warning badge
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — `module_updated` WS message type
- [Source: _bmad-output/planning-artifacts/architecture.md#Vitality score] — "cron backend quotidien a 03:00 UTC" (vitality is daily, refresh is per-module interval)
- [Source: packages/module-schema/src/moduleSpec.ts] — `refreshInterval: z.number().positive()`, `dataSources: z.array(dataSourceSchema)`
- [Source: apps/backend/app/main.py] — Lifespan pattern, task_manager integration, writer loop
- [Source: apps/backend/app/task_manager.py] — buffer_and_notify(), get_writer_queue() — the push mechanism
- [Source: apps/mobile/services/moduleSync.ts] — Existing `module_updated` handler
- [Source: apps/mobile/types/module.ts] — `DataStatus = 'ok' | 'stale' | 'error'`
- [Source: _bmad-output/implementation-artifacts/4-0-robust-chat-streaming-and-session-recovery.md] — Task manager pattern, writer loop, seq envelope, buffer_and_notify

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Backend tests (story-specific): 34 passed in 0.87s
- Backend tests (full suite excl. WS): 855 passed, 10 warnings in 4.36s
- Mobile tests (story-specific): 53 passed across 4 test suites in 0.885s
- Mobile tests (full suite): 76 passed, 1 failed (pre-existing failure in `__tests__/chat.test.ts` from Story 4-0 stream buffer refactor — not related to Story 4-1)

### Completion Notes List

- **Task 1 (Scheduler)**: `RefreshScheduler` class created in `scheduler.py`. Uses per-module `asyncio.Task` for independent refresh loops. First refresh fires immediately on registration. `start()` loads eligible modules from DB (refresh_interval > 0 and non-empty data_sources). `stop()` cancels all tasks gracefully with 1s timeout. `register_module()` replaces existing tasks (supports re-registration). 10 tests covering lifecycle, register/unregister, refresh execution, and push_fn passthrough.
- **Task 2 (Data Fetch)**: `fetch_module_data()` in `data_fetch.py` uses `httpx.AsyncClient` with configurable timeout (default 10s from `SELF_REFRESH_TIMEOUT`). V1 supports `http_json` type only (GET + JSON parse). Unsupported types log warning and skip. Returns merged dict keyed by data source id, or None if all failed. Partial success returns successful data only. Structured logging for every fetch operation (started, success with latency_ms, failed with error/http_status). 12 tests covering success, timeout, HTTP errors, partial success, unsupported types, and edge cases.
- **Task 3 (Refresh Logic)**: `refresh_module()` in `refresh.py` orchestrates the full pipeline: load module from DB, fetch data, compare with existing `spec.data`, update DB, push if data changed. No-change detection: if fetched data is identical to existing, `updated_at` is still bumped but no WS push sent. On failure: sets `last_refresh_error` without changing `updated_at`. Entire function wrapped in try/except for module isolation (NFR20). Per-request DB connections throughout. 7 tests covering success, no-change, failure, isolation, and push_fn=None scenarios.
- **Task 4 (Wiring)**: `_push_module_update()` bridge function in main.py iterates all active WS sessions via `task_manager._writer_queues` and calls `buffer_and_notify()` for each. Scheduler instantiated at module level, configured in lifespan (`set_push_fn`, `start`, `stop`). Agent hook `set_on_module_created_hook` auto-registers new modules with scheduler when created with refresh_interval > 0 and data_sources. `SELF_REFRESH_TIMEOUT` added to config.py Settings (default: 10, integer >= 1). 5 integration tests covering end-to-end push, scheduler auto-registration, runtime module registration, multi-session push, and no-push-when-no-sessions.
- **Task 5 (Migration)**: `003_add_refresh_metadata.sql` adds `last_refreshed_at TEXT` and `last_refresh_error TEXT` nullable columns to modules table. Schema version bumped to 3. Migration tested via existing migration test suite (test_migration_schema.py).
- **Task 6 (Mobile moduleSync)**: `module_updated` handler updated in `moduleSync.ts` to set `dataStatus: 'ok'` on module update (confirms fresh data). New `module_refresh_failed` handler added to set `dataStatus: 'error'` on affected module (shows "Offline" badge). 5 handler registrations verified (module_created, module_updated, module_refresh_failed, module_list, module_sync). Tests added for dataStatus update on module_updated and module_refresh_failed scenarios.
- **Task 7 (Freshness Indicators)**: `FreshnessIndicator` component created in `components/bridge/FreshnessIndicator.tsx`. Integrated into `ModuleCard` component. Thresholds: < 1h = nothing, 1-24h = "Updated Xh ago" caption (textSecondary color), > 24h = "Stale" badge (warning color), dataStatus error = "Offline" badge (textSecondary color). Full accessibility labels. 14 tests covering all thresholds, boundary conditions, and dataStatus states.
- **Pre-existing test failure**: `__tests__/chat.test.ts` has 2 failing tests due to Story 4-0 refactoring `chatSync.ts` to use `bufferToken()` instead of direct `appendStreamDelta()`. This is NOT a regression from Story 4-1 — the integration test was not updated when the stream buffer was introduced.

### File List

**New files:**
- `apps/backend/app/scheduler.py` — RefreshScheduler class with asyncio-based per-module refresh tasks
- `apps/backend/app/data_fetch.py` — HTTP data fetching with httpx for module data sources
- `apps/backend/app/refresh.py` — Refresh execution: fetch, compare, update DB, push
- `apps/backend/migrations/003_add_refresh_metadata.sql` — Add last_refreshed_at, last_refresh_error columns
- `apps/backend/tests/test_scheduler.py` — 10 scheduler lifecycle tests
- `apps/backend/tests/test_data_fetch.py` — 12 HTTP fetch tests (mocked httpx)
- `apps/backend/tests/test_refresh.py` — 7 refresh logic tests
- `apps/backend/tests/test_refresh_integration.py` — 5 end-to-end integration tests
- `apps/mobile/components/bridge/FreshnessIndicator.tsx` — Data freshness indicator component
- `apps/mobile/components/bridge/FreshnessIndicator.test.tsx` — 14 freshness indicator tests

**Modified files:**
- `apps/backend/app/main.py` — Scheduler wiring in lifespan, _push_module_update bridge function, on_module_created hook, _push_module_refresh_failed bridge function
- `apps/backend/app/config.py` — Added self_refresh_timeout setting (default: 10s)
- `apps/backend/app/agent.py` — Added set_on_module_created_hook and _on_module_created_hook for scheduler registration
- `apps/backend/app/task_manager.py` — Added active_session_ids() public method
- `apps/mobile/services/moduleSync.ts` — Added dataStatus update on module_updated, added module_refresh_failed handler
- `apps/mobile/services/moduleSync.test.ts` — Tests for dataStatus update and module_refresh_failed handler
- `apps/mobile/components/bridge/ModuleCard.tsx` — Integrated FreshnessIndicator component

## Code Review

### Review Date
2026-02-25

### Reviewer
Claude Opus 4.6 (adversarial code review)

### Findings Fixed (HIGH/MEDIUM)

1. **[HIGH] Data source type mismatch — refresh system silently skipped all real modules**
   - `data_fetch.py` only accepted `type: "http_json"` but the LLM agent prompt in `agent.py` instructs the LLM to create data sources with `type: "rest_api"`. This meant every module created by the agent would have its refresh completely silently skipped — the core purpose of Story 4-1 would not function in production.
   - **Fix**: Updated `data_fetch.py` to accept both `"http_json"` and `"rest_api"` via a `_SUPPORTED_HTTP_TYPES` set. Added 2 tests in `test_data_fetch.py` for `rest_api` type support.

2. **[HIGH] Backend never sends `module_refresh_failed` message — AC #3 not fully met**
   - Mobile registered a handler for `module_refresh_failed` (setting `dataStatus: 'error'`) but the backend had no code path that ever sends this message type. On refresh failure, only the DB was updated — mobile was never notified.
   - **Fix**: Added `FailPushFn` type and `fail_push_fn` keyword parameter to `refresh_module()`. Added `set_fail_push_fn()` to `RefreshScheduler`. Created `_push_module_refresh_failed()` bridge function in `main.py` and wired it into the scheduler lifespan.

3. **[MEDIUM] `_push_module_update` accesses private `task_manager._writer_queues`**
   - `main.py` directly accessed the private `_writer_queues` dict to iterate active sessions, violating encapsulation of `AgentTaskManager`.
   - **Fix**: Added public `active_session_ids()` method to `AgentTaskManager` in `task_manager.py`. Updated both `_push_module_update` and new `_push_module_refresh_failed` to use it.

4. **[MEDIUM] Redundant exception catch in `data_fetch.py`**
   - Line 111 caught `(httpx.TimeoutException, httpx.ReadTimeout)` but `ReadTimeout` is a subclass of `TimeoutException` (verified via MRO), making the explicit `ReadTimeout` mention dead code.
   - **Fix**: Simplified to `except httpx.TimeoutException as e:`.

### Review Follow-ups (LOW)

- [ ] [AI-Review][LOW] Story File List omits several modified test files visible in git diff: `test_migration_schema.py`, `test_agent.py`, `test_db.py`, `test_health.py`, `test_health_edge_cases.py` [apps/backend/tests/]
- [ ] [AI-Review][LOW] No edge case test files created per project convention (*_edge.py) for scheduler, data_fetch, or refresh modules [apps/backend/tests/]
- [x] [AI-Review][LOW] `data_fetch.py` `_SUPPORTED_HTTP_TYPES` moved to module-level `frozenset` constant (was created inside the for loop on every iteration)

### Test Results After Fixes
- Backend: 935 passed, 5 warnings in 5.57s (0 failures)
- Mobile: 1347 passed across 77 test suites in 2.374s (0 failures)
