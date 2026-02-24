# Wave 2 Test Plan — Chat + Render

**Wave:** 2 — Chat + Render (Epics 2 & 3 interleaved)
**Stories covered:** 3.1, 3.2, 3.3, 2.1
**Goal:** Validate that the agent talks and modules render natively — the two converging chains that unlock story 3.4.
**Date:** 2026-02-23
**Author:** SM Agent (Bob)
**Status:** Ready for QA execution

---

## 1. Scope

Wave 2 delivers two independent chains that must work **together** for story 3.4 (Module Creation End-to-End):

| Chain | Stories | What it delivers |
|-------|---------|-----------------|
| **Chain A — Rendering** | 3.1 → 3.2 → 3.3 | SDUI primitive registry, Card/List composites, template-aware ModuleCard pipeline |
| **Chain B — Conversation** | 2.1 | Real-time chat with streaming, Orb state, error handling |

**Out of scope:** Story 3.4 (E2E module creation), backend LLM routing (Epic 9), offline behavior (covered in Epic 1 / Story 1.5).

---

## 2. Automated Test Baseline

### 2.1 Current Coverage

| Suite | Tests | Description |
|-------|-------|-------------|
| **Mobile** | **1,058 tests / 48 suites** | Full mobile test suite |
| **Backend** | **~568 tests** | FastAPI + agent + WS tests |

### 2.2 Wave 2 Test Files by Story

**Story 3.1 — SDUI Primitive Registry**
| File | Tests | Coverage |
|------|-------|----------|
| `components/sdui/registry.test.ts` | ~10 | getPrimitive known/unknown, registry invariants |
| `components/sdui/UnknownPrimitive.test.tsx` | ~8 | renders type name, logs error, accessibility |
| `components/sdui/TextPrimitive.test.tsx` | ~15 | variants, RTL, Dynamic Type, WCAG AA |
| `components/sdui/MetricPrimitive.test.tsx` | ~12 | value formatting, unit display, accessibility |
| `components/sdui/LayoutPrimitive.test.tsx` | ~10 | stack/grid modes, direction, columns |
| `components/sdui/integration.test.tsx` | ~25 | full SDUI integration scenarios |

**Story 3.2 — Composite Primitives**
| File | Tests | Coverage |
|------|-------|----------|
| `components/sdui/CardPrimitive.test.tsx` | ~15 | title, children, empty states, UnknownPrimitive fallback |
| `components/sdui/ListPrimitive.test.tsx` | ~15 | items, empty state, 44px touch targets |

**Story 3.3 — Module Rendering Pipeline**
| File | Tests | Coverage |
|------|-------|----------|
| `components/sdui/templates.test.ts` | ~14 | 3 First Light templates, fallback |
| `components/sdui/templates.edge.test.ts` | ~22 | structural invariants, slot configs, prototype pollution |
| `components/bridge/ModuleCard.test.tsx` | ~23 | template-aware rendering, accessibleLabel, performance logging |
| `components/bridge/ModuleCard.edge.test.tsx` | ~23 | edge props, dataStatus, minimal specs |
| `components/bridge/pipeline.test.tsx` | ~12 | E2E pipeline: ModuleList → ModuleCard → template → getPrimitive |
| `components/bridge/pipeline.edge.test.tsx` | ~16 | prototype pollution, mixed dataStatus, composite primitives |

**Story 2.1 — Real-Time Chat Interface**
| File | Tests | Coverage |
|------|-------|----------|
| `stores/chatStore.test.ts` | ~34 | all actions, selectors, AgentStatus enum |
| `stores/chatStore.edge.test.ts` | edge | rapid deltas, concurrent calls, boundary conditions |
| `services/chatSync.test.ts` | ~14 | WS handler registration, chat_stream/status/error routing |
| `services/chatSync.edge.test.ts` | edge | out-of-order messages, cleanup, handler accumulation |
| `components/shell/ChatBubble.test.tsx` | ~12 | user/agent/error/streaming variants, accessibility |
| `components/shell/ChatBubble.edge.test.tsx` | edge | empty content, special chars, long messages |
| `components/shell/ChatInput.test.tsx` | ~14 | onSend, disabled state, 44px touch target, accessibility |
| `components/shell/ChatInput.edge.test.tsx` | edge | whitespace-only, multi-line, rapid submits |
| `components/shell/Orb.test.tsx` | ~21 | idle/thinking states, connectionStore, reduced motion |
| `components/shell/Orb.edge.test.tsx` | edge | rapid state changes, accessibility label format |
| `components/shell/StreamingIndicator.test.tsx` | ~8 | animation, visibility, accessibility |
| `components/bridge/ChatThread.test.tsx` | ~12 | message list, streaming bubble, auto-scroll |
| `components/bridge/ChatThread.edge.test.tsx` | ~14 | empty state, large lists, mixed message types |
| `__tests__/chat.test.ts` | ~15 | integration: store + sync + WS |
| `tests/test_agent.py` | ~25 | handle_chat, LLM integration, _log_llm_usage |
| `tests/test_agent_edge.py` | ~27 | empty message, DB failures, error isolation |
| `tests/test_ws_chat_edge.py` | ~36 | WS LLM error path, sequential chats, routing |

