# Story 3.4: Module Creation End-to-End (Request -> Discovery -> Definition -> Render)

Status: done

## Story

As a user,
I want to describe a need in natural language and get a working native module on my phone,
So that I go from idea to result in a single conversation. (FR9, FR10, FR11, FR28)

## Acceptance Criteria

1. **Given** the chat interface, **When** the user describes a need (e.g., "I want to track the weather"), **Then** the agent identifies the request as a module creation intent (FR9) **And** the user sees acknowledgment that creation has started (status message: `thinking` -> `discovering` -> `composing`).

2. **Given** a module creation intent, **When** the agent searches for relevant data sources, **Then** it discovers APIs matching the user's request (FR10) — the LLM prompt instructs the agent to find publicly available APIs and construct a valid data source configuration.

3. **Given** discovered APIs, **When** the agent creates the module definition, **Then** the definition follows the `moduleSpecSchema` from `@self/module-schema` with all required fields (FR11): `id` (UUID v4), `name`, `type`, `template`, `dataSources`, `refreshInterval`, `schemaVersion`, `accessibleLabel` **And** it passes Zod validation **And** it passes Pydantic validation on the backend.

4. **Given** a completed module definition, **When** it is sent to the mobile app via `{ type: 'module_created', payload: spec }`, **Then** it renders correctly using the SDUI pipeline from Story 3.3 (ModuleList -> ModuleCard -> template resolution -> getPrimitive).

5. **Given** a module with a refresh schedule, **When** the definition is created, **Then** it includes a `refreshInterval` appropriate for the data type (FR28) — weather: 3600s, stock: 300s, news: 1800s as reasonable defaults.

6. **Given** the end-to-end creation pipeline, **When** measured from user request to module visible, **Then** the total time is under 60 seconds for First Light (NFR4).

7. **Given** a module creation attempt, **When** the LLM fails to produce valid JSON or the validation fails, **Then** the backend sends a structured error `{ type: 'error', payload: { code: 'MODULE_CREATION_FAILED', message: '...', agent_action: '...' } }` (NFR22) **And** the user sees a friendly error message in the chat.

8. **Given** a successfully created module, **When** the backend persists it, **Then** the module is saved to the `modules` table in SQLite with all fields (id, name, spec JSON, status, created_at, updated_at) **And** subsequent sync requests include the new module.

9. **Given** agent status transitions during module creation, **When** the backend processes the creation, **Then** it sends `status` messages in order: `{ state: 'thinking' }` -> `{ state: 'discovering' }` -> `{ state: 'composing' }` -> module_created -> `{ state: 'idle' }` so the mobile can animate the Orb accordingly.

10. **Given** an existing chat conversation, **When** the user sends a module creation request, **Then** the agent's chat response acknowledges the creation intent before starting the pipeline (e.g., "I'll create a weather module for you. Let me find the right data sources...") — the user never faces silence.

## Tasks / Subtasks

