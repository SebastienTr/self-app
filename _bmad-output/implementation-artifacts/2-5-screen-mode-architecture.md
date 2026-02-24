# Story 2.5: Screen Mode Architecture — Chat & Dashboard

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want the app to show either a full-screen conversation (with modules inline) or a full-screen dashboard (with my module cards),
so that I never see a cramped split of chat, modules, and keyboard competing for space. (FR8, FR17)

## Acceptance Criteria

1. **Given** the app has 0 modules and no conversation history **When** I open the app **Then** the app is in Chat Mode with the chat thread taking the full screen above the input bar

2. **Given** the app is in Dashboard Mode **When** I tap the chat input field **Then** the app transitions to Chat Mode with a 250ms crossfade animation **And** the keyboard opens

3. **Given** the app is in Chat Mode with keyboard open **When** the keyboard closes AND modules exist (count > 0) AND the agent is idle (not streaming) **Then** the app transitions to Dashboard Mode after a 1-second delay with a 250ms crossfade

4. **Given** the app is in Chat Mode with keyboard open **When** the keyboard closes AND 0 modules exist **Then** the app stays in Chat Mode (no transition)

5. **Given** the app is in Chat Mode **When** the agent creates a module during conversation **Then** the module card is rendered inline in the chat thread, immediately after the agent message that announced it

6. **Given** the app is in Dashboard Mode **When** I view my modules **Then** modules fill the full screen above the input bar (no chat thread visible) **And** modules are scrollable

7. **Given** the app is in Chat Mode with inline module cards **When** the keyboard opens **Then** inline modules scroll up naturally with the rest of the conversation **And** I see only chat messages + input + keyboard (no competing split layout)

8. **Given** the app returns to foreground after being backgrounded for more than 5 seconds **When** modules exist AND the agent is idle **Then** the app opens in Dashboard Mode **When** no modules exist **Then** the app opens in Chat Mode

11. **Given** the app is in Chat Mode **When** the keyboard closes AND the agent is actively streaming a response **Then** the app stays in Chat Mode until the agent finishes (no transition during streaming)

9. **Given** the Chat Mode is active **When** an agent message with a module_created event arrives **Then** a ModuleCard is rendered inline in the ChatThread scroll after the corresponding agent bubble **And** the card uses the same ModuleCard bridge component as the Dashboard

10. **Given** any screen mode **Then** the chat input bar is always visible at the bottom of the screen as the constant anchor element

## Tasks / Subtasks

