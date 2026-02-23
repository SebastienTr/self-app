# Story 1.4: Mobile App Shell & WebSocket Connection

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want the mobile app to connect to my backend via WebSocket with automatic reconnection,
So that my connection is always stable. (FR56)

## Acceptance Criteria

1. **Given** the mobile app is launched for the first time **When** a backend URL is configured **Then** a WebSocket connection is established using the typed discriminated union protocol **And** connection status is visible to the developer (connected/connecting/disconnected)

2. **Given** an active WebSocket connection **When** the connection is lost (backend restart, network change) **Then** the app automatically reconnects within 3 seconds using exponential backoff (FR56) **And** the reconnection attempt count is visible in logs

## Tasks / Subtasks

- [x] Task 1: Create TypeScript type definitions for WebSocket protocol (AC: #1)
  - [x] 1.1 Create `apps/mobile/types/ws.ts` with the full `WSMessage` discriminated union type from the architecture (15 message types)
  - [x] 1.2 Define client-to-server message types: `auth`, `auth_reset`, `chat`, `module_action`, `log`, `sync`
  - [x] 1.3 Define server-to-client message types: `chat_stream`, `module_created`, `module_updated`, `module_list`, `module_sync`, `error`, `warning`, `status`, `usage_summary`
  - [x] 1.4 Define supporting types: `AgentState = 'idle' | 'thinking' | 'discovering' | 'composing'`, `PersonaType = 'flame' | 'tree' | 'star'`
  - [x] 1.5 Define `ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'`
  - [x] 1.6 Export all types from `apps/mobile/types/ws.ts`

- [x] Task 2: Create case conversion utilities (AC: #1)
  - [x] 2.1 Create `apps/mobile/utils/toCamel.ts` — deep `snake_case` to `camelCase` converter for incoming WS JSON
  - [x] 2.2 Create `apps/mobile/utils/toSnake.ts` — deep `camelCase` to `snake_case` converter for outgoing WS JSON
  - [x] 2.3 Create `apps/mobile/utils/toCamel.test.ts` — unit tests for nested objects, arrays, edge cases (null, numbers, empty)
  - [x] 2.4 Create `apps/mobile/utils/toSnake.test.ts` — unit tests for the reverse conversion

- [x] Task 3: Create structured logging service (AC: #1, #2)
  - [x] 3.1 Create `apps/mobile/services/logger.ts` with structured JSON logging matching the architecture's AI-First Observability pattern
  - [x] 3.2 Implement `log(layer, event, context, severity)` function that outputs `{ ts, layer: "mobile:${layer}", event, severity, context: { ...context, agent_action } }`
  - [x] 3.3 Log to `console.log` / `console.error` as structured JSON
  - [x] 3.4 Add `sendToBackend(entry)` method that queues log entries for WS forwarding (actual sending deferred until WS is connected)
  - [x] 3.5 Export `logger` singleton for app-wide use

- [x] Task 4: Create connection store (Zustand) (AC: #1, #2)
  - [x] 4.1 Install `zustand` (5.x) as a dependency of `apps/mobile`
  - [x] 4.2 Create `apps/mobile/stores/connectionStore.ts` with Zustand
  - [x] 4.3 Define state: `status: ConnectionStatus`, `reconnectAttempts: number`, `lastSync: string | null`, `backendUrl: string`
  - [x] 4.4 Define actions: `setStatus`, `setBackendUrl`, `incrementReconnectAttempts`, `resetReconnectAttempts`, `setLastSync`
  - [x] 4.5 Define selectors: `getIsConnected`, `getStatus`
  - [x] 4.6 Follow Zustand conventions: state = nouns, actions = imperative verbs, selectors = `get` + descriptive noun
  - [x] 4.7 NEVER use `isLoading: boolean` — always use the `ConnectionStatus` enum

- [x] Task 5: Create WebSocket client service (AC: #1, #2)
  - [x] 5.1 Create `apps/mobile/services/wsClient.ts` — the core WebSocket connection manager
  - [x] 5.2 Implement `connect(url: string)` — opens WS connection, sets `connectionStore.status = 'connecting'`
  - [x] 5.3 Implement `disconnect()` — cleanly closes WS connection
  - [x] 5.4 Implement `send(msg: WSMessage)` — if connected, serializes to snake_case JSON and sends; if disconnected, queues in `pendingMessages` array
  - [x] 5.5 Implement message reception: parse incoming JSON, convert from snake_case via `toCamel()`, route by `type` discriminator
  - [x] 5.6 Implement `onMessage` handler registry — allows stores/components to subscribe to specific message types
  - [x] 5.7 Implement exponential backoff reconnection: 1s, 2s, 4s, max 30s (FR56 — reconnect within 3 seconds using exponential backoff)
  - [x] 5.8 On reconnect: flush `pendingMessages` in FIFO order, then send `sync` message with `lastSync` from `connectionStore`
  - [x] 5.9 Log all connection events with structured logger: `connect`, `disconnect`, `reconnect`, `message_received`, `message_sent`, `reconnect_failed`
  - [x] 5.10 On open: set `connectionStore.status = 'connected'`, reset reconnect attempts
  - [x] 5.11 On close/error: set `connectionStore.status = 'reconnecting'`, increment attempts, start backoff timer
  - [x] 5.12 Export `wsClient` singleton

- [x] Task 6: Create offline message queue (AC: #2)
  - [x] 6.1 In `wsClient.ts`: implement `pendingMessages: WSMessage[]` array
  - [x] 6.2 Messages sent while `status !== 'connected'` are pushed to `pendingMessages`
  - [x] 6.3 On reconnect success: iterate and send all pending messages in original order, then clear the queue
  - [x] 6.4 Zero message loss guarantee — messages are never dropped, only queued (NFR19)
  - [x] 6.5 Log queue operations: `message_queued` (with queue length), `queue_flushed` (with count)

- [x] Task 7: Backend WebSocket endpoint (AC: #1)
  - [x] 7.1 Add WebSocket endpoint `@app.websocket("/ws")` to `apps/backend/app/main.py`
  - [x] 7.2 On connection: accept, log `ws_connected` event
  - [x] 7.3 Implement message receive loop: parse JSON, validate `type` field exists
  - [x] 7.4 Route messages by type:
    - `chat` → log receipt, respond with `chat_stream` stub (echo back with `done: true`) — full agent integration is a later story
    - `log` → forward payload to backend structured logging (`log.info("mobile_log", **payload)`)
    - `sync` → respond with `module_list` with empty modules array (no modules exist yet)
    - Unknown type → respond with `error` message: `{ code: "WS_UNKNOWN_TYPE", message: "Unknown message type: {type}", agent_action: "Check WSMessage type enum" }`
  - [x] 7.5 On disconnect: log `ws_disconnected` event with close code
  - [x] 7.6 Handle JSON parse errors gracefully: send `error` message with code `WS_INVALID_JSON`
  - [x] 7.7 All messages follow `{ type: string, payload: object }` format — no exceptions

- [x] Task 8: Write mobile unit tests (AC: #1, #2)
  - [x] 8.1 Create `apps/mobile/types/ws.test.ts` — verify type definitions compile correctly with sample messages
  - [x] 8.2 Test `toCamel` and `toSnake` utilities (already in 2.3/2.4)
  - [x] 8.3 Create `apps/mobile/stores/connectionStore.test.ts` — test state transitions, actions, selectors
  - [x] 8.4 Create `apps/mobile/services/wsClient.test.ts` — test send/queue behavior, reconnection logic (mock WebSocket)
  - [x] 8.5 Test pending message queue: messages queued when disconnected, flushed on reconnect
  - [x] 8.6 Test exponential backoff: verify delay sequence 1s, 2s, 4s, 8s, 16s, 30s (capped)
  - [x] 8.7 Mock WebSocket using jest mock or a simple mock class

- [x] Task 9: Write backend WebSocket tests (AC: #1)
  - [x] 9.1 Create `apps/backend/tests/test_ws.py` — test WebSocket endpoint
  - [x] 9.2 Test WS connection establishes successfully
  - [x] 9.3 Test `chat` message type receives `chat_stream` response
  - [x] 9.4 Test `log` message type is forwarded to backend logs
  - [x] 9.5 Test `sync` message type receives `module_list` response
  - [x] 9.6 Test unknown message type receives `error` response with `WS_UNKNOWN_TYPE`
  - [x] 9.7 Test invalid JSON receives `error` response with `WS_INVALID_JSON`
  - [x] 9.8 Test all response messages follow `{ type, payload }` format
  - [x] 9.9 Use `httpx` + `WebSocketTestSession` from Starlette/FastAPI for WS testing

- [x] Task 10: Update mobile app entry point with connection initialization (AC: #1)
  - [x] 10.1 Update `apps/mobile/App.tsx` or `apps/mobile/app/_layout.tsx` to initialize WS connection on app start
  - [x] 10.2 Read backend URL from a configuration source (hardcoded default `ws://localhost:8000/ws` for development)
  - [x] 10.3 Display connection status indicator (minimal — a colored dot or text showing connected/connecting/disconnected)
  - [x] 10.4 Connection status visible to developer in structured logs

## Review Follow-ups (AI)

- [ ] [AI-Review][LOW] `toCamel` mishandles leading underscore keys — `_private_field` becomes `PrivateField` (PascalCase) instead of preserving the leading underscore convention. This could cause issues if Python `_private` naming conventions are used in WS payloads. [apps/mobile/utils/toCamel.ts:9]
- [ ] [AI-Review][LOW] No WebSocket URL validation in `connect()` — passing invalid URLs (e.g., empty string, HTTP instead of WS) produces cryptic errors. Consider adding a basic scheme check. [apps/mobile/services/wsClient.ts:174]
- [ ] [AI-Review][LOW] `pnpm-lock.yaml` modified (from zustand install) not documented in story File List — minor documentation gap.

## Dev Notes

### Architecture Compliance (MANDATORY)

This story establishes the mobile-backend communication layer. The WebSocket is the ONLY communication channel between mobile and backend (except `/health` for Docker healthcheck). No REST endpoints for application logic.

**Target file structure after this story:**

```
apps/mobile/
├── app/                        # Expo Router — pages only, minimal logic
│   └── (existing files)
├── components/                 # EXISTS (empty)
├── services/                   # EXISTS (empty) — add new files here
│   ├── logger.ts               # NEW — structured JSON logging → WS to backend
│   └── wsClient.ts             # NEW — WebSocket + reconnection + message queue
├── stores/                     # EXISTS (empty) — add new files here
│   └── connectionStore.ts      # NEW — WS status, reconnection state
├── types/                      # NEW directory
│   └── ws.ts                   # NEW — WSMessage discriminated union
├── utils/                      # NEW directory
│   ├── toCamel.ts              # NEW — snake_case → camelCase converter
│   ├── toCamel.test.ts         # NEW — tests
│   ├── toSnake.ts              # NEW — camelCase → snake_case converter
│   └── toSnake.test.ts         # NEW — tests
├── __tests__/                  # Test helpers
├── metro.config.js             # EXISTS
├── tsconfig.json               # EXISTS
└── package.json                # MODIFY (add zustand)

apps/backend/
├── app/
│   ├── main.py                 # MODIFY (add /ws endpoint)
│   └── ... (existing files unchanged)
├── tests/
│   ├── test_ws.py              # NEW — WebSocket endpoint tests
│   └── ... (existing tests unchanged)
```

### WebSocket Protocol (EXACT from architecture)

All messages follow this invariant format:
```json
{ "type": "string", "payload": { ... } }
```

**Full discriminated union (TypeScript):**

```typescript
// types/ws.ts
type WSMessage =
  | { type: 'auth'; payload: { token: string } }
  | { type: 'auth_reset'; payload: Record<string, never> }
  | { type: 'chat'; payload: { message: string } }
  | { type: 'chat_stream'; payload: { delta: string; done: boolean } }
  | { type: 'module_created'; payload: ModuleSpec }
  | { type: 'module_updated'; payload: { moduleId: string; spec: ModuleSpec } }
  | { type: 'module_list'; payload: { modules: ModuleSpec[] } }
  | { type: 'module_sync'; payload: { modules: ModuleSpec[]; lastSync: string } }
  | { type: 'sync'; payload: { lastSync: string } }
  | { type: 'error'; payload: { code: string; message: string; agentAction?: string } }
  | { type: 'warning'; payload: { code: string; message: string } }
  | { type: 'status'; payload: { state: AgentState; persona?: PersonaType } }
  | { type: 'usage_summary'; payload: { daily: number; weekly: number; monthly: number } }
  | { type: 'module_action'; payload: { moduleId: string; action: string } }
  | { type: 'log'; payload: { layer: string; event: string; severity: string; context: Record<string, unknown> } };
```

**IMPORTANT:** The `type` field uses `snake_case` on the wire (as per architecture naming conventions). The `payload` fields are `snake_case` on the wire and converted to `camelCase` in TypeScript via `toCamel()`. The `type` field itself is NOT converted — it stays `snake_case` as the discriminator.

### Case Conversion Rules (CRITICAL — 3 conversion points)

```
Zod (camelCase) → JSON Schema (camelCase) → Pydantic (snake_case via alias_generator)
                                           → WS wire format: snake_case
                                           → Mobile receives snake_case → toCamel() → camelCase TS objects
```

**Conversion in `wsClient.ts`:**
- **Outgoing:** `toSnake(msg.payload)` before sending (type stays snake_case already)
- **Incoming:** `toCamel(parsed.payload)` after parsing (type stays as-is)

```typescript
// services/wsClient.ts — conversion pattern
const send = (msg: WSMessage) => {
  const wireMsg = { type: msg.type, payload: toSnake(msg.payload) };
  if (connectionStore.getState().status === 'connected') {
    ws.send(JSON.stringify(wireMsg));
  } else {
    pendingMessages.push(msg); // Store in camelCase, convert on flush
  }
};
```

### Reconnection Pattern (MANDATORY — from architecture)

```
connect → (on open) → status = 'connected'
  ↓ (disconnect)
status = 'reconnecting' → wait(backoff) → reconnect → (on open) → status = 'connected'
```

**Exponential backoff:** 1s, 2s, 4s, 8s, 16s, max 30s.

FR56 requires reconnection "within 3 seconds." This means the **first** reconnection attempt happens at 1s delay. The exponential backoff handles repeated failures gracefully.

On successful reconnect:
1. Set `connectionStore.status = 'connected'`
2. Reset reconnect attempts to 0
3. Flush all `pendingMessages` in FIFO order
4. Send `{ type: 'sync', payload: { last_sync: connectionStore.lastSync } }` to trigger delta sync

### Structured Logging (Mobile — from architecture)

```typescript
// services/logger.ts
const log = (layer: string, event: string, context: Record<string, unknown>, severity = 'info') => {
  const entry = {
    ts: new Date().toISOString(),
    layer: `mobile:${layer}`,
    event,
    severity,
    context: { ...context, agent_action: context.agent_action ?? null }
  };
  console[severity === 'error' ? 'error' : 'log'](JSON.stringify(entry));
  // Queue for WS forwarding when connected
  sendToBackend(entry);
};
```

This logs to `console` for React Native Debugger AND forwards to backend via WS `log` message type for the unified 3-stream logging architecture.

### Zustand Store Conventions (MANDATORY)

```typescript
// stores/connectionStore.ts
interface ConnectionStore {
  // State (nouns)
  status: ConnectionStatus;
  reconnectAttempts: number;
  lastSync: string | null;
  backendUrl: string;

  // Actions (imperative verbs)
  setStatus: (status: ConnectionStatus) => void;
  setBackendUrl: (url: string) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  setLastSync: (timestamp: string) => void;

  // Selectors (get + descriptive noun)
  getIsConnected: () => boolean;
}
```

**Rules:**
- Actions = imperative verbs (`set`, `increment`, `reset`)
- Selectors = `get` + descriptive noun
- State = nouns (never `isLoading: boolean` — use the `ConnectionStatus` enum)
- One store per domain: `connectionStore` manages WS state only

### Backend WebSocket Handler Pattern

```python
# apps/backend/app/main.py — add to existing file
from fastapi import WebSocket, WebSocketDisconnect
import json

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    log.info("ws_connected")
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({
                    "type": "error",
                    "payload": {
                        "code": "WS_INVALID_JSON",
                        "message": "Invalid JSON received",
                        "agent_action": "Check message serialization on mobile client"
                    }
                })
                continue

            msg_type = msg.get("type")
            payload = msg.get("payload", {})

            if msg_type == "chat":
                # Stub: echo back as chat_stream (full agent integration later)
                await ws.send_json({
                    "type": "chat_stream",
                    "payload": {"delta": f"Echo: {payload.get('message', '')}", "done": True}
                })
            elif msg_type == "log":
                log.info("mobile_log", **payload)
            elif msg_type == "sync":
                await ws.send_json({
                    "type": "module_list",
                    "payload": {"modules": []}
                })
            else:
                await ws.send_json({
                    "type": "error",
                    "payload": {
                        "code": "WS_UNKNOWN_TYPE",
                        "message": f"Unknown message type: {msg_type}",
                        "agent_action": "Check WSMessage type enum in types/ws.ts"
                    }
                })
    except WebSocketDisconnect as e:
        log.info("ws_disconnected", close_code=e.code)
```

**IMPORTANT:** `main.py` is the ONLY file that touches the WebSocket object. This is a firm architecture boundary. All message routing happens here; business logic is delegated to other modules (agent.py, modules.py — future stories).

### Error Message Format (MANDATORY)

```json
{
  "type": "error",
  "payload": {
    "code": "WS_UNKNOWN_TYPE",
    "message": "Human-readable error description",
    "agent_action": "Specific debug instruction for LLM agent"
  }
}
```

Error code prefixes: `AUTH_*`, `MODULE_*`, `LLM_*`, `WS_*`, `SCHEMA_*`.

### Status Enums — NEVER Booleans (MANDATORY)

```typescript
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
type AgentStatus = 'idle' | 'thinking' | 'discovering' | 'composing';
```

An AI agent must NEVER introduce an `isLoading: boolean` or `isConnected: boolean`. It is ALWAYS a status enum.

### Naming Conventions (MANDATORY)

| Context | Convention | Example |
|---------|-----------|---------|
| TypeScript files (services/utils) | camelCase | `wsClient.ts`, `toCamel.ts` |
| TypeScript types/interfaces | PascalCase | `WSMessage`, `ConnectionStatus`, `AgentState` |
| TypeScript directories | kebab-case or camelCase | `types/`, `utils/`, `services/` |
| Zustand stores | camelCase | `connectionStore.ts` |
| WS message types (wire) | snake_case | `chat_stream`, `module_created` |
| WS payload fields (wire) | snake_case | `{ module_id, last_sync }` |
| WS payload fields (TS) | camelCase | `{ moduleId, lastSync }` |
| Test files (TS) | `*.test.ts` co-located | `toCamel.test.ts` next to `toCamel.ts` |
| Python test files | `tests/test_*.py` | `tests/test_ws.py` |

### Import Rules (MANDATORY)

- Use `@/services/wsClient` for intra-app imports (path alias from tsconfig)
- Use `@/stores/connectionStore` for store imports
- Use `@/types/ws` for type imports
- Use `@/utils/toCamel` for utility imports
- NEVER use relative paths crossing package boundaries
- NO global barrel export at `components/index.ts`

### Async-Only Python Rule (CRITICAL)

| Forbidden | Required Alternative |
|-----------|---------------------|
| `import requests` | `import httpx` |
| `import sqlite3` | `import aiosqlite` |
| `subprocess.run()` | `asyncio.create_subprocess_exec()` |
| `time.sleep()` | `asyncio.sleep()` |

### What NOT To Do

- Do NOT implement authentication/session verification (Story 1.6) — accept all connections for now
- Do NOT implement full agent orchestration — `chat` messages get a stub echo response
- Do NOT implement module CRUD — `sync` returns empty module list
- Do NOT implement persona engine — `status` messages are not sent yet
- Do NOT implement `auth` message handling — authentication is Story 1.6
- Do NOT add expo-sqlite, expo-secure-store, or react-native-reanimated — those come in later stories
- Do NOT create Shell/Bridge/SDUI components — those come in Epic 2 and Epic 3
- Do NOT implement delta sync logic — just return full (empty) module list on `sync`
- Do NOT implement streaming — `chat_stream` returns a single message with `done: true`
- Do NOT add REST endpoints — WebSocket is the only communication channel
- Do NOT use `fetch` or `XMLHttpRequest` for WS — use the native `WebSocket` API
- Do NOT create `apps/mobile/app/` route files beyond what exists — minimal UI changes
- Do NOT implement `toCamel`/`toSnake` in the WebSocket type discriminator — `type` field stays snake_case as-is
- Do NOT use `isConnected: boolean` or `isLoading: boolean` — use status enums

### Previous Story Intelligence

**From Story 1.3 (LLM Provider Abstraction — done):**
- `app/llm/` package fully implemented with 5 providers (3 CLI + 2 API)
- CircuitBreaker, RateLimiter, retry logic all working
- `/health` endpoint returns `providers` field with name, type, health status
- 387 total tests passing, 0 failures
- structlog patterns established: event name as first positional arg, context as kwargs
- Ruff UP041: `asyncio.TimeoutError` must be `TimeoutError` in Python 3.12+
- `get_available_providers()` reads from settings by default

**From Story 1.2 (Backend Skeleton — done):**
- `config.py` exists: `Settings` class with `llm_api_key`, `self_llm_provider`, `self_log_level`, `self_llm_rate_limit`, `self_llm_cost_alert`, `self_data_dir`, `self_db_name`
- `logging.py` exists: structlog JSON config, `setup_logging()`, `log` export
- `db.py` exists: `get_connection()`, `run_migrations()`, `get_schema_version()`
- `main.py` exists: FastAPI lifespan, `/health` endpoint with status, schema_version, migrations_applied, uptime, providers
- `001_init.sql` creates 6 tables: `modules`, `memory_core`, `memory_episodic`, `sessions`, `schema_version`, `llm_usage`
- Docker: python:3.14-slim, non-root user `selfapp`, port 8000
- 220 base tests + 167 LLM tests = 387 total
- `ASGITransport` does NOT trigger lifespan automatically — tests use `app.router.lifespan_context` for startup
- structlog `get_level_from_name` not available — custom level mapping used

**From Story 1.1 (Monorepo — done):**
- Monorepo scaffolded with pnpm 10.30.1
- `packages/module-schema/` exists with Zod 4 source of truth, `CURRENT_SCHEMA_VERSION = 1`
- Mobile: Expo SDK 54, RN 0.81.5, React 19.1, TypeScript 5.9
- `tsconfig.json` already has path aliases: `@self/module-schema`, `@/components/*`, `@/services/*`, `@/stores/*`
- `metro.config.js` configured for pnpm monorepo symlink resolution
- `apps/mobile/package.json` has: expo, react, react-native, jest, jest-expo, typescript (NO zustand yet)
- `services/` and `stores/` directories exist but are empty
- No `types/` or `utils/` directories yet — need to create them
- 25 Jest tests + 16 pytest tests from Story 1.1
- Generated files are gitignored — CI regenerates them

**From Git History:**
- `010a321` docs: add README with Twilight theme screenshots and sync project status
- `2ccb7b8` feat(1-3): LLM provider abstraction with 5 providers, circuit breaker, and BYOK config
- `da4eff0` 1.2 (backend skeleton)
- `09adfc2` feat: implement stories 1.1 + 1.1b — monorepo setup and CI pipeline

### Key Technical Considerations

1. **React Native WebSocket:** Use the native `WebSocket` API available in React Native (same as browser API). Do NOT use a third-party WebSocket library — React Native provides it natively.

2. **JSON serialization:** `JSON.stringify()` and `JSON.parse()` work natively. The `toCamel`/`toSnake` utilities handle the case conversion at the boundary.

3. **Zustand 5.x:** The latest Zustand uses `create` from `zustand` directly. No middleware needed for this store (no persistence, no devtools in First Light).

4. **FastAPI WebSocket testing:** Use `TestClient` with `with client.websocket_connect("/ws") as ws:` pattern from Starlette. The FastAPI TestClient supports WebSocket testing natively.

5. **tsconfig paths for new dirs:** The existing tsconfig has `@/services/*` and `@/stores/*`. For `types/` and `utils/`, imports can use relative paths within mobile app (these are intra-app) or add path aliases if needed. The architecture specifies `@/types/*` and `@/utils/*` — add these to tsconfig.json.

6. **BackendURL configuration:** For First Light, hardcode `ws://localhost:8000/ws` as default. Story 1.6 adds proper pairing. The `connectionStore.backendUrl` allows future configurability.

### Project Structure Notes

- This story creates the first real mobile application code (services, stores, types, utils)
- The `types/` and `utils/` directories are new — create them
- Add `@/types/*` and `@/utils/*` path aliases to `apps/mobile/tsconfig.json`
- Add `zustand` to `apps/mobile/package.json` dependencies
- The backend only changes `main.py` (add `/ws` endpoint) and adds `test_ws.py`
- No docker-compose.yml changes needed
- No schema changes needed
- No new Python dependencies needed (FastAPI includes WebSocket support via Starlette)

### References

- [Source: architecture.md#API & Communication Patterns] — WebSocket-only protocol, 15 message types, typed discriminated union (lines 412-457)
- [Source: architecture.md#Communication Patterns] — WS reconnection pattern, exponential backoff 1s/2s/4s/max 30s, message queue during disconnection (lines 1020-1051)
- [Source: architecture.md#AI-First Observability] — Mobile logging service, 3-stream unified logging (lines 238-299)
- [Source: architecture.md#Naming Patterns] — snake_case on wire, camelCase in TS, conversion boundary (lines 804-818)
- [Source: architecture.md#Format Patterns] — WS message format invariant, error format, date/ID formats (lines 956-991)
- [Source: architecture.md#Zustand Store Conventions] — State/actions/selectors naming, one store per domain (lines 994-1019)
- [Source: architecture.md#Process Patterns] — Status enums never booleans (lines 1084-1092)
- [Source: architecture.md#Mobile project organization] — services/, stores/, types/, utils/ structure (lines 876-895)
- [Source: architecture.md#Import & Export Patterns] — Path aliases, barrel exports per sub-folder (lines 836-856)
- [Source: architecture.md#Service Boundaries] — main.py is the ONLY file that touches WS object (lines 1316-1337)
- [Source: architecture.md#Sync Protocol] — Delta sync on reconnection, updated_at based (lines 1449-1458)
- [Source: architecture.md#V1 Design Tokens] — Twilight theme tokens for any UI elements (lines 635-693)
- [Source: epics.md#Story 1.4] — Acceptance criteria (lines 489-505)
- [Source: prd.md#FR56] — Auto-reconnection within 3 seconds with exponential backoff
- [Source: prd.md#NFR5] — WebSocket reconnection < 1 second
- [Source: prd.md#NFR19] — Zero message loss on reconnection
- [Source: story 1-3] — Backend state, 387 tests, llm/ package, health endpoint with providers
- [Source: story 1-2] — main.py structure, config.py, logging.py, db.py, migration system
- [Source: story 1-1] — Monorepo structure, tsconfig paths, mobile package.json, Metro config

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Backend log message forwarding: `log.info("mobile_log", **payload)` caused `TypeError` due to structlog's `event` parameter conflict. Fixed by wrapping payload: `log.info("mobile_log", mobile_payload=payload)`.
- Exponential backoff ordering: Initial implementation incremented reconnect attempts before scheduling reconnect, causing first delay to be 2s instead of 1s. Fixed by scheduling reconnect before incrementing attempts.
- Jest fake timers + resetModules: Order matters — `jest.resetModules()` must run before `jest.useFakeTimers()` to ensure re-required modules capture fake timers.
- TypeScript `global` keyword not available in strict mode — changed to `globalThis` for WebSocket mock installation.

### Completion Notes List

- **Task 1**: Created `types/ws.ts` with full 15-type WSMessage discriminated union, AgentState, PersonaType, ConnectionStatus, ModuleSpec. All types exported. Added `@/types/*` and `@/utils/*` path aliases to tsconfig.json.
- **Task 2**: Created `toCamel.ts` and `toSnake.ts` with deep recursive key conversion. 27 tests covering nested objects, arrays, null/undefined, primitives, round-trip conversion.
- **Task 3**: Created `logger.ts` with structured JSON logging (`{ ts, layer, event, severity, context }`), console output, log queue with `registerLogSender`/`unregisterLogSender` for WS forwarding.
- **Task 4**: Installed zustand 5.x. Created `connectionStore.ts` with state (status, reconnectAttempts, lastSync, backendUrl), actions (set/increment/reset), selectors (getIsConnected, getStatus). 10 tests.
- **Task 5-6**: Created `wsClient.ts` with connect/disconnect/send, exponential backoff reconnection (1s, 2s, 4s, 8s, 16s, 30s cap), offline message queue with FIFO flush, onMessage handler registry with unsubscribe. All connection events logged via structured logger. 24 tests with MockWebSocket.
- **Task 7**: Added `/ws` WebSocket endpoint to `main.py`. Routes: chat (echo stub), log (forward to structlog), sync (empty module_list), unknown (WS_UNKNOWN_TYPE error). Invalid JSON returns WS_INVALID_JSON error. All messages follow `{ type, payload }` format.
- **Task 8**: Created `ws.test.ts` (8 tests for type compilation), `connectionStore.test.ts` (10 tests), `wsClient.test.ts` (24 tests). Also `toCamel.test.ts` (13 tests) and `toSnake.test.ts` (14 tests).
- **Task 9**: Created `test_ws.py` with 19 tests covering connection, chat, log, sync, unknown type, invalid JSON, response format, multiple messages.
- **Task 10**: Updated `App.tsx` with useEffect to connect on mount, disconnect on unmount. Reads backendUrl from connectionStore. Shows colored dot + status label (connected/connecting/reconnecting/disconnected). Uses Twilight theme dark background.
- **Test totals**: Mobile 176 tests (6 suites), Backend 432 tests (45 WS + 387 existing). Zero regressions.
- **Architecture compliance**: WebSocket is sole communication channel; `type` field stays snake_case; payload converted at boundary; no boolean flags; Zustand conventions followed; structlog patterns maintained.

### Change Log

- 2026-02-23: Implemented Story 1.4 — Mobile App Shell & WebSocket Connection. Added WS protocol types, case conversion utilities, structured logging service, Zustand connection store, WebSocket client with reconnection and offline queue, backend /ws endpoint, and comprehensive test suites (69 mobile + 19 backend tests).
- 2026-02-23: **Code review (Opus 4.6).** Fixed 5 issues (2 HIGH, 3 MEDIUM). (1) HIGH: Fixed JSON array payload crash on /ws endpoint — added `isinstance(msg, dict)` guard. (2) MEDIUM: Added bounded queue limits (500 log entries, 200 pending WS messages) to prevent unbounded memory growth. (3) MEDIUM: Fixed connect() race condition — now cleans up previous WebSocket before opening a new one. (4) MEDIUM: Fixed sync-on-first-connect — sync message now only sent on reconnect, not initial connect. (5) MEDIUM: Added missing `logger.test.ts` to story File List. 3 LOW issues documented in Review Follow-ups. Final: 176 mobile tests, 432 backend tests, zero regressions.

### File List

New files:
- apps/mobile/types/ws.ts
- apps/mobile/types/ws.test.ts
- apps/mobile/utils/toCamel.ts
- apps/mobile/utils/toCamel.test.ts
- apps/mobile/utils/toSnake.ts
- apps/mobile/utils/toSnake.test.ts
- apps/mobile/services/logger.ts
- apps/mobile/services/logger.test.ts
- apps/mobile/services/wsClient.ts
- apps/mobile/services/wsClient.test.ts
- apps/mobile/stores/connectionStore.ts
- apps/mobile/stores/connectionStore.test.ts
- apps/backend/tests/test_ws.py

Modified files:
- apps/mobile/App.tsx
- apps/mobile/package.json (added zustand dependency)
- apps/mobile/tsconfig.json (added @/types/* and @/utils/* path aliases)
- apps/mobile/jest.config.js (added moduleNameMapper for path aliases)
- apps/backend/app/main.py (added /ws WebSocket endpoint)