- [x] **Task 1: Create `modules.py` — Module CRUD on the backend** (AC: #3, #8)
  - [x] 1.1 Create `apps/backend/app/modules.py` with `async def create_module(db_path: str, name: str, spec: dict) -> dict` — generates UUID v4 `id`, sets `status='active'`, `created_at`/`updated_at` to ISO 8601 UTC, serializes `spec` as JSON TEXT, inserts into `modules` table, returns the full row as dict with `id`, `name`, `spec` (parsed), `status`, `created_at`, `updated_at`
  - [x] 1.2 Add `async def get_module(db_path: str, module_id: str) -> dict | None` — SELECT by id, parse spec JSON
  - [x] 1.3 Add `async def list_modules(db_path: str) -> list[dict]` — SELECT all ordered by updated_at DESC, parse spec JSON for each
  - [x] 1.4 Use per-request DB connections (pattern from `agent.py`'s `_log_llm_usage`): `db = await get_connection(db_path)` with `try/finally: await db.close()`
  - [x] 1.5 All functions use `app.logging.log` with structured events: `module_created`, `module_get`, `module_list_fetched`
  - [x] 1.6 Write `tests/test_modules.py`: create returns valid dict with all fields, get returns None for missing, list returns empty then populated, spec is valid JSON round-trip, duplicate id raises error (~10 tests)

- [x] **Task 2: Implement intent detection and module creation prompt in `agent.py`** (AC: #1, #2, #3, #5, #9, #10)
  - [x] 2.1 Add `async def _handle_module_creation(ws, result, module_spec, db_path) -> None` to `agent.py` — the orchestration function for module creation
  - [x] 2.2 Modify `handle_chat` to detect module creation intent: the LLM prompt includes system instruction; response JSON code fence triggers module creation pipeline
  - [x] 2.3 Implement the prompt assembly for module creation via `_build_module_prompt()`:
    - System prompt: "You are Self, an AI agent that creates native mobile modules..."
    - Include the module spec schema requirements inline with snake_case field names
    - Include example of valid module spec for weather module
  - [x] 2.4 Parse LLM response: `_extract_module_spec()` / `_try_extract_module_spec()` extract JSON block from markdown code fence, validate structure (must have required fields), fall back to chat-only response if no JSON found
  - [x] 2.5 Send granular status updates during creation: `status:thinking` (before LLM call), `status:discovering` (after receiving LLM response, before validation), `status:composing` (during DB save), then `module_created` payload, then `status:idle`
  - [x] 2.6 Send the conversational text portion as `chat_stream` (before the module_created message) so the user sees the agent's acknowledgment
  - [x] 2.7 On validation failure (JSON code fence found but invalid): send `{ type: 'error', payload: { code: 'MODULE_CREATION_FAILED', message: 'Module spec validation failed: <details>', agent_action: '...' } }`
  - [x] 2.8 Write `tests/test_agent.py` additions: 15 new tests for _extract_module_spec, _build_module_prompt, module creation flow (valid/invalid JSON, status sequence, chat+module_created, snake_case keys, regular chat still works)

- [x] **Task 3: Update `main.py` message routing for module creation** (AC: #1, #4, #7)
  - [x] 3.1 Verified: `websocket_endpoint` already routes `chat` to `agent.handle_chat` — module creation detection happens INSIDE `handle_chat` / `_handle_module_creation`. No changes to main.py needed.
  - [x] 3.2 `_handle_module_creation` in agent.py sends `{ type: 'module_created', payload: spec }` with snake_case keys including server-generated `module_id`
  - [x] 3.3 Verified: `_handle_sync` and `_parse_module_rows` continue to work correctly — newly created modules appear in sync responses (tested in E2E)
  - [x] 3.4 Write `tests/test_ws.py` additions: 5 new tests — TestModuleCreationViaChat class with tests for module_created trigger, format, status sequence, sync inclusion, chat_stream ordering

- [x] **Task 4: Mobile — handle `module_created` and status transitions in the creation flow** (AC: #4, #9)
  - [x] 4.1 Verified: `moduleSync.ts` already handles `module_created` -> `moduleStore.addModule(spec)`. No changes needed.
  - [x] 4.2 Verified: `chatSync.ts` already handles `status` messages -> `chatStore.setAgentStatus()`. AgentState in `types/ws.ts` already includes `'discovering' | 'composing'`. No changes needed.
  - [x] 4.3 Verified: `chatSync.ts` handles `chat_stream` for the conversational acknowledgment part. No changes needed.
  - [x] 4.4 Extended existing `moduleSync.test.ts` with 3 new integration tests: module_created with full spec adds module with all fields, module_created + module_list sync keeps module, multiple module_created messages add distinct modules

- [x] **Task 5: End-to-end integration test** (AC: #1, #2, #3, #4, #6, #7, #8, #9, #10)
  - [x] 5.1 Created `apps/backend/tests/test_module_creation_e2e.py`: 12 tests covering full flow (chat -> LLM -> parse -> validate -> save -> module_created), status sequence (thinking -> discovering -> composing -> idle), payload structure, DB persistence, chat_stream ordering
  - [x] 5.2 Tested error path: invalid JSON from LLM sends MODULE_CREATION_FAILED error, status returns to idle, no module saved to DB
  - [x] 5.3 Tested module appears in sync: full sync and delta sync both include newly created module
  - [x] 5.4 Backend tests: 612 passed (0 regressions, excluding pre-existing test_module_schema.py import error)
  - [x] 5.5 Mobile tests: 1035 passed (26 pre-existing ChatInput.edge.test.tsx failures from SafeAreaProvider — not related to our changes). 3 new moduleSync integration tests pass. 152 module-schema tests pass.

## Dev Notes

### Architecture Patterns and Constraints

**Module Creation Flow (from architecture — THE critical data flow):**
```
User types "Show me the weather"
  -> ChatInput -> wsClient.send({ type: 'chat', payload: { message: '...' } })
  -> Backend main.py receives, routes to agent.py handle_chat()
  -> agent.py detects module creation intent in LLM response
  -> agent.py sends status:thinking, then calls provider.execute(prompt)
  -> LLM returns text + module spec JSON
  -> agent.py sends status:discovering, parses JSON from response
  -> agent.py validates spec against required fields
  -> agent.py sends status:composing
  -> modules.py saves to self.db (modules table)
  -> agent.py logs LLM usage to llm_usage table
  -> main.py sends { type: 'module_created', payload: spec }
  -> Mobile wsClient receives, toCamel() converts
  -> moduleStore.addModule(spec) via moduleSync.ts handler
  -> ModuleCard renders via pipeline (template -> getPrimitive)
  -> agent.py sends status:idle
```

**CRITICAL: Module creation happens within `handle_chat`, not as a separate message type.** The user sends `{ type: 'chat', payload: { message: '...' } }`. The agent detects the intent from the LLM response and branches into the module creation pipeline. There is NO separate `module_create` client-to-server message type in the architecture.

**Agent Status State Machine (from architecture):**
```
AgentState = 'idle' | 'thinking' | 'discovering' | 'composing'
```
The Orb on mobile animates based on these states. `chatSync.ts` already handles `status` messages and updates `chatStore.agentStatus`. The creation ceremony animation (Epic 6, Story 6.3) is NOT in scope for this story — but the status messages that drive it ARE.

**Backend Boundaries (CRITICAL):**
- `main.py` is the ONLY file that touches WebSocket directly — `agent.py` receives `ws: WebSocket` as a parameter
- `agent.py` orchestrates — it calls `llm/` and will now call `modules.py`
- `modules.py` handles module CRUD — it calls `db.py` for connections
- `llm/` is isolated behind the Protocol — zero knowledge of modules

**LLM Prompt Strategy (First Light):**
The current `handle_chat` sends the user's message as the raw prompt to `provider.execute(prompt=message)`. For module creation, the prompt needs a system instruction that tells the LLM to:
1. Understand when a request is for a module (data tracking, monitoring, info display)
2. Respond with conversational text AND a JSON module spec code block
3. Follow the exact schema format

The First Light approach is to include the schema requirements + examples directly in the prompt string (no tool/function calling). The LLM outputs a markdown response with a JSON code block. `agent.py` extracts the JSON, validates it, and proceeds with creation. If no JSON block is found, it's a regular chat response.

**Module Spec on the Wire (snake_case):**
The module spec sent via `module_created` must be `snake_case` on the wire (architecture convention). The LLM should output snake_case field names (module_id, data_sources, refresh_interval, schema_version, accessible_label). The backend stores the spec as-is in the `modules.spec` JSON column. The mobile's `toCamel()` converts on receipt.

Wait — **IMPORTANT NUANCE**: The Zod schema in `packages/module-schema/src/moduleSpec.ts` uses camelCase (`dataSources`, `refreshInterval`, `schemaVersion`, `accessibleLabel`). The `modules` table stores `spec` as a JSON TEXT blob. The backend sends the spec over WS. The mobile `toCamel()` converts keys.

The cleanest approach for the backend:
1. LLM outputs JSON with the fields (case doesn't matter — we normalize)
2. Backend validates the required fields exist
3. Backend stores in DB as snake_case JSON (consistent with SQLite convention)
4. Backend sends over WS as snake_case (architecture rule: WS = snake_case)
5. Mobile `toCamel()` converts to camelCase for TypeScript consumption

**The `module_id` field:** Architecture says UUIDs are always generated server-side. The LLM should NOT generate the UUID. `modules.py` creates it. The LLM generates all other fields.

### Module Spec Shape (what the LLM must produce)

```json
{
  "name": "Paris Weather",
  "type": "metric",
  "template": "metric-dashboard",
  "data_sources": [
    {
      "id": "openmeteo-paris",
      "type": "rest_api",
      "config": {
        "url": "https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current=temperature_2m,wind_speed_10m",
        "method": "GET"
      }
    }
  ],
  "refresh_interval": 3600,
  "schema_version": 1,
  "accessible_label": "Paris weather forecast showing current temperature and wind speed"
}
```

The backend then adds: `id` (UUID v4), `status` ('active'), `created_at`, `updated_at`. The full spec stored in `modules.spec` column includes ALL fields.

### snake_case / camelCase Convention (CRITICAL - #1 bug source from Epic 1)

- **Wire format (WebSocket JSON):** `snake_case` — `module_id`, `data_sources`, `refresh_interval`
- **TypeScript code and Zod schemas:** `camelCase` — `moduleId`, `dataSources`, `refreshInterval`
- **Python code and DB columns:** `snake_case` — `module_id`, `data_sources`
- **Conversion point:** ONLY in `wsClient.ts`'s `toCamel()` — mobile always receives camelCase
- The LLM prompt should instruct output in `snake_case` to match the wire format

### Existing Code to Reuse — DO NOT RECREATE

**Backend:**
- **`agent.py`** — `apps/backend/app/agent.py` — MODIFY to add module creation logic
- **`main.py`** — `apps/backend/app/main.py` — the `_handle_sync` and `_parse_module_rows` functions already read from the `modules` table. The `websocket_endpoint` routes `chat` to `agent.handle_chat`. MINIMAL changes needed.
- **`db.py`** — `apps/backend/app/db.py` — `get_connection(db_path)` for per-request DB connections
- **`llm/base.py`** — `apps/backend/app/llm/base.py` — `LLMProvider` Protocol and `LLMResult` dataclass
- **`llm/__init__.py`** — `apps/backend/app/llm/__init__.py` — `get_provider()` factory
- **`config.py`** — `apps/backend/app/config.py` — `settings.db_path`
- **`logging.py`** — `apps/backend/app/logging.py` — `log` instance
- **`001_init.sql`** — `modules` table already exists with correct schema. NO migration needed.

**Mobile (NO changes expected — verify only):**
- **`moduleSync.ts`** — already handles `module_created` -> `moduleStore.addModule(spec)`
- **`chatSync.ts`** — already handles `status` -> `chatStore.setAgentStatus()` and `chat_stream`
- **`wsClient.ts`** — already handles message routing, toCamel conversion
- **`moduleStore.ts`** — `addModule(spec, updatedAt)` already works
- **`chatStore.ts`** — `setAgentStatus`, `startAgentStream`, `appendStreamDelta`, `finalizeAgentMessage` already work
- **`ModuleCard.tsx`** — template-aware rendering pipeline already works (from 3.3)
- **`templates.ts`** — template registry with 3 First Light templates already works
- **`registry.ts`** — primitive registry with 7 types already works

### What DOES NOT Exist Yet and Must Be Created

1. **`apps/backend/app/modules.py`** — Module CRUD operations (create, get, list). Architecture lists this file but it was not implemented in any prior story because no story needed to write to the `modules` table. Stories 3.1-3.3 worked entirely on the mobile side. The `modules` table exists (from 001_init.sql) but no Python code writes to it yet.

2. **Module creation logic in `agent.py`** — Currently `handle_chat` just passes the raw message to `provider.execute()` and streams the text response back. It does NOT detect module creation intent, parse JSON from responses, validate specs, or trigger module persistence. ALL of this is new.

3. **`apps/backend/tests/test_modules.py`** — Tests for the new modules.py CRUD operations.

### Testing Strategy

**Backend tests (pytest):**
- `test_modules.py`: Unit tests for modules.py CRUD — in-memory SQLite, test create/get/list
- `test_agent.py` additions: Mock LLM provider returning scripted responses (valid JSON, invalid JSON, chat-only), verify WS messages sent in correct order
- `test_module_creation_e2e.py`: Full integration test using the FastAPI test client with WebSocket, mock LLM provider

**Mobile tests (Jest):**
- Mostly VERIFICATION that existing handlers work (moduleSync, chatSync, status transitions)
- The mobile side should "just work" because the infrastructure from 3.3 + 2.1 handles all the message types
- Add targeted integration tests to verify the full message flow

**TDD approach:** Red-green-refactor, same pattern as stories 3.1-3.3. Write test first, implement to pass, refactor.

### Async-Only Python Rule (CRITICAL)

All new code in `modules.py` and `agent.py` MUST be `async`. Use `aiosqlite` via `get_connection()`. Never use `sqlite3`, `requests`, `subprocess.run()`, or `time.sleep()`. The backend is fully async (FastAPI) — any sync blocking call freezes the event loop and blocks ALL WebSocket connections.

### Error Handling Pattern

Backend Python — always log before sending error to client:
```python
log.error("module_creation_failed",
    module_name=name,
    error=str(e),
    agent_action="Check LLM output format. Run 'docker logs self-backend --tail 50' for details")
await ws.send_json({
    "type": "error",
    "payload": {"code": "MODULE_CREATION_FAILED", "message": str(e), "agent_action": "..."}
})
```

Never `catch (e) {}` empty. Never `console.log(e)` without structure. Everything goes through the structured logger with `agent_action`.

### Performance Budget (NFR4)

Fresh module creation end-to-end < 60 seconds (First Light). This includes:
- User sends message (~0ms)
- WS delivery to backend (~50ms)
- Agent prompt assembly (~5ms)
- LLM call via CLI (~10-45s — the bottleneck)
- JSON parsing + validation (~10ms)
- DB insert (~5ms)
- WS delivery to mobile (~50ms)
- Module rendering (<100ms per NFR3)

The LLM call is ~95% of the total time. The code cannot optimize this — it depends on the LLM provider speed. The architecture accepts this for First Light.

### Anti-Patterns to Avoid

1. **Do NOT create a separate WS message type for module creation** — The user sends `{ type: 'chat' }` and the agent internally decides to create a module based on the LLM response. No `module_create` client message exists in the architecture.
2. **Do NOT modify `wsClient.ts`, `moduleSync.ts`, `chatSync.ts`, or any mobile service** — They already handle all the message types needed. This story is primarily backend work.
3. **Do NOT modify SDUI primitives or templates** — The rendering pipeline is complete from 3.3.
4. **Do NOT implement the Creation Ceremony animation** — That's Story 6.3 in Epic 6. This story sends the status messages that DRIVE the ceremony, but the visual animation is out of scope.
5. **Do NOT implement memory or context** — The agent does not yet use SOUL.md, persona files, or memory for prompt assembly. That's Epic 5. For now, the prompt is self-contained with schema instructions + user message.
6. **Do NOT implement retry logic for failed module creation** — If the LLM output is invalid, send error and let the user try again. Semi-automatic fallback is FR12 (MVP).
7. **Do NOT generate UUIDs on the mobile** — Architecture says UUIDs are always generated server-side. `modules.py` creates the `id`.
8. **Do NOT add new dependencies** — All needed libraries are already installed (aiosqlite, FastAPI, Pydantic, Zod).
9. **Do NOT modify the `modules` table schema** — `001_init.sql` already has the correct schema. No new migration needed.
10. **Do NOT hardcode API URLs in the backend** — The LLM discovers APIs dynamically. The spec's `dataSources[].config.url` comes from the LLM output, not from backend config.

### Project Structure Notes

Files to CREATE in this story:
```
apps/backend/app/modules.py                    # Module CRUD (create, get, list)
apps/backend/tests/test_modules.py             # Unit tests for modules.py
apps/backend/tests/test_module_creation_e2e.py # E2E integration test
```

Files to MODIFY in this story:
```
apps/backend/app/agent.py                      # Add module creation logic, prompt engineering
apps/backend/tests/test_agent.py               # Add tests for module creation flow
```

Files to VERIFY (no changes expected):
```
apps/mobile/services/moduleSync.ts             # Already handles module_created
apps/mobile/services/chatSync.ts               # Already handles status + chat_stream
apps/mobile/stores/moduleStore.ts              # addModule already works
apps/mobile/stores/chatStore.ts                # setAgentStatus already works
apps/mobile/types/ws.ts                        # AgentState already includes 'discovering' | 'composing'
apps/backend/app/main.py                       # chat routing already exists, sync already reads modules table
```

Files NOT to touch:
```
apps/mobile/components/**                      # Rendering pipeline is done (3.1-3.3)
apps/mobile/services/wsClient.ts               # WS client is done (1.4, 1.5)
packages/module-schema/**                      # Schema is done (1.1)
apps/backend/migrations/**                     # No schema changes needed
apps/backend/app/llm/**                        # LLM providers are done (1.3)
apps/backend/app/db.py                         # DB layer is done (1.2)
```

### Previous Story Intelligence

**From Story 3.3 (done, 2026-02-23):**
- Rendering pipeline fully works: ModuleList -> ModuleCard -> template resolution -> getPrimitive
- Template registry has 3 First Light templates: metric-dashboard, data-card, simple-list
- Primitive registry has 7 types: text, metric, layout, card, list, status, table
- `extractPrimitiveProps` now uses scoped allowlist (fixed in 3.3)
- Total test count: 840 mobile + 152 schema = 992 total
- Review follow-ups: 4 LOW items, none blocking

**From Story 2.1 (done):**
- Chat flow fully works: ChatInput -> wsClient.send -> backend -> agent.handle_chat -> chat_stream -> chatStore
- Status messages flow: backend status -> wsClient -> chatSync -> chatStore.setAgentStatus
- Error messages flow: backend error -> wsClient -> chatSync -> chatStore.addErrorMessage

**From Story 1.2 (done):**
- Backend skeleton with main.py, agent.py, db.py, config.py all working
- `modules` table exists in 001_init.sql with correct schema
- `_handle_sync` and `_parse_module_rows` in main.py already read from modules table
- Per-request DB connections pattern established (fix from 1.5)

**From Epic 1 Retrospective:**
- snake_case/camelCase was #1 bug source — all conversion at wsClient boundary
- TDD (red-green-refactor) maintained since 1.3 — continue this pattern
- Per-request DB connections (not session-scoped) — critical pattern from 1.5 fix

### Git Intelligence

Recent commits:
- `04b0308` fix(ui): compact header, keyboard handling, Android edge-to-edge polish
- `d9adb6e` fix(dev): simplify self.sh, add tunnel mode, fix Hermes crypto
- `8b2a500` chore(2-1): finalize story cycle
- `2a7c305` feat(3-3): module rendering pipeline

**Commit convention:** `feat(3-4): module creation end-to-end pipeline`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Data Flow — Module Creation Flow] — Full pipeline: user -> chat -> agent -> LLM -> validate -> save -> module_created -> render
- [Source: _bmad-output/planning-artifacts/architecture.md#WebSocket Protocol] — Typed message union, 15 message types, status message with AgentState
- [Source: _bmad-output/planning-artifacts/architecture.md#Streaming strategy] — Creation Ceremony uses status messages: thinking -> discovering -> composing -> done
- [Source: _bmad-output/planning-artifacts/architecture.md#Backend project organization] — agent.py orchestration, modules.py CRUD, flat structure
- [Source: _bmad-output/planning-artifacts/architecture.md#LLMProvider Protocol] — `async def execute(prompt, tools=None) -> LLMResult`
- [Source: _bmad-output/planning-artifacts/architecture.md#Error handling] — Structured errors with agent_action, never swallowed
- [Source: _bmad-output/planning-artifacts/architecture.md#Async-Only Python Rule] — No sync blocking in app/
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns] — snake_case on wire, camelCase in TS
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4] — FR9, FR10, FR11, FR28, NFR4, acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#Module Creation & Management] — FR9-FR11 requirements, FR28 refresh schedule
- [Source: _bmad-output/planning-artifacts/prd.md#NFR4] — Fresh module creation < 30s (MVP) / < 60s (First Light)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Creation Ceremony] — Status-driven animation states, Orb pulsing
- [Source: _bmad-output/implementation-artifacts/3-3-module-rendering-pipeline.md] — Rendering pipeline state, test counts, file list
- [Source: _bmad-output/implementation-artifacts/2-1-real-time-chat-interface-with-streaming.md] — Chat flow, chatSync, status handling
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-02-23.md] — snake_case/camelCase lessons, TDD, per-request DB

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Backend test suite: 612 passed in 4.11s (excluding pre-existing test_module_schema.py import error)
- Mobile test suite: 1035 passed, 26 pre-existing failures (ChatInput SafeAreaProvider — not from this story)
- Module-schema test suite: 152 passed
- New tests added: 12 (test_modules.py) + 15 (test_agent.py additions) + 5 (test_ws.py additions) + 12 (test_module_creation_e2e.py) + 3 (moduleSync.test.ts additions) = 47 new tests

### Completion Notes List

- Created `modules.py` with async CRUD operations (create, get, list) following per-request DB connection pattern
- Modified `agent.py` to add module creation pipeline within `handle_chat`: enriched LLM prompt via `_build_module_prompt()`, JSON extraction via `_extract_module_spec()` / `_try_extract_module_spec()`, module persistence via `modules.create_module()`, `module_created` WS message with snake_case keys
- Prompt engineering: system instructions tell LLM to produce JSON code fence with module spec when user requests data tracking/monitoring/dashboards; regular chat falls through without JSON
- Error handling: distinguishes between "no code fence" (regular chat) and "code fence with invalid JSON" (MODULE_CREATION_FAILED error)
- Status sequence verified: thinking -> discovering -> composing -> idle with module_created between composing and idle
- Conversational text sent as chat_stream before module_created (user never faces silence)
- main.py required NO changes — routing already passes chat to agent.handle_chat
- Mobile code required NO changes — existing moduleSync.ts, chatSync.ts, wsClient.ts handlers already work
- Updated existing test_agent_edge.py to account for enriched prompt (was testing raw message, now verifies message within enriched prompt)
- TDD followed throughout: RED (write failing tests) -> GREEN (implement to pass) -> REFACTOR

### Review Follow-ups

- [ ] [AI-Review][LOW] `discovering` and `composing` statuses are sent back-to-back with no actual async work between them — consider adding validation/discovery logic between the two states in a future story [agent.py:254-257]
- [ ] [AI-Review][LOW] `_JSON_CODE_FENCE_RE` only matches ` ```json ` fences — a plain ` ``` ` block from the LLM would not be detected. This is strict-by-design but could miss edge cases from some providers [agent.py:38]
- [ ] [AI-Review][LOW] Backend test count in Dev Agent Record is outdated (claims 612, actual is 678 after TEA expansion) — cosmetic only [story file]

### Change Log

- 2026-02-24: Implemented story 3-4 — module creation end-to-end pipeline (all 5 tasks)
- 2026-02-24: Code review (adversarial) — 3 MEDIUM issues fixed, 3 LOW documented as follow-ups

### File List

New files:
- apps/backend/app/modules.py
- apps/backend/tests/test_modules.py
- apps/backend/tests/test_modules_edge.py
- apps/backend/tests/test_module_creation_e2e.py
- apps/backend/tests/test_module_creation_e2e_edge.py
- apps/backend/tests/test_agent_module_edge.py

Modified files:
- apps/backend/app/agent.py
- apps/backend/tests/test_agent.py
- apps/backend/tests/test_agent_edge.py
- apps/backend/tests/test_ws.py
- apps/mobile/services/moduleSync.test.ts

Verified (no changes):
- apps/mobile/services/moduleSync.ts
- apps/mobile/services/chatSync.ts
- apps/mobile/stores/moduleStore.ts
- apps/mobile/stores/chatStore.ts
- apps/mobile/types/ws.ts
- apps/backend/app/main.py
