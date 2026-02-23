---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests', 'step-04-validate']
lastStep: 'step-04-validate'
lastSaved: '2026-02-23'
inputDocuments:
  - _bmad-output/implementation-artifacts/1-5-offline-message-queue-and-cached-data-rendering.md
  - _bmad-output/implementation-artifacts/1-6-session-authentication-and-mobile-backend-pairing.md
  - apps/mobile/services/localDb.ts
  - apps/mobile/stores/moduleStore.ts
  - apps/mobile/services/moduleSync.ts
  - apps/mobile/services/wsClient.ts
  - apps/mobile/services/auth.ts
  - apps/mobile/stores/authStore.ts
  - apps/mobile/components/shell/PairingScreen.tsx
  - apps/mobile/App.tsx
  - apps/mobile/components/bridge/FreshnessIndicator.tsx
  - apps/mobile/components/bridge/ModuleCard.tsx
  - apps/mobile/components/bridge/ModuleList.tsx
  - apps/mobile/components/bridge/ErrorBoundary.tsx
  - apps/backend/app/main.py
  - apps/backend/app/sessions.py
  - apps/backend/tests/test_ws.py
---

# Test Automation Expansion — Story 1-5

## Summary

Expanded test coverage for Story 1-5 (Offline Message Queue & Cached Data Rendering) by adding 90 new tests across mobile (82) and backend (8), bringing totals from 218 to 300 mobile tests and 440 to 448 backend tests. All tests pass with zero regressions.

## Coverage Targets

Mode: BMad-Integrated (using story artifacts for context)
Coverage target: critical-paths + edge cases
Detected stack: fullstack

## Tests Added

### Mobile (82 new tests)

#### localDb.test.ts — 18 new edge case tests
- initLocalDb error handling (throws on failure, idempotent)
- cacheModule error handling (throws on insert failure, complex spec serialization)
- removeCachedModule edge cases (non-existent module, selective removal, error handling)
- clearModulesCache error handling (throw on failure, idempotent)
- clearPendingMessages (removes all, empty queue no-op)
- enqueuePendingMessage error handling (throw on failure, various WSMessage types)
- dequeuePendingMessages error handling (graceful fallback, no DELETE on empty queue)
- getCachedModules error handling (graceful fallback)
- getPendingMessageCount error handling (graceful fallback, null result)
- Multiple enqueue/dequeue cycles with FIFO ordering
- Spec JSON storage verification

#### moduleStore.test.ts — 19 new edge case tests
- updateModule on non-existent ID (creates new module)
- updateModule preserves existing status/dataStatus
- updateModule triggers cache persistence
- setModuleStatus no-op on non-existent module
- setModuleStatus all 6 status transitions
- setModuleDataStatus no-op on non-existent module
- setModuleDataStatus all 3 status transitions
- loadFromCache empty array (clears store)
- loadFromCache with invalid JSON spec (skipped gracefully)
- loadFromCache defaults empty status to active
- loadFromCache sets dataStatus to ok
- loadFromCache multiple modules
- removeModule no-op on non-existent
- removeModule selective removal
- getActiveModules with all non-active modules
- getAllModules and getModuleCount on empty store
- Full add/update/remove lifecycle with cache verification

#### moduleSync.test.ts — 7 new edge case tests
- module_sync with empty modules array (no-op on existing modules)
- module_list with empty modules array (clears store)
- cleanupModuleSync unregisters all handlers
- cleanupModuleSync prevents message delivery
- Re-initialization cleans up before re-registering (idempotent)
- module_created assigns current timestamp
- module_updated for non-existent module (creates via updateModule)

#### wsClient.test.ts — 12 new persistent queue tests
- Persists messages to localDb on offline send
- Calls clearPendingMessages after flush
- Does not call clearPendingMessages when no messages flushed
- loadPersistedMessages prepends to in-memory queue (FIFO order verification)
- loadPersistedMessages with empty persisted messages
- loadPersistedMessages error handling (graceful fallback)
- Queue overflow at MAX_PENDING_MESSAGES=200 (drops oldest)
- Queue overflow preserves FIFO with newest messages retained
- No sync on first connect
- Sync on reconnection
- Flush pending BEFORE sync on reconnect

