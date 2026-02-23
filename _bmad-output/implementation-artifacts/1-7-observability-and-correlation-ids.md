# Story 1.7: Observability & Correlation IDs

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer (or AI dev agent),
I want every request to carry a correlation ID through the entire mobile → backend → LLM pipeline, with structured logging of WebSocket messages, SQL queries, and LLM call metrics,
So that I can reconstruct the full timeline of any interaction from a single ID using `docker logs` and `jq`.

## Acceptance Criteria

1. **Given** the mobile app sends any WebSocket message **When** the message is constructed **Then** a `request_id` field (UUID v4) is injected into every outgoing `payload` **And** the `request_id` is logged on mobile side with the message type

2. **Given** the backend receives a WebSocket message with a `request_id` **When** the message is processed **Then** all subsequent log entries for that request include the `request_id` via structlog context binding **And** the response message(s) back to mobile include the same `request_id` in their payload

3. **Given** any backend function executes a SQL query **When** the query runs **Then** the query text (first 200 chars), parameter count, row count, and execution time (ms) are logged at DEBUG level **And** queries exceeding 100ms are logged at WARN level with `agent_action`

4. **Given** an LLM provider completes a call (success or failure) **When** the LLMResult is returned **Then** a `llm_call_completed` log entry is emitted with: provider, model, tokens_in, tokens_out, latency_ms, cost_estimate, and `request_id` **And** the data is inserted into the `llm_usage` table

5. **Given** the backend sends any WebSocket message to the mobile **When** the message is serialized **Then** the message type, payload size (bytes), and `request_id` (if present) are logged at DEBUG level

6. **Given** the backend receives any WebSocket message from the mobile **When** the message is parsed **Then** the message type, payload size (bytes), and `request_id` are logged at DEBUG level **And** parse failures include the raw data (first 500 chars) with `agent_action`

7. **Given** a developer runs `docker logs self-backend | jq 'select(.request_id == "some-uuid")'` **When** filtering by a specific request_id **Then** all log entries for that request appear in chronological order: message received → auth check → DB queries → LLM call → response sent

8. **Given** the mobile receives a response with a `request_id` **When** the response is logged **Then** the mobile logger includes the `request_id` in the log entry **And** round-trip time (from send to receive) is calculated and logged

## Tasks / Subtasks

