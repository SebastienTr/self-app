# Story 2.5: Screen Mode Architecture — Chat & Dashboard

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want the app to show either a full-screen conversation (with modules inline) or a full-screen dashboard (with my module cards),
so that I never see a cramped split of chat, modules, and keyboard competing for space. (FR8, FR17)

## Acceptance Criteria

1. **Given** the app has 0 modules and no conversation history **When** I open the app **Then** the app is in Chat Mode with the chat thread taking the full screen above the input bar

2. **Given** the app is in Dashboard Mode **When** I tap the chat input field **Then** the app transitions to Chat Mode with a 250ms crossfade animation **And** the keyboard opens

3. **Given** the app is in Chat Mode with keyboard open **When** the keyboard closes AND modules exist (count > 0) **Then** the app transitions to Dashboard Mode after a 1-second delay with a 250ms crossfade

4. **Given** the app is in Chat Mode with keyboard open **When** the keyboard closes AND 0 modules exist **Then** the app stays in Chat Mode (no transition)

5. **Given** the app is in Chat Mode **When** the agent creates a module during conversation **Then** the module card is rendered inline in the chat thread, immediately after the agent message that announced it

6. **Given** the app is in Dashboard Mode **When** I view my modules **Then** modules fill the full screen above the input bar (no chat thread visible) **And** modules are scrollable

7. **Given** the app is in Chat Mode with inline module cards **When** the keyboard opens **Then** inline modules scroll up naturally with the rest of the conversation **And** I see only chat messages + input + keyboard (no competing split layout)

8. **Given** the app returns to foreground **When** modules exist **Then** the app opens in Dashboard Mode **When** no modules exist **Then** the app opens in Chat Mode

9. **Given** the Chat Mode is active **When** an agent message with a module_created event arrives **Then** a ModuleCard is rendered inline in the ChatThread scroll after the corresponding agent bubble **And** the card uses the same ModuleCard bridge component as the Dashboard

10. **Given** any screen mode **Then** the chat input bar is always visible at the bottom of the screen as the constant anchor element

## Tasks / Subtasks