---

## 3. Wave 2 Integration Test Scenarios

These scenarios test **chain interactions** — behaviors that span multiple stories and cannot be caught by unit tests alone.

### 3.1 Chain A — Rendering Pipeline (Stories 3.1 + 3.2 + 3.3)

**IT-A1: Complete primitive resolution chain**
- Input: `module_created` WS message with `type: "metric"`, `template: "metric-dashboard"`
- Expected: ModuleList → ModuleCard → `getTemplate("metric-dashboard")` → `getPrimitive("metric")` → MetricPrimitive renders
- Verify: no UnknownPrimitive shown, correct layout (2-column grid)

**IT-A2: Card composite with nested primitives**
- Input: `module_created` with `type: "card"`, children `[{ type: "text", text: "Hello" }, { type: "metric", value: 42 }]`
- Expected: CardPrimitive renders, `getPrimitive("text")` returns TextPrimitive, `getPrimitive("metric")` returns MetricPrimitive
- Verify: both inner components render, card styling (surface bg, border, radius)

**IT-A3: Template fallback propagation**
- Input: module spec with `template: "unknown-future-template"`
- Expected: `getTemplate` falls back to `"data-card"` → ModuleCard renders data-card layout
- Verify: no error thrown, data-card structure (vertical stack, header + content slots)

**IT-A4: ErrorBoundary isolation**
- Input: 3 modules, second one has a primitive that throws during render
- Expected: modules 1 and 3 render correctly, module 2 shows ErrorBoundary fallback card
- Verify: no full-screen crash, other modules unaffected

**IT-A5: dataStatus flow through pipeline**
- Input: module with `dataStatus: "stale"` and `dataStatus: "error"`
- Expected: FreshnessIndicator shows "Stale" badge / "Offline" badge respectively
- Verify: badge text, badge color, no crash

**IT-A6: accessibleLabel propagation**
- Input: module spec with `accessibleLabel: "My Weather Module"`
- Expected: root View of ModuleCard has `accessibilityLabel="My Weather Module"`
- Verify: screen reader would announce the module label correctly

**IT-A7: Render performance logging**
- Input: module spec that renders within 100ms
- Expected: logger.info called with `module_rendered` event containing `render_ms < 100`
- Input 2: artificially slow render (mock)
- Expected 2: logger.warn called with NFR3 agent_action message

**IT-A8: Registry extensibility contract**
- Action: add a new primitive to registry
- Expected: requires only 1 component file + 1 registry entry
- Verify: no other source files need changes (AC 9 from 3.1 / AC 11 from 3.2)

### 3.2 Chain B — Conversation (Story 2.1)

**IT-B1: Full send → stream → finalize cycle**
- Action: user types message, taps Send
- WS events: `status { state: "thinking" }` → `chat_stream { delta: "Hello", done: false }` → `chat_stream { delta: " there", done: false }` → `chat_stream { delta: "", done: true }`
- Expected: user bubble appears immediately, Orb pulses (thinking), agent bubble streams token by token, StreamingIndicator disappears on `done: true`, message finalized

**IT-B2: Error response path**
- WS event: `error { code: "llm_error", message: "Provider unavailable", agentAction: "retry" }`
- Expected: error bubble appears (left-aligned, error border), no crash, Orb returns to idle, chatStore.agentStatus = 'idle'

**IT-B3: chatStore → chatSync → ChatThread data flow**
- Action: `initChatSync()` registers handlers, WS sends `chat_stream`
- Expected: chatStore updates → ChatThread re-renders → new ChatBubble visible
- Verify: no manual refresh, reactive update