- [x] Task 1: Create screen mode state management (AC: #1, #8)
  - [x] 1.1 Create `apps/mobile/stores/screenModeStore.ts` with Zustand store: `mode: 'chat' | 'dashboard'`, `setMode(mode)`, `hasModules: boolean` (derived from moduleStore)
  - [x] 1.2 Implement initial mode logic: on app start, if `moduleStore.modules.size > 0` → dashboard, else → chat
  - [x] 1.3 Export `useScreenMode()` selector hook following existing store conventions
  - [x] 1.4 In `App.tsx`, add `AppState.addEventListener('change', ...)` listener: on transition from `background` → `active` (after >5s in background), re-evaluate mode based on module count and agent status. If modules > 0 and agent idle → dashboard; if 0 modules → chat; otherwise keep current mode

- [x] Task 2: Create `useKeyboardVisible` hook (AC: #2, #3, #4, #7)
  - [x] 2.1 Create `apps/mobile/hooks/useKeyboardVisible.ts` — listens to `keyboardWillShow`/`keyboardWillHide` (iOS) and `keyboardDidShow`/`keyboardDidHide` (Android)
  - [x] 2.2 Returns `{ keyboardVisible: boolean }` — pure observation hook, no side effects, no store dependencies
  - [x] 2.3 Refactor `ChatInput.tsx` to use `useKeyboardVisible()` instead of its internal keyboard listener (deduplicate existing code)
  - [x] 2.4 Wire transition logic **in `App.tsx`** (not in the hook): on keyboard close, if `modules.size > 0` AND `agentStatus === 'idle'` → `setTimeout(() => setMode('dashboard'), 1000)` with cleanup on unmount or re-open. Cancel timer if keyboard reopens or agent starts streaming

- [x] Task 3: Refactor App.tsx layout to two-mode rendering (AC: #1, #6, #10)
  - [x] 3.1 Replace the current `ChatThread(flex:1) + ModuleList(flex:1)` simultaneous layout with a conditional render based on `screenModeStore.mode`
  - [x] 3.2 Chat Mode: render `<ChatThread style={{flex: 1}} />` only (full screen above input)
  - [x] 3.3 Dashboard Mode: render `<ModuleList style={{flex: 1}} />` only (full screen above input)
  - [x] 3.4 Keep `ChatInput` always rendered at the bottom in both modes (constant anchor)
  - [x] 3.5 Keep `Header` always rendered at the top in both modes

- [x] Task 4: Add crossfade transition animation (AC: #2, #3)
  - [x] 4.1 Wrap mode content in `Animated.View` with opacity transition (250ms ease-in-out)
  - [x] 4.2 On mode change: fade out current content (opacity 1→0), swap content, fade in new content (opacity 0→1)
  - [x] 4.3 Respect `Reduce Motion` accessibility setting: if enabled, use instant swap instead of crossfade

- [x] Task 5: Render inline module cards in ChatThread (AC: #5, #9, #11)
  - [x] 5.1 Add new message type `module_card` to `chatStore.messages` array — message with `type: 'module_card'` and `moduleId: string`
  - [x] 5.2 In `moduleSync.ts`, when `module_created` is received: check `chatStore.agentStatus`. If `idle` → append `module_card` entry immediately. If streaming/thinking → subscribe to `agentStatus` changes via `chatStore.subscribe()` and append the `module_card` entry once `agentStatus` returns to `idle` (i.e., after `finalizeAgentMessage`). Use a one-shot subscription that cleans itself up
  - [x] 5.3 In `ChatThread.tsx`, add a render branch: if `message.type === 'module_card'`, render `<ModuleCard module={moduleStore.modules.get(moduleId)} />` inline in the scroll
  - [x] 5.4 Style inline ModuleCard with `marginHorizontal: tokens.spacing.md` to align with chat bubbles

- [x] Task 6: Wire ChatInput focus to trigger Chat Mode (AC: #2)
  - [x] 6.1 Add an optional `onInputFocus?: () => void` prop to `ChatInput` (maintains shell layer purity — no store imports)
  - [x] 6.2 In `ChatInput.tsx`, call `onInputFocus?.()` from the TextInput's `onFocus` handler
  - [x] 6.3 In `App.tsx`, pass `onInputFocus={() => screenModeStore.setMode('chat')}` to `<ChatInput />` — this keeps the store call in the orchestration layer

- [x] Task 7: Write tests (AC: all)
  - [x] 7.1 Unit test `screenModeStore`: initial mode based on module count, `setMode` transitions
  - [x] 7.2 Unit test `useKeyboardVisible` hook: mock keyboard events, verify state changes (pure — no store side effects)
  - [x] 7.3 Unit test ChatThread: renders `module_card` type messages as ModuleCard components, renders `chat` type as ChatBubble
  - [x] 7.4 Unit test App layout: in chat mode only ChatThread visible, in dashboard mode only ModuleList visible
  - [x] 7.5 Unit test transition delay: keyboard close with modules + agent idle triggers dashboard after 1s, cleanup on re-open cancels timer
  - [x] 7.6 Unit test streaming guard: keyboard close while agent streaming does NOT trigger dashboard transition; transition fires after agent becomes idle
  - [x] 7.7 Unit test AppState foreground: mock AppState change from background→active after >5s, verify mode re-evaluation
  - [x] 7.8 Unit test module_card timing in moduleSync: if agent is streaming when module_created arrives, module_card is appended only after streaming completes

- [x] Task 8: Update existing tests for new layout (AC: all)
  - [x] 8.1 Update App.tsx tests to account for conditional rendering (ChatThread OR ModuleList, not both)
  - [x] 8.2 Update ChatThread tests to handle `module_card` message type
  - [x] 8.3 Ensure all existing mobile tests pass — run `npm run test:mobile`

## Dev Notes

### Architecture Compliance (MANDATORY)

This is story 2.5 in Epic 2 (Conversational Shell & Agent Identity). It refactors the app layout from a simultaneous split view (ChatThread + ModuleList) to a two-mode architecture (Chat Mode vs Dashboard Mode) based on the Twilight UX deep dive analysis.

**Key architectural decisions:**

1. **Two modes, never simultaneous** — Chat Mode shows the full chat thread (with inline modules). Dashboard Mode shows the full module gallery. They never share the screen. The chat input bar is the constant anchor at the bottom of both modes.

2. **Inline modules in chat** — When the agent creates a module, a `ModuleCard` is rendered inside the ChatThread scroll, right after the agent message that announced it. This reuses the existing `ModuleCard` bridge component — no new SDUI components needed.

3. **New store, not modification of existing** — `screenModeStore.ts` is a new Zustand store. It does NOT modify `chatStore` or `moduleStore`. It reads from `moduleStore` to determine initial mode.

4. **Transition rules** (from UX spec):
   - Tap input → Dashboard→Chat (instant, keyboard opens)
   - Keyboard close + modules > 0 + agent idle → Chat→Dashboard (1s delay + 250ms fade)
   - Keyboard close + modules > 0 + agent streaming → stay in Chat (wait for idle)
   - Keyboard close + 0 modules → stay in Chat
   - Agent sends message → stay in/switch to Chat
   - App foreground resume (>5s background) + agent idle → Dashboard (if modules) or Chat (if none)

5. **Shell/Bridge layer separation** — The `useKeyboardVisible` hook is a pure utility (goes in `hooks/`), returns only `{ keyboardVisible: boolean }`, no store deps. The mode rendering logic and all transition orchestration stays in `App.tsx`. `ChatInput` receives an `onInputFocus` callback prop from `App.tsx` — it never imports a store directly (shell layer purity).

### What Changes in App.tsx

Current layout (simultaneous):
```
KeyboardAvoidingView
  Header
  ChatThread (flex: 1)    ← always visible
  ModuleList (flex: 1)    ← always visible
  ChatInput
```

New layout (conditional with crossfade):
```
KeyboardAvoidingView
  Header
  // IMPORTANT: Both views stay mounted during transition. Use opacity + pointerEvents
  // to crossfade. A ternary would unmount before fade-out completes.
  <Animated.View style={{flex: mode === 'chat' ? 1 : 0, opacity: chatOpacity}}
                 pointerEvents={mode === 'chat' ? 'auto' : 'none'}>
    <ChatThread />
  </Animated.View>
  <Animated.View style={{flex: mode === 'dashboard' ? 1 : 0, opacity: dashOpacity}}
                 pointerEvents={mode === 'dashboard' ? 'auto' : 'none'}>
    <ModuleList />
  </Animated.View>
  ChatInput
```
Note: The dev may choose an alternative approach (e.g., ref-based swap after fade-out completes). The key constraint is: the outgoing view must remain visible during the 250ms fade-out.

### Inline Module Cards in Chat

A new message type is added to the chat messages array:

```typescript
// In chatStore.ts — convert to discriminated union with explicit `type` field
type ChatMessage = {
  id: string;
  type: 'chat';           // NEW — explicit discriminant for regular messages
  role: 'user' | 'agent';
  content: string;
  timestamp: string;      // ISO format (existing convention)
  isError?: boolean;      // existing field for error messages
} | {
  id: string;
  type: 'module_card';
  moduleId: string;
  timestamp: string;      // ISO format (same as regular messages)
};
```

**Migration note:** All existing code that creates `ChatMessage` objects (`addUserMessage`, `finalizeAgentMessage`, `addErrorMessage`) must add `type: 'chat'` to the created object. This is a mechanical change — search for `role: 'user'` and `role: 'agent'` in chatStore.ts.

In `ChatThread.tsx`, the render function uses the discriminant:
```typescript
if (message.type === 'module_card') {
  const module = useModuleStore.getState().modules.get(message.moduleId);
  if (module) return <ModuleCard key={message.id} module={module} />;
  return null;
}
// message.type === 'chat' — render normally
```

The existing `ModuleCard` bridge component is reused as-is — it already handles SDUI rendering, error boundaries, and freshness indicators.

### What NOT To Do (Anti-Patterns)

- **DO NOT** remove `ModuleList` component — it is reused in Dashboard Mode as-is
- **DO NOT** create a new SDUI rendering pipeline for inline cards — reuse `ModuleCard`
- **DO NOT** add a bottom tab bar or navigation library — this is a single-screen app with mode switching
- **DO NOT** modify WebSocket protocol — the `module_card` message is a local-only chat entry, not a WS message type. The insertion happens in `moduleSync.ts` (not `chatSync.ts`)
- **DO NOT** cache mode in AsyncStorage — mode is derived from state (module count + keyboard) on every render
- **DO NOT** add react-native-reanimated — use React Native's built-in `Animated` API (consistent with Orb implementation)
- **DO NOT** break existing tests — current count: 1079 mobile + 784 backend

### Previous Story Intelligence

**From Story 2.1 (Real-Time Chat Interface with Streaming — done):**
- `ChatThread.tsx` uses a `ScrollView` with `flexGrow: 1, justifyContent: 'flex-end'` for bottom-stacking messages
- `chatStore.messages` is an array of message objects with `id`, `role`, `content`, `timestamp`
- `ChatInput.tsx` listens to keyboard events for bottom margin adjustment — this logic can be extracted into `useKeyboardVisible`

**From Story 3.3 (Module Rendering Pipeline — done):**
- `ModuleCard.tsx` is a self-contained bridge component with ErrorBoundary wrapper
- It takes a `module: ModuleState` prop and handles all SDUI rendering internally
- Can be rendered anywhere — no dependency on being inside a FlatList

**From Story 3.4 (Module Creation End-to-End — done):**
- `moduleSync.ts` handles `module_sync` WS messages and updates `moduleStore`
- Module creation flow: agent creates spec → backend sends `module_sync` → mobile renders
- The `module_created` event can be intercepted to also append an inline card to chat

### UX Reference

See: `_bmad-output/planning-artifacts/ux-twilight-deep-dive.html` — section "Screen Architecture: Chat & Dashboard" for visual mockups, transition table, and before/after comparison.

### Target File Structure After This Story

```
apps/mobile/
├── App.tsx                         MODIFY (conditional mode rendering, crossfade animation)
├── stores/
│   ├── screenModeStore.ts          NEW (screen mode state: chat | dashboard)
│   ├── chatStore.ts                MODIFY (add module_card message type)
│   └── (other stores unchanged)
├── hooks/
│   └── useKeyboardVisible.ts       NEW (keyboard visibility hook)
├── components/
│   ├── bridge/
│   │   ├── ChatThread.tsx          MODIFY (render inline ModuleCard for module_card messages)
│   │   └── ModuleList.tsx          UNCHANGED (used as-is in Dashboard Mode)
│   └── shell/
│       └── ChatInput.tsx           MODIFY (add onInputFocus prop, use useKeyboardVisible hook)
└── services/
    └── moduleSync.ts               MODIFY (append module_card to chatStore on module_created)
```

### References

- [Source: epics.md#Epic 2] — FR8 (contextual empty state), FR17 (native module rendering)
- [Source: ux-twilight-deep-dive.html#Screen Architecture] — Two-mode mockups, transition rules, before/after comparison
- [Source: architecture.md#Two-Mode Screen Architecture] — Chat Mode / Dashboard Mode definition, transition rules
- [Source: architecture.md#Mobile Component Layers] — Shell/Bridge/SDUI layer separation
- [Source: architecture.md#State Management] — Zustand store conventions, naming patterns
- [Source: story 2-1] — ChatThread, ChatInput, chatStore implementations, keyboard event handling
- [Source: story 3-3] — ModuleCard bridge component, ModuleList FlatList rendering
- [Source: story 3-4] — moduleSync module creation flow, moduleStore update patterns
- [Source: tokens.ts] — Design system spacing, animation timing conventions

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug issues.

### Completion Notes List

Tasks 1-8 complete. 54 new tests. 0 regressions. 1133+784=1917 total.

### Change Log

- 2026-02-24: Story 2.5 created — Screen Mode Architecture for Chat & Dashboard modes, based on Twilight UX deep dive analysis of keyboard/module/chat conflict
- 2026-02-24: Post-audit review — fixed ChatMessage type (timestamp: string not number, added isError), corrected target file (moduleSync.ts not chatSync.ts), updated test counts (1079+784), added architecture reference
- 2026-02-24: Impl complete (Opus 4.6) - 8 tasks, 54 new tests, 0 regressions
- 2026-02-24: Code review (Opus 4.6) — Fixed MEDIUM: crossfade using absoluteFill instead of collapsed height:0 (proper overlay during transition). Removed no-op setTimeout placeholder. Added 30 edge-case tests (TEA phase). Final: 1163 mobile tests passing.
- 2026-02-24: Party mode review (Winston, Sally, Amelia, Bob) — 8 fixes: (1) useKeyboardVisible now pure hook, transition logic in App.tsx; (2) added AppState listener task for foreground resume; (3) fixed crossfade pseudo-code (both views mounted during transition); (4) added AC #11 streaming guard + AC #3 agent-idle condition; (5) discriminated union with explicit type:'chat'; (6) module_card timing via one-shot chatStore subscription; (7) ChatInput uses onInputFocus prop instead of store import; (8) AC #8 clarified with 5s background threshold

### File List

New: screenModeStore.ts, useKeyboardVisible.ts, 7 test files. Modified: App.tsx, chatStore.ts, moduleSync.ts, ChatThread.tsx, ChatInput.tsx

