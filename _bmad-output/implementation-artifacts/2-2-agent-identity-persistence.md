# Story 2.2: Agent Identity Persistence

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want my agent to have a persistent identity and personality across sessions,
so that it feels like the same assistant every time. (FR29)

## Acceptance Criteria

1. **Given** a fresh backend installation **When** the agent initializes for the first time **Then** a `SOUL.md` file is created on disk at `data/SOUL.md` with default identity parameters (name, personality traits, communication style, knowledge scope)

2. **Given** a `SOUL.md` file exists **When** a new WebSocket session begins and the user sends a chat message **Then** the agent loads its identity from `SOUL.md` and injects it into the LLM prompt, maintaining consistent personality across sessions

3. **Given** the agent has accumulated knowledge over multiple sessions **When** I start a new session **Then** the agent's personality and accumulated knowledge are preserved (FR29) — the `SOUL.md` file persists between backend restarts

4. **Given** the `SOUL.md` file is corrupted or deleted between sessions **When** the agent initializes **Then** a new default `SOUL.md` is regenerated automatically **And** the agent logs a warning indicating identity was reset

5. **Given** the `SOUL.md` file is loaded into the prompt **When** the user sends a chat message **Then** the agent responds with the personality defined in `SOUL.md` (tone, communication style, name)

6. **Given** the `_build_module_prompt` function in `agent.py` **When** it assembles the prompt **Then** the SOUL.md content is injected BEFORE the module creation instructions and user message, so the agent's identity shapes all responses

## Tasks / Subtasks

