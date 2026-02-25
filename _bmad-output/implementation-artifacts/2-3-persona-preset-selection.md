# Story 2.3: Persona Preset Selection

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to select a persona preset (Flame / Tree / Star) that shapes my agent's interaction style,
so that the agent matches my preferred communication tone. (FR2)

## Acceptance Criteria

1. **Given** no persona is stored in `memory_core` **When** the user sends a chat message **Then** the agent responds with a default persona-neutral style (SOUL.md only, no persona layer) **And** the `status` message includes `persona: null`

2. **Given** the app needs a persona selection **When** a `set_persona` endpoint or conversational command is used **Then** the backend writes `persona_type` = `flame` | `tree` | `star` into the `memory_core` table **And** the agent loads the corresponding persona file from `data/personas/{type}.md`

3. **Given** a persona is active (e.g., `flame`) **When** the agent assembles the LLM prompt **Then** the persona instruction file content is injected AFTER the SOUL.md identity and BEFORE the module creation instructions in the prompt: `SOUL.md + persona instructions + module instructions + user message`

4. **Given** the user selects a persona **When** the selection is confirmed by the backend **Then** the backend sends a `status` message with `persona` field set (e.g., `{ "state": "idle", "persona": "flame" }`) via WebSocket **And** the mobile client stores the persona type

5. **Given** a persona is active **When** the agent communicates **Then** its tone, autonomy level, and proactivity match the persona definition (FR2):
   - **Flame**: 50% shorter messages, no confirmation before actions, acts first and reports after
   - **Tree**: standard message length, always asks before creating or removing, warm and reassuring
   - **Star**: between Flame and Tree, agent suggests, user confirms for new action types only

6. **Given** three persona instruction files exist in `data/personas/` **When** the backend starts **Then** the files `flame.md`, `tree.md`, and `star.md` are created with default content if missing (similar to SOUL.md auto-creation pattern)

7. **Given** the mobile client receives a `status` message with `persona` field **When** the UI renders **Then** the Orb component can use the persona value (future: persona-driven colors/animation — this story wires the data, does NOT change Orb visuals)

8. **Given** the Settings screen is rendered **When** the user views the Persona section **Then** three persona options (Flame / Tree / Star) are displayed as tappable cards showing the active persona highlighted **And** tapping a different persona sends a `set_persona` message to the backend via WebSocket

## Tasks / Subtasks

