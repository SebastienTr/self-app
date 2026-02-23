# Story 1.1: Initialize Monorepo & Module Definition Schema

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to clone the repository and have a working monorepo with a shared module definition schema,
So that I have type-safe contracts between mobile and backend from day one.

## Acceptance Criteria

1. **Given** a fresh clone of the repository **When** I run `pnpm install` at the root **Then** all workspace dependencies are resolved without errors (apps/mobile, apps/backend, packages/module-schema)

2. **Given** the module-schema package with Zod source definitions **When** I run the schema generation command (`pnpm schema:generate`) **Then** JSON Schema, TypeScript types, and Pydantic models are generated in their respective output directories **And** the generated TypeScript types are importable from `@self-app/module-schema` **And** the generated Pydantic models are importable from `module_schema`

3. **Given** a module definition object **When** it is validated against the Zod schema **Then** it validates successfully for valid specs and rejects invalid specs with descriptive errors **And** the schema includes at minimum: module name, type, data sources (array), layout template, refresh interval, schema_version, and accessibleLabel (FR11, NFR31)

## Tasks / Subtasks

- [x] Task 1: Scaffold monorepo structure (AC: #1)
  - [x] 1.1 Initialize pnpm workspace at repo root with `pnpm-workspace.yaml`
  - [x] 1.2 Create root `package.json` with workspace scripts (dev, build, schema:generate, test:mobile, test:backend)
  - [x] 1.3 Create root `tsconfig.json` with strict mode and path aliases
  - [x] 1.4 Scaffold `apps/mobile/` using `create-expo-app` (Expo SDK 54, New Architecture, TypeScript)
  - [x] 1.5 Configure Metro for pnpm monorepo symlink resolution (from byCedric pattern)
  - [x] 1.6 Scaffold `apps/backend/` with Python project (`pyproject.toml` using uv)
  - [x] 1.7 Scaffold `packages/module-schema/` with `package.json` and `tsconfig.json`
  - [x] 1.8 Configure TypeScript path aliases (`@self/module-schema`, `@/components/*`, `@/services/*`, etc.)
  - [x] 1.9 Verify `pnpm install` resolves all workspace dependencies clean
  - [x] 1.10 Create `.gitignore` covering node_modules, generated files, data/, .env, __pycache__, etc.

- [x] Task 2: Create Zod module definition schema (AC: #2, #3)
  - [x] 2.1 Create `packages/module-schema/src/moduleSpec.ts` with Zod 4 source-of-truth schema
  - [x] 2.2 Define all required fields: id, name, type, template, dataSources, refreshInterval, schemaVersion, accessibleLabel
  - [x] 2.3 Define enum/union types for `type` field (metric, list, text, status, table — First Light primitives)
  - [x] 2.4 Define template field with known template names (metric-dashboard, data-card, simple-list for First Light)
  - [x] 2.5 Export `CURRENT_SCHEMA_VERSION` constant from `packages/module-schema/src/index.ts`
  - [x] 2.6 Create barrel export in `packages/module-schema/src/index.ts`

- [x] Task 3: Schema generation pipeline (AC: #2)
  - [x] 3.1 Create `packages/module-schema/scripts/generate.ts` using Zod 4 native `z.toJSONSchema()`
  - [x] 3.2 Generate `packages/module-schema/generated/schema.json` (JSON Schema output)
  - [x] 3.3 Generate `packages/module-schema/generated/models.py` using `datamodel-code-generator` from JSON Schema
  - [x] 3.4 TypeScript types via Zod inference (zero codegen — `z.infer<typeof moduleSpecSchema>`)
  - [x] 3.5 Wire `pnpm schema:generate` root script to run the generation pipeline
  - [x] 3.6 Verify generated TypeScript types are importable as `@self-app/module-schema`
  - [x] 3.7 Verify generated Pydantic models are importable as `module_schema` in Python

- [x] Task 4: Schema validation tests (AC: #3)
  - [x] 4.1 Create `packages/module-schema/src/__tests__/moduleSpec.test.ts` with Jest
  - [x] 4.2 Test valid module spec passes validation
  - [x] 4.3 Test missing required fields produce descriptive errors
  - [x] 4.4 Test invalid enum values are rejected
  - [x] 4.5 Test schema_version field is present and numeric
  - [x] 4.6 Test accessibleLabel is required (NFR31)
  - [x] 4.7 Create test fixture factory: `createTestModuleSpec(overrides?)` in `__tests__/fixtures/moduleSpec.ts`
  - [x] 4.8 Create Python test `apps/backend/tests/test_module_schema.py` verifying Pydantic model validates same specs

## Dev Notes

### Monorepo Structure (MANDATORY)

Follow this exact structure from architecture document:

```
self-app/
├── apps/
│   ├── mobile/                  # Expo SDK 54 (byCedric monorepo pattern)
│   │   ├── app/                 # Expo Router (file-based routing)
│   │   ├── components/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── metro.config.js      # pnpm symlink resolution (CRITICAL)
│   │   └── app.json
│   └── backend/                 # Python 3.14, FastAPI
│       ├── app/
│       │   ├── __init__.py
│       │   └── main.py          # Placeholder FastAPI app
│       ├── tests/
│       │   └── conftest.py
│       ├── pyproject.toml       # uv project config
│       └── Dockerfile           # Placeholder
├── packages/
│   └── module-schema/
│       ├── src/
│       │   ├── moduleSpec.ts    # Zod source of truth
│       │   ├── index.ts         # Barrel export + CURRENT_SCHEMA_VERSION
│       │   └── __tests__/
│       │       ├── fixtures/
│       │       │   └── moduleSpec.ts  # Test factory
│       │       └── moduleSpec.test.ts
│       ├── generated/
│       │   ├── schema.json      # Auto-generated JSON Schema
│       │   └── models.py        # Auto-generated Pydantic models
│       ├── scripts/
│       │   └── generate.ts      # Generation pipeline script
│       ├── tsconfig.json
│       └── package.json
├── pnpm-workspace.yaml
├── package.json                 # Root scripts
├── tsconfig.json                # Root TypeScript config
└── .github/                     # Placeholder for CI (Story 1.1b)
```

### Technical Stack (Pinned Versions)

| Technology | Version | Notes |
|-----------|---------|-------|
| Expo SDK | 54 | SDK 55 in beta — do NOT use |
| React Native | 0.81 | Bundled with SDK 54, New Architecture only |
| React | 19.1 | Bundled with SDK 54 |
| TypeScript | 5.9 | Latest stable, strict mode mandatory |
| Zod | **4.x** (latest 4.3.6) | **NOT Zod 3** — use native `z.toJSONSchema()` |
| pnpm | 10.x | Strict mode, configure `onlyBuiltDependencies` |
| Python | 3.14.3 | Latest stable |
| uv | latest | Replaces pip/poetry for Python tooling |
| Ruff | latest | Replaces black+flake8+isort |
| pytest | latest | Python testing |
| Jest | Bundled with Expo | TypeScript testing |
| datamodel-code-generator | latest | JSON Schema → Pydantic models |

### Critical: Zod 4 Migration from Architecture

The architecture document references `zod-to-json-schema` library. **This is outdated.** Zod 4 provides a native `z.toJSONSchema()` method that replaces it entirely. The `zod-to-json-schema` package is **incompatible with Zod 4**.

**Use this pipeline instead:**

```typescript
// packages/module-schema/scripts/generate.ts
import { z } from 'zod';
import { moduleSpecSchema } from '../src/moduleSpec';

// Generate JSON Schema using Zod 4 native method
const jsonSchema = z.toJSONSchema(moduleSpecSchema);
```

### Module Definition Schema Fields

The Zod schema in `moduleSpec.ts` MUST include these fields:

| Field | Type | Required | Source |
|-------|------|----------|--------|
| `id` | `z.string().uuid()` | Yes | Architecture — generated server-side |
| `name` | `z.string()` | Yes | FR11 — module name |
| `type` | `z.enum(["metric","list","text","status","table"])` | Yes | FR11 — First Light primitives |
| `template` | `z.string().default("data-card")` | Yes | Architecture — composition template |
| `dataSources` | `z.array(dataSourceSchema)` | Yes | FR11 — data sources array |
| `refreshInterval` | `z.number().positive()` | Yes | FR11 — refresh interval in seconds |
| `schemaVersion` | `z.number().int().positive()` | Yes | Architecture — versioning |
| `accessibleLabel` | `z.string()` | Yes | NFR31 — screen reader label |

Optional fields to include from architecture:
- `status` — module lifecycle status (default: "active")
- `createdAt` / `updatedAt` — timestamps (ISO 8601)
- `vitalityScore` — module health score (0-100, optional, computed server-side)

### Schema Versioning Rules

- Export `CURRENT_SCHEMA_VERSION = 1` from `index.ts`
- Additive changes (new optional fields) do NOT increment version
- Breaking changes (renamed fields, type changes, new required fields) require version increment + migrator
- Migrator registry: `Record<number, (spec: unknown) => ModuleSpec>` — not needed in Story 1.1 but schema structure must support it

### Naming Conventions (MANDATORY)

| Context | Convention | Example |
|---------|-----------|---------|
| Zod schema fields | camelCase | `dataSources`, `schemaVersion` |
| TypeScript types/interfaces | PascalCase | `ModuleSpec`, `DataSource` |
| TypeScript files (services/utils) | camelCase | `moduleSpec.ts`, `logger.ts` |
| React components | PascalCase files | `MetricPrimitive.tsx` |
| Python modules | snake_case | `models.py`, `test_modules.py` |
| Python classes | PascalCase | `ModuleSpec` (Pydantic model) |
| JSON over WebSocket | snake_case | Pydantic `alias_generator` handles conversion |
| Test files (TS) | `*.test.ts` co-located | `moduleSpec.test.ts` next to `moduleSpec.ts` |
| Test files (Python) | `tests/test_*.py` | `tests/test_module_schema.py` |
| TS directories | kebab-case | `module-schema/` |

### Case Conversion Boundary

```
Zod (camelCase) → JSON Schema (camelCase) → Pydantic models (snake_case via alias_generator)
```

Three explicit conversion points:
1. **Pydantic `alias_generator`** — camelCase JSON Schema → snake_case internal fields
2. **Backend WS serialization** — Pydantic models serialize to snake_case on the wire
3. **Mobile `toCamel()`** — snake_case from WS → camelCase TypeScript objects

The Pydantic model MUST use:
```python
model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
```

### Import Path Rules (MANDATORY from commit 1)

```json
// tsconfig.json paths
{
  "paths": {
    "@self/module-schema": ["../../packages/module-schema/src"],
    "@/components/*": ["./components/*"],
    "@/services/*": ["./services/*"],
    "@/stores/*": ["./stores/*"]
  }
}
```

- **NEVER** use relative paths crossing package boundaries (no `../../packages/`)
- Use `@self/` for cross-package imports
- Use `@/` for intra-app imports
- Barrel exports per sub-folder only — never a global `components/index.ts`

### pnpm 10.x Configuration Note

pnpm 10 **disables lifecycle scripts by default** (security feature). Expo/RN packages use postinstall scripts. Add to `pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'

onlyBuiltDependencies:
  - expo
  - react-native
  - esbuild
```

### Metro Config for Monorepo (CRITICAL)

The Metro config must resolve pnpm symlinks. Reference byCedric/expo-monorepo-example:

```javascript
// apps/mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
```

### Root Scripts (package.json)

```json
{
  "scripts": {
    "dev:mobile": "cd apps/mobile && pnpm expo start",
    "dev:backend": "cd apps/backend && uvicorn app.main:app --reload",
    "dev": "concurrently \"pnpm dev:mobile\" \"pnpm dev:backend\"",
    "schema:generate": "cd packages/module-schema && pnpm generate",
    "test:mobile": "cd apps/mobile && pnpm jest",
    "test:backend": "cd apps/backend && pytest"
  }
}
```

### Test Factory Pattern (MANDATORY for module specs)

```typescript
// packages/module-schema/src/__tests__/fixtures/moduleSpec.ts
import type { ModuleSpec } from '../../moduleSpec';

export const createTestModuleSpec = (overrides?: Partial<ModuleSpec>): ModuleSpec => ({
  id: 'test-module-1',
  name: 'Test Module',
  type: 'metric',
  template: 'data-card',
  dataSources: [],
  refreshInterval: 3600,
  schemaVersion: 1,
  accessibleLabel: 'Test module displaying metric data',
  ...overrides,
});
```

### Python Backend Placeholder

For Story 1.1, the backend only needs a minimal FastAPI placeholder to verify monorepo structure. The actual backend skeleton comes in Story 1.2.

```python
# apps/backend/app/main.py
from fastapi import FastAPI

app = FastAPI(title="self-app backend", version="0.1.0")

@app.get("/health")
async def health():
    return {"status": "ok"}
```

**pyproject.toml** should use uv and include:
- `fastapi[standard]` >= 0.131.0
- `pydantic` >= 2.13.0
- `datamodel-code-generator` (dev dependency for schema generation)
- `pytest` + `pytest-asyncio` (dev dependencies)
- `ruff` (dev dependency for linting)

### What NOT To Do

- Do NOT install `zod-to-json-schema` — it's incompatible with Zod 4
- Do NOT create sub-directories in `apps/backend/app/` except `llm/` (flat structure rule)
- Do NOT add database setup, migrations, or SQLite configuration (Story 1.2)
- Do NOT implement WebSocket endpoints (Story 1.4)
- Do NOT implement LLM provider abstraction (Story 1.3)
- Do NOT add authentication or session management (Story 1.6)
- Do NOT set minimum test coverage thresholds (not required for First Light)
- Do NOT use `npm` or `yarn` — pnpm only
- Do NOT use relative imports crossing package boundaries
- Do NOT create a global barrel export at `components/index.ts`

### Project Structure Notes

- Monorepo follows byCedric/expo-monorepo-example pattern with pnpm workspaces
- `packages/module-schema` is the FIRST shared contract — all downstream stories depend on it
- The schema generation pipeline (Zod → JSON Schema → Pydantic) is the architectural backbone
- Module schema changes propagate to both mobile and backend via generated types
- One clone, one `pnpm install` should launch everything

### References

- [Source: architecture.md#Monorepo Structure] — Complete folder layout (lines 125-168)
- [Source: architecture.md#Module Definition Schema] — Zod source of truth pipeline (lines 176-207)
- [Source: architecture.md#Conversion Boundary Map] — camelCase/snake_case rules (lines 188-200)
- [Source: architecture.md#Root Scripts] — package.json scripts (lines 305-314)
- [Source: architecture.md#File and Component Naming] — Naming conventions (lines 820-832)
- [Source: architecture.md#Import & Export Patterns] — Path alias rules (lines 836-856)
- [Source: architecture.md#Test Patterns] — Testing standards (lines 1094-1117)
- [Source: architecture.md#Composition Template Registry] — 6 templates (lines 493-542)
- [Source: architecture.md#SDUI Primitive Registry] — 5 First Light primitives (lines 463-487)
- [Source: epics.md#Story 1.1] — Story requirements and acceptance criteria (lines 394-415)
- [Source: prd.md#FR11] — Module definition format requirements
- [Source: prd.md#NFR31] — Accessibility requirements (accessibleLabel)
- [Source: prd.md#Critical Path] — Module Definition Schema is FIRST deliverable
- [Source: prd.md#First Light Phase] — Phase scope and success criteria

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Pydantic 2.13.0 not yet released — used 2.12.5 (latest available Feb 2026)
- Zod 4 `z.string().uuid()` generates both `format: uuid` AND `pattern` in JSON Schema, causing Pydantic UUID+pattern conflict — resolved by stripping pattern from uuid fields before Pydantic codegen
- datamodel-code-generator execution now prefers `uv run --extra dev` and falls back to backend `.venv/bin/datamodel-codegen` when `uv` is unavailable or unstable in local sandbox environments
- Generated Pydantic models use snake_case fields with camelCase aliases (via `--snake-case-field` flag); code review fixes add `alias_generator=to_camel` + `populate_by_name=True` post-generation

### Completion Notes List

- Story context engine analysis completed — comprehensive developer guide created
- Web research identified Zod 4 migration: `zod-to-json-schema` replaced by native `z.toJSONSchema()`
- pnpm 10.x lifecycle script change documented
- All technology versions pinned with February 2026 latest stable
- **Task 1 complete**: Monorepo scaffolded with pnpm 10.30.1, Expo SDK 54 (RN 0.81.5, React 19.1), Python backend with FastAPI 0.131.0, Metro configured for pnpm symlinks
- **Task 2 complete**: Zod 4 schema with all required + optional fields, enums for type/template/status, DataSource sub-schema
- **Task 3 complete**: Generation pipeline (Zod → JSON Schema → Pydantic) working end-to-end via `pnpm run schema:generate`. Python package auto-generated as installable `module_schema` with uv path dependency
- **Task 4 complete**: 25 Jest tests + 16 pytest tests — all passing. Covers valid specs, missing fields, invalid enums, field constraints, schema versioning, snake_case input compatibility
- **AI code review fixes applied**: root `test/dev` scripts fixed, backend test execution made robust (`.venv` fallback + `uv` fallback), schema generation no longer depends only on a hardcoded venv path, generated Pydantic models patched with `alias_generator` + `populate_by_name`, legacy `generated/models.py` mirrored to avoid drift

### Implementation Plan

1. Scaffolded pnpm monorepo with 3 workspace projects (apps/mobile, apps/backend, packages/module-schema)
2. Used create-expo-app for Expo SDK 54 with blank-typescript template, added Metro monorepo config
3. Created Python backend with FastAPI placeholder, uv for dependency management
4. Implemented Zod 4 source-of-truth schema with 8 required fields + 3 optional fields
5. Built generation pipeline: Zod → JSON Schema (draft-2020-12) → Pydantic v2 models via datamodel-codegen
6. Generated Python package (`module_schema`) auto-installed as uv path dependency in backend
7. Created comprehensive test suites in both TypeScript (Jest) and Python (pytest)

### File List

#### New Files
- pnpm-workspace.yaml
- package.json (root)
- pnpm-lock.yaml
- tsconfig.json (root)
- scripts/dev.mjs
- apps/mobile/App.tsx
- apps/mobile/app.json
- apps/mobile/index.ts
- apps/mobile/package.json
- apps/mobile/tsconfig.json
- apps/mobile/metro.config.js
- apps/mobile/.gitignore
- apps/mobile/assets/ (icons and splash)
- apps/backend/pyproject.toml
- apps/backend/uv.lock
- apps/backend/Dockerfile
- apps/backend/app/__init__.py
- apps/backend/app/main.py
- apps/backend/tests/conftest.py
- apps/backend/tests/test_module_schema.py
- packages/module-schema/package.json
- packages/module-schema/tsconfig.json
- packages/module-schema/jest.config.js
- packages/module-schema/src/moduleSpec.ts
- packages/module-schema/src/index.ts
- packages/module-schema/src/__tests__/moduleSpec.test.ts
- packages/module-schema/src/__tests__/fixtures/moduleSpec.ts
- packages/module-schema/scripts/generate.ts
- packages/module-schema/generated/ (auto-generated, gitignored)

#### Modified Files
- .gitignore (added Python, generated files, data/ entries)

#### Review Fixes (AI)
- package.json (root) — fixed root `dev/test` scripts
- packages/module-schema/package.json — generate script execution updated (`node --import tsx`)
- packages/module-schema/scripts/generate.ts — robust codegen execution + post-generation Pydantic config patch + legacy mirror sync
- apps/backend/tests/test_module_schema.py — added snake_case input compatibility test

## Change Log

| Date | Change |
|------|--------|
| 2026-02-23 | Story 1.1 implemented: monorepo scaffold, Zod 4 module schema, generation pipeline, 40 tests (25 Jest + 15 pytest) |
| 2026-02-23 | AI code review fixes: root scripts hardened, codegen fallback added, Pydantic `populate_by_name`/`alias_generator` patch applied, legacy generated models synced, tests updated to 41 total (25 Jest + 16 pytest) |