- [x] Task 1: Create SOUL.md management functions in `agent.py` (AC: #1, #3, #4)
  - [x] 1.1 Create constant `_DEFAULT_SOUL_CONTENT` in `agent.py` with the default SOUL.md template (see Dev Notes for content)
  - [x] 1.2 Create `_soul_path(data_dir: str) -> Path` helper returning `Path(data_dir) / "SOUL.md"`
  - [x] 1.3 Create `async def load_soul(data_dir: str) -> str` that reads `data/SOUL.md` from disk. If file missing or empty, call `_ensure_default_soul(data_dir)` and return default content
  - [x] 1.4 Create `async def _ensure_default_soul(data_dir: str) -> str` that writes `_DEFAULT_SOUL_CONTENT` to `data/SOUL.md` and returns it. Log info on first creation, warning on regeneration after corruption/deletion
  - [x] 1.5 Handle corrupted files: if `SOUL.md` exists but cannot be read (e.g., binary garbage, encoding error), log warning with `agent_action`, regenerate default, return default content
  - [x] 1.6 Use `aiofiles` for async file I/O (already in deps from FastAPI ecosystem) — OR use `asyncio.to_thread(Path.read_text, ...)` to avoid adding new dependency. Check if `aiofiles` is in `pyproject.toml` first; if not, use `asyncio.to_thread`

- [x] Task 2: Inject SOUL.md into prompt assembly (AC: #2, #5, #6)
  - [x] 2.1 Modify `_build_module_prompt(message: str)` signature to `_build_module_prompt(message: str, soul_content: str)` — add `soul_content` parameter
  - [x] 2.2 Prepend SOUL.md content at the TOP of the prompt, before the module creation system instructions. Format: `# Agent Identity\n\n{soul_content}\n\n# Instructions\n\n{existing_prompt}`
  - [x] 2.3 In `handle_chat()`, call `soul_content = await load_soul(data_dir)` before `_build_module_prompt()`. Derive `data_dir` from `db_path` (parent directory of the db file)
  - [x] 2.4 Pass `soul_content` to `_build_module_prompt(message, soul_content)`

- [x] Task 3: Ensure SOUL.md is created at backend startup (AC: #1, #4)
  - [x] 3.1 In `main.py` `lifespan()`, after `_ensure_data_dir()` and before `run_migrations()`, call `await agent.load_soul(settings.self_data_dir)` to ensure SOUL.md exists on first boot
  - [x] 3.2 Log the result: "soul_loaded" on success, "soul_created" on first creation

- [x] Task 4: Write unit tests for SOUL.md management (AC: #1, #3, #4, #5)
  - [x] 4.1 Create `apps/backend/tests/test_soul.py` (dedicated test file for SOUL functions)
  - [x] 4.2 Test: `load_soul` with no existing file → creates default SOUL.md, returns content
  - [x] 4.3 Test: `load_soul` with existing valid SOUL.md → returns existing content unchanged
  - [x] 4.4 Test: `load_soul` with empty file → regenerates default, logs warning
  - [x] 4.5 Test: `load_soul` with unreadable file (mock OSError) → regenerates default, logs warning
  - [x] 4.6 Test: `_ensure_default_soul` creates file in correct path
  - [x] 4.7 Test: `_soul_path` returns correct Path object
  - [x] 4.8 Test: default SOUL.md content contains required sections (name, personality, communication style)

- [x] Task 5: Write unit tests for prompt injection (AC: #2, #5, #6)
  - [x] 5.1 In `apps/backend/tests/test_agent.py`, add tests for SOUL injection in prompt
  - [x] 5.2 Test: `_build_module_prompt("hello", soul_content)` → returned prompt starts with SOUL content, followed by module instructions, ending with user message
  - [x] 5.3 Test: `handle_chat` with mock provider → verify `provider.execute()` was called with prompt that contains SOUL content
  - [x] 5.4 Test: `handle_chat` with missing SOUL.md → still works (default SOUL created), no crash

- [x] Task 6: Update existing tests to accommodate new `_build_module_prompt` signature (AC: all)
  - [x] 6.1 Grep for all calls to `_build_module_prompt` in test files and update signature
  - [x] 6.2 Update `test_agent.py` existing tests that call `_build_module_prompt` to pass `soul_content` parameter
  - [x] 6.3 Update `test_agent_edge.py` and `test_agent_module_edge.py` if they call `_build_module_prompt`
  - [x] 6.4 Ensure all existing tests still pass after changes — run `npm run test:backend`

- [x] Task 7: Integration test for SOUL persistence across sessions (AC: #2, #3)
  - [x] 7.1 Add integration test in `test_soul.py`: create SOUL.md → load → modify content → load again → verify modifications persist
  - [x] 7.2 Add integration test: simulate backend restart by calling `load_soul` twice with existing file → verify same content returned

### Review Follow-ups

- [ ] [AI-Review][LOW] Pre-existing F401 unused import `_extract_module_spec` in `test_agent_module_edge.py:27` — not introduced by this story but should be cleaned up
- [ ] [AI-Review][LOW] Pre-existing I001 unsorted imports in `main.py:10` — not introduced by this story but should be cleaned up
- [ ] [AI-Review][LOW] Redundant name validation for "Unnamed Module" in both `agent.py:432` and `modules.py:33-34` — defense-in-depth, not a bug, but worth noting

## Dev Notes

### Architecture Compliance (MANDATORY)

This is the SECOND story in Epic 2 (Conversational Shell & Agent Identity). It adds the SOUL.md identity file that the agent injects into every LLM prompt. Story 2.1 built the chat infrastructure; this story enriches the prompt with persistent identity. Stories 2.3 (Persona Preset) and 2.4 (Empty State) build on top.

**Critical patterns from architecture:**

1. **SOUL.md is a FILE on disk, NOT in SQLite** (architecture decision):
   - Path: `data/SOUL.md` (inside `settings.self_data_dir`)
   - Plain markdown file, human-readable via `cat`, versionable in git
   - Injected integrally into every LLM prompt by `agent.py`
   - Modified by the agent itself via a dedicated function (future stories)
   - No indirection layer needed — read file, inject into prompt
   - `data/` directory is gitignored (runtime data)

2. **`agent.py` is the SOLE owner of SOUL.md** (data boundary from architecture):
   - `agent.py` reads SOUL.md on prompt assembly
   - `agent.py` writes SOUL.md via dedicated function
   - No other file should read/write SOUL.md
   - `main.py` calls `agent.load_soul()` at startup only to ensure file exists

3. **Prompt assembly order** (from architecture data flow):
   ```
   agent.py assembles prompt: SOUL.md + persona instructions + memory + user message
   ```
   In this story, only SOUL.md + module instructions + user message (persona is Story 2.3, memory is Epic 5).

4. **Backend flat structure** (no subdirectories):
   - All SOUL functions go in `agent.py` (not a new file like `soul.py`)
   - `agent.py` is the orchestration module — it owns prompt assembly

5. **Async-only Python rule** — no `open()`, use `asyncio.to_thread(Path.read_text, ...)` or `aiofiles`

6. **Per-request pattern** — SOUL.md is read on every chat message (not cached in memory). This ensures live edits to the file take effect immediately. The file is small (~1KB), so I/O overhead is negligible.

### Default SOUL.md Content

The default SOUL.md template for a fresh installation:

```markdown
# Self — Agent Identity

## Name
Self

## Personality
You are Self, a thoughtful and capable AI assistant. You are warm but concise, helpful but not overbearing. You speak naturally, like a knowledgeable friend who genuinely wants to help.

## Communication Style
- Be conversational and natural — avoid sounding robotic or formulaic
- Match the user's language (if they write in French, respond in French)
- Keep responses concise unless the user asks for detail
- Use a friendly, approachable tone
- Never start responses with "I" — vary your sentence openings
- Acknowledge the user's intent before jumping to solutions

## Knowledge & Capabilities
You can create native mobile modules (widgets) by discovering APIs and composing UI primitives. When a user describes a need that maps to a data module (weather, stocks, news, tracking, etc.), you create it autonomously.

For regular conversation, you are helpful, honest, and direct. You don't pretend to know things you don't.

## Values
- Respect the user's time — be efficient
- Be honest about limitations
- Prioritize the user's actual need over showing off
- Remember that every API call costs the user money (BYOK) — be mindful of token usage
```

This default is intentionally persona-neutral. Story 2.3 (Persona Preset Selection) will layer persona-specific instructions on top via `data/personas/*.md`.

### Modifying `_build_module_prompt` — What Changes

Current signature:
```python
def _build_module_prompt(message: str) -> str:
```

New signature:
```python
def _build_module_prompt(message: str, soul_content: str) -> str:
```

The function body changes to prepend SOUL content:
```python
def _build_module_prompt(message: str, soul_content: str) -> str:
    return f"""# Agent Identity

{soul_content}

# Instructions

You are Self, an AI agent that creates native mobile modules. ...
{rest of existing prompt}

User message: {message}"""
```

Note: The "You are Self..." in the existing prompt is now REDUNDANT with SOUL.md content. However, keep the module creation instructions as-is — they are functional instructions, not identity. The SOUL.md provides WHO the agent is; the module instructions provide WHAT the agent can do.

### Deriving `data_dir` from `db_path`

In `handle_chat()`, the `db_path` is `data/self.db`. The SOUL.md lives at `data/SOUL.md`. Derive `data_dir`:
```python
from pathlib import Path
data_dir = str(Path(db_path).parent)
```

This is consistent with `settings.self_data_dir` which defaults to `"data"`.

### File I/O Strategy — `asyncio.to_thread`

Check `pyproject.toml` for `aiofiles`. If NOT present, use:
```python
import asyncio
from pathlib import Path

async def load_soul(data_dir: str) -> str:
    soul_path = _soul_path(data_dir)
    try:
        content = await asyncio.to_thread(soul_path.read_text, encoding="utf-8")
        if not content.strip():
            log.warning("soul_empty", agent_action="SOUL.md was empty, regenerating default identity")
            return await _ensure_default_soul(data_dir)
        return content
    except FileNotFoundError:
        log.info("soul_not_found", agent_action="Creating default SOUL.md for first boot")
        return await _ensure_default_soul(data_dir)
    except (OSError, UnicodeDecodeError) as e:
        log.warning("soul_read_failed", error=str(e), agent_action="SOUL.md corrupted, regenerating default identity")
        return await _ensure_default_soul(data_dir)
```

Do NOT add `aiofiles` as a new dependency just for this.

### What NOT To Do (Anti-Patterns)

- **DO NOT** create a separate `soul.py` module — SOUL functions belong in `agent.py` (architecture mandate: `agent.py` is the sole owner)
- **DO NOT** store SOUL content in SQLite — it is a file on disk (architecture decision)
- **DO NOT** cache SOUL content in memory — read from disk on every chat (enables live editing)
- **DO NOT** implement persona loading — that is Story 2.3 (persona files in `data/personas/`)
- **DO NOT** implement memory (Core/Semantic/Episodic) — that is Epic 5
- **DO NOT** modify the WebSocket protocol — no new message types needed for SOUL
- **DO NOT** modify `config.py` — `self_data_dir` already exists and is used by `_ensure_data_dir()`
- **DO NOT** add the SOUL.md file to git — `data/` is gitignored (runtime data)
- **DO NOT** break existing tests — current count: 1058 mobile + 568 backend = 1626 total
- **DO NOT** use synchronous file I/O (`open()`, `Path.read_text()` directly) — must be async via `asyncio.to_thread()`

### Previous Story Intelligence

**From Story 2.1 (Real-Time Chat Interface with Streaming — done):**
- `agent.py` exists and is the orchestration module — add SOUL functions HERE
- `_build_module_prompt(message)` is the function to modify — add `soul_content` parameter
- `handle_chat(ws, message, provider, db_path)` is the entry point — add `load_soul()` call before prompt assembly
- `_log_llm_usage(result, db_path)` pattern shows how to derive DB operations from `db_path`
- Per-request DB connections pattern (critical from fix(1-5)) — for file I/O, same principle: no persistent file handles
- Test patterns: `test_agent.py` uses `mock_provider` fixture and patches — follow same patterns

**From Story 2.1 Completion Notes (important learnings):**
1. `patch("app.main.get_provider")` did NOT work because `main.py` uses `from app.llm import get_provider` (local binding). Correct pattern: `patch.object(main_mod, "get_provider", ...)`
2. After replacing the echo stub, ALL tests using chat messages needed updates — be prepared for similar ripple effects when modifying `_build_module_prompt` signature
3. Test count baseline after 2.1: 1058 mobile, 568 backend — DO NOT REGRESS

**From Story 2.1 Code Review Follow-ups (LOW severity, informational):**
- `StreamingIndicator.tsx` not exported from barrel — not relevant to this story but context
- `Orb.test.tsx` doesn't test disconnected state — not relevant to this story

### Existing `agent.py` Analysis

Current `_build_module_prompt` returns a hardcoded system prompt starting with "You are Self, an AI agent that creates native mobile modules." This identity is currently embedded in the code. This story externalizes it to `SOUL.md`:

- The "You are Self..." opening in the module prompt will be preceded by SOUL.md content
- The module creation instructions remain unchanged (they are functional, not identity)
- The `handle_chat()` function needs one new line: `soul_content = await load_soul(data_dir)`

### `settings.self_data_dir` Usage

`config.py` already has `self_data_dir: str = "data"` and `db_path` property that uses it. In `main.py`, `settings.self_data_dir` is used by `_ensure_data_dir()` to create the data directory. The `settings.db_path` is passed to `handle_chat()`. To get `data_dir` in `agent.py`:

```python
data_dir = str(Path(db_path).parent)  # "data/self.db" → "data"
```

Alternatively, pass `settings.self_data_dir` directly from `main.py` to `handle_chat()`. The simpler approach is to derive from `db_path` since it's already a parameter — avoids changing `handle_chat` signature further.

### Target File Structure After This Story

```
apps/backend/
├── app/
│   ├── agent.py           MODIFY (add load_soul, _ensure_default_soul, _soul_path, modify _build_module_prompt)
│   ├── main.py            MODIFY (call agent.load_soul at startup in lifespan)
│   └── (all other files unchanged)
├── data/
│   ├── self.db            EXISTS (unchanged)
│   └── SOUL.md            NEW (created at runtime, gitignored)
└── tests/
    ├── test_soul.py       NEW (SOUL.md management tests)
    ├── test_agent.py      MODIFY (add SOUL injection tests, update _build_module_prompt calls)
    └── (other test files may need _build_module_prompt signature updates)
```

### Project Structure Notes

- `SOUL.md` lives in `data/` which is gitignored — it is runtime data, not source
- No new Python files in `app/` — all SOUL functions are added to existing `agent.py`
- One new test file: `tests/test_soul.py` for SOUL-specific unit tests
- Existing `test_agent.py` updated for SOUL injection tests

### References

- [Source: epics.md#Story 2.2] — FR29, acceptance criteria (SOUL.md creation, persistence, corruption recovery)
- [Source: architecture.md#Data Architecture] — "SOUL.md as file on disk" decision, rationale (human-readable, injected into prompts)
- [Source: architecture.md#Memory Architecture] — 4-layer memory: SOUL (Identity) layer description, `data/SOUL.md` on disk, injected integrally by `agent.py`
- [Source: architecture.md#Data Boundaries] — SOUL.md owned by `agent.py`, read on prompt assembly, written via dedicated function
- [Source: architecture.md#Data Flow] — `agent.py assembles prompt (SOUL.md + persona instructions + memory + user message)`
- [Source: architecture.md#Backend File Structure] — `data/SOUL.md` location, `data/personas/*.md` (Story 2.3)
- [Source: architecture.md#Persona Engine] — Persona stored in `memory_core`, loaded from `data/personas/{type}.md` (Story 2.3, NOT this story)
- [Source: architecture.md#Service Boundaries] — `agent.py` sole owner of SOUL.md and prompt assembly
- [Source: story 2-1] — `agent.py` current implementation, `_build_module_prompt`, `handle_chat`, test patterns, completion notes (patch.object pattern)
- [Source: config.py] — `settings.self_data_dir` = "data", `settings.db_path` = "data/self.db"
- [Source: PRD#Executive Summary] — "evolving SOUL.md identity file" as core differentiator

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None — implementation was clean with no debug issues.

### Completion Notes List

- Implemented SOUL.md agent identity persistence following TDD red-green-refactor cycle
- Added `_DEFAULT_SOUL_CONTENT`, `_soul_path()`, `load_soul()`, and `_ensure_default_soul()` functions to `agent.py` (sole owner per architecture mandate)
- Used `asyncio.to_thread()` for all file I/O since `aiofiles` is not in dependencies
- Modified `_build_module_prompt(message, soul_content)` to inject SOUL content at top of prompt with `# Agent Identity` header, followed by `# Instructions` header before module creation instructions
- Updated `handle_chat()` to derive `data_dir` from `db_path` and call `load_soul()` on every chat message (no caching, enables live editing)
- Added `await agent.load_soul(settings.self_data_dir)` to `main.py` lifespan to ensure SOUL.md exists on first boot
- Created 26 unit/integration tests in `test_soul.py` covering: path helper, default content validation, file creation, empty/corrupted/missing file recovery, persistence across sessions, and backend restart simulation
- Added 4 SOUL injection tests in `test_agent.py` covering: prompt contains SOUL content, SOUL appears before instructions, missing SOUL auto-creates default, and default SOUL does not crash
- Updated existing `_build_module_prompt` calls in `test_agent.py` (2 tests) and `test_agent_module_edge.py` (7 tests) to pass new `soul_content` parameter
- `test_agent_edge.py` required no changes (does not call `_build_module_prompt` directly)
- All 728 backend tests pass (up from 568 baseline — includes tests from prior stories)
- Zero regressions; all pre-existing tests continue to pass
- Ruff lint clean on all new/modified files (pre-existing E501 violations in `agent.py` prompt string not touched)

### Change Log

- 2026-02-24: Implemented Story 2.2 — Agent Identity Persistence (SOUL.md management, prompt injection, startup loading, comprehensive test coverage)
- 2026-02-24: Code review (adversarial) — Fixed 3 MEDIUM issues: (1) added soul_loaded logging at startup in main.py, (2) corrected misleading docstring in _ensure_default_soul, (3) added missing test files to File List. Documented 3 LOW issues as review follow-ups.

### File List

- `apps/backend/app/agent.py` — MODIFIED (added SOUL management functions: `_DEFAULT_SOUL_CONTENT`, `_soul_path`, `_ensure_default_soul`, `load_soul`; modified `_build_module_prompt` signature to accept `soul_content`; modified `handle_chat` to load SOUL before prompt assembly)
- `apps/backend/app/main.py` — MODIFIED (added `await agent.load_soul(settings.self_data_dir)` in lifespan after `_ensure_data_dir()`, with soul_loaded logging)
- `apps/backend/tests/test_soul.py` — NEW (26 tests for SOUL.md management: path helper, default content, file creation, corruption recovery, persistence integration)
- `apps/backend/tests/test_soul_edge.py` — NEW (edge-case tests for SOUL.md management: path edge cases, content structure, logging verification, concurrency, persistence edge cases)
- `apps/backend/tests/test_agent.py` — MODIFIED (added 4 SOUL injection tests in `TestHandleChatSoulInjection` class; updated 2 existing `_build_module_prompt` calls to pass `soul_content`)
- `apps/backend/tests/test_agent_module_edge.py` — MODIFIED (updated 7 existing `_build_module_prompt` calls to pass `soul_content`; added `_TEST_SOUL` constant)
- `apps/backend/tests/test_agent_soul_edge.py` — NEW (edge-case tests for SOUL injection in agent.py: empty/large SOUL content, f-string safety, data_dir derivation, auto-recovery, no-caching verification)