- [x] Task 1: Create persona instruction files and loading functions in `agent.py` (AC: #3, #6)
  - [x] 1.1 Define `_DEFAULT_PERSONA_FLAME`, `_DEFAULT_PERSONA_TREE`, `_DEFAULT_PERSONA_STAR` content constants in `agent.py` (see Dev Notes for content)
  - [x] 1.2 Create `_persona_dir(data_dir: str) -> Path` returning `Path(data_dir) / "personas"`
  - [x] 1.3 Create `_persona_path(data_dir: str, persona_type: str) -> Path` returning `Path(data_dir) / "personas" / f"{persona_type}.md"`
  - [x] 1.4 Create `async def _ensure_default_personas(data_dir: str) -> None` that creates `data/personas/` directory and writes `flame.md`, `tree.md`, `star.md` if missing. Use `asyncio.to_thread` for all I/O. Log info on creation.
  - [x] 1.5 Create `async def load_persona(data_dir: str, persona_type: str) -> str | None` that reads `data/personas/{persona_type}.md` from disk. Returns content string if persona found, `None` if persona_type is `None` or empty. If file missing/corrupted, log warning and return `None` (graceful degradation — agent works without persona).
  - [x] 1.6 Validate `persona_type` is one of `flame`, `tree`, `star` (or `None`). Reject unknown values with a warning log.

- [x] Task 2: Store and retrieve persona in `memory_core` table (AC: #2)
  - [x] 2.1 Create `async def get_persona_type(db_path: str) -> str | None` in `agent.py` that queries `memory_core` for `key = 'persona_type'`. Returns the `value` or `None` if not set. Uses per-request DB connection pattern (try/finally close).
  - [x] 2.2 Create `async def set_persona_type(db_path: str, persona_type: str) -> None` in `agent.py` that upserts `persona_type` into `memory_core`. Uses INSERT OR REPLACE (the `key` column has no UNIQUE constraint, so use: delete existing + insert, or check and update/insert). Validates persona_type is `flame`/`tree`/`star`.
  - [x] 2.3 Use `uuid.uuid4()` for the `id` field and `datetime.now(UTC).isoformat()` for `created_at`. Set `category` to `"persona"` and `user_id` to `"default"`.

- [x] Task 3: Inject persona into prompt assembly (AC: #3, #5)
  - [x] 3.1 Modify `_build_module_prompt(message: str, soul_content: str)` signature to `_build_module_prompt(message: str, soul_content: str, persona_content: str | None)` — add optional `persona_content` parameter
  - [x] 3.2 If `persona_content` is not None, inject it AFTER the SOUL identity section and BEFORE the `# Instructions` section: `# Agent Identity\n\n{soul_content}\n\n# Persona\n\n{persona_content}\n\n# Instructions\n\n{existing instructions}`
  - [x] 3.3 If `persona_content` is None, keep existing prompt format (no persona section)
  - [x] 3.4 In `handle_chat()`, after `load_soul()`, call `persona_type = await get_persona_type(db_path)` then `persona_content = await load_persona(data_dir, persona_type)` if persona_type is not None
  - [x] 3.5 Pass `persona_content` to `_build_module_prompt(message, soul_content, persona_content)`

- [x] Task 4: Add `persona` field to `status` WebSocket messages (AC: #4, #7)
  - [x] 4.1 In `handle_chat()`, after loading persona_type, include it in all `status` messages sent during the chat lifecycle: `{"type": "status", "payload": {"state": "thinking", "persona": persona_type}}`
  - [x] 4.2 In `main.py`, after successful auth, load the current persona type and include it in the initial `status: idle` message: `{"type": "status", "payload": {"state": "idle", "persona": persona_type}}`
  - [x] 4.3 In `_handle_auth_reset()`, include persona in the status message
  - [x] 4.4 The `persona` field is optional (can be `null`/absent) — already defined in the WS protocol (`persona?: PersonaType`)

- [x] Task 5: Add `set_persona` WebSocket message handler (AC: #2, #4, #8)
  - [x] 5.1 In `main.py`, add a new message type handler for `set_persona` in the authenticated message routing block
  - [x] 5.2 Payload: `{ "persona": "flame" | "tree" | "star" }`. Validate the persona value.
  - [x] 5.3 Call `agent.set_persona_type(settings.db_path, persona_type)` to persist
  - [x] 5.4 Send confirmation `status` message with new persona: `{"type": "status", "payload": {"state": "idle", "persona": persona_type}}`
  - [x] 5.5 Log: `"persona_changed"` with old and new persona values
  - [x] 5.6 Add `'set_persona'` to the WS message type documentation in `main.py` docstring

- [x] Task 6: Ensure persona files created at backend startup (AC: #6)
  - [x] 6.1 In `main.py` `lifespan()`, after `agent.load_soul()`, call `await agent._ensure_default_personas(settings.self_data_dir)` to ensure persona files exist on first boot
  - [x] 6.2 Log: `"personas_loaded"` with count of persona files found/created

- [x] Task 7: Mobile — add persona to connectionStore or a new personaStore (AC: #4, #7)
  - [x] 7.1 Add `persona: PersonaType | null` state and `setPersona: (p: PersonaType | null) => void` action to `connectionStore.ts` (persona is connection-scoped, received from backend on auth)
  - [x] 7.2 In `wsClient.ts`, when a `status` message is received, extract `persona` field and call `setPersona()` if present
  - [x] 7.3 Add `'set_persona'` to the client-to-server message types in `types/ws.ts`: `{ type: 'set_persona'; payload: { persona: PersonaType } }`
  - [x] 7.4 Add `sendSetPersona(persona: PersonaType)` helper to `wsClient.ts` that sends the set_persona message

- [x] Task 8: Mobile — add PersonaSelector to Settings screen (AC: #8)
  - [x] 8.1 Create `components/shell/PersonaSelector.tsx` — three tappable cards (Flame / Tree / Star) with icon placeholder, name, and one-line description. Highlight the currently active persona with accent border.
  - [x] 8.2 Props: `currentPersona: PersonaType | null`, `onSelect: (persona: PersonaType) => void`
  - [x] 8.3 In `SettingsScreen.tsx`, add a "Persona" section between "Connection" and "Data" sections
  - [x] 8.4 Wire `PersonaSelector` to read persona from `connectionStore` and call `sendSetPersona()` on select
  - [x] 8.5 Show a "No persona selected" state when persona is null, with all three options equally weighted

- [x] Task 9: Backend tests for persona functions (AC: #1-#6)
  - [x] 9.1 Create `apps/backend/tests/test_persona.py` for persona management tests
  - [x] 9.2 Test: `_ensure_default_personas` creates 3 files in `data/personas/`
  - [x] 9.3 Test: `_ensure_default_personas` is idempotent (running twice does not overwrite existing files)
  - [x] 9.4 Test: `load_persona("flame")` returns flame persona content
  - [x] 9.5 Test: `load_persona(None)` returns None
  - [x] 9.6 Test: `load_persona("invalid")` returns None and logs warning
  - [x] 9.7 Test: `load_persona` with missing file returns None gracefully
  - [x] 9.8 Test: `get_persona_type` with no entry returns None
  - [x] 9.9 Test: `set_persona_type("flame")` followed by `get_persona_type` returns "flame"
  - [x] 9.10 Test: `set_persona_type("tree")` overwrites previous persona
  - [x] 9.11 Test: `set_persona_type("invalid")` raises ValueError or logs warning

- [x] Task 10: Backend tests for persona in prompt and WebSocket (AC: #3, #4, #5)
  - [x] 10.1 In `test_agent.py`, add tests for persona injection in prompt
  - [x] 10.2 Test: `_build_module_prompt("hello", soul, persona_content)` includes persona section between SOUL and Instructions
  - [x] 10.3 Test: `_build_module_prompt("hello", soul, None)` has no persona section (backward compat)
  - [x] 10.4 Test: `handle_chat` with persona set sends `status` messages including persona field
  - [x] 10.5 Test: `set_persona` WS message handler changes persona and sends confirmation status

- [x] Task 11: Update existing tests for new `_build_module_prompt` signature (AC: all)
  - [x] 11.1 Grep for all calls to `_build_module_prompt` in test files and update to include `persona_content` parameter (pass `None` for backward compat)
  - [x] 11.2 Update `test_agent.py` existing tests
  - [x] 11.3 Update `test_agent_module_edge.py` existing tests
  - [x] 11.4 Update `test_agent_soul_edge.py` existing tests
  - [x] 11.5 Ensure all existing tests still pass — run `npm run test:backend`

- [x] Task 12: Mobile tests for persona features (AC: #7, #8)
  - [x] 12.1 Test: `connectionStore` has persona state, setPersona action
  - [x] 12.2 Test: `PersonaSelector` renders three options
  - [x] 12.3 Test: `PersonaSelector` highlights active persona
  - [x] 12.4 Test: tapping a persona calls onSelect
  - [x] 12.5 Test: `SettingsScreen` renders PersonaSelector when paired
  - [x] 12.6 Test: `ws.ts` types include `set_persona` message type

## Dev Notes

### Architecture Compliance (MANDATORY)

This is the THIRD story in Epic 2 (Conversational Shell & Agent Identity). Story 2.2 created the SOUL.md identity file. This story layers persona-specific instructions on top. The architecture mandates a specific persona engine design.

**Critical patterns from architecture:**

1. **Persona stored in `memory_core` table** (NOT a file, NOT in SOUL.md):
   - Key: `persona_type`, values: `flame`, `tree`, `star`
   - Table already exists in `001_init.sql`: `memory_core (id, key, value, category, user_id, created_at)`
   - No new migration needed — reuse existing table
   - `agent.py` is the sole reader/writer of persona (architecture data boundary)

2. **Persona instruction files on disk** (read-only templates):
   - Path: `data/personas/flame.md`, `data/personas/tree.md`, `data/personas/star.md`
   - These are DEFAULT templates created on first boot, similar to SOUL.md pattern
   - `agent.py` reads them and injects into prompt — `data/personas/*.md` owned by `agent.py` (data boundary table in architecture)
   - Files are in `data/` directory (gitignored, runtime data)

3. **Prompt assembly order** (from architecture data flow):
   ```
   agent.py assembles prompt: SOUL.md + persona instructions + memory + user message
   ```
   In this story: `SOUL.md + persona instructions + module instructions + user message` (memory is Epic 5)

4. **Persona transmitted to mobile via `status` message** (architecture spec):
   - `status` message payload already has `persona?: PersonaType` field defined in both architecture and `types/ws.ts`
   - The `PersonaType` type already exists in `types/ws.ts`: `'flame' | 'tree' | 'star'`
   - No need to modify the WS type definitions — they already support persona

5. **`set_persona` is a NEW WebSocket message type** — currently 15 typed messages in the protocol. This adds a 16th (client-to-server). Add to the `types/ws.ts` discriminated union.

6. **Backend flat structure** — all persona functions go in `agent.py`. Do NOT create `persona.py` or `memory.py`. The memory module (`memory.py`) is deferred to Epic 5. For this story, interact directly with `memory_core` table from `agent.py` using per-request DB connections.

7. **`_ensure_default_personas` follows SOUL.md pattern** — check if files exist, create defaults if missing, log appropriately. Do NOT overwrite existing files (user may have edited them).

### Default Persona File Content

**`data/personas/flame.md`:**
```markdown
# Persona: Flame (Autonomous)

## Communication Style
- Be extremely concise — 50% shorter than default responses
- Act first, report after — do not ask for confirmation before creating modules
- Use direct, efficient language — no pleasantries or filler
- When the user describes a need, immediately create the module without asking
- If something goes wrong, fix it and explain briefly what happened

## Autonomy Level
- Maximum autonomy — take action without asking
- Create, modify, and remove modules proactively
- Only ask for clarification when the request is genuinely ambiguous

## Tone
- Confident, competent, no-nonsense
- Respect the user's time above all else
- Assume the user knows what they want
```

**`data/personas/tree.md`:**
```markdown
# Persona: Tree (Collaborative)

## Communication Style
- Use warm, reassuring language
- Always explain what you're about to do before doing it
- Ask for confirmation before creating, modifying, or removing any module
- Use phrases like "Would you like me to..." and "I can help with that — shall I..."
- Provide context and reasoning for suggestions

## Autonomy Level
- Minimal autonomy — always ask before acting
- Present options rather than making decisions
- Confirm before every significant action

## Tone
- Gentle, patient, encouraging
- Never use technical jargon unless the user does first
- Make the user feel supported and in control
```

**`data/personas/star.md`:**
```markdown
# Persona: Star (Balanced)

## Communication Style
- Balanced message length — concise but not terse
- For new action types, ask for confirmation first
- For repeated patterns the user has approved before, act autonomously
- Adapt communication style to the user's own style over time

## Autonomy Level
- Adaptive autonomy — ask for new action types, auto-execute for established patterns
- Suggest proactively but let the user decide
- First-time actions require confirmation; repeated patterns auto-execute

## Tone
- Friendly and natural — like a capable colleague
- Match the user's energy and formality level
- Be direct when appropriate, warm when needed
```

### Modifying `_build_module_prompt` — What Changes

Current signature (from Story 2.2):
```python
def _build_module_prompt(message: str, soul_content: str) -> str:
```

New signature:
```python
def _build_module_prompt(message: str, soul_content: str, persona_content: str | None = None) -> str:
```

The function body adds an optional persona section:
```python
def _build_module_prompt(message: str, soul_content: str, persona_content: str | None = None) -> str:
    persona_section = f"\n\n# Persona\n\n{persona_content}" if persona_content else ""
    return f"""# Agent Identity

{soul_content}{persona_section}

# Instructions

You are Self, an AI agent that creates native mobile modules. ...
{rest of existing prompt}

User message: {message}"""
```

Using a default parameter `persona_content: str | None = None` means existing callers (tests) that pass only `(message, soul_content)` continue to work without modification. However, it is STILL RECOMMENDED to update all existing test calls explicitly to pass `persona_content=None` for clarity and to match the Story 2.2 pattern of explicit parameter passing.

### Interacting with `memory_core` Table

The `memory_core` table already exists (created in `001_init.sql`):
```sql
CREATE TABLE IF NOT EXISTS memory_core (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    category TEXT,
    user_id TEXT NOT NULL DEFAULT 'default',
    created_at TEXT NOT NULL
);
```

**IMPORTANT**: There is no UNIQUE constraint on `key`. To upsert `persona_type`:
1. DELETE existing rows WHERE `key = 'persona_type'` AND `user_id = 'default'`
2. INSERT new row with the new value

Do NOT use `INSERT OR REPLACE` because the primary key is `id` (UUID), not `key`. The upsert pattern is:
```python
async def set_persona_type(db_path: str, persona_type: str) -> None:
    if persona_type not in ("flame", "tree", "star"):
        raise ValueError(f"Invalid persona type: {persona_type}")
    db = await get_connection(db_path)
    try:
        await db.execute(
            "DELETE FROM memory_core WHERE key = ? AND user_id = ?",
            ("persona_type", "default"),
        )
        await db.execute(
            "INSERT INTO memory_core (id, key, value, category, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "persona_type", persona_type, "persona", "default", datetime.now(UTC).isoformat()),
        )
        await db.commit()
    finally:
        await db.close()
```

### Adding `set_persona` to WebSocket Message Routing

In `main.py`, add to the authenticated message routing (after `elif msg_type == "sync":` block):
```python
elif msg_type == "set_persona":
    persona = payload.get("persona", "")
    try:
        await agent.set_persona_type(settings.db_path, persona)
        await ws.send_json({
            "type": "status",
            "payload": {"state": "idle", "persona": persona},
        })
    except ValueError:
        await ws.send_json({
            "type": "error",
            "payload": {
                "code": "PERSONA_INVALID",
                "message": f"Invalid persona type: {persona}. Must be flame, tree, or star.",
                "agent_action": "Check PersonaType enum in types/ws.ts",
            },
        })
```

### Status Messages — Where Persona Must Be Included

Every `status` message the backend sends should include the current persona. Audit all locations:

1. **`main.py` — after successful auth** (line ~391): `{"type": "status", "payload": {"state": "idle"}}` → add `"persona": persona_type`
2. **`main.py` — after auth_reset** (line ~314): same pattern
3. **`agent.py` — handle_chat thinking** (line ~493): `{"type": "status", "payload": {"state": "thinking"}}` → add `"persona": persona_type`
4. **`agent.py` — handle_chat discovering/composing** (lines ~427, ~430): add persona
5. **`agent.py` — handle_chat idle (finally block)**: add persona

To avoid repeating persona lookup everywhere, pass `persona_type` through `handle_chat`:
- Either add `persona_type: str | None` parameter to `handle_chat`
- Or load it once at the start of `handle_chat` and reuse

Recommended: load persona_type once at the start of `handle_chat` and use it for both prompt assembly AND status messages. This avoids changing `handle_chat`'s signature (which would ripple to `main.py`).

### Mobile Integration — Wiring Persona

**`connectionStore.ts` changes:**
```typescript
// Add to interface:
persona: PersonaType | null;
setPersona: (persona: PersonaType | null) => void;

// Add to initial state:
persona: null,
setPersona: (persona) => set({ persona }),
```

**`wsClient.ts` changes:**
- In the message handler where `status` messages are processed, extract `msg.payload.persona` and call `useConnectionStore.getState().setPersona(persona)`
- Add `sendSetPersona` helper

**`types/ws.ts` changes:**
- Add `SetPersonaMessage` interface: `{ type: 'set_persona'; payload: { persona: PersonaType } }`
- Add to `WSMessage` union

### PersonaSelector Component Design

Based on UX spec: three tappable cards visible simultaneously (no carousel). Each shows:
- Icon placeholder (text emoji for V1: "🔥" Flame, "🌳" Tree, "⭐" Star)
- Persona name
- One-line description
- Active indicator (accent border when selected)

Layout: vertical stack of 3 cards within a settings section. Use existing `tokens` for styling (surface background, accent border for active).

### What NOT To Do (Anti-Patterns)

- **DO NOT** create `persona.py` or `memory.py` — all persona functions belong in `agent.py` (architecture mandate)
- **DO NOT** add a new migration — `memory_core` table already exists in `001_init.sql`
- **DO NOT** modify SOUL.md content for persona — persona is a SEPARATE layer injected alongside SOUL
- **DO NOT** implement persona-driven Orb colors/animation — that is a UX enhancement for a future story. This story wires the persona data to the mobile; visual changes are separate.
- **DO NOT** implement persona change via conversation — architecture says "changement via conversation avec l'agent" but for V1, use explicit `set_persona` WS message + Settings UI. Conversational persona change is a future story (14-2).
- **DO NOT** implement warm-up mode or adaptive behavior — those are FR4 (Epic 14)
- **DO NOT** store persona in SOUL.md — persona is in `memory_core` table (architecture decision)
- **DO NOT** cache persona in memory — read from DB on every chat (same principle as SOUL.md)
- **DO NOT** break existing tests — current test count: 728+ backend tests. ALL must still pass.
- **DO NOT** add new npm/pip dependencies

### Previous Story Intelligence

**From Story 2.2 (Agent Identity Persistence — done):**
- SOUL.md pattern: `load_soul()` reads from disk on every request, `_ensure_default_soul()` creates if missing — follow IDENTICAL pattern for persona files
- `_build_module_prompt(message, soul_content)` now takes soul_content — extend with `persona_content` parameter
- `handle_chat()` derives `data_dir = str(Path(db_path).parent)` — reuse same derivation for persona file path
- `asyncio.to_thread` for all file I/O (no `aiofiles` in deps)
- Test patterns: `_TEST_SOUL` constant used in test files — create `_TEST_PERSONA` similarly
- Ripple effect warning: modifying `_build_module_prompt` signature required updating tests in `test_agent.py`, `test_agent_module_edge.py`, and `test_agent_soul_edge.py`. Same will happen here. Use default parameter `= None` to minimize ripple but still audit all call sites.

**From Story 2.2 Completion Notes:**
- `patch.object(main_mod, "get_provider", ...)` is the correct pattern for mocking provider in tests
- Total backend test count after 2.2: 728 tests — DO NOT REGRESS
- Pre-existing ruff issues (F401 in test_agent_module_edge, I001 in main.py) — not your problem, don't fix

**From Story 2.5b (Tab Navigation Architecture — done):**
- Settings screen (`SettingsScreen.tsx`) already exists with sections: Connection, Data, About
- Tab bar with Home/Chat/Settings is implemented
- `PairingScreen` component is embedded in SettingsScreen when not paired

### Existing Test Files That Need Signature Updates

Files that call `_build_module_prompt` directly (from Story 2.2 completion notes):
- `apps/backend/tests/test_agent.py` — has `_build_module_prompt` calls (2+4 calls)
- `apps/backend/tests/test_agent_module_edge.py` — has 7 `_build_module_prompt` calls + `_TEST_SOUL` constant
- `apps/backend/tests/test_agent_soul_edge.py` — has `_build_module_prompt` calls

Using a default parameter `persona_content: str | None = None` means these will NOT break. But audit and optionally update for explicitness.

### Target File Structure After This Story

```
apps/backend/
├── app/
│   ├── agent.py           MODIFY (add persona file loading, memory_core persona get/set, modify _build_module_prompt, modify handle_chat)
│   ├── main.py            MODIFY (add set_persona handler, include persona in status messages, call _ensure_default_personas at startup)
│   └── (all other files unchanged)
├── data/
│   ├── self.db            EXISTS (memory_core table already has schema)
│   ├── SOUL.md            EXISTS (unchanged)
│   └── personas/          NEW directory (created at runtime, gitignored)
│       ├── flame.md       NEW (created at runtime)
│       ├── tree.md        NEW (created at runtime)
│       └── star.md        NEW (created at runtime)
└── tests/
    ├── test_persona.py           NEW (persona file management + memory_core get/set tests)
    ├── test_agent.py             MODIFY (add persona injection tests, update _build_module_prompt calls)
    ├── test_agent_module_edge.py MODIFY (update _build_module_prompt calls if using positional args)
    └── test_agent_soul_edge.py   MODIFY (update _build_module_prompt calls if using positional args)

apps/mobile/
├── types/
│   └── ws.ts                     MODIFY (add SetPersonaMessage type)
├── stores/
│   └── connectionStore.ts        MODIFY (add persona state + setPersona action)
├── services/
│   └── wsClient.ts               MODIFY (handle persona in status messages, add sendSetPersona)
├── components/
│   └── shell/
│       └── PersonaSelector.tsx   NEW (persona selection cards)
└── screens/
    └── SettingsScreen.tsx         MODIFY (add Persona section with PersonaSelector)
```

### Project Structure Notes

- `data/personas/` is a subdirectory of `data/` which is gitignored — runtime data
- No new Python modules in `app/` — all functions added to existing `agent.py`
- No new SQL migrations — `memory_core` table already exists
- One new backend test file: `tests/test_persona.py`
- One new mobile component: `components/shell/PersonaSelector.tsx`
- `types/ws.ts` already has `PersonaType` defined — just add the new message type

### References

- [Source: epics.md#Story 2.3] — FR2, acceptance criteria (persona selection, instruction loading, tone matching)
- [Source: architecture.md#Persona Engine] — persona stored in `memory_core`, loaded from `data/personas/{type}.md`, transmitted via `status` message
- [Source: architecture.md#Data Boundaries] — `data/personas/*.md` owned by `agent.py`, read-only persona instruction files
- [Source: architecture.md#Data Flow] — `agent.py assembles prompt (SOUL.md + persona instructions + memory + user message)`
- [Source: architecture.md#Backend File Structure] — `data/personas/` directory, `flame.md`, `tree.md`, `star.md`
- [Source: architecture.md#WS Protocol] — `status` message: `{ state, persona? }`, `PersonaType = 'flame' | 'tree' | 'star'`
- [Source: architecture.md#Memory Architecture] — `memory_core` table: `id, key, value, category, user_id, created_at`
- [Source: ux-design-specification.md#Persona Voice Patterns] — Flame (50% shorter, no confirmation), Tree (always asks), Star (adaptive)
- [Source: ux-design-specification.md#PersonaSelector] — three tappable cards, all visible simultaneously
- [Source: types/ws.ts] — `PersonaType` already defined, `StatusMessage.payload.persona` already typed
- [Source: 001_init.sql] — `memory_core` table schema (no migration needed)
- [Source: story 2-2] — SOUL.md loading pattern, `_build_module_prompt` signature, `handle_chat` flow, test patterns, ripple effect warning
- [Source: story 2-5b] — SettingsScreen exists with Connection/Data/About sections, tab navigation active

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Backend tests: 827 passed (793 existing + 34 new persona tests), 0 regressions
- Mobile tests: 1252 passed (all existing + new persona tests), 0 regressions
- Key fix: `_DEFAULT_SOUL_CONTENT` contains "## Personality" which includes "# Persona" as substring -- tests use `"\n# Persona\n"` for accurate assertion

### Completion Notes List

- Backend persona management: 3 persona instruction files (flame/tree/star), memory_core storage, prompt injection, status messages with persona field, set_persona WS handler
- All status messages (auth, auth_reset, handle_chat lifecycle) now include persona field
- Mobile: connectionStore persona state, wsClient persona extraction from status messages, sendSetPersona helper, PersonaSelector component, SettingsScreen integration
- ws.ts types: SetPersonaMessage added (16th message type in protocol)
- TDD: wrote tests first (RED), then implemented (GREEN), then verified all pass
- No new dependencies added (backend or mobile)
- No new migrations needed (memory_core table already exists in 001_init.sql)

### File List

**Backend Modified:**
- `apps/backend/app/agent.py` -- persona constants, file loading, memory_core get/set, prompt injection, status messages
- `apps/backend/app/main.py` -- startup persona init, set_persona handler, persona in auth/reset status messages

**Backend Tests Created:**
- `apps/backend/tests/test_persona.py` -- 25 tests for persona file management + memory_core CRUD

**Backend Tests Modified:**
- `apps/backend/tests/test_agent.py` -- added TestBuildModulePromptPersona (7 tests), TestHandleChatWithPersona (4 tests), updated DB setup
- `apps/backend/tests/test_agent_edge.py` -- memory_core table in DB setup, idle status assertion fix
- `apps/backend/tests/test_agent_module_edge.py` -- memory_core table in DB setup, idle status assertion fix
- `apps/backend/tests/test_agent_soul_edge.py` -- memory_core table in DB setup, idle status assertion fix
- `apps/backend/tests/test_module_creation_e2e.py` -- memory_core table in DB setup, auth assertion fix
- `apps/backend/tests/test_module_creation_e2e_edge.py` -- memory_core table in DB setup, auth assertion fix
- `apps/backend/tests/test_ws.py` -- memory_core table in DB setup, auth assertion fix, TestSetPersonaWsHandler (8 tests)
- `apps/backend/tests/test_ws_auth.py` -- memory_core table in DB setup, status assertion fix
- `apps/backend/tests/test_ws_auth_edge.py` -- memory_core table in DB setup
- `apps/backend/tests/test_ws_chat_edge.py` -- memory_core table in DB setup, auth assertion fix

**Mobile Modified:**
- `apps/mobile/types/ws.ts` -- SetPersonaMessage type, added to WSMessage union
- `apps/mobile/stores/connectionStore.ts` -- persona state + setPersona action
- `apps/mobile/services/wsClient.ts` -- persona extraction from status messages, sendSetPersona helper
- `apps/mobile/screens/SettingsScreen.tsx` -- Persona section with PersonaSelector
- `apps/mobile/components/shell/index.ts` -- PersonaSelector export

**Mobile Created:**
- `apps/mobile/components/shell/PersonaSelector.tsx` -- three tappable persona cards

**Mobile Tests Created:**
- `apps/mobile/components/shell/PersonaSelector.test.tsx` -- 14 tests

**Mobile Tests Modified:**
- `apps/mobile/stores/connectionStore.test.ts` -- 7 persona tests added
- `apps/mobile/screens/SettingsScreen.test.tsx` -- 5 persona section tests added
- `apps/mobile/types/ws.test.ts` -- set_persona type test, count updated to 16

### Change Log

| File | Change |
|------|--------|
| agent.py | Added persona constants, helper functions, DB functions, prompt injection, status messages |
| main.py | Added startup persona init, set_persona handler, persona in auth/reset status |
| ws.ts | Added SetPersonaMessage type to WSMessage union |
| connectionStore.ts | Added persona state and setPersona action |
| wsClient.ts | Added persona extraction from status, sendSetPersona helper |
| PersonaSelector.tsx | NEW: three tappable persona cards component |
| SettingsScreen.tsx | Added Persona section between Connection and Data |
| shell/index.ts | Added PersonaSelector export |
| test_persona.py | NEW: 25 persona management tests |
| test_agent.py | Added 11 persona tests (prompt + handle_chat) |
| test_ws.py | Added 8 set_persona WS handler tests |
| connectionStore.test.ts | Added 7 persona state tests |
| PersonaSelector.test.tsx | NEW: 14 component tests |
| SettingsScreen.test.tsx | Added 5 persona section tests |
| ws.test.ts | Updated type count, added set_persona test |

## Senior Developer Review (AI)

**Reviewer:** Seb (AI-assisted) on 2026-02-25
**Model:** Claude Opus 4.6

### Review Summary

**Story:** 2-3-persona-preset-selection
**Git vs Story Discrepancies:** 3 found (undocumented edge test files)
**Issues Found:** 0 High, 2 Medium, 3 Low

### AC Validation

| AC | Status | Evidence |
|----|--------|----------|
| AC1: Default persona-neutral style | IMPLEMENTED | `handle_chat` loads persona_type from DB; when None, no persona section in prompt; status includes `persona: null` |
| AC2: set_persona stores in memory_core | IMPLEMENTED | `set_persona_type()` in agent.py upserts into memory_core; `set_persona` WS handler in main.py calls it |
| AC3: Persona injected in prompt order | IMPLEMENTED | `_build_module_prompt` injects persona after SOUL.md, before Instructions; verified by tests |
| AC4: Status message includes persona | IMPLEMENTED | All status messages (auth, auth_reset, thinking, discovering, composing, idle) include persona field |
| AC5: Persona tone matching | IMPLEMENTED | Default persona files contain correct instruction content matching FR2 spec (Flame=concise, Tree=collaborative, Star=balanced) |
| AC6: Persona files created at startup | IMPLEMENTED | `ensure_default_personas()` called in lifespan; creates flame.md/tree.md/star.md if missing |
| AC7: Mobile stores persona from status | IMPLEMENTED | wsClient extracts persona from status messages, updates connectionStore |
| AC8: Settings PersonaSelector UI | IMPLEMENTED | PersonaSelector component with 3 tappable cards, wired in SettingsScreen, calls sendSetPersona |

### Issues Found and Fixed (MEDIUM)

1. **[MEDIUM][FIXED] Stale persona state on disconnect** — `handleDisconnect()` in SettingsScreen.tsx did not reset `persona` to null in connectionStore. After disconnect, the UI would briefly show the old persona until a fresh status message arrived on reconnect. Fixed by adding `useConnectionStore.getState().setPersona(null)` in handleDisconnect.

2. **[MEDIUM][FIXED] Private function accessed from main.py** — `main.py` called `agent._ensure_default_personas()` (private by Python naming convention). Renamed to `ensure_default_personas()` (public) with backward-compat alias `_ensure_default_personas = ensure_default_personas` so existing test imports continue to work.

### Review Follow-ups (LOW)

- [ ] [AI-Review][LOW] Story File List missing 3 edge test files: `test_persona_edge.py`, `PersonaSelector.edge.test.tsx`, `connectionStore.persona.edge.test.ts` — these were created but not documented in the Dev Agent Record File List section
- [ ] [AI-Review][LOW] Story debug log test counts are stale — story says "827 backend / 1252 mobile" but actual counts are 866 backend / 1272 mobile
- [ ] [AI-Review][LOW] Extra DB round-trip in set_persona WS handler — `old_persona = await agent.get_persona_type(...)` in main.py line 432 is an unnecessary DB query just for logging the old value; could be deferred or removed

### Test Results After Review Fixes

- Backend: 866 passed, 0 failed
- Mobile: 1272 passed, 0 failed
- No regressions introduced

### Review Verdict

**APPROVED** — All 8 Acceptance Criteria are implemented and verified. 2 MEDIUM issues were auto-fixed with tests passing. 3 LOW issues documented as follow-ups. Story status set to done.