#### FreshnessIndicator.test.tsx — 7 new boundary tests
- Exactly 1 hour boundary (shows caption)
- Exactly 24 hours boundary (shows Stale)
- Just under 1 hour (59 min, no indicator)
- Just under 24 hours (23h, caption not Stale)
- dataStatus 'stale' behaves like 'ok' (time-based, not Offline)
- Offline badge regardless of data age (error dataStatus priority)
- Very old data (weeks, Stale badge)

#### ModuleCard.test.tsx — 10 new tests (new file)
- Module name from spec
- Fallback to moduleId when no name
- FreshnessIndicator for stale data (> 24h)
- No FreshnessIndicator for fresh data (< 1h)
- Offline badge when dataStatus is error
- Caption for 1h-24h data
- ErrorBoundary renders children when no error
- ErrorBoundary shows fallback on render crash
- ErrorBoundary handles missing error message
- ErrorBoundary isolates errors between siblings

#### ModuleList.test.tsx — 9 new tests (new file)
- Empty state "No modules yet"
- No offline indicator when empty and disconnected
- Module cards render when modules exist
- No empty state when modules exist
- Offline indicator when disconnected with modules
- Offline indicator when reconnecting
- No offline indicator when connected
- Offline indicator during connecting status

### Backend (8 new tests)

#### test_ws.py — 8 new delta sync edge case tests
- Invalid spec JSON handled gracefully
- Explicit null last_sync returns full sync
- Multiple modules with same updated_at
- Delta sync boundary timestamp (strict greater than)
- Nested spec JSON correctly parsed
- Empty spec string handled
- Full sync returns modules ordered by updated_at DESC
- Delta sync with many modules (20 modules stress test)

## Test Results (Story 1-5 run)

- Mobile: 300 tests, 13 suites, all passing
- Backend: 448 tests, all passing
- Zero regressions from previous stories

---

# Test Automation Expansion — Story 1-6

## Summary

Expanded test coverage for Story 1-6 (Session Authentication & Mobile-Backend Pairing) by adding 126 new tests across mobile (72) and backend (54), bringing totals from 382 to 454 mobile tests (21 suites) and 486 to 540 backend tests. All tests pass with zero regressions.

## Coverage Targets

Mode: BMad-Integrated (using story artifacts for context)
Coverage target: critical-paths + edge cases + security scenarios
Detected stack: fullstack

## Tests Added

### Mobile (72 new tests across 4 files)

#### services/wsClient.auth.test.ts — 25 new tests (new file)
- sendAuthMessage sends token on open when session token is set
- sendAuthMessage does not send when no session token is set
- Auth message sent FIRST before pending messages on connect
- Auth sent before sync on reconnect (ordering guarantee)
- Pairing token included in auth message when provided to connect()
- Pairing token consumed after first use (not sent on reconnect)
- No pairing_token when not provided to connect()
- AUTH_INVALID_TOKEN sets authStatus to auth_failed
- AUTH_INVALID_TOKEN sets pairingError with message
- AUTH_REQUIRED sets authStatus to auth_failed
- AUTH_PAIRING_FAILED sets auth_failed and pairingError
- Fallback message when error payload has no message field
- Fallback message for AUTH_PAIRING_FAILED without message
- Non-auth error codes do not change auth status
- Auth success inference: pairing -> authenticated on non-error message
- Auth success inference: authenticating -> authenticated on non-error message
- Does not re-infer auth when already authenticated
- Does not infer auth success from error messages in pairing state
- Does not infer auth when status is unconfigured
- Does not infer auth when status is auth_failed
- Full ordering: auth + pending messages + sync on reconnect
- First connect: auth + pending only (no sync)
- New connect() replaces pairing token
- connect() without pairing token clears previous pairing token