**IT-B4: Orb + chatStore state coupling**
- Action: send message → `status { state: "thinking" }` → `status { state: "idle" }`
- Expected: Orb transitions idle → thinking (fast 1.5s pulse) → idle (slow 4s pulse)
- Verify: connectionStore status does not override chatStore status in normal flow

**IT-B5: ChatInput disabled during streaming**
- Action: initiate stream, check ChatInput state
- Expected: `disabled={true}` while `agentStatus !== 'idle'`, re-enabled on finalize or error
- Verify: send button not tappable, no double-submit

**IT-B6: Cleanup on unmount**
- Action: mount App, initChatSync, initModuleSync, then unmount
- Expected: all 4 WS handlers (moduleSync) + chat handlers cleaned up, no handler accumulation
- Verify: `cleanupChatSync()` AND `cleanupModuleSync()` both called in useEffect cleanup

### 3.3 Cross-Chain Integration (3.3 + 2.1 together)

**IT-C1: Simultaneous chat + module render**
- Action: user sends "Show me weather" → backend streams response AND sends `module_created`
- Expected: chat response streams in ChatThread AND module renders in ModuleList simultaneously
- Verify: no race condition, no layout jank, both stores update independently

**IT-C2: Error in module render doesn't break chat**
- Action: receive `module_created` with malformed spec → ErrorBoundary catches → then user sends message
- Expected: chat still works normally after module error
- Verify: chatStore unaffected by SDUI ErrorBoundary

**IT-C3: WebSocket message routing**
- Events: `module_sync`, `chat_stream`, `status` interleaved
- Expected: moduleSync handles module events, chatSync handles chat events, no cross-contamination
- Verify: chatStore unchanged after `module_sync`, moduleStore unchanged after `chat_stream`

---

## 4. Manual End-to-End Test Scenarios

Run on real device (or simulator) with `./self.sh` + Expo Go.

### Setup
```bash
./self.sh           # launches backend (port 8000) + mobile (Expo)
# Note the pairing token in backend logs
# Open Expo Go → scan QR code → complete pairing with token
```