- [ ] Task 1: Create screen mode state management (AC: #1, #8)
  - [ ] 1.1 Create `apps/mobile/stores/screenModeStore.ts` with Zustand store: `mode: 'chat' | 'dashboard'`, `setMode(mode)`, `hasModules: boolean` (derived from moduleStore)
  - [ ] 1.2 Implement initial mode logic: on app start, if `moduleStore.modules.size > 0` → dashboard, else → chat
  - [ ] 1.3 Export `useScreenMode()` selector hook following existing store conventions

- [ ] Task 2: Create `useKeyboardVisible` hook (AC: #2, #3, #4, #7)
  - [ ] 2.1 Create `apps/mobile/hooks/useKeyboardVisible.ts` — listens to `keyboardWillShow`/`keyboardWillHide` (iOS) and `keyboardDidShow`/`keyboardDidHide` (Android)
  - [ ] 2.2 Returns `{ keyboardVisible: boolean }` — true when keyboard is open
  - [ ] 2.3 Wire transition logic: keyboard close + modules exist → `setTimeout(() => setMode('dashboard'), 1000)` with cleanup on unmount or re-open

- [ ] Task 3: Refactor App.tsx layout to two-mode rendering (AC: #1, #6, #10)
  - [ ] 3.1 Replace the current `ChatThread(flex:1) + ModuleList(flex:1)` simultaneous layout with a conditional render based on `screenModeStore.mode`
  - [ ] 3.2 Chat Mode: render `<ChatThread style={{flex: 1}} />` only (full screen above input)
  - [ ] 3.3 Dashboard Mode: render `<ModuleList style={{flex: 1}} />` only (full screen above input)
  - [ ] 3.4 Keep `ChatInput` always rendered at the bottom in both modes (constant anchor)
  - [ ] 3.5 Keep `Header` always rendered at the top in both modes

- [ ] Task 4: Add crossfade transition animation (AC: #2, #3)
  - [ ] 4.1 Wrap mode content in `Animated.View` with opacity transition (250ms ease-in-out)
  - [ ] 4.2 On mode change: fade out current content (opacity 1→0), swap content, fade in new content (opacity 0→1)
  - [ ] 4.3 Respect `Reduce Motion` accessibility setting: if enabled, use instant swap instead of crossfade

- [ ] Task 5: Render inline module cards in ChatThread (AC: #5, #9)
  - [ ] 5.1 Add new message type `module_card` to `chatStore.messages` array — message with `type: 'module_card'` and `moduleId: string`
  - [ ] 5.2 When `moduleSync` receives a `module_created` event, append a `{ type: 'module_card', moduleId }` entry to `chatStore.messages` after the agent's current streaming message completes
  - [ ] 5.3 In `ChatThread.tsx`, add a render branch: if message type is `module_card`, render `<ModuleCard module={moduleStore.modules.get(moduleId)} />` inline in the scroll
  - [ ] 5.4 Style inline ModuleCard with `marginHorizontal: tokens.spacing.md` to align with chat bubbles

- [ ] Task 6: Wire ChatInput tap to trigger Chat Mode (AC: #2)
  - [ ] 6.1 In `ChatInput.tsx`, on `onFocus` of the TextInput, call `screenModeStore.setMode('chat')`
  - [ ] 6.2 This triggers the transition from Dashboard → Chat before the keyboard animation starts

- [ ] Task 7: Write tests (AC: all)
  - [ ] 7.1 Unit test `screenModeStore`: initial mode based on module count, `setMode` transitions
  - [ ] 7.2 Unit test `useKeyboardVisible` hook: mock keyboard events, verify state changes
  - [ ] 7.3 Unit test ChatThread: renders `module_card` type messages as ModuleCard components
  - [ ] 7.4 Unit test App layout: in chat mode only ChatThread visible, in dashboard mode only ModuleList visible
  - [ ] 7.5 Unit test transition delay: keyboard close with modules triggers dashboard after 1s, cleanup on re-open cancels timer

- [ ] Task 8: Update existing tests for new layout (AC: all)
  - [ ] 8.1 Update App.tsx tests to account for conditional rendering (ChatThread OR ModuleList, not both)
  - [ ] 8.2 Update ChatThread tests to handle `module_card` message type
  - [ ] 8.3 Ensure all existing mobile tests pass — run `npm run test:mobile`

## Dev Notes

### Architecture Compliance (MANDATORY)

This is story 2.5 in Epic 2 (Conversational Shell & Agent Identity). It refactors the app layout from a simultaneous split view (ChatThread + ModuleList) to a two-mode architecture (Chat Mode vs Dashboard Mode) based on the Twilight UX deep dive analysis.

**Key architectural decisions:**

1. **Two modes, never simultaneous** — Chat Mode shows the full chat thread (with inline modules). Dashboard Mode shows the full module gallery. They never share the screen. The chat input bar is the constant anchor at the bottom of both modes.

2. **Inline modules in chat** — When the agent creates a module, a `ModuleCard` is rendered inside the ChatThread scroll, right after the agent message that announced it. This reuses the existing `ModuleCard` bridge component — no new SDUI components needed.

3. **New store, not modification of existing** — `screenModeStore.ts` is a new Zustand store. It does NOT modify `chatStore` or `moduleStore`. It reads from `moduleStore` to determine initial mode.

4. **Transition rules** (from UX spec):
   - Tap input → Dashboard→Chat (instant, keyboard opens)
   - Keyboard close + modules > 0 → Chat→Dashboard (1s delay + 250ms fade)
   - Keyboard close + 0 modules → stay in Chat
   - Agent sends message → stay in/switch to Chat
   - App foreground resume → Dashboard (if modules) or Chat (if none)

5. **Shell/Bridge layer separation** — The `useKeyboardVisible` hook is a utility (goes in `hooks/`). The mode rendering logic stays in `App.tsx` (root orchestration). `ChatInput` triggers mode change on focus (shell component calling store).

### What Changes in App.tsx

Current layout (simultaneous):
```
KeyboardAvoidingView
  Header
  ChatThread (flex: 1)    ← always visible
  ModuleList (flex: 1)    ← always visible
  ChatInput
```

New layout (conditional):
```
KeyboardAvoidingView
  Header
  {mode === 'chat' ? (
    <Animated.View style={{flex: 1, opacity: fadeAnim}}>
      <ChatThread />
    </Animated.View>
  ) : (
    <Animated.View style={{flex: 1, opacity: fadeAnim}}>
      <ModuleList />
    </Animated.View>
  )}
  ChatInput
```

### Inline Module Cards in Chat

A new message type is added to the chat messages array:

```typescript
// In chatStore.ts
type ChatMessage = {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
} | {
  id: string;
  type: 'module_card';
  moduleId: string;
  timestamp: number;
};
```

In `ChatThread.tsx`, the render function adds a branch:
```typescript
if ('type' in message && message.type === 'module_card') {
  const module = useModuleStore.getState().modules.get(message.moduleId);
  if (module) return <ModuleCard key={message.id} module={module} />;
  return null;
}
```

The existing `ModuleCard` bridge component is reused as-is — it already handles SDUI rendering, error boundaries, and freshness indicators.

### What NOT To Do (Anti-Patterns)

- **DO NOT** remove `ModuleList` component — it is reused in Dashboard Mode as-is
- **DO NOT** create a new SDUI rendering pipeline for inline cards — reuse `ModuleCard`
- **DO NOT** add a bottom tab bar or navigation library — this is a single-screen app with mode switching
- **DO NOT** modify `chatSync.ts` or WebSocket protocol — the `module_card` message is a local-only chat entry, not a WS message type
- **DO NOT** cache mode in AsyncStorage — mode is derived from state (module count + keyboard) on every render
- **DO NOT** add react-native-reanimated — use React Native's built-in `Animated` API (consistent with Orb implementation)
- **DO NOT** break existing tests — current count: 1058 mobile + 728 backend

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
│       └── ChatInput.tsx           MODIFY (onFocus triggers setMode('chat'))
└── services/
    └── chatSync.ts                 MODIFY (append module_card to chat on module_created)
```

### References

- [Source: epics.md#Epic 2] — FR8 (contextual empty state), FR17 (native module rendering)
- [Source: ux-twilight-deep-dive.html#Screen Architecture] — Two-mode mockups, transition rules, before/after comparison
- [Source: architecture.md#Mobile Component Layers] — Shell/Bridge/SDUI layer separation
- [Source: architecture.md#State Management] — Zustand store conventions, naming patterns
- [Source: story 2-1] — ChatThread, ChatInput, chatStore implementations, keyboard event handling
- [Source: story 3-3] — ModuleCard bridge component, ModuleList FlatList rendering
- [Source: story 3-4] — moduleSync module creation flow, moduleStore update patterns
- [Source: tokens.ts] — Design system spacing, animation timing conventions

## Dev Agent Record

### Agent Model Used

(pending implementation)

### Debug Log References

(pending implementation)

### Completion Notes List

(pending implementation)

### Change Log

- 2026-02-24: Story 2.5 created — Screen Mode Architecture for Chat & Dashboard modes, based on Twilight UX deep dive analysis of keyboard/module/chat conflict

### File List

(populated after implementation)