#### services/auth.edge.test.ts — 17 new tests (new file)
- getSessionToken returns null when SecureStore.getItemAsync throws
- getStoredBackendUrl returns null when SecureStore.getItemAsync throws
- setSessionToken does not throw when SecureStore.setItemAsync throws
- setStoredBackendUrl does not throw when SecureStore.setItemAsync throws
- clearSessionToken does not throw when SecureStore.deleteItemAsync throws
- isSessionConfigured returns false when token retrieval fails
- isSessionConfigured returns false when both calls return null
- resetSession calls wsClient.send even if clearSessionToken fails
- resetSession calls clearAuth on authStore
- generateSessionToken generates exactly 36-character tokens
- generateSessionToken tokens have correct UUID v4 structure (50 iterations)
- setSessionToken stores empty string (not null)
- setStoredBackendUrl stores empty string
- isSessionConfigured returns true with empty string values
- setSessionToken overwrites in sequence
- clearSessionToken + setSessionToken round-trip
- Clearing non-existent token then setting works

#### components/shell/PairingScreen.edge.test.tsx — 14 new tests (new file)
- Button disabled with URL-only whitespace
- Button disabled with token-only whitespace
- Button disabled when both inputs are whitespace
- URL trimmed before storing
- Pairing token trimmed before sending to connect
- Button disabled during pairing status
- Button disabled during authenticating status
- Long error messages displayed without truncation
- Previous error cleared on new connection attempt
- Sets backendUrl in authStore when connecting
- Sets sessionToken in authStore when connecting
- Calls wsClient.connect with URL and pairing token
- Generates session token via generateSessionToken
- Allows re-connection after auth failure (button enabled)

#### stores/authStore.edge.test.ts — 16 new tests (new file)
- Full pairing flow state sequence (unconfigured -> pairing -> authenticated)
- Subsequent launch state sequence (authenticating -> authenticated)
- Auth failure state sequence (authenticating -> auth_failed -> clearAuth)
- Rapid transitions: pairing -> auth_failed -> pairing -> authenticated
- Multiple clearAuth calls are idempotent
- getIsPaired with empty string token and URL (truthy)
- getIsPaired false after setting token to null
- getIsPaired false after setting URL to null
- getIsAuthenticated false for every non-authenticated status (exhaustive)
- getIsAuthenticated true only for authenticated
- pairingError preserved across status changes
- pairingError survives token changes
- clearAuth clears pairingError
- setSessionToken does not affect backendUrl
- setBackendUrl does not affect sessionToken
- setAuthStatus does not affect token or URL

### Backend (54 new tests across 2 files)

#### tests/test_ws_auth_edge.py — 30 new tests (new file)
- Auth with missing token field -> AUTH_INVALID_TOKEN
- Auth with null token -> AUTH_INVALID_TOKEN
- Auth with numeric token -> AUTH_INVALID_TOKEN
- Auth with no payload -> AUTH_INVALID_TOKEN
- Auth with extra fields still works (tolerant parsing)
- Re-auth with same token succeeds
- Re-auth with different valid token switches session
- Re-auth with invalid token returns error (no crash)
- Invalid JSON returns WS_INVALID_JSON
- JSON array returns WS_INVALID_JSON
- JSON string returns WS_INVALID_JSON
- JSON number returns WS_INVALID_JSON
- Empty string returns WS_INVALID_JSON
- JSON null returns WS_INVALID_JSON
- auth_reset session usable for subsequent messages (round-trip)
- auth_reset old token no longer works on new connection
- Unknown type returns WS_UNKNOWN_TYPE when authenticated
- Missing type field when unauthenticated returns AUTH_REQUIRED
- None type when authenticated returns WS_UNKNOWN_TYPE
- Pairing token cannot be used as session token (security)
- Real session token cannot be used as pairing_token (security)
- Empty pairing token treated as no pairing token
- Pairing token cannot be reused across connections (security)
- Auth fails then succeeds (retry flow)
- Multiple failed auths do not crash server (10 attempts)
- AUTH_REQUIRED response has code, message, agent_action
- AUTH_INVALID_TOKEN response has code, message, agent_action
- AUTH_PAIRING_FAILED response has code, message, agent_action
- WS_INVALID_JSON response has code, message, agent_action
- WS_UNKNOWN_TYPE response has code, message, agent_action

