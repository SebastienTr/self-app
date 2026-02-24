# CLAUDE.md — self-app

## Project

AI-powered personal assistant mobile app. User describes needs conversationally → agent creates native SDUI modules.

## Tech Stack

- **Mobile**: React Native 0.81 + Expo SDK 54 + TypeScript 5.9 + Zustand 5
- **Backend**: Python 3.12 + FastAPI + aiosqlite (SQLite WAL)
- **Schema**: Zod → TypeScript types → Pydantic models (shared `packages/module-schema`)
- **Protocol**: WebSocket only (15 typed messages)
- **Monorepo**: pnpm workspaces

## Structure

```
apps/backend/app/       # FastAPI modules (main.py, agent.py, db.py, modules.py, sessions.py)
apps/backend/tests/     # pytest (test_*.py, *_edge.py for edge cases)
apps/backend/migrations/ # SQL migrations (001_init.sql, ...)
apps/mobile/components/ # React Native (bridge/, sdui/, shell/)
apps/mobile/services/   # wsClient.ts, auth.ts, chatSync.ts, localDb.ts
apps/mobile/stores/     # Zustand stores (chatStore.ts, authStore.ts)
packages/module-schema/ # Shared Zod schema → TS + Python
```

## Commands

```bash
./self.sh               # Start full stack (tmux mode if available)
./self.sh --kill        # Stop everything
./self.sh --status      # Show service health
./self.sh --no-tmux     # Force inline mode
npm run test            # All tests (mobile + backend)
npm run test:backend    # pytest
npm run test:mobile     # jest
npm run schema:generate # Zod → TS → Pydantic
```

## Conventions

- **Python**: snake_case, ruff (line 100), async everywhere, structlog
- **TypeScript**: camelCase, strict mode
- **Tests**: TDD red-green-refactor. Edge cases in separate files (*_edge.py / *.edge.test.ts)
- **Backend DB**: per-request connections with try/finally (no connection leaks)
- **Mobile DB**: lazy initialization only — never call `openDatabaseSync()` at module top-level (crashes Expo Go)
- **Commits**: `feat(story-key): description` or `fix(story-key): description`

## Rules for Bash commands

- NEVER use newlines to separate commands — use `&&` or `;` on a single line
- NEVER put comments (`# ...`) on separate lines in Bash commands
- Correct: `adb shell input keyevent KEYCODE_BACK && echo done`
- Wrong: `# dismiss keyboard\nadb shell input keyevent KEYCODE_BACK`

## BMAD Framework

Project management via `_bmad/` framework. Stories in `_bmad-output/implementation-artifacts/`.
Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`
Roadmap: `_bmad-output/implementation-artifacts/roadmap.md`

## Do NOT

- Do not commit `.env` files or API keys
- Do not use `kill` commands without explicit user approval
- Do not add unnecessary abstractions or over-engineer
