---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests']
lastStep: 'step-03-generate-tests'
lastSaved: '2026-02-23'
inputDocuments:
  - _bmad-output/implementation-artifacts/1-5-offline-message-queue-and-cached-data-rendering.md
  - apps/mobile/services/localDb.ts
  - apps/mobile/stores/moduleStore.ts
  - apps/mobile/services/moduleSync.ts
  - apps/mobile/services/wsClient.ts
  - apps/mobile/components/bridge/FreshnessIndicator.tsx
  - apps/mobile/components/bridge/ModuleCard.tsx
  - apps/mobile/components/bridge/ModuleList.tsx
  - apps/mobile/components/bridge/ErrorBoundary.tsx
  - apps/backend/app/main.py
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

## Test Results

- Mobile: 300 tests, 13 suites, all passing
- Backend: 448 tests, all passing
- Zero regressions from previous stories