#### tests/test_sessions_edge.py — 24 new tests (new file)
- get_existing_pairing_token returns None when no pairing exists
- get_existing_pairing_token returns token when it exists
- get_existing_pairing_token works when real sessions also exist
- get_existing_pairing_token does not return real sessions
- get_existing_pairing_token returns one when multiple exist
- has_active_client_session false with no sessions
- has_active_client_session false with only pairing tokens
- has_active_client_session true with recent session
- has_active_client_session true after update_last_seen
- Timestamps are ISO format
- Timestamps contain UTC offset
- update_last_seen changes timestamp
- get_session finds correct one among many
- invalidate_session only removes target
- update_last_seen only affects target session
- consume_pairing_token with empty session token
- consume_pairing_token with empty pairing token
- Pairing token gone after consumption (verified via get_existing)
- Default user_id is 'default'
- Custom user_id is stored and retrievable
- Pairing token has default user_id
- Consumed pairing creates session with default user_id
- Each session has unique ID (20 sessions)
- Session ID is UUID format

## Test Results (Story 1-6 run)

- Mobile: 454 tests, 21 suites, all passing (up from 382)
- Backend: 540 tests, all passing (up from 486)
- Zero regressions from previous stories
- New tests added: 72 mobile + 54 backend = 126 total

---

# Test Automation Expansion — Story 3-2

## Summary

Expanded test coverage for Story 3-2 (Composite Primitives: Card, List) by adding 83 new tests across mobile (54) and module-schema (29), bringing totals from 688 to 742 mobile tests (29 suites) and 123 to 152 schema tests (2 suites). All tests pass with zero regressions.

## Coverage Targets

Mode: BMad-Integrated (using story artifacts for context)
Coverage target: critical-paths + edge cases + accessibility + security
Detected stack: mobile + shared schema package

## Gap Analysis

Identified the following coverage gaps not addressed by the original 90 Story 3.2 tests:

1. **Prototype pollution safety** -- CardPrimitive children with `__proto__`, `constructor`, `toString` type strings; getPrimitive registry Map safety against Object.prototype keys
2. **Children prop tolerance** -- extra props from ModuleCard extractPrimitiveProps (name, schemaVersion) passed through to children
3. **Large data sets** -- children/items arrays with 50-100+ entries
4. **Title boundary conditions** -- empty string, whitespace, very long, special chars, HTML entities, emoji/Unicode
5. **Card-in-card nesting** -- recursive composition via children
6. **ListPrimitive styling validation** -- separator color/height, trailing margin, subtitle margin, empty state typography, item layout direction
7. **Dynamic Type/RTL** -- subtitle, trailing, and empty state writingDirection and font scaling not tested
8. **Accessibility label edge cases** -- undefined when no title/label, fallback "Item N" for empty titles, correct generated label with 0/1 items
9. **Schema isolation** -- listItemSchema not tested independently; card children type validation for non-string types; list items with boolean/numeric field values
10. **Integration composition** -- card+list coexistence in layout, realistic module spec rendering end-to-end

## Tests Added

### Mobile — CardPrimitive.test.tsx (20 new tests)

- Prototype pollution: child type `__proto__`, `constructor`, `toString` gracefully handled via UnknownPrimitive
- Children tolerate extra props (name, schemaVersion)
- Large children array (50 items) renders without crashing
- Empty string title omits title section
- Title with HTML-like special characters renders safely
- Very long title (1000 chars) renders without crashing
- Title with emoji and Unicode renders correctly
- Card-in-card nesting (recursive composition)
- Mixed valid and invalid children render side by side
- Null child in children array handled gracefully
- Undefined child in children array handled gracefully
- No accessibilityLabel when neither title nor accessibleLabel provided
- accessibleLabel takes priority over title
- accessibilityRole undefined when not provided
- Title marginBottom spacing validated against tokens.spacing.sm
- All 5 registered primitive types as children simultaneously

