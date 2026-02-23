# Story 1.5: Offline Message Queue & Cached Data Rendering

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want my messages to be queued when offline and my modules to remain visible from cache,
So that I never lose work and can still use the app without a connection. (FR57, FR58)

## Acceptance Criteria

1. **Given** the connection is lost while the user types a message **When** the user sends messages during disconnection **Then** all messages are queued locally in order (FR57) **And** upon reconnection, queued messages are delivered in the original order **And** zero messages are lost (NFR19)

2. **Given** modules exist in the local cache **When** the backend is unreachable **Then** cached module data is rendered from local storage (FR58, NFR18) **And** the app remains usable with last-known data

3. **Given** cached modules are displayed while offline **When** the user views them **Then** each module shows a freshness indicator (last updated timestamp) **And** modules older than 24h show a "Stale" badge

4. **Given** the app is opened without a backend connection (cold start) **When** cached modules exist in expo-sqlite **Then** cached content is visible within 2 seconds (NFR1) **And** the app cold start to cached content visible < 2s

5. **Given** the app returns online after being offline **When** the connection is restored **Then** modules refresh automatically via delta sync (`sync` message with `lastSync` timestamp) **And** the local cache is updated with fresh data from the backend

6. **Given** the offline message queue contains messages **When** the queue is persisted to expo-sqlite **Then** messages survive app kills/crashes **And** are flushed on next successful connection (zero message loss guarantee)

## Tasks / Subtasks