### M1: Basic conversation
1. Type "Hello" → Send
2. **Expected:** User bubble appears right-aligned (#1A3050 background), Orb pulses (thinking state), agent response streams letter by letter, Orb returns to idle
3. **Pass criteria:** First visible token < 1 second after send (NFR7)

### M2: Multilingual response
1. Type a message in French: "Bonjour, comment ça va ?"
2. **Expected:** Agent responds in French
3. **Pass criteria:** Language of response matches input language (FR1)

### M3: Long conversation scroll
1. Send 10+ messages
2. **Expected:** Thread scrolls to bottom automatically on each new message/stream delta
3. **Pass criteria:** Latest message always visible without manual scroll

### M4: Streaming indicator visibility
1. Send a message and observe during streaming
2. **Expected:** StreamingIndicator (animated dots) visible during stream, disappears on `done: true`
3. **Pass criteria:** Indicator disappears cleanly, no flash/flicker

### M5: Orb accessibility
1. Enable VoiceOver/TalkBack
2. Tap the Orb
3. **Expected:** Screen reader announces "Agent status: idle" or "Agent status: thinking"
4. **Pass criteria:** Correct accessibility label per NFR31

### M6: Reduced motion
1. Enable Reduce Motion in device settings
2. **Expected:** Orb renders as static amber circle, no animation
3. **Pass criteria:** No animation loop, Orb still visible and styled correctly

### M7: LLM error display
1. Start backend without LLM provider configured (no `LLM_API_KEY` in env)
2. Send a message
3. **Expected:** Error bubble appears (left-aligned, error border color #CC5F5F), informative message, no crash, Orb returns to idle
4. **Pass criteria:** App remains functional, can send another message after error

### M8: ChatInput touch target
1. Use device with smaller screen (375pt width)
2. **Expected:** Send button visually centered, minimum 44x44pt touch area
3. **Pass criteria:** Tappable reliably on small fingers (NFR33)

### M9: Module list + chat layout
> Requires backend to send a `module_created` event (or test with a mock)
1. Receive a module_created message
2. **Expected:** Module appears in ModuleList AND chat still functional in ChatThread below
3. **Pass criteria:** Both UI zones visible and usable simultaneously

### M10: Connection loss during streaming
1. Send a message, then disable Wi-Fi mid-stream
2. **Expected:** Streaming stops, connection indicator changes, no crash, Orb returns to idle state
3. **Pass criteria:** App recovers gracefully; no frozen streaming state

---

## 5. Performance Tests

| Test | Target | Method |
|------|--------|--------|
| First token latency | < 1s (NFR7) | Measure time from Send tap to first `chat_stream` delta visible |
| Module render time | < 100ms (NFR3) | Check `module_rendered` logger output, `render_ms` field |
| App startup to usable | < 2s (NFR1) | Check `startup_ms` in logger output from App.tsx |
| Stream 500 tokens | No visible jank | Send prompt that generates long response, observe scroll performance |
| 20 modules in ModuleList | Scrolls at 60fps | Load 20 modules, scroll through ModuleList |

---

## 6. Accessibility Tests

| Check | Component | Standard | Method |
|-------|-----------|----------|--------|
| Orb label | Orb | NFR31 | VoiceOver: announces "Agent status: [idle\|thinking]" |
| User bubble label | ChatBubble | NFR31 | VoiceOver: announces "You: [content]" |
| Agent bubble label | ChatBubble | NFR31 | VoiceOver: announces "Agent: [content]" |
| Chat input label | ChatInput | NFR31 | VoiceOver: announces "Message input" |
| Send button label | ChatInput | NFR31 | VoiceOver: announces "Send message" |
| Conversation thread | ChatThread | NFR31 | VoiceOver: announces "Conversation thread" |
| Module label | ModuleCard | NFR31 | VoiceOver: announces spec.accessibleLabel |
| Primitive labels | All SDUI | NFR37 | VoiceOver navigates through module content |
| WCAG AA contrast | All text | NFR32 | Contrast analyzer: ≥ 4.5:1 normal text, ≥ 3:1 large text |
| Dynamic Type | All text | NFR30 | Increase font size to max, verify no clipping |
| Reduced motion | Orb | NFR35 | Enable Reduce Motion → static circle renders |
| Touch targets | Send button, list items | NFR33 | Measure: ≥ 44x44pt all interactive elements |

---

## 7. Regression Baseline

**Before running Wave 2 manual tests, verify:**

```bash
# Mobile unit tests
cd apps/mobile && npx jest
# Expected: 1,058 tests / 48 suites — all passing

# Backend unit tests
cd apps/backend && python -m pytest tests/ --ignore=tests/test_module_schema.py
# Expected: ~568 tests — all passing (test_module_schema.py excluded — known module_schema import issue)

# TypeScript typecheck
pnpm typecheck
# Expected: 0 errors
```

**Zero regression policy:** Any Wave 3 work that causes a regression in these counts must be fixed before continuing.

---

## 8. Wave 2 Exit Criteria

### Automated (non-negotiable)
- [ ] All 1,058 mobile tests pass
- [ ] All ~568 backend tests pass (excl. test_module_schema.py known issue)
- [ ] `pnpm typecheck` returns 0 errors
- [ ] CI green on `main` branch

### Manual (required for Wave 3 readiness)
- [ ] M1–M5 pass on real device or simulator
- [ ] M7 (LLM error) passes — critical for production robustness
- [ ] No P0 accessibility failures (Orb, ChatBubble, ChatInput labels)

### Performance
- [ ] `render_ms < 100` in logs for all module renders observed
- [ ] First token visible < 1s on local network

### Known Technical Debt (documented LOW issues — not blocking Wave 3)
- `ChatThread.tsx`: double-scroll (useEffect + onContentSizeChange) may cause stutter during fast streams
- `StreamingIndicator.tsx`: not exported from barrel `components/shell/index.ts`
- `Orb.test.tsx`: disconnected state accessibility label not tested
- `react-native-reanimated` v4: Orb uses built-in Animated API — migration deferred

---

## 9. Wave 3 Prerequisites Checklist

Before starting story 3.4 (Module Creation End-to-End), confirm:

- [ ] Wave 2 exit criteria met (section 8)
- [ ] Rendering pipeline handles all 3 First Light templates without crash
- [ ] Chat interface sends messages and receives streaming responses end-to-end
- [ ] Backend `agent.handle_chat()` successfully calls LLM provider (test with real key)
- [ ] `module_created` WS message handled by moduleSync → ModuleList renders correctly
- [ ] No open HIGH/MEDIUM issues in any Wave 2 story file

---

*Generated by SM Agent (Bob) — 2026-02-23 — self-app Wave 2 complete*