### Mobile — ListPrimitive.test.tsx (24 new tests)

- Touch target minHeight >= 48 validated for all items in multi-item list
- Separator styling: backgroundColor from tokens.colors.border, height 1px
- Subtitle writingDirection auto for RTL
- Trailing writingDirection auto for RTL
- Subtitle does not disable font scaling (Dynamic Type)
- Trailing does not disable font scaling (Dynamic Type)
- List title text color from tokens.colors.text
- List title marginBottom spacing from tokens.spacing.sm
- Large item list (100 items) renders without crashing
- No accessibilityLabel when no title and no accessibleLabel
- Generated label correct with 0 items ("Empty Tasks, 0 items")
- Generated label correct with 1 item
- Item accessibilityLabel fallback "Item N" for empty string title
- Item accessibilityLabel fallback "Item N" for undefined title
- accessibilityRole undefined when not provided
- Item layout direction (row) and alignment (center) validated
- Special characters in subtitle
- Emoji in trailing value
- Subtitle marginTop spacing from tokens.spacing.xs
- Trailing marginLeft spacing from tokens.spacing.sm
- Empty state body typography validated
- Empty state writingDirection auto for RTL
- Item title body typography + text color validated
- Correct separator count for 5 items (4 separators)

### Mobile — integration.test.tsx (10 new tests)

- getPrimitive("__proto__") returns UnknownPrimitive (prototype pollution safety)
- getPrimitive("constructor") returns UnknownPrimitive
- getPrimitive("hasOwnProperty") returns UnknownPrimitive
- getPrimitive("toString") returns UnknownPrimitive
- Card-in-card nesting through registry
- Card with all five primitive types as children
- Realistic weather module spec end-to-end rendering
- Realistic task list module spec end-to-end rendering
- Layout containing both card and list renders correctly

### Schema — primitives.test.ts (29 new tests)

#### listItemSchema isolation (10 tests)
- Complete list item validates successfully
- Empty list item validates (all fields optional)
- Boolean title rejected
- Numeric subtitle rejected
- Numeric trailing rejected
- Array id rejected
- Empty string values accepted
- Unrecognized fields stripped (onPress, icon)
- Null input rejected

#### cardPrimitiveSchema additional edge cases (10 tests)
- Numeric type field in children rejected
- Boolean type field in children rejected
- Null type field in children rejected
- Null title rejected (not a string)
- Empty string title accepted
- Passthrough preserves nested metric data
- Deeply nested card children preserved via passthrough
- Non-object entries in children rejected
- Empty string accessibleLabel accepted
- Numeric accessibleLabel rejected

#### listPrimitiveSchema additional edge cases (9 tests)
- Null items rejected
- Non-object entries in items rejected
- Item with only id accepted
- Unicode title accepted
- Numeric accessibleRole rejected
- Empty string accessibleLabel accepted
- Null item title rejected
- Boolean item subtitle rejected
- Object item trailing rejected
- Mixed valid items accepted (4 items with varying fields)

## Test Results (Story 3-2 expansion run)

- Mobile: 742 tests, 29 suites, all passing (up from 688)
- Schema: 152 tests, 2 suites, all passing (up from 123)
- Total: 894 tests (up from 811)
- Zero regressions from previous stories
- New tests added: 54 mobile + 29 schema = 83 total

## Priority Breakdown

- P0 (Critical paths): 15 tests -- prototype pollution safety, card/list rendering through registry, realistic spec rendering
- P1 (Important features): 35 tests -- accessibility edge cases, Dynamic Type/RTL, styling validation, composition
- P2 (Edge cases): 33 tests -- boundary conditions, large data sets, malformed inputs, schema type validation
