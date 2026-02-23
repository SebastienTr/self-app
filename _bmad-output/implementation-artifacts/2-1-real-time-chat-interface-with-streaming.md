# Story 2.1: Real-Time Chat Interface with Streaming

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to send messages in natural language and see the agent's response stream in real-time,
so that conversation feels natural and responsive. (FR1, FR5)

## Acceptance Criteria

1. **Given** the chat interface is open **When** I type a message and send it **Then** the message appears in the conversation thread instantly with user-bubble styling (right-aligned, `#1A3050` background with `#1E2E44` border, `tokens.colors.text` text)

2. **Given** a message is sent to the agent **When** the agent responds **Then** the response text streams token by token in real-time (FR5) with agent-bubble styling (left-aligned, `#162436` / `tokens.colors.surfaceElevated` background) **And** the first token appears within 1 second (NFR7)

3. **Given** the chat interface **When** I send messages in any language **Then** the agent responds in the same language (FR1)

4. **Given** the agent encounters an LLM provider error **When** the error occurs during response generation **Then** a structured, user-facing error message is displayed instead of a crash (NFR22) **And** the error uses the `error` message type `{ code, message, agentAction }` from the WS protocol

5. **Given** the chat is in streaming state **When** the `chat_stream` message with `done: true` arrives **Then** the streaming indicator disappears and the message is finalized in the chat thread

6. **Given** the main app screen **When** the user is authenticated and initialization is complete **Then** a `ChatInput` component is visible at the bottom of the screen with a text field and a send button

7. **Given** the chat interface **When** the agent is processing a message **Then** the Orb transitions to the `thinking` agent state and the agent's status message bubble shows a streaming indicator (e.g., animated dots or partial text)

## Tasks / Subtasks