- [ ] Task 1: Create correlation ID utilities (AC: #1, #2)
  - [ ] 1.1 Create `apps/mobile/utils/requestId.ts` — `generateRequestId(): string` using `crypto.randomUUID()`
  - [ ] 1.2 Update `apps/mobile/services/wsClient.ts` — inject `request_id` into every outgoing message payload before `JSON.stringify`
  - [ ] 1.3 Store `{ request_id, sent_at }` in a Map for round-trip timing (max 100 entries, LRU eviction)
  - [ ] 1.4 On message received: if payload contains `request_id`, compute round-trip ms from stored Map, log it
  - [ ] 1.5 Log outgoing messages at debug level: type, request_id, payload size

- [ ] Task 2: Backend correlation context binding (AC: #2, #5, #6)
  - [ ] 2.1 Update `apps/backend/app/main.py` — after parsing each WS message, extract `request_id` from payload (or generate one if missing for backward compatibility)
  - [ ] 2.2 Use `structlog.contextvars.bind_contextvars(request_id=request_id)` to bind request_id for the duration of message processing
  - [ ] 2.3 Call `structlog.contextvars.unbind_contextvars("request_id")` after processing completes (or use try/finally)
  - [ ] 2.4 Log every incoming WS message: type, payload size (bytes), request_id at DEBUG level
  - [ ] 2.5 Log every outgoing WS message: type, payload size (bytes), request_id at DEBUG level
  - [ ] 2.6 Inject `request_id` into outgoing response payloads when the original message had one

- [ ] Task 3: SQL query logging with timing (AC: #3)
  - [ ] 3.1 Create `apps/backend/app/db_logging.py` — a thin wrapper around `aiosqlite` connections
  - [ ] 3.2 Implement `logged_execute(conn, query, params=None)` — wraps `conn.execute()` with timing (monotonic clock), logs: query (truncated 200 chars), param_count, duration_ms, row_count at DEBUG level
  - [ ] 3.3 Add WARN-level logging for queries > 100ms with `agent_action: "Slow query detected. Consider adding index or optimizing."`
  - [ ] 3.4 Update `apps/backend/app/db.py` `get_connection()` to return a connection that uses `logged_execute` when `SELF_LOG_LEVEL=debug`
  - [ ] 3.5 Update `apps/backend/app/sessions.py` — replace direct `conn.execute()` calls with `logged_execute` for query observability
  - [ ] 3.6 Update `apps/backend/app/main.py` sync handler — replace direct `conn.execute()` calls with `logged_execute`

- [ ] Task 4: LLM call completion logging and usage tracking (AC: #4)
  - [ ] 4.1 Update `apps/backend/app/llm/base.py` `_call_with_retry()` — after a successful call, emit `llm_call_completed` log with: provider, model, tokens_in, tokens_out, latency_ms, cost_estimate, request_id
  - [ ] 4.2 After logging, insert usage record into `llm_usage` table: provider, model, tokens_in, tokens_out, cost_estimate, created_at
  - [ ] 4.3 On failure (after retries exhausted), emit `llm_call_failed` log with same fields plus error and agent_action
  - [ ] 4.4 Ensure request_id flows from the WS message context into the LLM call via structlog contextvars

- [ ] Task 5: Update structlog configuration (AC: #2, #7)
  - [ ] 5.1 Update `apps/backend/app/logging.py` — add `structlog.contextvars.merge_contextvars` to the processor chain (before JSONRenderer)
  - [ ] 5.2 This ensures `request_id` bound via `bind_contextvars()` appears in ALL log entries automatically
  - [ ] 5.3 Add `structlog.processors.CallsiteParameterAdder` (with module and function) for better debugging at DEBUG level only

- [ ] Task 6: Backend tests for correlation IDs (AC: #2, #5, #6, #7)
  - [ ] 6.1 Create `apps/backend/tests/test_correlation.py`
  - [ ] 6.2 Test: WS message with request_id → all log entries include request_id
  - [ ] 6.3 Test: WS message without request_id → request_id is auto-generated
  - [ ] 6.4 Test: response message includes same request_id as request
  - [ ] 6.5 Test: request_id is unbound after message processing (no leak to next message)

- [ ] Task 7: Backend tests for SQL logging (AC: #3)
  - [ ] 7.1 Create `apps/backend/tests/test_db_logging.py`
  - [ ] 7.2 Test: `logged_execute` logs query, param_count, duration_ms, row_count
  - [ ] 7.3 Test: slow query (simulated) triggers WARN level with agent_action
  - [ ] 7.4 Test: query text is truncated at 200 chars

- [ ] Task 8: Backend tests for LLM usage logging (AC: #4)
  - [ ] 8.1 Update `apps/backend/tests/test_llm.py` or create `test_llm_logging.py`
  - [ ] 8.2 Test: successful LLM call emits `llm_call_completed` log with all fields
  - [ ] 8.3 Test: failed LLM call emits `llm_call_failed` log with error and agent_action
  - [ ] 8.4 Test: usage record inserted into `llm_usage` table with correct values

- [ ] Task 9: Mobile tests for correlation IDs (AC: #1, #8)
  - [ ] 9.1 Create `apps/mobile/utils/requestId.test.ts`
  - [ ] 9.2 Test: `generateRequestId()` returns valid UUID v4
  - [ ] 9.3 Update `apps/mobile/services/wsClient.test.ts` — test request_id injection in outgoing messages
  - [ ] 9.4 Test: round-trip timing computed when response contains request_id
  - [ ] 9.5 Test: LRU eviction of timing entries after 100 entries

- [ ] Task 10: Verify end-to-end correlation (AC: #7)
  - [ ] 10.1 Create `apps/backend/tests/test_correlation_e2e.py` — integration test
  - [ ] 10.2 Test: send chat message with request_id → receive auth check log → DB query logs → response with same request_id
  - [ ] 10.3 Test: filter by request_id gives complete request timeline

## Dev Notes

### Architecture Compliance (MANDATORY)

This story adds observability infrastructure to the existing codebase without changing any business logic. It complements the AI-First Observability architecture by filling the identified gaps in cross-request tracing and query-level visibility.

**Critical architecture patterns to follow:**

1. **structlog contextvars for correlation:** Use `structlog.contextvars.bind_contextvars()` / `unbind_contextvars()` — this is the idiomatic structlog approach. The `merge_contextvars` processor must be added to the chain. This ensures ALL log entries within a request context automatically include `request_id` without modifying every single log call.

2. **Agent_action on every error/warning:** All new error and warning logs MUST include `agent_action` field per architecture mandate. Example: `agent_action: "Slow query detected (>100ms). Check query plan or add index on referenced columns."`

3. **DEBUG level for high-volume logs:** WS message logging and SQL query logging produce high volume. These MUST be at DEBUG level by default. Only anomalies (slow queries > 100ms) escalate to WARN. The existing `SELF_LOG_LEVEL` config controls this — no new config needed.

4. **No new message types on WebSocket:** `request_id` is added to existing payload objects, NOT as a new message type. The architecture says 15 message types — do not add a 16th.

5. **request_id is optional on incoming messages:** The backend must handle messages without `request_id` (backward compatibility during transition). Generate a UUID server-side if missing.

6. **Per-request DB connections (NOT session-scoped):** Follow the fix(1-5) pattern. Each `logged_execute` operates on a connection obtained per-request via `get_connection()`. Do NOT create a session-scoped connection wrapper.

7. **Async-only Python:** `logged_execute` must be async. Use `time.monotonic()` for timing (not `time.time()`). No synchronous blocking.

8. **flat backend structure:** `db_logging.py` goes in `apps/backend/app/` (flat, no sub-directories). Do NOT create an `observability/` or `logging/` sub-package.

### WebSocket Message Mutation Pattern

The `request_id` injection on mobile must happen at the lowest level — in `wsClient.ts`'s `send()` function — so that ALL outgoing messages automatically get a `request_id`. This avoids modifying every callsite.

```typescript
// In wsClient.ts send():
const send = (msg: WSMessage) => {
  const requestId = generateRequestId();
  const enrichedMsg = {
    ...msg,
    payload: { ...msg.payload, request_id: requestId }
  };
  pendingTimings.set(requestId, performance.now());
  // ... existing send logic with enrichedMsg
};
```

On the backend, extract `request_id` early in the message loop:

```python
# In websocket_endpoint():
request_id = payload.get("request_id") or str(uuid.uuid4())
structlog.contextvars.bind_contextvars(request_id=request_id)
try:
    # ... message routing (existing code)
finally:
    structlog.contextvars.unbind_contextvars("request_id")
```

### SQL Logging Pattern

The `logged_execute` wrapper is intentionally thin — it wraps `conn.execute()` with timing but does NOT change the return type. This allows drop-in replacement:

```python
# Before: await conn.execute("SELECT ...", params)
# After:  await logged_execute(conn, "SELECT ...", params)
```

This is NOT a middleware or connection proxy — it's a simple function wrapper. The connection lifecycle remains unchanged.

### LLM Usage Tracking

The `llm_usage` table already exists in `001_init.sql` but is currently NOT populated. This story starts populating it after every LLM call. The INSERT happens in `_call_with_retry()` after receiving a successful `LLMResult`.

### What NOT To Do

- Do NOT add a REST endpoint for logs or metrics — WebSocket is the only communication channel
- Do NOT implement distributed tracing (OpenTelemetry, Jaeger) — overkill for single-user self-hosted
- Do NOT create a logging dashboard UI — this is backend-only observability
- Do NOT modify existing WS message type definitions in `types/ws.ts` — request_id is an optional payload field, not a type change
- Do NOT add any npm dependencies for logging — use built-in crypto.randomUUID() and performance.now()
- Do NOT add any Python dependencies — structlog.contextvars is built into structlog
- Do NOT log full message payloads at INFO level — only at DEBUG to avoid log spam
- Do NOT log sensitive data (session tokens, API keys) — only log request_id, message types, and sizes
- Do NOT create an `observability/` sub-package — keep flat structure per architecture
- Do NOT break any existing tests (994 as of story 1.6: 454 mobile + 540 backend)
- Do NOT change existing log call signatures — only ADD new log calls and the correlation context
- Do NOT implement the store debug API (Zustand inspection) — that's a separate story scope

### Previous Story Intelligence

**From Story 1.6 (Session Authentication & Mobile-Backend Pairing — done):**
- `wsClient.ts` has auth message injection on connect — correlation ID injection follows same pattern (inject before send)
- `sessions.py` uses per-request DB connections — `logged_execute` wraps these same calls
- `main.py` auth gate wraps all message handling — correlation binding goes INSIDE the auth gate (after auth, before routing)
- `PairingScreen.tsx` and `authStore.ts` are NOT modified by this story
- 994 tests total (454 mobile + 540 backend) — zero regressions expected
- Edge case test files exist for auth — similar pattern for correlation edge cases

**From Story 1.5 (Offline Message Queue — done):**
- `localDb.ts` already has comprehensive error logging with agent_action — good pattern to follow
- `moduleSync.ts` logs module events — these will automatically get request_id from WS client injection
- Message queue persistence in SQLite — logged_execute should cover these queries too

**From Story 1.3 (LLM Provider Abstraction — done):**
- `LLMResult` dataclass in `base.py` already captures tokens_in, tokens_out, latency_ms, cost_estimate
- `_call_with_retry()` is the single point where all LLM calls complete — perfect place to add logging + usage tracking
- Circuit breaker logs already include agent_action — consistent pattern

**Key Code Review Follow-ups from 1.6 (still relevant):**
- `isSessionConfigured()` returns true for empty strings — not this story's scope
- `auth_reset` doesn't return new token to mobile — not this story's scope

### Target File Structure After This Story

```
apps/mobile/
├── utils/
│   ├── requestId.ts          # NEW — generateRequestId() + timing Map
│   ├── requestId.test.ts     # NEW — tests
│   ├── toCamel.ts            # EXISTS (unchanged)
│   └── toSnake.ts            # EXISTS (unchanged)
├── services/
│   ├── wsClient.ts           # MODIFY — request_id injection, round-trip timing, message logging
│   ├── wsClient.test.ts      # MODIFY — add correlation tests
│   └── (other services unchanged)
└── (rest unchanged)

apps/backend/
├── app/
│   ├── main.py               # MODIFY — correlation context binding, WS message logging
│   ├── logging.py            # MODIFY — add merge_contextvars processor
│   ├── db.py                 # MODIFY — optional logged_execute integration
│   ├── db_logging.py         # NEW — logged_execute wrapper with timing
│   ├── sessions.py           # MODIFY — use logged_execute
│   ├── llm/
│   │   ├── base.py           # MODIFY — llm_call_completed logging + llm_usage INSERT
│   │   └── (providers unchanged)
│   └── (other files unchanged)
└── tests/
    ├── test_correlation.py   # NEW — correlation ID propagation tests
    ├── test_correlation_e2e.py # NEW — end-to-end correlation test
    ├── test_db_logging.py    # NEW — SQL logging tests
    ├── test_llm_logging.py   # NEW — LLM usage logging tests (or in test_llm.py)
    └── (existing tests unchanged)
```

### References

- [Source: architecture.md#AI-First Observability] — 3-stream unified logging, agent_action convention, structured JSON (lines 238-299)
- [Source: architecture.md#Error Format Contract] — error payload with code, message, agent_action (lines 967-980)
- [Source: architecture.md#Consistency Pattern 7 — Process Patterns] — error handling, status enums (lines 1053-1093)
- [Source: architecture.md#Consistency Pattern 4 — Async-Only Python] — no sync blocking (lines 943-954)
- [Source: architecture.md#Consistency Pattern 3 — Structure Patterns] — flat backend, llm/ exception (lines 872-941)
- [Source: architecture.md#Database Schema] — llm_usage table columns (lines 367-375)
- [Source: architecture.md#WebSocket Protocol] — 15 message types, payload format (lines 416-454)
- [Source: architecture.md#Naming Conventions] — snake_case JSON, camelCase TS (lines 803-832)
- [Source: epics.md#Epic 1] — Project Bootstrap & Developer Connection scope (lines 311-314)
- [Source: story 1-6] — Auth gate pattern, per-request DB, 994 tests baseline
- [Source: story 1-5] — localDb.ts logging patterns, moduleSync event logging
- [Source: story 1-3] — LLMResult dataclass, _call_with_retry(), circuit breaker logging

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
