# Story 1.6: Session Authentication & Mobile-Backend Pairing

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to connect my mobile app to my self-hosted backend through a simple pairing flow with session authentication,
So that my session is secure and persistent across reconnections. (FR39, FR49)

## Acceptance Criteria

1. **Given** a running backend instance **When** the backend starts **Then** it generates a pairing token (UUID v4) that is displayed in the backend logs and available via `GET /health` (extended to include a `pairing_token` field only when no active session exists) **And** the pairing token is stored in the `sessions` table

2. **Given** the mobile app is launched for the first time **When** no session token exists in expo-secure-store **Then** a pairing screen is displayed allowing the user to enter the backend URL and pairing token (manual entry) **And** QR code scanning is deferred to MVP (per architecture Gap #4)

3. **Given** the user enters a valid backend URL and pairing token on mobile **When** the pairing is initiated **Then** the mobile generates a UUID v4 session token, stores it in expo-secure-store **And** the first WebSocket message sent is `{ type: "auth", payload: { token: "session-token" } }` **And** the backend verifies the token against the `sessions` table, creates a new session entry if valid pairing token is presented

4. **Given** an authenticated session exists **When** the WebSocket connection drops and reconnects **Then** the mobile sends the stored session token via `auth` message **And** the session is maintained without requiring re-pairing (FR39) **And** the `last_seen` field is updated in the `sessions` table

5. **Given** an invalid or expired session token **When** the mobile app attempts to connect **Then** the backend sends `{ type: "error", payload: { code: "AUTH_INVALID_TOKEN", message: "...", agent_action: "..." } }` **And** the mobile clears the stored token and shows the pairing screen

6. **Given** the backend receives a WebSocket message from an unauthenticated connection **When** the message type is NOT `auth` **Then** the backend responds with `{ type: "error", payload: { code: "AUTH_REQUIRED", message: "...", agent_action: "..." } }` **And** does not process the message

7. **Given** the user wants to reset their session **When** the mobile sends `{ type: "auth_reset", payload: {} }` **Then** the backend invalidates the current session token in the `sessions` table **And** generates a new session token **And** responds with `{ type: "status", payload: { state: "idle" } }` indicating success **And** the mobile stores the new token in expo-secure-store

8. **Given** all tables in the database **When** I inspect the schema **Then** every table includes `user_id TEXT DEFAULT 'default'` for future multi-user readiness (NFR29) *(already satisfied by 001_init.sql)*

## Tasks / Subtasks

- [ ] Task 1: Install expo-secure-store dependency (AC: #2, #3)
  - [ ] 1.1 Add `expo-secure-store` to `apps/mobile/package.json` dependencies
  - [ ] 1.2 Run `pnpm install` from the monorepo root
  - [ ] 1.3 Verify the dependency resolves correctly and does not break existing tests
  - [ ] 1.4 Create `apps/mobile/__mocks__/expo-secure-store.ts` mock for Jest tests (in-memory key-value store implementing `getItemAsync`, `setItemAsync`, `deleteItemAsync`)

- [ ] Task 2: Create auth service for session token management (AC: #2, #3, #4)
  - [ ] 2.1 Create `apps/mobile/services/auth.ts` — async wrapper around expo-secure-store for session token and backend URL persistence
  - [ ] 2.2 Implement `getSessionToken(): Promise<string | null>` — reads token from SecureStore key `self_session_token`
  - [ ] 2.3 Implement `setSessionToken(token: string): Promise<void>` — writes token to SecureStore
  - [ ] 2.4 Implement `clearSessionToken(): Promise<void>` — deletes token from SecureStore
  - [ ] 2.5 Implement `getStoredBackendUrl(): Promise<string | null>` — reads URL from SecureStore key `self_backend_url`
  - [ ] 2.6 Implement `setStoredBackendUrl(url: string): Promise<void>` — writes URL to SecureStore
  - [ ] 2.7 Implement `generateSessionToken(): string` — generates a UUID v4 (use `crypto.randomUUID()` or `expo-crypto` if needed)
  - [ ] 2.8 Implement `isSessionConfigured(): Promise<boolean>` — returns true if both token AND backend URL exist in SecureStore
  - [ ] 2.9 Log all auth operations with structured logging including `agent_action` on errors
  - [ ] 2.10 Export all functions

- [ ] Task 3: Create authStore (Zustand) (AC: #2, #4, #5)
  - [ ] 3.1 Create `apps/mobile/stores/authStore.ts` with Zustand
  - [ ] 3.2 Define state: `sessionToken: string | null`, `backendUrl: string | null`, `authStatus: AuthStatus`, `pairingError: string | null`
  - [ ] 3.3 Define `AuthStatus = 'unconfigured' | 'pairing' | 'authenticating' | 'authenticated' | 'auth_failed'` — status enum, NEVER boolean
  - [ ] 3.4 Define actions: `setSessionToken(token: string | null)`, `setBackendUrl(url: string | null)`, `setAuthStatus(status: AuthStatus)`, `setPairingError(error: string | null)`, `clearAuth()`
  - [ ] 3.5 Define selectors: `getIsAuthenticated()`, `getIsPaired()`
  - [ ] 3.6 Add `AuthStatus` type to `apps/mobile/types/module.ts` (or a new `types/auth.ts`)
  - [ ] 3.7 Follow Zustand conventions: state = nouns, actions = imperative verbs, selectors = get + descriptive noun

- [ ] Task 4: Update wsClient to send auth message on connect (AC: #3, #4, #6)
  - [ ] 4.1 Update `apps/mobile/services/wsClient.ts` — on WebSocket `onopen`, send `{ type: "auth", payload: { token: sessionToken } }` BEFORE flushing pending messages or sending sync
  - [ ] 4.2 Read session token from `authStore` (not directly from SecureStore, since it's already loaded on startup)
  - [ ] 4.3 If no session token is available on connect, log a warning and do not connect (auth is required)
  - [ ] 4.4 Register an `error` handler that checks for `AUTH_INVALID_TOKEN` or `AUTH_REQUIRED` error codes — on either, call `authStore.setAuthStatus('auth_failed')` and `authStore.clearAuth()`
  - [ ] 4.5 Ensure `flushPendingMessages()` only happens AFTER auth is acknowledged (for now: after sending auth message, proceed to flush; backend processes auth synchronously before any other messages)
  - [ ] 4.6 Update `sendSyncOnReconnect()` to happen after auth message on reconnect too

- [ ] Task 5: Create PairingScreen component (AC: #2, #5)
  - [ ] 5.1 Create `apps/mobile/components/shell/PairingScreen.tsx` — simple form with two text inputs: Backend URL, Pairing Token
  - [ ] 5.2 Style with Twilight design tokens from `constants/tokens.ts`:
    - Background: `tokens.colors.background` (#0C1420)
    - Input fields: `tokens.colors.surfaceElevated` (#162436) background, `tokens.colors.border` (#1E2E44) border
    - Button: `tokens.colors.accent` (#E8A84C) background, `tokens.colors.background` text
    - Error text: `tokens.colors.error` (#CC5F5F)
    - Label text: `tokens.colors.text` (#E4ECF4)
  - [ ] 5.3 On "Connect" button press: validate inputs are non-empty, store backend URL in authStore and SecureStore, generate UUID session token, store in authStore and SecureStore, set authStatus to 'pairing', initiate WebSocket connection
  - [ ] 5.4 Display error messages from `authStore.pairingError` if pairing fails
  - [ ] 5.5 Show a loading state while pairing is in progress (use authStatus 'pairing' or 'authenticating')
  - [ ] 5.6 Ensure touch targets meet minimum 44x44pt (NFR33) for inputs and button
  - [ ] 5.7 Ensure accessibility labels on all interactive elements (NFR31)
  - [ ] 5.8 Create `apps/mobile/components/shell/index.ts` barrel export for shell components

- [ ] Task 6: Backend — Implement auth message handling (AC: #1, #3, #4, #5, #6)
  - [ ] 6.1 Update `apps/backend/app/main.py` — add authentication state to the WebSocket session
  - [ ] 6.2 Add a session-level `authenticated` flag (initially `False`) and `session_id` variable in the `websocket_endpoint` function
  - [ ] 6.3 On receiving `auth` message type:
    - Extract `token` from payload
    - Query `sessions` table for matching token
    - If token found: set `authenticated = True`, update `last_seen` timestamp, log success
    - If token NOT found but the system is in pairing mode (first connection, no sessions exist yet, or a pairing token matches): create new session in `sessions` table, set `authenticated = True`
    - If token NOT found and pairing is not valid: send `AUTH_INVALID_TOKEN` error
  - [ ] 6.4 On receiving `auth_reset` message type:
    - If not authenticated: send `AUTH_REQUIRED` error
    - If authenticated: invalidate current session, generate new UUID token, insert new session, send new token via `status` message
  - [ ] 6.5 For ALL other message types: check `authenticated` flag before processing
    - If not authenticated: send `AUTH_REQUIRED` error, do not process the message
  - [ ] 6.6 Generate a pairing token on backend startup (UUID v4), store in sessions table with `user_id='default'`, log it clearly for the user to copy
  - [ ] 6.7 Extend `GET /health` to include `pairing_available: bool` field (true if pairing token exists and no active client session has been seen in the last 5 minutes)

- [ ] Task 7: Backend — Create session management helpers (AC: #3, #4, #6, #7)
  - [ ] 7.1 Create `apps/backend/app/sessions.py` — session CRUD operations
  - [ ] 7.2 Implement `create_session(db, token: str, user_id: str = 'default') -> dict` — inserts into sessions table with `created_at` and `last_seen` as current UTC ISO timestamp
  - [ ] 7.3 Implement `get_session_by_token(db, token: str) -> dict | None` — queries sessions table
  - [ ] 7.4 Implement `update_session_last_seen(db, session_id: str) -> None` — updates `last_seen` timestamp
  - [ ] 7.5 Implement `invalidate_session(db, session_id: str) -> None` — deletes session from table
  - [ ] 7.6 Implement `create_pairing_token(db) -> str` — generates UUID v4, creates a session with a special marker (e.g., `token` prefixed with `pairing:` or a separate `is_pairing` boolean column via migration)
  - [ ] 7.7 Implement `consume_pairing_token(db, pairing_token: str, session_token: str) -> dict | None` — if pairing token exists, creates real session with session_token and removes pairing token
  - [ ] 7.8 All functions are async, use `aiosqlite`, follow the `db.py` patterns
  - [ ] 7.9 Log all operations with structured logging

- [ ] Task 8: Backend — Add pairing token column to sessions table (AC: #1)
  - [ ] 8.1 Create `apps/backend/migrations/002_session_pairing.sql` — adds `is_pairing INTEGER DEFAULT 0` column to sessions table
  - [ ] 8.2 Pairing tokens have `is_pairing = 1`, real session tokens have `is_pairing = 0`
  - [ ] 8.3 When a pairing token is consumed, it is deleted and a new real session is created
  - [ ] 8.4 Update `schema_version` to `2`

- [ ] Task 9: Update App.tsx for auth-gated startup flow (AC: #2, #4, #5)
  - [ ] 9.1 Update `apps/mobile/App.tsx` startup sequence:
    1. Initialize local database (`initLocalDb()`)
    2. Load session token and backend URL from SecureStore into authStore
    3. If session is configured (token + URL exist): proceed to cached module load + WS connect (existing flow)
    4. If session is NOT configured: show PairingScreen, do NOT connect WebSocket
  - [ ] 9.2 After successful pairing from PairingScreen: transition to main app view, initiate WS connection
  - [ ] 9.3 On `auth_failed` status in authStore: show PairingScreen with error message
  - [ ] 9.4 Cached module display still works before auth (show cached data even in pairing screen, if any)

- [ ] Task 10: Handle auth_reset flow on mobile (AC: #7)
  - [ ] 10.1 Add `resetSession()` function to auth service — sends `auth_reset` WS message, waits for response
  - [ ] 10.2 On receiving new token from backend: update SecureStore and authStore
  - [ ] 10.3 This is a developer/debug feature — no UI button needed in V1, callable from dev console or code

- [ ] Task 11: Write unit tests for auth service (AC: #2, #3)
  - [ ] 11.1 Create `apps/mobile/services/auth.test.ts`
  - [ ] 11.2 Test `getSessionToken()` / `setSessionToken()` / `clearSessionToken()` — SecureStore read/write/delete
  - [ ] 11.3 Test `getStoredBackendUrl()` / `setStoredBackendUrl()`
  - [ ] 11.4 Test `generateSessionToken()` — returns a valid UUID v4
  - [ ] 11.5 Test `isSessionConfigured()` — true when both token and URL exist, false otherwise
  - [ ] 11.6 Mock expo-secure-store for unit tests

- [ ] Task 12: Write unit tests for authStore (AC: #3, #5)
  - [ ] 12.1 Create `apps/mobile/stores/authStore.test.ts`
  - [ ] 12.2 Test all actions: setSessionToken, setBackendUrl, setAuthStatus, setPairingError, clearAuth
  - [ ] 12.3 Test selectors: getIsAuthenticated (true only when authStatus === 'authenticated'), getIsPaired (true when token and URL exist)
  - [ ] 12.4 Test clearAuth resets all state

- [ ] Task 13: Write unit tests for PairingScreen (AC: #2, #5)
  - [ ] 13.1 Create `apps/mobile/components/shell/PairingScreen.test.tsx`
  - [ ] 13.2 Test renders two text inputs (backend URL, pairing token) and a connect button
  - [ ] 13.3 Test connect button disabled when inputs are empty
  - [ ] 13.4 Test error message displayed when pairingError is set
  - [ ] 13.5 Test loading state while authStatus is 'pairing'
  - [ ] 13.6 Test accessibility labels on inputs and button

- [ ] Task 14: Write backend tests for session management (AC: #3, #4, #6, #7)
  - [ ] 14.1 Create `apps/backend/tests/test_sessions.py`
  - [ ] 14.2 Test `create_session()` — inserts with correct timestamps
  - [ ] 14.3 Test `get_session_by_token()` — returns session or None
  - [ ] 14.4 Test `update_session_last_seen()` — updates timestamp
  - [ ] 14.5 Test `invalidate_session()` — deletes session
  - [ ] 14.6 Test `create_pairing_token()` — creates pairing session
  - [ ] 14.7 Test `consume_pairing_token()` — creates real session, deletes pairing token

- [ ] Task 15: Write backend tests for auth in WS endpoint (AC: #3, #4, #5, #6)
  - [ ] 15.1 Update `apps/backend/tests/test_ws.py` with auth tests
  - [ ] 15.2 Test: unauthenticated connection sending `chat` message gets `AUTH_REQUIRED` error
  - [ ] 15.3 Test: `auth` message with valid token → authenticated, subsequent messages processed
  - [ ] 15.4 Test: `auth` message with invalid token → `AUTH_INVALID_TOKEN` error
  - [ ] 15.5 Test: `auth` with valid pairing token → session created, authenticated
  - [ ] 15.6 Test: `auth_reset` when authenticated → old session deleted, new token returned
  - [ ] 15.7 Test: `auth_reset` when not authenticated → `AUTH_REQUIRED` error
  - [ ] 15.8 Test: reconnection with same session token → session maintained, `last_seen` updated
  - [ ] 15.9 Test: pairing token generated on startup and visible in health endpoint

- [ ] Task 16: Write integration test for pairing flow (AC: #2, #3, #4)
  - [ ] 16.1 Create `apps/mobile/__tests__/pairing.test.ts`
  - [ ] 16.2 Test: first launch → no token → pairing screen shown
  - [ ] 16.3 Test: enter URL + token → pairing succeeds → main app shown → WS connected
  - [ ] 16.4 Test: subsequent launch → token exists → skip pairing → main app shown directly
  - [ ] 16.5 Test: auth failure → pairing screen shown with error
  - [ ] 16.6 Mock SecureStore, wsClient, authStore

- [ ] Task 17: Update jest.config.js for new mocks (AC: all)
  - [ ] 17.1 Add `expo-secure-store` to `moduleNameMapper` in `apps/mobile/jest.config.js`, pointing to `__mocks__/expo-secure-store.ts`
  - [ ] 17.2 Verify all existing tests still pass after changes

## Dev Notes

### Architecture Compliance (MANDATORY)

This is the final story in Epic 1 (Project Bootstrap & Developer Connection). It implements session authentication and the mobile-backend pairing flow, closing the loop on the secure connection established in stories 1.4 and 1.5.

**Critical architecture patterns to follow:**

1. **UUID session auth (NOT JWT):** The architecture explicitly chooses UUID v4 tokens over JWT. No crypto libraries, no token signing, no expiration claims. Simple token lookup in the `sessions` table. Quote from architecture: "UUID v4 token generated on first mobile launch, stored in expo-secure-store. No JWT -- unnecessary crypto complexity for a single-user self-hosted system."

2. **Auth message as first WS message:** The architecture specifies: "First message after connection: `{ type: "auth", token: "uuid-here" }`. Not via query parameter (visible in server logs) or header (inconsistent WS support on mobile). Backend verifies token against sessions table, creates entry if new."

3. **expo-secure-store for secrets:** API keys and session tokens go in expo-secure-store ONLY. Never in expo-sqlite, never in AsyncStorage, never in plain files. The architecture explicitly calls out: "SecureStore | auth.ts | API keys + session token only".

4. **No token expiration in V1:** Architecture states: "No token expiration in V1 -- single user, single device." The session persists indefinitely until manually reset via `auth_reset`.

5. **Manual pairing in First Light, QR in MVP:** Architecture Gap #4 resolved: "For First Light (developer use only), connection via manual config (backend URL in settings screen). QR code scanning via expo-camera arrives in MVP."

6. **All messages require auth:** After the initial `auth` message, the backend must verify authentication on every subsequent message. Unauthenticated messages get `AUTH_REQUIRED` error.

### Pairing Flow (Step by Step)

```
FIRST LAUNCH:
1. Backend starts → generates pairing token (UUID v4) → stores in sessions table (is_pairing=1) → logs token
2. User sees pairing token in backend logs (or /health endpoint)
3. User opens mobile app → no token in SecureStore → PairingScreen shown
4. User enters: backend URL + pairing token → taps "Connect"
5. Mobile generates session token (UUID v4) → stores in SecureStore
6. Mobile connects WebSocket → sends auth message with session token AND pairing token
7. Backend verifies pairing token → creates real session → deletes pairing token → responds success
8. Mobile transitions to main app view

SUBSEQUENT LAUNCHES:
1. Mobile loads token from SecureStore → connects WS → sends auth with stored token
2. Backend finds token in sessions → authenticated → continue
```

### WebSocket Auth Sequence

```
connect → send auth { token } → wait for response
  ↓ (success: no error response = authenticated)
flushPendingMessages → sendSyncOnReconnect → normal operation
  ↓ (failure: error response with AUTH_INVALID_TOKEN)
clear token → show PairingScreen
```

**Important:** The current architecture does not define an explicit "auth_success" message type. The absence of an error after sending `auth` implies success. The backend processes the auth synchronously before accepting other messages. If auth fails, an `error` message is sent.

### Backend Auth Gate Pattern

```python
# In websocket_endpoint():
authenticated = False
session_id = None

while True:
    raw = await ws.receive_text()
    msg = json.loads(raw)
    msg_type = msg.get("type")
    payload = msg.get("payload", {})

    if msg_type == "auth":
        # Handle auth (create/verify session)
        ...
        authenticated = True
        continue

    if not authenticated:
        await ws.send_json({
            "type": "error",
            "payload": {
                "code": "AUTH_REQUIRED",
                "message": "Authentication required. Send auth message first.",
                "agent_action": "Send { type: 'auth', payload: { token: '...' } } before other messages"
            }
        })
        continue

    # ... existing message routing (chat, log, sync, etc.)
```

### Target File Structure After This Story

```
apps/mobile/
├── app/                        # Expo Router — pages only, minimal logic
│   └── (existing files)
├── components/
│   ├── bridge/                 # EXISTS (from 1-5)
│   │   └── (existing files)
│   └── shell/                  # NEW directory — static UI
│       ├── PairingScreen.tsx   # NEW — backend URL + token pairing form
│       ├── PairingScreen.test.tsx # NEW — tests
│       └── index.ts            # NEW — barrel export
├── constants/                  # EXISTS (from 1-5)
│   └── tokens.ts               # EXISTS (unchanged)
├── services/
│   ├── auth.ts                 # NEW — expo-secure-store wrapper for session
│   ├── auth.test.ts            # NEW — tests
│   ├── localDb.ts              # EXISTS (unchanged)
│   ├── localDb.test.ts         # EXISTS (unchanged)
│   ├── moduleSync.ts           # EXISTS (unchanged)
│   ├── logger.ts               # EXISTS (unchanged)
│   └── wsClient.ts             # MODIFY (auth message on connect, auth error handling)
├── stores/
│   ├── authStore.ts            # NEW — auth state management
│   ├── authStore.test.ts       # NEW — tests
│   ├── moduleStore.ts          # EXISTS (unchanged)
│   └── connectionStore.ts      # EXISTS (unchanged)
├── types/
│   ├── auth.ts                 # NEW — AuthStatus type
│   ├── module.ts               # EXISTS (unchanged)
│   └── ws.ts                   # EXISTS (unchanged — auth types already defined)
├── utils/                      # EXISTS (unchanged)
├── __mocks__/
│   ├── expo-sqlite.ts          # EXISTS (unchanged)
│   └── expo-secure-store.ts    # NEW — mock for tests
├── __tests__/
│   ├── startup.test.ts         # EXISTS (may need updates for auth flow)
│   └── pairing.test.ts         # NEW — pairing flow integration test
├── App.tsx                     # MODIFY (auth-gated startup, PairingScreen)
├── package.json                # MODIFY (add expo-secure-store)
├── jest.config.js              # MODIFY (add expo-secure-store mock mapping)
└── tsconfig.json               # EXISTS (unchanged — @/services/* already configured)

apps/backend/
├── app/
│   ├── main.py                 # MODIFY (auth gate, auth/auth_reset handlers, pairing token on startup)
│   ├── sessions.py             # NEW — session CRUD operations
│   └── (existing files)
├── migrations/
│   ├── 001_init.sql            # EXISTS (unchanged)
│   └── 002_session_pairing.sql # NEW — add is_pairing column
└── tests/
    ├── test_ws.py              # MODIFY (auth tests)
    ├── test_sessions.py        # NEW — session management tests
    └── (existing files)
```

### Existing WS Type Definitions (Already Correct)

The `types/ws.ts` file already defines `AuthMessage` and `AuthResetMessage`:

```typescript
export interface AuthMessage {
  type: 'auth';
  payload: { token: string };
}

export interface AuthResetMessage {
  type: 'auth_reset';
  payload: Record<string, never>;
}
```

These types are already part of the `WSMessage` discriminated union. Do NOT modify them.

### expo-secure-store Usage Pattern

expo-secure-store provides a simple async key-value store backed by the platform's secure enclave:

```typescript
import * as SecureStore from 'expo-secure-store';

// Write
await SecureStore.setItemAsync('self_session_token', tokenValue);

// Read
const token = await SecureStore.getItemAsync('self_session_token');
// Returns string | null

// Delete
await SecureStore.deleteItemAsync('self_session_token');
```

**Key constraints:**
- Values must be strings (no objects — serialize with JSON.stringify if needed)
- Key names must be strings
- Max value size: 2048 bytes (sufficient for UUID tokens and URLs)
- Operations are async (return Promises)
- Available only on native (not web) — tests must mock it

### Backend Sessions Table (Already Exists)

The `sessions` table is already defined in `001_init.sql`:

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL DEFAULT 'default',
    created_at TEXT NOT NULL,
    last_seen TEXT NOT NULL
);
```

The `002_session_pairing.sql` migration adds the `is_pairing` column to distinguish pairing tokens from real session tokens.

### Error Code Conventions

From the architecture error code prefixes: `AUTH_*` for authentication errors.

| Code | When | Message |
|------|------|---------|
| `AUTH_REQUIRED` | Non-auth message before authentication | "Authentication required. Send auth message first." |
| `AUTH_INVALID_TOKEN` | Auth message with unknown/expired token | "Invalid session token. Re-pair with backend." |
| `AUTH_PAIRING_FAILED` | Pairing token is invalid or already consumed | "Pairing token is invalid or has already been used." |

### What NOT To Do

- Do NOT use JWT — architecture explicitly rejects it for V1
- Do NOT implement QR code scanning — that is MVP (FR49 requalified from First Light to MVP per Gap #4)
- Do NOT implement automatic token rotation — manual `auth_reset` only in V1 (NFR12 deferred)
- Do NOT implement multi-user auth — single user, `user_id='default'` everywhere
- Do NOT store API keys in this story — BYOK key storage comes in Epic 9
- Do NOT implement OAuth — that is Epic 15
- Do NOT add token expiration logic — V1 tokens do not expire
- Do NOT create REST endpoints for auth — WebSocket is the only communication channel (except /health)
- Do NOT modify existing WS type definitions in `types/ws.ts` — AuthMessage and AuthResetMessage are already correct
- Do NOT modify `types/module.ts` — add AuthStatus to a separate `types/auth.ts` file
- Do NOT implement the Shell/SDUI components (Orb, ChatInput, ChatBubble) — only PairingScreen in `components/shell/`
- Do NOT remove or break any existing tests (300 mobile, 448 backend as of 1-5)
- Do NOT change the existing `sync`, `chat`, `log` message handling logic in `main.py` — only wrap them in the auth gate
- Do NOT implement push notifications or any notification-related auth
- Do NOT use `auth` query parameters or WebSocket headers for authentication — architecture explicitly forbids both

### Previous Story Intelligence

**From Story 1.5 (Offline Message Queue & Cached Data Rendering -- done):**
- `localDb.ts` fully implemented with expo-sqlite for module caching and persistent message queue
- `moduleStore.ts` with full module state management (Map-based, dual status: ModuleStatus + DataStatus)
- `moduleSync.ts` handles module_created, module_updated, module_list, module_sync messages
- `wsClient.ts` upgraded with persistent offline queue (hybrid in-memory + SQLite), loadPersistedMessages
- `App.tsx` startup: initLocalDb -> loadCache -> loadPersistedMessages -> initModuleSync -> connect
- Bridge components: FreshnessIndicator, ModuleCard (placeholder), ModuleList, ErrorBoundary
- Design tokens (`constants/tokens.ts`) fully implemented matching architecture
- 300 mobile tests, 448 backend tests, zero regressions
- `jest.config.js` already maps `expo-sqlite` mock — add `expo-secure-store` similarly
- Review follow-ups (LOW): FreshnessIndicator rounding, ModuleCard type assertion, accessibility role, barrel exports, getBackendUrl no tests
- Backend `main.py` handles: chat (echo stub), log (forward), sync (delta sync) — NO auth gate yet
- Backend opens per-request DB connections for sync (reverted from session-scoped in fix(1-5))

**From Story 1.4 (Mobile App Shell & WebSocket Connection -- done):**
- `wsClient.ts`: connect/disconnect/send, exponential backoff reconnection, message routing
- `connectionStore.ts`: status, reconnectAttempts, lastSync, backendUrl
- `types/ws.ts`: full 15-type WSMessage discriminated union (AuthMessage, AuthResetMessage already defined)
- `toCamel.ts` / `toSnake.ts` case converters
- `logger.ts` structured logging service
- `getBackendUrl.ts` utility for dynamic URL resolution
- Path aliases: `@/services/*`, `@/stores/*`, `@/types/*`, `@/utils/*`, `@/components/*`, `@/constants/*`

**From Story 1.2 (Backend Skeleton -- done):**
- `config.py` with Settings class (pydantic-settings) — may need `SELF_PAIRING_TOKEN` env var
- `db.py` with `get_connection()`, `run_migrations()`, WAL mode
- `001_init.sql` creates 6 tables including `sessions` with: id, token, user_id, created_at, last_seen
- Migrations: numbered SQL files, transaction-wrapped, backup before migration
- `ASGITransport` does NOT trigger lifespan — tests use `app.router.lifespan_context`

**From Git History:**
- Commit convention: `feat(1-X):` for story implementations
- `187777d` fix(1-5): revert session-scoped DB to per-sync connection (important: do NOT use session-scoped DB connections, use per-request)

### Key Technical Considerations

1. **wsClient.ts modification is critical:** The `onopen` handler currently flushes pending messages and sends sync immediately. After this story, the sequence must be: send auth -> (wait for potential error) -> flush pending messages -> send sync. The auth message must be the FIRST message sent after WebSocket opens.

2. **App.tsx startup must be auth-aware:** The current startup flow is: initLocalDb -> loadCache -> loadPersistedMessages -> initModuleSync -> connect. After this story: initLocalDb -> loadCache -> loadPersistedMessages -> **loadAuth** -> initModuleSync -> **if authenticated: connect, else: show PairingScreen**.

3. **Per-request DB connections on backend:** The fix(1-5) commit reverted session-scoped DB connections to per-request. Follow this pattern in `sessions.py`: open connection, do operation, close connection. Each session management function should accept a `db_path` parameter or use `get_connection(settings.db_path)`.

4. **Migration 002 must be compatible:** The `is_pairing` column defaults to 0, so existing session rows (if any) are unaffected. The migration adds the column with `ALTER TABLE sessions ADD COLUMN is_pairing INTEGER DEFAULT 0`.

5. **Backend pairing token on startup:** During lifespan startup, after migrations, generate a pairing token UUID and store it in the sessions table with `is_pairing=1`. Log it clearly so the developer can copy it. If a pairing token already exists (from a previous startup), reuse it rather than creating a new one.

6. **Mobile-side auth error handling:** Register an `error` handler via `wsClient.onMessage('error', ...)` that checks for `AUTH_*` error codes. On auth failure, clear the stored token and transition to the pairing screen.

7. **expo-secure-store mock pattern:** Similar to `__mocks__/expo-sqlite.ts`, create `__mocks__/expo-secure-store.ts` with an in-memory Map-based implementation of `getItemAsync`, `setItemAsync`, `deleteItemAsync`.

8. **No components/sdui/ yet:** This story creates `components/shell/PairingScreen.tsx` which is the first file in the `components/shell/` directory. The full Shell components (Orb, ChatInput, ChatBubble) come in Epic 2.

9. **UUID generation:** Use `crypto.randomUUID()` which is available in React Native's Hermes engine. If not available, use `expo-crypto` (`Crypto.randomUUID()`). On the backend, use Python's `uuid.uuid4()`.

10. **Backend health endpoint extension:** The `/health` endpoint should include `pairing_available: true/false` to help the user know if pairing is needed. Do NOT include the actual pairing token in the health response for security.

### Project Structure Notes

- Creates new `components/shell/` directory — the first Shell layer component (architecture: Shell/Bridge/SDUI layers)
- Creates new `services/auth.ts` — the SecureStore wrapper for tokens (architecture data boundary: "SecureStore | auth.ts | API keys + session token only")
- Creates new `stores/authStore.ts` — auth state management (one store per domain)
- Creates new `types/auth.ts` — AuthStatus type definition
- Creates new `apps/backend/app/sessions.py` — session CRUD (flat backend structure, no sub-packages)
- Creates new `migrations/002_session_pairing.sql` — migration for is_pairing column
- Modifies `wsClient.ts` — auth message on connect, auth error handling
- Modifies `main.py` — auth gate around message routing, pairing token on startup
- Modifies `App.tsx` — auth-gated startup, PairingScreen conditional rendering
- Modifies `jest.config.js` — expo-secure-store mock mapping
- Modifies `package.json` — expo-secure-store dependency

### References

- [Source: architecture.md#Authentication & Security] -- UUID session auth, WS first message auth, SecureStore for tokens, no JWT, no token expiration V1 (lines 387-408)
- [Source: architecture.md#Auth flow (First Light)] -- 5-step auth flow: generate UUID, WS connect, auth message, verify/create session, associate messages (lines 395-401)
- [Source: architecture.md#Token regeneration] -- auth_reset message for manual token regen, old token invalidated immediately (lines 405-408)
- [Source: architecture.md#Gap #4 — FR49 QR pairing] -- Manual config for First Light, QR for MVP (lines 1502-1504)
- [Source: architecture.md#API & Communication Patterns] -- WebSocket-only protocol, typed messages, auth/auth_reset message types (lines 412-457)
- [Source: architecture.md#Data Boundaries] -- SecureStore for API keys + session token only (lines 1340-1347)
- [Source: architecture.md#Component Boundaries] -- Shell/Bridge/SDUI layer separation (lines 1293-1312)
- [Source: architecture.md#Zustand Store Conventions] -- state/actions/selectors naming, one store per domain (lines 994-1019)
- [Source: architecture.md#Process Patterns — Error handling] -- Structured errors with agent_action, error code prefixes AUTH_* (lines 1055-1083)
- [Source: architecture.md#NFR12] -- Token rotation deferred, manual regeneration available (lines 137)
- [Source: architecture.md#NFR29] -- user_id column on all tables for multi-user readiness (lines 1497-1498)
- [Source: epics.md#Story 1.6] -- FR39 session auth, FR49 QR pairing, acceptance criteria (lines 526-556)
- [Source: epics.md#Epic 1 overview] -- Last story in Epic 1, FRs: FR36, FR39, FR49, FR55, FR56, FR57, FR58 (lines 311-314)
- [Source: story 1-5] -- wsClient.ts structure, moduleStore, bridge components, 300 mobile tests, 448 backend tests
- [Source: story 1-4] -- WS protocol types, connectionStore, exponential backoff, message routing
- [Source: story 1-2] -- sessions table schema, db.py patterns, config.py Settings class, migrations
- [Source: story 1-1] -- Monorepo structure, tsconfig paths, Expo SDK 54 setup

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