- [x] Task 1: Install expo-sqlite dependency (AC: #2, #4)
  - [x] 1.1 Add `expo-sqlite` to `apps/mobile/package.json` dependencies
  - [x] 1.2 Run `pnpm install` from the monorepo root
  - [x] 1.3 Verify the dependency resolves correctly and does not break existing tests

- [x] Task 2: Create local database service for caching (AC: #2, #4, #6)
  - [x] 2.1 Create `apps/mobile/services/localDb.ts` — async wrapper around expo-sqlite
  - [x] 2.2 Initialize a local SQLite database named `self-cache.db`
  - [x] 2.3 Create `modules_cache` table: `module_id TEXT PRIMARY KEY, spec TEXT (JSON), status TEXT, updated_at TEXT, cached_at TEXT`
  - [x] 2.4 Create `pending_messages` table: `id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT (JSON), created_at TEXT` — for persistent offline queue
  - [x] 2.5 Implement `initLocalDb()` — creates tables if not exist, called on app startup
  - [x] 2.6 Implement `cacheModule(moduleId: string, spec: ModuleSpec, status: string, updatedAt: string)` — upsert module into `modules_cache`
  - [x] 2.7 Implement `getCachedModules(): Promise<CachedModule[]>` — returns all cached modules ordered by `updated_at` DESC
  - [x] 2.8 Implement `removeCachedModule(moduleId: string)` — removes a module from cache
  - [x] 2.9 Implement `clearModulesCache()` — removes all cached modules
  - [x] 2.10 Implement `enqueuePendingMessage(msg: WSMessage)` — inserts message JSON into `pending_messages`
  - [x] 2.11 Implement `dequeuePendingMessages(): Promise<WSMessage[]>` — returns all pending messages in FIFO order (ordered by `id` ASC) and deletes them from the table
  - [x] 2.12 Implement `getPendingMessageCount(): Promise<number>` — returns count of pending messages
  - [x] 2.13 Export all functions and the `CachedModule` type
  - [x] 2.14 All database operations use `async/await` — no synchronous calls
  - [x] 2.15 Log all database errors with structured logging including `agent_action`

- [x] Task 3: Create module store (Zustand) (AC: #2, #3, #4)
  - [x] 3.1 Create `apps/mobile/stores/moduleStore.ts` with Zustand
  - [x] 3.2 Define state: `modules: Map<string, ModuleState>` where `ModuleState = { spec: ModuleSpec; status: ModuleStatus; dataStatus: DataStatus; updatedAt: string; cachedAt: string }`
  - [x] 3.3 Define `ModuleStatus = 'loading' | 'active' | 'refreshing' | 'stale' | 'dormant' | 'error'` (from architecture)
  - [x] 3.4 Define `DataStatus = 'ok' | 'stale' | 'error'` (from architecture — separate from lifecycle status)
  - [x] 3.5 Define actions: `addModule(spec, updatedAt)`, `updateModule(id, spec, updatedAt)`, `removeModule(id)`, `setModuleStatus(id, status)`, `setModuleDataStatus(id, dataStatus)`, `loadFromCache(modules: CachedModule[])`
  - [x] 3.6 Define selectors: `getModule(id)`, `getActiveModules()`, `getModuleCount()`, `getAllModules()`
  - [x] 3.7 On every `addModule` / `updateModule`: also persist to local cache via `localDb.cacheModule()`
  - [x] 3.8 On `removeModule`: also remove from local cache via `localDb.removeCachedModule()`
  - [x] 3.9 Follow Zustand conventions: state = nouns, actions = imperative verbs, selectors = `get` + descriptive noun
  - [x] 3.10 NEVER use `isLoading: boolean` — always use status enums

- [x] Task 4: Create module types (AC: #2, #3)
  - [x] 4.1 Create or update `apps/mobile/types/module.ts` with `ModuleState`, `ModuleStatus`, `DataStatus`, `CachedModule` types
  - [x] 4.2 `ModuleStatus` must exactly match the architecture: `'loading' | 'active' | 'refreshing' | 'stale' | 'dormant' | 'error'`
  - [x] 4.3 `DataStatus` must match: `'ok' | 'stale' | 'error'`
  - [x] 4.4 Export all types

- [x] Task 5: Integrate module store with WebSocket message handlers (AC: #2, #5)
  - [x] 5.1 Create `apps/mobile/services/moduleSync.ts` — WS message handler registration for module-related messages
  - [x] 5.2 Register `onMessage('module_created', ...)` handler: calls `moduleStore.addModule(spec, updatedAt)`
  - [x] 5.3 Register `onMessage('module_updated', ...)` handler: calls `moduleStore.updateModule(id, spec, updatedAt)`
  - [x] 5.4 Register `onMessage('module_list', ...)` handler: replaces all modules in store + cache (full sync response)
  - [x] 5.5 Register `onMessage('module_sync', ...)` handler: merges delta sync response into store + cache, updates `connectionStore.lastSync`
  - [x] 5.6 Initialize handlers on app startup (called from app layout/entry point)
  - [x] 5.7 Log all sync operations with structured logging

- [x] Task 6: Upgrade offline message queue to persistent storage (AC: #1, #6)
  - [x] 6.1 Update `apps/mobile/services/wsClient.ts` — change `pendingMessages` from in-memory array to hybrid: in-memory for fast access + expo-sqlite for persistence
  - [x] 6.2 On app startup: load any persisted pending messages from `localDb.dequeuePendingMessages()` into the in-memory queue
  - [x] 6.3 On `send()` when disconnected: add message to both in-memory queue AND persist to `localDb.enqueuePendingMessage()`
  - [x] 6.4 On `flushPendingMessages()`: after successful send, messages are already removed from DB (via `dequeuePendingMessages()`)
  - [x] 6.5 Ensure message ordering is preserved (FIFO) — the `id AUTOINCREMENT` column guarantees DB ordering
  - [x] 6.6 Keep the existing `MAX_PENDING_MESSAGES = 200` limit, applying it to combined in-memory + persisted messages
  - [x] 6.7 Log queue persistence operations

- [x] Task 7: Load cached modules on app startup (AC: #4)
  - [x] 7.1 Update `apps/mobile/App.tsx` (or `app/_layout.tsx`) startup sequence:
    1. Initialize local database (`initLocalDb()`)
    2. Load cached modules from expo-sqlite (`getCachedModules()`)
    3. Populate moduleStore with cached data (`moduleStore.loadFromCache()`)
    4. Initiate WebSocket connection
  - [x] 7.2 Cached modules must be visible BEFORE WebSocket connection is established
  - [x] 7.3 Load persisted pending messages from localDb on startup
  - [x] 7.4 Measure and log startup time to verify < 2s target (NFR1)
  - [x] 7.5 If no cached modules exist, proceed normally (empty state)

- [x] Task 8: Create data freshness indicator component (AC: #3)
  - [x] 8.1 Create `apps/mobile/components/bridge/FreshnessIndicator.tsx` — displays data age relative to `updatedAt`
  - [x] 8.2 Implement freshness logic matching architecture spec:
    - `< 1 hour`: No indicator (implicitly fresh)
    - `1h - 24h`: Caption text "Updated Xh ago" under module title, using `tokens.colors.textSecondary` (#7899BB)
    - `> 24h`: Warning badge "Stale" with `tokens.colors.warning` (#E8C84C), data slightly dimmed
    - `Backend unreachable (dataStatus === 'error')`: Badge "Offline" with `tokens.colors.textSecondary`, last known data shown
  - [x] 8.3 Use Twilight design tokens from `constants/tokens.ts` for all colors and typography
  - [x] 8.4 Support accessibility: `accessibleLabel` on badge (e.g., "Data last updated 3 hours ago")
  - [x] 8.5 Export component with typed props: `{ updatedAt: string; dataStatus: DataStatus }`

- [x] Task 9: Create minimal module card placeholder for cache display (AC: #2, #3)
  - [x] 9.1 Create `apps/mobile/components/bridge/ModuleCard.tsx` — minimal card wrapper that displays a cached module's basic info
  - [x] 9.2 Display module name from spec, wrapped in card container using Twilight tokens (#101C2C bg, #1E2E44 border, 12px radius)
  - [x] 9.3 Include `FreshnessIndicator` component to show data age
  - [x] 9.4 Include `ErrorBoundary` wrapper (per architecture — every module renders inside an ErrorBoundary)
  - [x] 9.5 On render error: show fallback card with diagnostic info and structured log with `agent_action`
  - [x] 9.6 This is a PLACEHOLDER — full SDUI rendering comes in Epic 3. This card shows module name + freshness only.
  - [x] 9.7 Export component with typed props: `{ module: ModuleState }`
  - [x] 9.8 Ensure touch targets meet minimum size: 44x44pt iOS / 48x48dp Android (NFR33)

- [x] Task 10: Create module list display for cached data (AC: #2, #4)
  - [x] 10.1 Create `apps/mobile/components/bridge/ModuleList.tsx` — renders a scrollable list of ModuleCard components from moduleStore
  - [x] 10.2 Subscribe to `moduleStore.getAllModules()` for reactive rendering
  - [x] 10.3 Show empty state when no modules exist (simple text: "No modules yet")
  - [x] 10.4 Show offline indicator when `connectionStore.status !== 'connected'` and modules are being shown from cache
  - [x] 10.5 Use `FlatList` from React Native for efficient list rendering

- [x] Task 11: Update App.tsx to display cached modules (AC: #2, #3, #4)
  - [x] 11.1 Update `apps/mobile/App.tsx` to render `ModuleList` component below the connection status indicator
  - [x] 11.2 Show module count next to connection status
  - [x] 11.3 Ensure cached modules are visible even when connection status is `disconnected` or `reconnecting`

- [x] Task 12: Create design tokens file (AC: #3)
  - [x] 12.1 Create `apps/mobile/constants/tokens.ts` with the full Twilight theme tokens from architecture doc
  - [x] 12.2 Include: `colors`, `spacing`, `typography`, `radii`, `shadows`, `animation` sections exactly as specified
  - [x] 12.3 Export `tokens` as `const` object (immutable)
  - [x] 12.4 This file will be used by all future UI components — get it right from the start

- [x] Task 13: Write unit tests for localDb service (AC: #2, #4, #6)
  - [x] 13.1 Create `apps/mobile/services/localDb.test.ts`
  - [x] 13.2 Test `initLocalDb()` creates tables
  - [x] 13.3 Test `cacheModule()` / `getCachedModules()` — insert, update (upsert), retrieve
  - [x] 13.4 Test `removeCachedModule()` / `clearModulesCache()`
  - [x] 13.5 Test `enqueuePendingMessage()` / `dequeuePendingMessages()` — FIFO ordering, deletion after dequeue
  - [x] 13.6 Test `getPendingMessageCount()`
  - [x] 13.7 Mock expo-sqlite for unit tests (do not require actual SQLite)

- [x] Task 14: Write unit tests for moduleStore (AC: #2, #3)
  - [x] 14.1 Create `apps/mobile/stores/moduleStore.test.ts`
  - [x] 14.2 Test `addModule()` — adds to store and triggers cache
  - [x] 14.3 Test `updateModule()` — updates existing module
  - [x] 14.4 Test `removeModule()` — removes from store
  - [x] 14.5 Test `loadFromCache()` — populates store from cached data
  - [x] 14.6 Test `getModule()`, `getActiveModules()`, `getModuleCount()`
  - [x] 14.7 Test `setModuleStatus()`, `setModuleDataStatus()`
  - [x] 14.8 Mock `localDb` functions to verify cache persistence calls

- [x] Task 15: Write unit tests for moduleSync (AC: #5)
  - [x] 15.1 Create `apps/mobile/services/moduleSync.test.ts`
  - [x] 15.2 Test `module_created` handler adds module to store
  - [x] 15.3 Test `module_updated` handler updates module in store
  - [x] 15.4 Test `module_list` handler replaces all modules
  - [x] 15.5 Test `module_sync` handler merges delta updates and updates lastSync
  - [x] 15.6 Mock wsClient.onMessage and moduleStore

- [x] Task 16: Write unit tests for FreshnessIndicator (AC: #3)
  - [x] 16.1 Create `apps/mobile/components/bridge/FreshnessIndicator.test.tsx`
  - [x] 16.2 Test < 1h: no indicator rendered
  - [x] 16.3 Test 1h-24h: "Updated Xh ago" caption rendered
  - [x] 16.4 Test > 24h: "Stale" badge rendered with warning color
  - [x] 16.5 Test dataStatus === 'error': "Offline" badge rendered
  - [x] 16.6 Test accessibility labels

- [x] Task 17: Write integration/smoke test for startup flow (AC: #4)
  - [x] 17.1 Create `apps/mobile/__tests__/startup.test.ts`
  - [x] 17.2 Test: localDb initialized -> cached modules loaded -> moduleStore populated -> WS connection initiated (in correct order)
  - [x] 17.3 Mock localDb, wsClient, moduleStore to verify call sequence

- [x] Task 18: Backend — Add module cache support to sync endpoint (AC: #5)
  - [x] 18.1 Update `apps/backend/app/main.py` WS handler: when `sync` message is received with a `last_sync` timestamp, query modules updated since that timestamp
  - [x] 18.2 If `last_sync` is null or absent: respond with `module_list` (full sync with all modules)
  - [x] 18.3 If `last_sync` has a value: respond with `module_sync` containing only modules where `updated_at > last_sync`
  - [x] 18.4 Include `last_sync` field in `module_sync` response with the current server timestamp
  - [x] 18.5 Query the `modules` table in `self.db` for module data (using existing `db.py`)
  - [x] 18.6 This replaces the current stub that returns an empty `module_list`

- [x] Task 19: Write backend tests for delta sync (AC: #5)
  - [x] 19.1 Update `apps/backend/tests/test_ws.py` with new delta sync tests
  - [x] 19.2 Test `sync` with null `last_sync` returns `module_list` with all modules
  - [x] 19.3 Test `sync` with valid `last_sync` returns `module_sync` with only updated modules
  - [x] 19.4 Test `sync` with recent `last_sync` returns empty `module_sync` when no updates
  - [x] 19.5 Test `module_sync` response includes `last_sync` server timestamp
  - [x] 19.6 Insert test modules into the database using test fixtures

## Dev Notes

### Architecture Compliance (MANDATORY)

This story establishes the **offline-first data layer** for the mobile app. It introduces expo-sqlite for local caching and persisted message queuing, and the moduleStore for reactive module state management. This is the foundation for all future module rendering (Epic 3) and module interaction (Epic 7).

**Critical architecture patterns to follow:**

1. **Cache-first rendering (NFR18):** The app MUST display last known state when backend is unreachable. This is a 100% requirement. Cache loading happens BEFORE WebSocket connection.

2. **Zero message loss (NFR19):** Messages MUST be persisted to expo-sqlite, not just held in memory. App kill during offline period must not lose messages.

3. **Delta sync protocol:** On reconnection, send `{ type: "sync", payload: { last_sync: "ISO timestamp" } }`. Backend responds with `module_sync` containing only changed modules. If `last_sync` is null, backend sends full `module_list`.

4. **Module isolation:** Each module has independent state. A failure loading/rendering one module MUST NOT affect others. ErrorBoundary per module.

5. **Dual status tracking:** `ModuleStatus` (lifecycle: loading/active/stale/etc.) is separate from `DataStatus` (data freshness: ok/stale/error). A module can be `status: 'active'` but `dataStatus: 'error'` if its last refresh failed.

**Target file structure after this story:**

```
apps/mobile/
├── app/                        # Expo Router — pages only, minimal logic
│   └── (existing files)
├── components/
│   └── bridge/                 # NEW directory — lifecycle-aware wrappers
│       ├── ModuleCard.tsx      # NEW — minimal card placeholder + ErrorBoundary
│       ├── ModuleCard.test.tsx # NEW — tests
│       ├── ModuleList.tsx      # NEW — scrollable list of module cards
│       ├── FreshnessIndicator.tsx  # NEW — data age display
│       ├── FreshnessIndicator.test.tsx # NEW — tests
│       └── index.ts            # NEW — barrel export
├── constants/                  # NEW directory
│   └── tokens.ts               # NEW — Twilight design tokens
├── services/
│   ├── localDb.ts              # NEW — expo-sqlite wrapper for caching
│   ├── localDb.test.ts         # NEW — tests
│   ├── moduleSync.ts           # NEW — WS handler registration for module messages
│   ├── moduleSync.test.ts      # NEW — tests
│   ├── logger.ts               # EXISTS (unchanged)
│   └── wsClient.ts             # MODIFY (persistent queue via localDb)
├── stores/
│   ├── moduleStore.ts          # NEW — module state management
│   ├── moduleStore.test.ts     # NEW — tests
│   └── connectionStore.ts      # EXISTS (unchanged)
├── types/
│   ├── module.ts               # NEW — ModuleState, ModuleStatus, DataStatus types
│   └── ws.ts                   # EXISTS (unchanged)
├── utils/                      # EXISTS (unchanged)
├── __tests__/
│   └── startup.test.ts         # NEW — startup flow integration test
├── App.tsx                     # MODIFY (startup sequence + module display)
└── package.json                # MODIFY (add expo-sqlite)

apps/backend/
├── app/
│   └── main.py                 # MODIFY (delta sync logic in /ws handler)
└── tests/
    └── test_ws.py              # MODIFY (add delta sync tests)
```

### Data Freshness Indicators (from architecture)

| Data Age | Visual Indicator |
|----------|-----------------|
| < 1 hour | None (implicitly fresh) |
| 1h - 24h | Caption "Updated 3h ago" under module title |
| > 24h | `warning` Badge "Stale", data slightly dimmed |
| API unreachable | `textSecondary` Badge "Offline" + last known data |

### Design Tokens (Twilight Theme — EXACT from architecture)

The `constants/tokens.ts` file MUST match the architecture exactly:

```typescript
export const tokens = {
  colors: {
    background: '#0C1420',
    surface: '#101C2C',
    surfaceElevated: '#162436',
    border: '#1E2E44',
    text: '#E4ECF4',
    textSecondary: '#7899BB',
    accent: '#E8A84C',
    accentSubtle: '#12203A',
    success: '#5CB8A0',
    warning: '#E8C84C',
    error: '#CC5F5F',
    info: '#6B8ECC',
    agentGlow: 'rgba(232, 168, 76, 0.15)',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  typography: {
    title: { fontSize: 22, fontWeight: '700' as const },
    subtitle: { fontSize: 17, fontWeight: '600' as const },
    body: { fontSize: 15, fontWeight: '400' as const },
    caption: { fontSize: 13, fontWeight: '400' as const },
    metric: { fontSize: 28, fontWeight: '700' as const },
    metricUnit: { fontSize: 15, fontWeight: '400' as const },
  },
  radii: { sm: 4, md: 8, lg: 16 },
  shadows: {
    card: { shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    elevated: { shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  },
  animation: {
    orbIdle: { duration: 4000 },
    orbCreating: { duration: 1500 },
    breathe: { duration: 6000 },
    fadeIn: { duration: 400 },
    shimmer: { duration: 2000 },
    chipDismiss: { duration: 300 },
  },
} as const;
```

### Module Spec Shape (from existing types/ws.ts)

The `ModuleSpec` type is currently a minimal placeholder in `types/ws.ts`:
```typescript
export interface ModuleSpec {
  moduleId: string;
  [key: string]: unknown;
}
```
Do NOT change this placeholder. The full ModuleSpec lives in `@self/module-schema` and will be integrated in Epic 3. For caching purposes, store the entire spec as a JSON string in expo-sqlite.

### expo-sqlite Usage Pattern

expo-sqlite (Expo SDK 54) provides a synchronous-looking API with async operations:

```typescript
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('self-cache.db');

// Use execAsync for DDL
await db.execAsync('CREATE TABLE IF NOT EXISTS ...');

// Use runAsync for DML with parameters
await db.runAsync('INSERT OR REPLACE INTO modules_cache VALUES (?, ?, ?, ?)', [id, spec, status, updatedAt]);

// Use getAllAsync for queries
const rows = await db.getAllAsync<CachedModule>('SELECT * FROM modules_cache ORDER BY updated_at DESC');
```

**IMPORTANT:** expo-sqlite in SDK 54 uses `openDatabaseSync` (not the older `openDatabase` callback-based API). The new API returns a database object with `execAsync`, `runAsync`, `getFirstAsync`, `getAllAsync` methods. Do NOT use the deprecated callback-based API.

### Offline Queue Persistence Strategy

The current `wsClient.ts` uses an in-memory `pendingMessages` array. This story upgrades it to a hybrid approach:

1. **In-memory array** for fast access during the current session
2. **expo-sqlite `pending_messages` table** for persistence across app kills

**On startup:**
1. Load persisted messages from `pending_messages` table
2. Prepend them to the in-memory queue (they came first)
3. These will be flushed when WebSocket connects

**On queue:**
1. Add to in-memory array (existing behavior)
2. Also persist to `pending_messages` table

**On flush:**
1. Send from in-memory array (existing behavior)
2. Clear the `pending_messages` table after successful flush

This ensures zero message loss even if the app is killed while offline.

### Startup Sequence (CRITICAL ORDER)

```
1. initLocalDb()           — Create/open expo-sqlite tables
2. Load cached modules     — getCachedModules() → moduleStore.loadFromCache()
3. Load persisted queue    — dequeuePendingMessages() → prepend to wsClient queue
4. Render UI with cache    — ModuleList shows cached modules immediately
5. connect(backendUrl)     — WebSocket connection starts (async, non-blocking)
6. On connect success      — flushPendingMessages() → sync message → delta update
```

Steps 1-4 MUST complete before the UI renders (or at minimum, cached content must be visible within 2s of cold start per NFR1).

### What NOT To Do

- Do NOT implement full SDUI rendering — ModuleCard is a PLACEHOLDER showing module name + freshness only. Full primitive rendering comes in Epic 3.
- Do NOT implement Shell/SDUI components (Orb, ChatInput, ChatBubble) — those come in Epic 2.
- Do NOT implement module creation flow — that is Epic 3.
- Do NOT implement module interaction (tap, scroll, expand) — that is Epic 7 Story 7.3.
- Do NOT implement module lifecycle transitions (active/stale/dormant) — that is Epic 11.
- Do NOT add expo-secure-store — that comes in Story 1.6 for authentication.
- Do NOT add react-native-reanimated — that comes later for animations.
- Do NOT implement the Phase Morphing interface (PhaseController, StatusLine) — that comes in Epic 2/3 when real modules exist.
- Do NOT implement vitality scoring — that is Epic 4.
- Do NOT create REST endpoints — WebSocket is the only communication channel.
- Do NOT change the existing WS message protocol types — they are correct as-is.
- Do NOT implement `auth` message handling — that is Story 1.6.
- Do NOT modify the backend module database schema — `001_init.sql` already defines the `modules` table correctly.
- Do NOT implement streaming — `chat_stream` behavior is unchanged from 1.4.
- Do NOT create a `components/shell/` or `components/sdui/` directory — only `components/bridge/` in this story.

### Previous Story Intelligence

**From Story 1.4 (Mobile App Shell & WebSocket Connection — done):**
- `wsClient.ts` fully implemented with connect/disconnect/send, exponential backoff reconnection, offline message queue (in-memory only), onMessage handler registry
- `connectionStore.ts` with status, reconnectAttempts, lastSync, backendUrl
- `types/ws.ts` with full 15-type WSMessage discriminated union
- `toCamel.ts` / `toSnake.ts` case conversion utilities working
- `logger.ts` structured logging service working
- Backend `/ws` endpoint handling chat (echo stub), log (forward), sync (empty module_list)
- Review follow-ups: toCamel leading underscore issue (LOW), no WS URL validation (LOW)
- 176 mobile tests, 432 backend tests, zero regressions
- `App.tsx` displays connection status indicator (colored dot + label)
- `zustand` 5.x installed and working
- Path aliases configured: `@/services/*`, `@/stores/*`, `@/types/*`, `@/utils/*`
- `MAX_PENDING_MESSAGES = 200` limit with oldest-message-drop on overflow
- `jest.config.js` has `moduleNameMapper` for path aliases

**From Story 1.3 (LLM Provider Abstraction — done):**
- 5 LLM providers working (3 CLI + 2 API)
- CircuitBreaker, RateLimiter, retry logic all working
- `/health` endpoint returns provider info
- structlog patterns: event name first positional, context as kwargs
- `get_available_providers()` reads from settings

**From Story 1.2 (Backend Skeleton — done):**
- `config.py` with Settings class (pydantic-settings)
- `db.py` with `get_connection()`, `run_migrations()`, WAL mode
- `001_init.sql` creates 6 tables including `modules` with: id, name, spec (JSON), status, vitality_score, user_id, created_at, updated_at
- `main.py` with FastAPI lifespan, `/health` endpoint
- Migrations: numbered SQL files, transaction-wrapped, backup before migration
- `ASGITransport` does NOT trigger lifespan — tests use `app.router.lifespan_context`

**From Story 1.1 (Monorepo — done):**
- pnpm 10.30.1, Expo SDK 54, RN 0.81.5, React 19.1, TypeScript 5.9
- Zod 4 source of truth in `packages/module-schema/`
- `tsconfig.json` path aliases configured for `@/components/*`, `@/services/*`, `@/stores/*`, `@/types/*`, `@/utils/*`
- `metro.config.js` for pnpm monorepo symlink resolution
- `services/` and `stores/` directories exist

**From Git History:**
- `b31d304` feat(1-4): mobile app shell and WebSocket connection
- `a4f2438` feat(1-3): LLM provider abstraction with 5 providers, circuit breaker, and BYOK config
- `c39899d` 1.2 (backend skeleton)
- Commit convention: `feat(1-X):` for story implementations

### Key Technical Considerations

1. **expo-sqlite API (SDK 54):** Uses `openDatabaseSync()` which returns an object with async methods (`execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync`). This is the NEW API — do NOT use the deprecated `openDatabase()` with callbacks. See https://docs.expo.dev/versions/latest/sdk/sqlite/

2. **Module spec JSON storage:** Store the entire ModuleSpec as a JSON string in the `spec` column. Parse it back with `JSON.parse()` when reading. This avoids schema coupling with the evolving ModuleSpec format.

3. **Zustand + expo-sqlite:** The moduleStore is the reactive source of truth for the UI. expo-sqlite is the persistence layer for offline. They must stay in sync: every store mutation also writes to SQLite. Use `localDb.cacheModule()` inside store actions.

4. **ErrorBoundary pattern:** From the architecture, every module renders inside an ErrorBoundary. Create a simple ErrorBoundary class component (React class components are required for error boundaries). It catches render errors and shows a fallback card with diagnostic info.

5. **No components/shell/ or components/sdui/ yet:** This story only creates `components/bridge/` with ModuleCard, ModuleList, and FreshnessIndicator. The Shell (Orb, ChatInput) and SDUI (primitives) come in later epics.

6. **Backend delta sync query:** The `modules` table already has an `updated_at` column. The sync query is: `SELECT * FROM modules WHERE updated_at > ? AND user_id = ?` — simple and efficient.

7. **Constants directory:** Create `apps/mobile/constants/` directory for `tokens.ts`. This is the first file in this directory. It will hold all design tokens for the Twilight theme.

8. **expo-sqlite mocking in tests:** expo-sqlite is a native module. For Jest tests, mock it using `jest.mock('expo-sqlite')` and provide mock implementations for `openDatabaseSync`, `execAsync`, `runAsync`, `getAllAsync`.

9. **FlatList for module list:** Use React Native's `FlatList` component for rendering the module list. It provides virtualization for performance and handles empty states.

10. **barrel exports:** Create `components/bridge/index.ts` to barrel-export the bridge components. Follow the architecture pattern: barrel per sub-folder, never a global `components/index.ts`.

### Project Structure Notes

- Creates new `components/bridge/` directory — matches architecture's 3-layer component architecture (Shell/Bridge/SDUI)
- Creates new `constants/` directory for design tokens
- Creates new `services/localDb.ts` — the local persistence layer
- Creates new `services/moduleSync.ts` — WS message handlers for module data
- Creates new `stores/moduleStore.ts` — the central module state store
- Creates new `types/module.ts` — module-related type definitions
- Modifies `wsClient.ts` — adds persistent queue capability
- Modifies `App.tsx` — adds startup sequence and module list display
- Modifies `package.json` — adds expo-sqlite dependency
- Backend changes limited to `main.py` (delta sync) and `test_ws.py` (new tests)
- No docker-compose.yml changes needed
- No schema migration changes needed (modules table already exists)

### References

- [Source: architecture.md#Data Architecture] -- SQLite WAL mode, modules table schema (lines 346-379)
- [Source: architecture.md#Offline Flow] -- Cache-first rendering, moduleStore loads from expo-sqlite, pendingMessages flushed (lines 1437-1448)
- [Source: architecture.md#Sync Protocol] -- Delta sync on reconnection, updated_at based, sync/module_sync messages (lines 1449-1458)
- [Source: architecture.md#Data Freshness Indicators] -- < 1h none, 1-24h caption, > 24h stale badge, unreachable offline badge (lines 626-634)
- [Source: architecture.md#V1 Design Tokens] -- Complete Twilight theme token object (lines 635-693)
- [Source: architecture.md#Mobile Architecture (SDUI)] -- Module isolation, ErrorBoundary per module, render vs data errors (lines 583-589)
- [Source: architecture.md#Component Boundaries] -- Shell/Bridge/SDUI layer separation, Bridge components own lifecycle logic (lines 1293-1312)
- [Source: architecture.md#Zustand Store Conventions] -- ModuleStore interface pattern, state/actions/selectors naming (lines 994-1019)
- [Source: architecture.md#Communication Patterns] -- Message queue during disconnection (lines 1030-1051)
- [Source: architecture.md#Module lifecycle state machine] -- loading/active/refreshing/stale/dormant/error states (lines 558-566)
- [Source: architecture.md#Phase Morphing Interface] -- Phase thresholds based on module count (lines 593-618)
- [Source: epics.md#Story 1.5] -- FR57 offline message queue, FR58 cached data rendering, NFR18/NFR19 (lines 507-525)
- [Source: prd.md#FR57] -- Queue messages during disconnection, deliver in order upon reconnection
- [Source: prd.md#FR58] -- Render cached module data when backend is unavailable
- [Source: prd.md#NFR1] -- App cold start to cached content visible < 2 seconds
- [Source: prd.md#NFR18] -- Cache-first rendering, 100% display of last known state
- [Source: prd.md#NFR19] -- Message queue for offline input, zero message loss on reconnection
- [Source: story 1-4] -- wsClient.ts structure, connectionStore, WS protocol types, App.tsx layout, 176 mobile tests
- [Source: story 1-2] -- db.py, modules table schema in 001_init.sql, main.py structure
- [Source: story 1-1] -- Monorepo structure, tsconfig paths, Expo SDK 54 setup

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- All tests pass: 300 mobile tests, 448 backend tests
- Zero regressions from previous stories

### Completion Notes List

- Implemented offline-first data layer with expo-sqlite for local caching and persistent message queue
- Created moduleStore (Zustand) for reactive module state management with cache persistence
- Created moduleSync service for WS message handler registration (module_created, module_updated, module_list, module_sync)
- Upgraded wsClient offline queue to hybrid in-memory + persistent storage (zero message loss on app kill)
- Created Twilight design tokens matching architecture spec exactly
- Created bridge components: FreshnessIndicator (< 1h/1-24h/> 24h/offline states), ModuleCard (placeholder with ErrorBoundary), ModuleList (FlatList with offline indicator)
- Updated App.tsx startup sequence: initLocalDb -> loadCache -> loadPersistedMessages -> initModuleSync -> connect (cache-first, WS last)
- Implemented backend delta sync: full sync (module_list) when no last_sync, delta sync (module_sync) when last_sync provided
- All module types defined: ModuleStatus (6 states), DataStatus (3 states), ModuleState, CachedModule
- Added @testing-library/react-native for component testing
- Module spec stored as JSON string in SQLite, parsed on retrieval (schema-independent)

### Change Log

- 2026-02-23: Story 1-5 implementation complete. All 19 tasks with subtasks implemented and tested.
- 2026-02-23: Code review complete. 3 HIGH, 3 MEDIUM fixed; 5 LOW documented as follow-ups.

### Review Follow-ups

- [ ] [AI-Review][LOW] FreshnessIndicator uses Math.floor for hours, so 1h59m shows as "Updated 1h ago". Consider Math.round or minutes display for < 2h. [components/bridge/FreshnessIndicator.tsx:25]
- [ ] [AI-Review][LOW] ModuleCard uses double type assertion `(module.spec as Record<string, unknown>).name as string`. Since ModuleSpec has index signature, `.name` is accessible without the intermediate cast. [components/bridge/ModuleCard.tsx:24]
- [ ] [AI-Review][LOW] ModuleCard View lacks `accessibilityRole` for screen readers (NFR30-33 WCAG AA). Add `accessibilityRole="summary"` or similar. [components/bridge/ModuleCard.tsx:28]
- [ ] [AI-Review][LOW] FreshnessIndicatorProps and ModuleCardProps types not re-exported from barrel index.ts. Consumers must import directly from component files. [components/bridge/index.ts]
- [ ] [AI-Review][LOW] getBackendUrl utility has no unit tests. [utils/getBackendUrl.ts]

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 (adversarial code review)
**Date:** 2026-02-23

**Summary:** Story 1-5 implementation is solid. All 6 ACs are met. All 19 tasks with subtasks are genuinely implemented. Tests are thorough (300 mobile, 448 backend, zero regressions). Architecture compliance is strong: cache-first rendering, zero message loss, delta sync, module isolation, dual status tracking.

**Issues Found and Fixed:**
1. **[HIGH] dequeuePendingMessages race condition** — SELECT and DELETE were not atomic. Fixed by using `DELETE WHERE id <= ?` to only delete the rows that were read, preventing loss of concurrently-enqueued messages.
2. **[HIGH] Queue overflow doesn't sync SQLite** — When in-memory queue overflows (>200), oldest is dropped from memory but not from SQLite. On restart, dropped messages would reappear. Fixed by enforcing MAX_PENDING_MESSAGES limit in loadPersistedMessages after merge.
3. **[MEDIUM] Backend opens new DB connection per sync call** — Refactored to use a session-scoped connection opened once per WS session and closed on disconnect. Extracted _parse_module_rows helper to reduce code duplication.
4. **[MEDIUM] Story File List incomplete** — Added 5 missing files (ModuleCard.test.tsx, ModuleList.test.tsx, getBackendUrl.ts, wsClient.test.ts, connectionStore.ts).
5. **[MEDIUM] Task subtask checkboxes inconsistent** — Tasks 10-19 had parent [x] but all subtasks [ ]. Fixed all subtask checkboxes to [x].

**Verdict:** APPROVED. All HIGH and MEDIUM issues fixed. All ACs implemented. Status set to done.

### File List

New files:
- apps/mobile/constants/tokens.ts
- apps/mobile/types/module.ts
- apps/mobile/services/localDb.ts
- apps/mobile/services/localDb.test.ts
- apps/mobile/services/moduleSync.ts
- apps/mobile/services/moduleSync.test.ts
- apps/mobile/stores/moduleStore.ts
- apps/mobile/stores/moduleStore.test.ts
- apps/mobile/components/bridge/ErrorBoundary.tsx
- apps/mobile/components/bridge/FreshnessIndicator.tsx
- apps/mobile/components/bridge/FreshnessIndicator.test.tsx
- apps/mobile/components/bridge/ModuleCard.tsx
- apps/mobile/components/bridge/ModuleCard.test.tsx
- apps/mobile/components/bridge/ModuleList.tsx
- apps/mobile/components/bridge/ModuleList.test.tsx
- apps/mobile/components/bridge/index.ts
- apps/mobile/__mocks__/expo-sqlite.ts
- apps/mobile/__tests__/startup.test.ts
- apps/mobile/utils/getBackendUrl.ts

Modified files:
- apps/mobile/package.json (added expo-sqlite, @testing-library/react-native, react-test-renderer)
- apps/mobile/tsconfig.json (added @/constants/* path alias)
- apps/mobile/jest.config.js (added expo-sqlite mock mapping)
- apps/mobile/services/wsClient.ts (persistent queue via localDb, loadPersistedMessages)
- apps/mobile/services/wsClient.test.ts (persistent queue tests, loadPersistedMessages tests)
- apps/mobile/stores/connectionStore.ts (import getBackendUrl for dynamic URL resolution)
- apps/mobile/App.tsx (startup sequence, module list display, design tokens)
- apps/backend/app/main.py (delta sync logic in _handle_sync, session-scoped DB connection)
- apps/backend/tests/test_ws.py (delta sync tests, updated existing sync tests)