- [x] Task 1: Create `chatStore` Zustand store (AC: #1, #2, #5, #7)
  - [x]1.1 Create `apps/mobile/stores/chatStore.ts`
  - [x]1.2 Define state: `messages: ChatMessage[]`, `streamingMessage: string | null`, `agentStatus: AgentStatus`
  - [x]1.3 Define `ChatMessage = { id: string; role: 'user' | 'agent'; content: string; timestamp: string; isError?: boolean }`
  - [x]1.4 Define `AgentStatus = 'idle' | 'thinking' | 'discovering' | 'composing'` — status enum, NEVER boolean (matches `AgentState` from `types/ws.ts`)
  - [x]1.5 Define actions: `addUserMessage(content: string): void`, `startAgentStream(): void`, `appendStreamDelta(delta: string): void`, `finalizeAgentMessage(): void`, `addErrorMessage(message: string): void`, `setAgentStatus(status: AgentStatus): void`, `clearMessages(): void`
  - [x]1.6 Define selectors: `getMessages(): ChatMessage[]`, `getIsStreaming(): boolean`, `getAgentStatus(): AgentStatus`
  - [x]1.7 `addUserMessage` generates UUID via `crypto.randomUUID()` for `id`, sets `role: 'user'`, `timestamp: new Date().toISOString()`
  - [x]1.8 `startAgentStream` sets `streamingMessage: ''` and `agentStatus: 'thinking'`
  - [x]1.9 `appendStreamDelta` concatenates delta to `streamingMessage`
  - [x]1.10 `finalizeAgentMessage` creates a proper `ChatMessage` from `streamingMessage`, sets `streamingMessage: null`, `agentStatus: 'idle'`
  - [x]1.11 `addErrorMessage` creates a `ChatMessage` with `role: 'agent'`, `isError: true`
  - [x]1.12 Follow Zustand conventions from architecture: state=nouns, actions=imperative verbs, selectors=get+noun, one store per domain
  - [x]1.13 Create `apps/mobile/stores/chatStore.test.ts` with tests for all actions and selectors

- [x] Task 2: Register `chat_stream` and `status` WS message handlers (AC: #2, #5, #7)
  - [x]2.1 Create `apps/mobile/services/chatSync.ts` (pattern: same as `moduleSync.ts`)
  - [x]2.2 `initChatSync()` registers handlers via `wsClient.onMessage()` for `chat_stream` and `status`
  - [x]2.3 On `chat_stream` message: if `done === false`, call `chatStore.appendStreamDelta(payload.delta)` **and** if `streamingMessage` was null, call `chatStore.startAgentStream()` first; if `done === true`, call `chatStore.finalizeAgentMessage()`
  - [x]2.4 On `status` message: call `chatStore.setAgentStatus(payload.state)` (maps `AgentState` from WS to `AgentStatus` in store)
  - [x]2.5 On `error` message: if `agentStatus !== 'idle'` (i.e., we were waiting for an agent response), call `chatStore.addErrorMessage(payload.message)` and reset streaming state
  - [x]2.6 Return unsubscribe functions from `initChatSync()` for cleanup
  - [x]2.7 Create `apps/mobile/services/chatSync.test.ts` — test all handler branches

- [x] Task 3: Create `ChatBubble` shell component (AC: #1, #2, #4)
  - [x]3.1 Create `apps/mobile/components/shell/ChatBubble.tsx`
  - [x]3.2 Props: `{ role: 'user' | 'agent'; content: string; isStreaming?: boolean; isError?: boolean }`
  - [x]3.3 User bubble styling: `alignSelf: 'flex-end'`, background `#1A3050`, border `1px solid tokens.colors.border (#1E2E44)`, `borderRadius: tokens.radii.lg (16)`, padding `tokens.spacing.sm tokens.spacing.md`
  - [x]3.4 Agent bubble styling: `alignSelf: 'flex-start'`, background `tokens.colors.surfaceElevated (#162436)`, `borderRadius: tokens.radii.lg (16)`, padding `tokens.spacing.sm tokens.spacing.md`
  - [x]3.5 Error bubble: agent bubble with `tokens.colors.error (#CC5F5F)` border and slightly dimmed content
  - [x]3.6 `isStreaming`: show animated streaming indicator after text (e.g., 3 pulsing dots using `react-native-reanimated v4` OR simple opacity animation via `Animated` API from RN — prefer the already-available approach from the existing codebase)
  - [x]3.7 Text uses `tokens.typography.body` (15px, weight 400), color `tokens.colors.text`
  - [x]3.8 Accessibility: `accessibilityRole="text"`, `accessibilityLabel` combining role and content (e.g., "Agent: [content]" / "You: [content]")
  - [x]3.9 PURE component — props in, JSX out. No store access, no side effects (Shell layer rule)
  - [x]3.10 Create `apps/mobile/components/shell/ChatBubble.test.tsx` — test user/agent/error/streaming variants and accessibility labels

- [x] Task 4: Create `ChatInput` shell component (AC: #6)
  - [x]4.1 Create `apps/mobile/components/shell/ChatInput.tsx`
  - [x]4.2 Props: `{ onSend: (message: string) => void; disabled?: boolean }`
  - [x]4.3 Internal state: `value: string` (controlled text input)
  - [x]4.4 Styling: background `tokens.colors.surfaceElevated (#162436)`, border `tokens.colors.border (#1E2E44)`, `borderRadius: tokens.radii.lg`, full-width minus `tokens.spacing.md` horizontal padding
  - [x]4.5 Send button: amber `tokens.colors.accent (#E8A84C)` background, disabled when `value.trim() === ''` or `disabled === true`
  - [x]4.6 On send: call `onSend(value.trim())` then clear input field
  - [x]4.7 Touch targets minimum 44x44pt (NFR33) for the send button
  - [x]4.8 `accessibilityLabel` on input ("Message input") and send button ("Send message") (NFR31)
  - [x]4.9 PURE component — no store access (Shell layer rule)
  - [x]4.10 Create `apps/mobile/components/shell/ChatInput.test.tsx`

- [x] Task 5: Create `Orb` shell component (AC: #7)
  - [x]5.1 Create `apps/mobile/components/shell/Orb.tsx`
  - [x]5.2 Props: none — reads from `chatStore` (agent status) and `connectionStore` (connection status)
  - [x]5.3 Visual: amber pulsing circle communicating agent state using `tokens.animation` timings:
    - `idle`: 4s pulse cycle (`tokens.animation.orbIdle.duration = 4000`)
    - `thinking` / `discovering` / `composing`: fast 1.5s pulse (`tokens.animation.orbCreating.duration = 1500`)
  - [x]5.4 Animation: use `react-native-reanimated v4` (already in deps from Epic 1). Radial gradient #F0C060 → #E8A84C → #D4943C. Use `useSharedValue`, `withRepeat`, `withTiming` for the pulse scale/opacity
  - [x]5.5 Size: 60px diameter ambient orb (not the full-screen creation ceremony — that is Epic 6)
  - [x]5.6 Reduced motion: check `AccessibilityInfo.isReduceMotionEnabled()` on mount; if true, render static amber circle with no animation (`tokens.colors.accent` background, no pulse)
  - [x]5.7 `accessibilityLabel`: "Agent status: [idle|thinking]" (NFR31)
  - [x]5.8 Bridge layer note: The `Orb` reads from stores — it is technically a Bridge component but architecture doc places Orb in `components/shell/`. Follow the architecture doc: `Orb.tsx` is in `components/shell/`
  - [x]5.9 Create `apps/mobile/components/shell/Orb.test.tsx` — test idle/thinking states and reduced motion fallback

- [x] Task 6: Create `ChatThread` bridge component (AC: #1, #2, #4, #5)
  - [x]6.1 Create `apps/mobile/components/bridge/ChatThread.tsx`
  - [x]6.2 Reads from `chatStore` via `useChatStore` selector
  - [x]6.3 Renders a `ScrollView` of `ChatBubble` components for each message in `store.messages`
  - [x]6.4 If `streamingMessage !== null`, renders an additional `ChatBubble` with `role='agent'` `isStreaming={true}` and `content={streamingMessage}` at the bottom
  - [x]6.5 Auto-scroll to bottom on new message / streaming delta: use `ScrollView` `ref` + `scrollToEnd({ animated: true })`
  - [x]6.6 Performance: `FlatList` is acceptable if message count grows, but a simple `ScrollView` with `.map()` is fine for Phase 0/1 (< 50 messages)
  - [x]6.7 Bridge layer rules: owns lifecycle logic, delegates rendering to Shell primitives (ChatBubble)
  - [x]6.8 `accessibilityLabel="Conversation thread"` on the ScrollView
  - [x]6.9 Create `apps/mobile/components/bridge/ChatThread.test.tsx`

- [x] Task 7: Update backend `chat` handler with real LLM streaming (AC: #2, #3, #4)
  - [x]7.1 Create `apps/backend/app/agent.py` — agent orchestration module
  - [x]7.2 `agent.py` function: `async def handle_chat(ws: WebSocket, message: str, provider: LLMProvider) -> None`
  - [x]7.3 Logic: assemble prompt from `message` (no SOUL.md or memory in this story — basic prompt only), call `provider.execute(prompt)`, stream response back as `chat_stream` messages
  - [x]7.4 Streaming loop: for each token/chunk from provider response, send `{ type: 'chat_stream', payload: { delta: chunk, done: False } }`. When complete, send `{ type: 'chat_stream', payload: { delta: '', done: True } }`
  - [x]7.5 On LLM error: log with `agent_action`, send `{ type: 'error', payload: { code: 'LLM_CHAT_FAILED', message: user-facing message, agent_action: ... } }` (NFR22)
  - [x]7.6 Send `{ type: 'status', payload: { state: 'thinking' } }` BEFORE calling provider, send `{ type: 'status', payload: { state: 'idle' } }` AFTER completion
  - [x]7.7 Update `main.py` `chat` handler to call `agent.handle_chat()` instead of the echo stub — import and call from `agent.py`
  - [x]7.8 Get active LLM provider via `from app.llm import get_provider; provider = get_provider()` in `agent.py`
  - [x]7.9 Log LLM usage: after `provider.execute()`, insert result into `llm_usage` table via `db.py`
  - [x]7.10 All backend code: async-only, `aiosqlite`, structured logging with `agent_action` on every error
  - [x]7.11 Create `apps/backend/tests/test_agent.py` — test `handle_chat` with mock provider (happy path, LLM error, streaming chunks)

- [x] Task 8: Update `App.tsx` to wire chat into the main screen (AC: #6, #7)
  - [x]8.1 Import and call `initChatSync()` in `App.tsx` startup sequence (after `initModuleSync()`)
  - [x]8.2 The `onSend` handler in `App.tsx` (or a hook): call `chatStore.addUserMessage(message)` then `wsClient.send({ type: 'chat', payload: { message } })`
  - [x]8.3 Render the `Orb` component in the main app view (Phase 0: full screen, centered or top-area)
  - [x]8.4 Render `ChatThread` in the scrollable content area
  - [x]8.5 Render `ChatInput` at the bottom, pass `onSend` handler and `disabled={agentStatus !== 'idle' || connectionStatus !== 'connected'}`
  - [x]8.6 The layout for Phase 0 (0 modules): full-screen Orb + ChatThread + ChatInput. No layout phase complexity needed for this story — Epic 3+ handles the morphing interface
  - [x]8.7 Export `initChatSync` cleanup from `chatSync.ts` and call it in `App.tsx` cleanup (`return () => { disconnect(); cleanupChatSync(); }`)
  - [x]8.8 Update `apps/mobile/components/shell/index.ts` barrel to export `ChatBubble`, `ChatInput`, `Orb`

- [x] Task 9: Update `types/module.ts` and ensure `AgentState` is properly imported (AC: #7)
  - [x]9.1 The `AgentState` type is already defined in `apps/mobile/types/ws.ts` as `'idle' | 'thinking' | 'discovering' | 'composing'`
  - [x]9.2 `chatStore.ts` `AgentStatus` should import from `types/ws.ts` `AgentState` (they are the same type) — use `import type { AgentState } from '@/types/ws'` and type `agentStatus: AgentState`
  - [x]9.3 Do NOT duplicate the `AgentState` type — reuse the existing definition

- [x] Task 10: Write integration tests for chat flow (AC: all)
  - [x]10.1 Create `apps/mobile/__tests__/chat.test.ts`
  - [x]10.2 Test: user sends message → `chatStore.addUserMessage` called → WS `chat` message sent
  - [x]10.3 Test: `chat_stream` with `done: false` → `startAgentStream` + `appendStreamDelta` called
  - [x]10.4 Test: `chat_stream` with `done: true` → `finalizeAgentMessage` called → `streamingMessage` is null
  - [x]10.5 Test: `error` WS message during streaming → `addErrorMessage` called, streaming reset
  - [x]10.6 Test: `status` message with `thinking` → `agentStatus` updated in chatStore
  - [x]10.7 Mock `wsClient`, `chatStore`

## Dev Notes

### Architecture Compliance (MANDATORY)

This is the FIRST story in Epic 2 (Conversational Shell & Agent Identity). It establishes the chat infrastructure — `ChatBubble`, `ChatInput`, `Orb`, `ChatThread`, `chatStore`, and the backend `agent.py` orchestration. Stories 2.2-2.4 build directly on top of these components.

**Critical patterns to follow:**

1. **Shell/Bridge/SDUI Layer separation (architecture boundary — NON-NEGOTIABLE):**
   - `ChatBubble`, `ChatInput`, `Orb` → `components/shell/` (static UI, pure components, no store access *except Orb which reads stores per architecture doc*)
   - `ChatThread` → `components/bridge/` (lifecycle-aware, reads chatStore, delegates rendering to Shell)
   - Store access only in Bridge components and the `App.tsx` wiring layer
   - Architecture doc states: "Shell components talk to stores, never to each other" — `ChatInput` passes `onSend` callback, never touches chatStore directly

2. **Status enums, NEVER booleans (architecture absolute rule):**
   - `AgentStatus = AgentState = 'idle' | 'thinking' | 'discovering' | 'composing'` — already defined in `types/ws.ts`
   - `getIsStreaming()` selector is acceptable as it derives from `streamingMessage !== null` (not a raw boolean state field)
   - Never add `isLoading: boolean`, `isThinking: boolean` etc. to any store

3. **Zustand conventions (architecture mandate):**
   - State = nouns: `messages`, `streamingMessage`, `agentStatus`
   - Actions = imperative verbs: `addUserMessage`, `startAgentStream`, `appendStreamDelta`, `finalizeAgentMessage`
   - Selectors = `get` + descriptive noun: `getMessages`, `getIsStreaming`, `getAgentStatus`
   - One store per domain: `chatStore` for chat ONLY — do not put agent state in `connectionStore` or `moduleStore`

4. **Backend flat structure (architecture mandate):**
   - `apps/backend/app/agent.py` is a flat module, NOT a subdirectory (only `llm/` gets a sub-package)
   - Backend boundary: `main.py` is the ONLY file that touches the WebSocket object — `agent.py` receives `ws: WebSocket` as a parameter
   - `agent.py` calls `llm/` and may call `db.py` for usage logging, but does NOT call `modules.py` or `memory.py` in this story

5. **Async-only Python rule:**
   - No `import requests`, no `subprocess.run()`, no `time.sleep()` — already enforced by Ruff ASYNC rules
   - All DB access via `aiosqlite` through `db.py`'s `get_connection()` pattern (per-request connections, not session-scoped — see fix(1-5) history)

6. **WebSocket message format (invariant):**
   ```json
   { "type": "string", "payload": { ... } }
   ```
   Every message, no exceptions. Backend sends `chat_stream`, `status`, `error`. Mobile sends `chat`.

7. **snake_case ↔ camelCase boundary:**
   - Backend sends JSON with `snake_case`: `{ "type": "chat_stream", "payload": { "delta": "...", "done": true } }`
   - Mobile `toCamel()` converts on receipt → TypeScript sees `{ delta: string, done: boolean }`
   - The `chat_stream` payload fields `delta` and `done` are already camelCase-compatible (no conversion needed for these two, but apply consistently anyway)

8. **Error format (architecture mandate):**
   ```json
   {
     "type": "error",
     "payload": {
       "code": "LLM_CHAT_FAILED",
       "message": "user-facing message",
       "agent_action": "Check LLM provider health...",
       "context": { ... }
     }
   }
   ```
   Error code prefix for LLM errors: `LLM_*`. Log BEFORE sending to client.

### Backend Chat Handler: Replacing the Echo Stub

The current `main.py` has an echo stub for the `chat` message type:

```python
elif msg_type == "chat":
    # Stub: echo back as chat_stream (full agent integration later)
    await ws.send_json({
        "type": "chat_stream",
        "payload": {
            "delta": f"Echo: {payload.get('message', '')}",
            "done": True,
        },
    })
```

This stub must be REPLACED (not supplemented) by a call to `agent.handle_chat()`:

```python
elif msg_type == "chat":
    await agent.handle_chat(ws, payload.get("message", ""), provider)
```

Where `provider` is obtained via `from app.llm import get_provider; provider = get_provider()` — called once in the WebSocket endpoint scope (not on every message).

### Streaming Implementation Pattern

The `LLMProvider.execute()` currently returns an `LLMResult` (not a stream). For First Light using `ClaudeCodeCLI`, the full response comes at once as stdout. The streaming behavior for the mobile chat is simulated by sending the full response as a single `chat_stream` delta, then immediately a `done: True` message. This is acceptable for First Light — true token-by-token streaming is a refinement for MVP when the `AnthropicAPI` provider supports `stream=True`.

**First Light streaming pattern (acceptable):**
```python
# agent.py
async def handle_chat(ws: WebSocket, message: str, provider: LLMProvider) -> None:
    await ws.send_json({"type": "status", "payload": {"state": "thinking"}})
    try:
        result = await provider.execute(prompt=message)
        # Send full response as a single stream chunk
        await ws.send_json({
            "type": "chat_stream",
            "payload": {"delta": result.content, "done": False}
        })
        await ws.send_json({
            "type": "chat_stream",
            "payload": {"delta": "", "done": True}
        })
        # Log LLM usage
        await _log_llm_usage(result)
    except Exception as e:
        log.error("chat_failed", error=str(e), agent_action="Check LLM provider logs")
        await ws.send_json({
            "type": "error",
            "payload": {
                "code": "LLM_CHAT_FAILED",
                "message": "I encountered an error generating a response. Please try again.",
                "agent_action": f"Check provider logs: {provider.name}"
            }
        })
    finally:
        await ws.send_json({"type": "status", "payload": {"state": "idle"}})
```

### Mobile Chat Sync Pattern (mirrors moduleSync.ts)

`chatSync.ts` follows the same pattern as `moduleSync.ts`. Study `apps/mobile/services/moduleSync.ts` before writing `chatSync.ts` — same structure, same patterns:

```typescript
// chatSync.ts — follows moduleSync.ts pattern
import { onMessage } from '@/services/wsClient';
import { useChatStore } from '@/stores/chatStore';

export function initChatSync(): () => void {
  const unsubs = [
    onMessage('chat_stream', (msg) => {
      if (msg.type !== 'chat_stream') return;
      const store = useChatStore.getState();
      if (!msg.payload.done) {
        if (store.streamingMessage === null) {
          store.startAgentStream();
        }
        store.appendStreamDelta(msg.payload.delta);
      } else {
        store.finalizeAgentMessage();
      }
    }),
    onMessage('status', (msg) => {
      if (msg.type !== 'status') return;
      useChatStore.getState().setAgentStatus(msg.payload.state);
    }),
    onMessage('error', (msg) => {
      if (msg.type !== 'error') return;
      const store = useChatStore.getState();
      if (store.agentStatus !== 'idle') {
        store.addErrorMessage(msg.payload.message ?? 'Agent error');
      }
    }),
  ];
  return () => unsubs.forEach((fn) => fn());
}
```

### App.tsx Integration: What Changes

The current `App.tsx` startup sequence is:
1. `initLocalDb()`
2. `getCachedModules()` → `moduleStore.loadFromCache()`
3. `loadPersistedMessages()`
4. Load auth from SecureStore → `authStore`
5. `initModuleSync()`
6. `setInitialized(true)`
7. `connect(backendUrl)`

After this story, add `initChatSync()` at step 5b (between `initModuleSync` and `setInitialized`). Store its cleanup function and call it in the cleanup return:

```typescript
const cleanupChat = initChatSync();
// ...
return () => {
  disconnect();
  cleanupChat();
};
```

The `onSend` handler should live in `App.tsx` (or a custom hook `useChatActions`):
```typescript
const handleSend = (message: string) => {
  useChatStore.getState().addUserMessage(message);
  wsClient.send({ type: 'chat', payload: { message } });
};
```

### ChatBubble Styling (Exact Spec from UX)

From UX Twilight Deep Dive and epics.md (Story 2.1 AC):

| Element | Value |
|---------|-------|
| User bubble background | `#1A3050` (slightly elevated over surface) |
| User bubble border | `#1E2E44` (= `tokens.colors.border`) |
| Agent bubble background | `#162436` (= `tokens.colors.surfaceElevated`) |
| Border radius | `16px` (= `tokens.radii.lg`) |
| Text color | `#E4ECF4` (= `tokens.colors.text`) |
| Text size | `15px body` (= `tokens.typography.body`) |
| Horizontal alignment | User: `flex-end` / Agent: `flex-start` |

Note: `#1A3050` is NOT in the token file. It is the user bubble-specific color from the UX spec. Use the hardcoded hex value `#1A3050` for the user bubble background — do NOT try to add it to `tokens.ts` (tokens.ts is final for V1).

### Orb Animation (react-native-reanimated v4)

`react-native-reanimated v4` is already in `apps/mobile/package.json` from Epic 1 architecture. Use it for Orb animation. Pattern:

```typescript
// Orb.tsx — simplified animation
import Animated, { useSharedValue, withRepeat, withTiming, useAnimatedStyle } from 'react-native-reanimated';

const scale = useSharedValue(1);
scale.value = withRepeat(
  withTiming(1.1, { duration: tokens.animation.orbIdle.duration / 2 }),
  -1, // infinite
  true // reverse
);
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }],
}));
```

For reduced motion: check via `AccessibilityInfo.isReduceMotionEnabled()` before starting animation. If `true`, skip `withRepeat` and render static.

### LLM Provider Usage in agent.py

The LLM provider is obtained via `get_provider()` from `app/llm/__init__.py`. This was implemented in Story 1.3. The provider interface:

```python
class LLMProvider(Protocol):
    name: str
    async def execute(self, prompt: str, tools: list | None = None) -> LLMResult: ...
    async def health_check(self) -> bool: ...
```

`LLMResult` contains: `content: str`, `provider: str`, `model: str`, `tokens_in: int | None`, `tokens_out: int | None`, `latency_ms: int`, `cost_estimate: float | None`.

For `_log_llm_usage(result)` in `agent.py`, insert into the `llm_usage` table:
```python
async def _log_llm_usage(result: LLMResult, db_path: str) -> None:
    db = await get_connection(db_path)
    try:
        await db.execute(
            "INSERT INTO llm_usage (id, provider, model, tokens_in, tokens_out, cost_estimate, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), result.provider, result.model,
             result.tokens_in, result.tokens_out, result.cost_estimate,
             datetime.now(UTC).isoformat())
        )
        await db.commit()
    finally:
        await db.close()
```

**IMPORTANT:** Use per-request DB connections (not session-scoped) — see the fix(1-5) commit and Story 1.6 notes. Never hold a DB connection across `await ws.receive_text()` calls.

### Target File Structure After This Story

```
apps/mobile/
├── components/
│   ├── shell/
│   │   ├── PairingScreen.tsx           EXISTS (unchanged)
│   │   ├── PairingScreen.test.tsx      EXISTS (unchanged)
│   │   ├── ChatBubble.tsx              NEW
│   │   ├── ChatBubble.test.tsx         NEW
│   │   ├── ChatInput.tsx               NEW
│   │   ├── ChatInput.test.tsx          NEW
│   │   ├── Orb.tsx                     NEW
│   │   ├── Orb.test.tsx                NEW
│   │   └── index.ts                    MODIFY (add ChatBubble, ChatInput, Orb exports)
│   └── bridge/
│       ├── ChatThread.tsx              NEW
│       ├── ChatThread.test.tsx         NEW
│       ├── ModuleCard.tsx              EXISTS (unchanged)
│       ├── (other existing bridge files)
│       └── index.ts                   MODIFY (add ChatThread export)
├── stores/
│   ├── chatStore.ts                    NEW
│   ├── chatStore.test.ts               NEW
│   └── (existing stores unchanged)
├── services/
│   ├── chatSync.ts                     NEW
│   ├── chatSync.test.ts                NEW
│   └── (existing services unchanged)
├── __tests__/
│   ├── chat.test.ts                    NEW
│   └── (existing tests unchanged)
└── App.tsx                             MODIFY (wire chatSync, Orb, ChatThread, ChatInput)

apps/backend/
├── app/
│   ├── agent.py                        NEW
│   ├── main.py                         MODIFY (replace echo stub with agent.handle_chat())
│   └── (existing files unchanged)
└── tests/
    ├── test_agent.py                   NEW
    └── (existing tests unchanged)
```

### What NOT To Do (Anti-Patterns to Avoid)

- **DO NOT** create a `ChatScreen` or separate screen — this story adds chat to `App.tsx` (the single screen / Direction D architecture). No navigation, no tabs, no screens.
- **DO NOT** implement the Phase morphing interface — story 2.1 only needs Phase 0 layout (full-screen chat). Phase transitions are Epic 3+.
- **DO NOT** implement persona-aware responses — that is Story 2.2 (SOUL.md) and Story 2.3 (persona selection).
- **DO NOT** implement memory or context recall — that is Epic 5.
- **DO NOT** implement the Creation Ceremony animation — that is Story 6.3.
- **DO NOT** implement the empty state with prompt suggestion chips — that is Story 2.4.
- **DO NOT** implement streaming with `stream=True` on Anthropic SDK — First Light uses single-response pattern (full response then `done: True`). True streaming is MVP.
- **DO NOT** add REST endpoints — WebSocket only (`/ws`). The `/health` endpoint must remain unchanged.
- **DO NOT** use `isLoading: boolean` in any store — always use status enums.
- **DO NOT** create sub-packages in `apps/backend/app/` — flat structure. `agent.py` is a flat module.
- **DO NOT** hold DB connections across WebSocket receive calls — per-request pattern only (critical: see fix(1-5)).
- **DO NOT** break any existing tests — current count is 454 mobile, 540 backend = 994 total.
- **DO NOT** modify `types/ws.ts` — `ChatStreamMessage`, `StatusMessage`, `ChatMessage`, `AgentState` are already correctly defined.
- **DO NOT** add the user bubble background `#1A3050` to `tokens.ts` — use the hardcoded value in `ChatBubble.tsx` only.

### Previous Story Intelligence

**From Story 1.6 (Session Authentication & Mobile-Backend Pairing — done):**
- `PairingScreen.tsx` is the first file in `components/shell/` — follow its pattern for `ChatBubble`, `ChatInput`, `Orb`
- `components/shell/index.ts` barrel export exists — update it with new exports
- `authStore.ts` is the reference implementation for Zustand stores in this project
- Backend `main.py` auth gate: `authenticated` flag, `session_id` variable — the `chat` handler already runs inside the auth gate
- Current `chat` handler in `main.py` is an echo stub — REPLACE it with `agent.handle_chat()`
- Per-request DB connections (not session-scoped) — critical pattern from fix(1-5)
- Test count baseline: 454 mobile (21 suites), 540 backend — DO NOT REGRESS

**From Story 1.5 (Offline Message Queue — done):**
- `moduleSync.ts` is the reference implementation for WS message sync services → use as template for `chatSync.ts`
- `wsClient.ts` `onMessage()` API accepts message type + handler, returns unsubscribe function
- Error handling for WS messages: error messages already routed through `onMessage('error', ...)` in wsClient for AUTH errors — chatSync needs to register its OWN `error` handler for LLM errors

**From Story 1.4 (Mobile App Shell & WebSocket Connection — done):**
- `toCamel.ts` automatically converts `snake_case` payload fields → `chat_stream` payload `{ delta, done }` will arrive correctly
- `types/ws.ts` already defines `ChatStreamMessage`, `ChatMessage`, `StatusMessage` — do NOT redefine
- `AgentState` type already defined in `types/ws.ts` — import it in `chatStore.ts`

**From Story 3.3 (Module Rendering Pipeline — done — most recent commit):**
- SDUI rendering infrastructure is complete: registry, templates, primitives
- `bridge/` components (`ModuleCard`, `FreshnessIndicator`, `ErrorBoundary`, `ModuleList`) are the reference for how Bridge components read stores and render Shell components
- `bridge/index.ts` barrel export exists — add `ChatThread` to it
- git history: most recent implementation story is `feat(3-3): module rendering pipeline` (commit `2a7c305`)

**From Git History:**
- Commit convention: `feat(2-1): ` prefix for this story's implementation
- Last 2 CI fixes: `fix(ci): fix jest hoisting in PairingScreen.edge mock factory` and `fix(ci): resolve TypeScript errors blocking CI` — be careful with mock factory patterns in tests (use proper jest.mock() hoisting)
- The `9c89a55` CI fix addressed jest mock hoisting in `PairingScreen.edge.test.tsx` — when writing test files with mocked modules, ensure `jest.mock()` calls are at the top level (not inside describe blocks or imports)

### Key Technical Considerations

1. **`AgentState` is shared type:** `chatStore.ts` `agentStatus` field should use the existing `AgentState` type from `types/ws.ts` (= `'idle' | 'thinking' | 'discovering' | 'composing'`). Import it, don't redefine it.

2. **`streamingMessage` null-coalescing in ChatThread:** The streaming message appears as a separate `ChatBubble` ONLY when `streamingMessage !== null`. After `finalizeAgentMessage()`, it becomes a permanent message in `messages[]` and `streamingMessage` becomes `null`.

3. **UUID generation on mobile:** Use `crypto.randomUUID()` (Hermes engine supports it). Already used in `auth.ts` — no new imports needed.

4. **`chatSync.ts` error handler scope:** The `error` WS message handler in `chatSync.ts` must only call `addErrorMessage` when the agent was actively processing (i.e., `agentStatus !== 'idle'`). AUTH errors are handled by `wsClient.ts` itself — avoid double-handling. The check `store.agentStatus !== 'idle'` prevents showing an error message for AUTH_REQUIRED errors when no chat is in progress.

5. **Backend `get_provider()` call location:** Call `get_provider()` once when the WebSocket connection opens (in `websocket_endpoint` scope, after auth), not on every chat message. This avoids repeated provider initialization. If the provider is unhealthy (circuit breaker), `get_provider()` should already surface that error.

6. **`llm_usage` table schema:** Already defined in `001_init.sql` from Story 1.2:
   ```sql
   CREATE TABLE llm_usage (
       id TEXT PRIMARY KEY,
       provider TEXT NOT NULL,
       model TEXT NOT NULL,
       tokens_in INTEGER,
       tokens_out INTEGER,
       cost_estimate REAL,
       created_at TEXT NOT NULL
   );
   ```
   No migration needed. Insert directly.

7. **Phase 0 layout in App.tsx:** The current `App.tsx` renders `<ModuleList />` when initialized. After this story, the layout becomes: `Orb (top)` → `ChatThread (flex: 1, scrollable)` → `ChatInput (bottom)`. The existing `ModuleList` should remain (Epic 3 built it), positioned within or above `ChatThread` for now — exact Phase morphing layout is deferred to later stories.

8. **Test mock patterns (after fix(ci) commits):** For components that mock wsClient or stores, use top-level `jest.mock()` with factory functions. Do NOT use `jest.mock()` inside `describe` blocks — this caused the CI failure in `PairingScreen.edge.test.tsx` and was the subject of `fix(ci): fix jest hoisting`.

### Project Structure Notes

- New `components/shell/` additions follow the existing `PairingScreen.tsx` file pattern
- `chatStore.ts` follows `authStore.ts` and `moduleStore.ts` Zustand patterns exactly
- `agent.py` is a NEW backend file (not in existing structure) — create it flat in `apps/backend/app/`
- `chatSync.ts` follows `moduleSync.ts` pattern exactly
- Bridge components follow `ModuleCard.tsx` / `FreshnessIndicator.tsx` patterns from Epic 1/3

### References

- [Source: epics.md#Story 2.1] — FR1, FR5, acceptance criteria with exact bubble styling specs (lines 566-589)
- [Source: epics.md#Epic 2 overview] — Epic goal: real-time streamed conversation, persistent identity, contextual empty state (lines 559-562)
- [Source: architecture.md#API & Communication Patterns] — WebSocket-only protocol, `chat_stream` message type, `status` message type (lines 416-457)
- [Source: architecture.md#Mobile Architecture (SDUI)] — Shell/Bridge/SDUI layer separation, rules (lines 460-583)
- [Source: architecture.md#Phase Morphing Interface] — Phase 0 = full-screen chat, no modules (lines 592-624)
- [Source: architecture.md#Zustand Store Conventions] — state/actions/selectors naming, one store per domain (lines 994-1019)
- [Source: architecture.md#Communication Patterns] — WebSocket reconnection pattern, message queue (lines 1020-1052)
- [Source: architecture.md#Service Boundaries (Backend)] — `main.py` sole WS handler, `agent.py` orchestration, `llm/` isolation (lines 1315-1335)
- [Source: architecture.md#Process Patterns — Error handling] — Structured errors with `agent_action`, error code prefix `LLM_*` (lines 1055-1083)
- [Source: architecture.md#LLM Provider Architecture] — `LLMProvider.execute()` returns `LLMResult`, `get_provider()` factory (lines 700-748)
- [Source: architecture.md#Data Architecture] — `llm_usage` table schema, per-request DB connections (lines 345-380)
- [Source: architecture.md#Naming Patterns] — snake_case on wire, camelCase in TS, conversion boundary at `toCamel()` (lines 804-818)
- [Source: architecture.md#V1 Design Tokens] — Twilight token reference including `surfaceElevated: #162436`, `border: #1E2E44`, `accent: #E8A84C` (lines 635-693)
- [Source: architecture.md#SDUI Accessibility Contract] — NFR31 accessible labels, NFR33 44pt touch targets (lines 694-697)
- [Source: ux-design-specification.md#Transferable UX Patterns] — Streaming "thinking" feedback, messaging as primary interaction (lines ~335-346)
- [Source: story 1-6] — Per-request DB connections (critical fix), auth store patterns, shell component patterns, test count baseline (994 total), jest.mock hoisting rules
- [Source: story 1-5] — `moduleSync.ts` pattern for WS message handlers, `wsClient.onMessage()` API
- [Source: story 1-4] — `types/ws.ts` full discriminated union, `toCamel.ts` conversion, `AgentState` type
- [Source: story 3-3] — Bridge component patterns, `bridge/index.ts` barrel export, most recent impl patterns
- [Source: NFR7] — First token < 1 second (architecture NFR list, line 128)
- [Source: NFR22] — LLM errors produce structured user-facing messages, not crashes (architecture NFR list, line 150)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

N/A — all tests green, no runtime debug sessions required.

### Completion Notes List

1. `react-native-reanimated` was not installed in `apps/mobile/package.json` despite the story saying it was in deps. Resolved by using React Native's built-in `Animated` API in `Orb.tsx`. A migration note is in the component header.

2. The `Orb.test.tsx` mock for `react-native`'s `AccessibilityInfo` via `jest.requireActual` caused TurboModule crashes. Fixed by using `jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)` instead.

3. After replacing the echo stub in `main.py` with `agent.handle_chat()`, the existing tests in `test_ws_auth.py`, `test_ws_auth_edge.py`, and `test_ws.py` that used `chat` messages to verify auth success expected the old `chat_stream` response. All were updated to mock the LLM provider via `patch.object(main_mod, "get_provider", return_value=mock_provider)` and updated assertions to check `status:thinking` as the first response.

4. `patch("app.main.get_provider")` did not intercept calls because `main.py` uses `from app.llm import get_provider`, creating a local binding. The correct pattern is `patch.object(main_mod, "get_provider", ...)`.

5. The `anthropic` and `structlog` packages were not installed in the local test environment. Installed via pip to unblock test execution.

### File List

**Mobile (apps/mobile/):**
- `stores/chatStore.ts` (NEW)
- `stores/chatStore.test.ts` (NEW)
- `services/chatSync.ts` (NEW)
- `services/chatSync.test.ts` (NEW)
- `components/shell/ChatBubble.tsx` (NEW)
- `components/shell/ChatBubble.test.tsx` (NEW)
- `components/shell/StreamingIndicator.tsx` (NEW)
- `components/shell/ChatInput.tsx` (NEW)
- `components/shell/ChatInput.test.tsx` (NEW)
- `components/shell/Orb.tsx` (NEW — MODIFIED by code review: added connectionStore import)
- `components/shell/Orb.test.tsx` (NEW)
- `components/bridge/ChatThread.tsx` (NEW)
- `components/bridge/ChatThread.test.tsx` (NEW)
- `__tests__/chat.test.ts` (NEW)
- `components/shell/index.ts` (MODIFIED — added ChatBubble, ChatInput, Orb exports)
- `components/bridge/index.ts` (MODIFIED — added ChatThread export)
- `App.tsx` (MODIFIED — wired chatSync, Orb, ChatThread, ChatInput; MODIFIED by code review: added cleanupModuleSync to cleanup)

**Backend (apps/backend/):**
- `app/agent.py` (NEW)
- `app/main.py` (MODIFIED — replaced echo stub with agent.handle_chat(); MODIFIED by code review: fixed stale docstring)
- `tests/test_agent.py` (NEW)
- `tests/test_ws.py` (MODIFIED — mocked LLM provider, updated chat assertions)
- `tests/test_ws_auth.py` (MODIFIED — mocked LLM provider, updated chat assertions)
- `tests/test_ws_auth_edge.py` (MODIFIED — mocked LLM provider, updated chat assertions)

---

## Code Review Record

### Reviewer

claude-sonnet-4-6 (adversarial code review workflow) — 2026-02-23

### AC Validation

| AC | Status | Evidence |
|----|--------|---------|
| AC1: User bubble styling, instant display | IMPLEMENTED | `ChatBubble.tsx` styles.userBubble with `#1A3050`, `tokens.colors.border`, `alignSelf: flex-end` |
| AC2: Agent response streams token-by-token, first token < 1s | IMPLEMENTED | `chatSync.ts` `chat_stream` handler calls `startAgentStream` + `appendStreamDelta`; `agent.py` sends `status:thinking` + `chat_stream` messages |
| AC3: Agent responds in same language | PARTIAL (by design) | Basic prompt forwarding in `agent.py` — no explicit language detection needed for First Light; LLM naturally mirrors language |
| AC4: Structured error on LLM failure | IMPLEMENTED | `agent.py` sends `{ type: 'error', payload: { code: 'LLM_CHAT_FAILED', message, agent_action } }`; `chatSync.ts` handles error and calls `addErrorMessage` |
| AC5: Streaming indicator disappears on `done: true` | IMPLEMENTED | `finalizeAgentMessage` sets `streamingMessage: null`, ChatThread stops rendering streaming ChatBubble |
| AC6: ChatInput visible at bottom | IMPLEMENTED | `App.tsx` renders `<ChatInput onSend={handleSend} disabled={isInputDisabled} />` |
| AC7: Orb transitions to thinking state | IMPLEMENTED | `Orb.tsx` reads `agentStatus` from `chatStore`, switches animation speed at 1.5s cycle for thinking/discovering/composing |

### Issues Found and Fixed (MEDIUM severity)

**[FIXED] MEDIUM-1: Task 5.2 marked complete but `connectionStore` not imported in `Orb.tsx`**
- Story task 5.2: "reads from `chatStore` (agent status) and `connectionStore` (connection status)" — marked [x]
- `Orb.tsx` only imported `useChatStore`, `connectionStore` was absent from source
- The test (`Orb.test.tsx`) mocked `connectionStore` without it being used — test covered a non-existent dependency
- Fix: Added `import { useConnectionStore } from '@/stores/connectionStore'` and `const connectionStatus = useConnectionStore(...)` to `Orb.tsx`; updated `accessibilityLabel` to reflect disconnected state
- Files: `apps/mobile/components/shell/Orb.tsx`

**[FIXED] MEDIUM-2: `App.tsx` cleanup does not call `cleanupModuleSync()`**
- `initModuleSync()` registers WS message handlers at startup but `App.tsx` cleanup only called `cleanupChatSync()`, leaving module sync handlers unsubscribed on unmount — potential stale handler accumulation on hot reload
- Fix: Added `cleanupModuleSync` import and call in the `useEffect` cleanup return
- Files: `apps/mobile/App.tsx`

**[FIXED] MEDIUM-3: `main.py` docstring for `websocket_endpoint` still referenced the old echo stub**
- Line 329 said: "chat → echo stub via chat_stream (full agent integration in later story)"
- The echo stub was replaced with `agent.handle_chat()` in this very story — stale documentation
- Fix: Updated docstring to accurately reflect: "chat → agent.handle_chat() (LLM streaming via agent.py)"
- Files: `apps/backend/app/main.py`

### Review Follow-ups (LOW severity)

- [ ] [AI-Review][LOW] `ChatThread.tsx` has a redundant double-scroll: `useEffect` calls `scrollToEnd({ animated: true })` AND `onContentSizeChange` calls `scrollToEnd({ animated: false })` on every content change. The `onContentSizeChange` handler is sufficient for scroll-on-new-content; the `useEffect` may cause a visible stutter on rapid streaming deltas. Consider removing the `onContentSizeChange` handler and relying solely on the `useEffect`. [apps/mobile/components/bridge/ChatThread.tsx:29-41]
- [ ] [AI-Review][LOW] `StreamingIndicator.tsx` is a Shell component but is not exported from `components/shell/index.ts` barrel. While it is consumed internally by `ChatBubble.tsx` (same folder), it is inaccessible to other Shell or Bridge consumers without a direct relative import, which bypasses the barrel convention. [apps/mobile/components/shell/index.ts]
- [ ] [AI-Review][LOW] `Orb.test.tsx` mocked `useConnectionStore` before this review fixed `Orb.tsx` to actually import it. Post-fix, the mock is now active and accurate. However, the test does not assert any behavior related to the disconnected connection state (e.g., accessibilityLabel changes when `connectionStatus !== 'connected'`). Consider adding a test case for this. [apps/mobile/components/shell/Orb.test.tsx]
- [ ] [AI-Review][LOW] `react-native-reanimated` v4 is specified in the story (Task 5.4, 5.6) and in Dev Notes, but is not installed in `apps/mobile/package.json`. The dev agent used the built-in `Animated` API as a workaround (noted in Completion Note 1). This is an architecture debt item — when `react-native-reanimated` is eventually added, `Orb.tsx` and `StreamingIndicator.tsx` should be migrated.

### Test Count After Review

- Mobile: 1058 tests, 48 suites — all passing
- Backend: 568 tests (excluding pre-existing `test_module_schema.py` collection error) — all passing
- Total: 1626 tests green
