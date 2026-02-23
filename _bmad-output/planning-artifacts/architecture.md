---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: ['_bmad-output/planning-artifacts/prd.md', '_bmad-output/planning-artifacts/ux-design-specification.md', '_bmad-output/planning-artifacts/product-brief-self-app-2026-02-21.md']
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-02-22'
project_name: 'self-app'
user_name: 'Seb'
date: '2026-02-22'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
55 FRs across 9 categories define the capability contract:

| Category | FR Count | Architectural Implication |
|----------|----------|--------------------------|
| Conversation & Onboarding | 9 (FR1-8, FR54) | Streaming chat, persona engine, trust-before-access gate |
| Module Creation & Management | 8 (FR9-16) | Agent→LLM→API pipeline, module definition format (JSON schema), progressive fallback chain |
| Module Rendering & Display | 6 (FR17-22) | SDUI rendering engine, primitive library (5→11), composition templates, cache-first offline |
| Module Lifecycle | 6 (FR23-28) | Vitality scoring, lifecycle state machine, usage analytics, configurable refresh scheduling |
| Agent Memory & Identity | 5 (FR29-33) | 4-layer memory (SOUL + Core + Semantic + Episodic), anti-repetition pipeline, memory CRUD |
| Data Sources & Authentication | 6 (FR34-39) | Secure key storage, OAuth proxy, BYOK multi-provider, model routing, session management |
| Proactive Behavior & Notifications | 6 (FR40-45) | Dual-tier heartbeat (cron + agent), push notifications (APNs/FCM), active hours scheduling |
| Configuration & Sharing | 7 (FR46-52, FR55) | Genome format (JSON/YAML), import/export, QR pairing, audit logging, Docker deployment |
| Safety & Reversibility | 1 (FR53) | Undo system with 60-second window, action journaling |

**Non-Functional Requirements:**
33 NFRs drive architectural constraints:

| Domain | NFR Count | Key Constraints |
|--------|-----------|----------------|
| Performance | 9 (NFR1-9) | Cold start < 2s, module render < 100ms, creation < 30s, anti-repetition < 50ms, heartbeat < 500 tokens |
| Security & Privacy | 8 (NFR10-17) | AES-256/secure enclave, TLS 1.3, zero telemetry, no third-party data, secure deletion, OAuth token isolation |
| Reliability | 5 (NFR18-22) | Cache-first 100%, zero message loss, module fault isolation, heartbeat resilience, structured error recovery |
| Integration | 4 (NFR23-26) | LLM provider abstraction (min 2), API timeout handling, push delivery < 30s, OAuth proxy compatibility |
| Scalability | 3 (NFR27-29) | 50+ modules, 10K+ memory entries, multi-user schema readiness from day one |
| Accessibility | 4 (NFR30-33) | WCAG AA, Dynamic Type, screen readers, 44×44pt touch targets |

**Scale & Complexity:**

- Primary domain: Full-stack mobile + backend AI gateway
- Complexity level: High
- Estimated architectural components: ~12-15 major components

### Technical Constraints & Dependencies

- **Solo developer** — architecture must be buildable and maintainable by one person
- **BYOK model** — no hosted AI service; user provides their own API keys or uses their subscription
- **App Store compliance** — SDUI must use native primitives only, no dynamic code execution
- **React Native Expo managed workflow** — constrains native module access
- **SQLite + sqlite-vec** — lightweight local vector search, no external database service
- **Two-stage MVP** — First Light (5 core SDUI primitives, CLI-based agent, cron-only refresh) → Full MVP (11 primitives, multi-provider API, agent heartbeat)
- **Module Definition Format is the critical path** — everything (agent, renderer, lifecycle, genome) depends on this JSON schema

### Cross-Cutting Concerns Identified

- **Trust architecture** — Trust-before-access pattern affects onboarding, permissions, notifications, proactive suggestions. Must be enforced at every system boundary.
- **Agent-UI contract** — The JSON schema between agent output and SDUI renderer is the system's backbone. Schema versioning, validation, and fallback behavior affect every component.
- **Real-time + offline duality** — WebSocket for live updates, but cache-first for offline. Every data flow must handle both connected and disconnected states.
- **Persona-driven behavior** — Flame/Tree/Star affects agent verbosity, confirmation patterns, autonomy level. This is not cosmetic — it changes agent decision logic.
- **Module isolation** — Individual module failures must never cascade. Each module has independent data sources, refresh cycles, and error states.
- **Cost awareness** — BYOK means every API call costs the user money. The dual-strategy (CLI for personal use, API for distribution) and model routing (premium for creation, economic for heartbeat) are cost architecture, not just configuration.

### LLM Execution Strategy (Pre-Architecture Decision)

A key insight from discovery: Claude Max subscription includes unlimited Claude Code CLI usage, while the API is pay-per-token. This shapes the agent execution architecture:

**Dual-mode LLM access:**

| Mode | When | How | Cost |
|------|------|-----|------|
| **CLI mode** (First Light, personal use) | Developer running own instance | `claude -p "prompt" --output-format json` via Claude Code CLI | $0 (included in Max subscription) |
| **API mode** (MVP, public distribution) | Any user with BYOK API keys | Anthropic Client SDK / OpenAI-compatible SDK | Pay-per-token |
| **Economic routing** | Heartbeat, simple queries | Direct API call to DeepSeek/Moonshot/Haiku | ~$0.27-0.80/M tokens |

**Architectural implication:** The interface between the backend and LLM execution MUST be abstracted from day one. A `LLMProvider` abstraction that can swap between CLI-based execution and API-based execution without changing any upstream logic. This is the foundation of the BYOK promise and the cost optimization strategy.

**Estimated monthly cost (25 modules, daily use):**
- CLI mode + DeepSeek heartbeat: ~$0.20/month
- Full API mode (Sonnet): ~$15-50/month
- Full API mode (economic providers): ~$2-5/month

## Starter Template & Project Foundation

### Developer Context

Seb is a senior backend developer (Python) with no mobile/React Native experience. AI agents (Claude Code, Codex) will be the primary mobile code authors and debuggers. This fundamentally shapes tooling choices: everything must be debuggable from a terminal by an LLM reading structured logs — no GUI-dependent debugging workflows.

### Primary Technology Domain

Dual-stack mobile + backend AI gateway:

| Layer | Technology | Version (Feb 2026) |
|-------|-----------|-------------------|
| Mobile | React Native (Expo managed) | Expo SDK 54, RN 0.81, React 19.1 |
| Backend | Python (FastAPI + WebSocket) | Python 3.14.3, FastAPI latest |
| Database | SQLite + sqlite-vec | Via expo-sqlite (mobile) + aiosqlite (backend) |
| State (mobile) | Zustand | 5.0.11 |
| Package manager | pnpm | Strict mode, best monorepo support for Expo SDK 54 |
| Python tooling | uv + Ruff + pytest | uv replaces pip/poetry (10-100x faster), Ruff replaces black+flake8+isort |

### Starter Options Evaluated

| Option | Verdict | Reason |
|--------|---------|--------|
| Turborepo + Expo | Rejected | JS/TS only — cannot orchestrate Python backend |
| create-t3-turbo | Rejected | Wrong stack (Next.js + tRPC, no Python, no WebSocket) |
| byCedric/expo-monorepo-example | Adopted as base | Best Expo + pnpm monorepo reference; includes Metro config for symlink resolution |
| Full Stack FastAPI Template | Rejected | PostgreSQL-oriented, no WebSocket, no sqlite-vec, too opinionated |
| create-expo-app (SDK 54 default) | Used within monorepo | Clean starting point: Expo Router, New Architecture, TypeScript |

### Selected Approach: Composed Monorepo

No single starter covers Self's dual-stack architecture. The foundation is a manual composition based on proven references:

**Monorepo Structure (First Light — minimal, no empty directories):**

```
self-app/
├── apps/
│   ├── mobile/                  # Expo SDK 54 (from byCedric monorepo pattern)
│   │   ├── app/                 # Expo Router
│   │   ├── components/          # Shell + Bridge + SDUI (created as needed)
│   │   ├── services/
│   │   │   ├── logger.ts        # Structured JSON logging → WebSocket to backend
│   │   │   └── ws.ts            # WebSocket client
│   │   ├── stores/              # Zustand (created as needed)
│   │   ├── metro.config.js      # pnpm monorepo symlink resolution (from byCedric)
│   │   └── app.json
│   │
│   └── backend/                 # Python 3.14, FastAPI
│       ├── app/
│       │   ├── main.py          # FastAPI + WebSocket endpoint
│       │   ├── llm/             # LLMProvider abstraction (CLI ↔ API swap)
│       │   │   ├── __init__.py  # Re-exports LLMProvider, get_provider()
│       │   │   ├── base.py      # LLMProvider Protocol + CLIProvider base + LLMResult
│       │   │   ├── cli_claude.py
│       │   │   ├── cli_codex.py
│       │   │   ├── cli_kimi.py
│       │   │   ├── api_anthropic.py
│       │   │   └── api_deepseek.py
│       │   ├── modules.py       # Module CRUD + SQLite
│       │   └── logging.py       # structlog JSON configuration
│       ├── pyproject.toml       # uv project config
│       └── Dockerfile
│
├── packages/
│   └── module-schema/           # Shared contract (JSON Schema source of truth)
│       ├── schema.json          # Language-agnostic module definition schema
│       ├── src/                  # Zod source → generates JSON Schema
│       └── generated/
│           ├── types.ts         # Auto-generated TypeScript types
│           └── models.py        # Auto-generated Pydantic models
│
├── pnpm-workspace.yaml
├── package.json                 # Root scripts: dev, build, schema:generate
├── docker-compose.yml           # Backend + SQLite volume
└── .github/
```

**Rationale for monorepo:** One clone, one `pnpm install && pnpm dev` launches everything. The module-schema package changes constantly during First Light — monorepo means schema change + type rebuild + both-side testing in a single commit. Multi-repo would triple the release ceremony for every schema iteration.

### Schema Contract Strategy

The module definition JSON Schema is the architectural backbone — agent (Python), renderer (TypeScript), lifecycle, and genome all depend on it.

**Source of truth flow:**

```
Zod (TypeScript) → json-schema-to-zod inverse: NO
Zod schema (packages/module-schema/src/)
    → zod-to-json-schema → schema.json (language-agnostic)
    → auto-generates TypeScript types (zod inference, zero codegen needed)
    → datamodel-code-generator → Pydantic models for Python backend
```

Zod is the source of truth because: TypeScript is where schema violations are caught at compile time (strict mode), and the mobile renderer is where malformed specs cause visible failures. Defining the contract in the consumer's language minimizes the gap between schema and runtime.

**Conversion boundary map:**

```
Zod (camelCase) → JSON Schema (camelCase) → Pydantic models (snake_case via alias_generator)
```

- Backend serializes in `snake_case` on the WebSocket (Pydantic `alias_generator` handles the conversion)
- Mobile receives `snake_case`, converts to `camelCase` via `toCamel()`
- **3 explicit conversion points:**
  1. **Pydantic `alias_generator`** — Zod camelCase schema → Pydantic snake_case internal fields
  2. **Backend WS serialization** — Pydantic models serialize to snake_case JSON on the wire
  3. **Mobile `toCamel()`** — snake_case JSON from WS → camelCase TypeScript objects

#### Schema Versioning

- Champ `schemaVersion: number` dans le Zod schema (`packages/module-schema/src/moduleSpec.ts`)
- Constante `CURRENT_SCHEMA_VERSION` exportee depuis `packages/module-schema/src/index.ts`
- Au chargement d'un module : si `schemaVersion` < `CURRENT_SCHEMA_VERSION`, migration via un registre de migrators (`Record<number, (spec: unknown) => ModuleSpec>`)
- Si la migration echoue : module marque `error` avec `agent_action: "Schema migration failed from version X to Y"`
- **Regle d'increment :** les changements additifs (nouveaux champs optionnels) n'incrementent pas la version. Les breaking changes (champs renommes, types modifies, champs obligatoires ajoutes) necessitent un increment + migrator obligatoire.

### Architectural Decisions Provided by Foundation

**Language & Runtime:**
- TypeScript strict maximum (mobile): `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- Python 3.14 with type hints (backend): Pydantic for validation, full async

**LLM Provider Abstraction (non-negotiable from commit 1):**

```python
# app/llm/base.py — exists from first commit
class LLMProvider(Protocol):
    async def execute(self, prompt: str, tools: list | None = None) -> str: ...

class ClaudeCodeCLI:      # First Light — uses Max subscription ($0)
class AnthropicAPI:        # MVP — BYOK pay-per-token
class DeepSeekAPI:         # Economic routing for heartbeat
```

The rest of the codebase calls `provider.execute()` without knowing the implementation. Swapping CLI → API requires one config change.

**Mobile Dependencies (added to Expo default):**

| Package | Role |
|---------|------|
| zustand 5.x | State management (modules, UI state, connection status) |
| expo-sqlite | Local cache + offline module state |
| expo-secure-store | API keys, auth tokens |
| react-native-reanimated v4 | Animations (Orb, Creation Ceremony) — New Architecture only |

### AI-First Observability Architecture

Since AI agents are the primary mobile debuggers, all errors must be diagnosable from `docker logs` without GUI tools.

**Design Principle:** Every log entry is structured JSON with an `agent_action` field that tells an LLM exactly what to check next.

**Three-stream unified logging:**

```
📱 Mobile errors ──► WebSocket "log" channel ──► Backend stdout (JSON)
🖥️ Backend logs ──► stdout directly (JSON via structlog)
🤖 LLM call logs ──► stdout (prompt hash, tokens, latency, provider)

→ Everything lands in one `docker logs` stream
→ An AI agent runs `docker logs self-backend --tail 100` and sees EVERYTHING
```

**Mobile logging service (exists from commit 1):**

```typescript
// services/logger.ts
const log = (layer: string, event: string, context: Record<string, any>, severity = 'info') => {
  const entry = {
    ts: new Date().toISOString(),
    layer: `mobile:${layer}`,
    event,
    severity,
    context: { ...context, agent_action: context.agent_action ?? null }
  };
  console[severity === 'error' ? 'error' : 'log'](JSON.stringify(entry));
  ws.send(JSON.stringify({ type: 'log', payload: entry }));
};
```

**Backend logging (structlog JSON, exists from commit 1):**

```python
# app/logging.py — 20 lines, structured JSON to stdout
import structlog
structlog.configure(processors=[
    structlog.processors.TimeStamper(fmt="iso"),
    structlog.processors.JSONRenderer()
])
log = structlog.get_logger()
```

**SDUI ErrorBoundary with diagnostic:**

Every module renders inside an ErrorBoundary that catches failures and produces structured diagnostics with `agent_action` instructions. The user sees a fallback card; the AI agent sees exactly what broke and why.

**Error log contract:**

| Field | Purpose | Example |
|-------|---------|---------|
| `ts` | Timestamp (ISO 8601) | `2026-02-22T08:15:32.001Z` |
| `layer` | Source layer | `mobile:sdui`, `backend:agent`, `backend:ws` |
| `event` | What happened | `render_failure`, `llm_timeout`, `module_created` |
| `severity` | Level | `info`, `warn`, `error` |
| `context` | Structured details | Module ID, spec snapshot, error message |
| `agent_action` | Debug instruction for LLM | `"Check if spec.type 'chart' exists in primitive registry"` |

**No GUI debugging required:** Everything is debuggable via `docker logs self-backend --tail 200 | jq 'select(.severity == "error")'`. AI agents never need Xcode, Android Studio, or React DevTools.

### Development Workflow

```json
{
  "scripts": {
    "dev:mobile": "cd apps/mobile && pnpm expo start",
    "dev:backend": "cd apps/backend && uvicorn app.main:app --reload",
    "dev": "concurrently \"pnpm dev:mobile\" \"pnpm dev:backend\"",
    "schema:generate": "cd packages/module-schema && pnpm generate",
    "test:mobile": "cd apps/mobile && pnpm jest",
    "test:backend": "cd apps/backend && pytest",
    "logs": "docker logs self-backend --follow | jq ."
  }
}
```

**Note:** Project initialization using this structure should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Module Definition JSON Schema (Zod source of truth) — decided in step 3
- LLMProvider abstraction with 5 backends (3 CLI + 2 API)
- WebSocket message protocol (typed discriminated union)
- SDUI Primitive Registry pattern

**Important Decisions (Shape Architecture):**
- Single SQLite + SOUL.md file
- UUID session auth (not JWT)
- LLMResult with benchmarking metrics
- CLIProvider base class with health_check
- Module lifecycle state machine
- ErrorBoundary per-module isolation

**Deferred Decisions (Post-MVP):**
- Multi-user auth (OAuth, JWT migration)
- Intelligent LLM routing by task complexity
- REST API endpoints (for third-party integrations)
- Horizontal scaling strategy
- Push notification infrastructure (APNs/FCM)

### Data Architecture

**Database:** Single SQLite file (`self.db`) in WAL mode on backend. Separate expo-sqlite cache on mobile for offline rendering. The backend is the source of truth; the mobile cache is read-only, pushed via WebSocket.

**WAL checkpoint configuration (in `db.py` at connection):**

```python
# db.py — WAL tuning PRAGMAs, executed at every connection
await db.execute("PRAGMA wal_autocheckpoint = 1000;")    # checkpoint every ~4MB
await db.execute("PRAGMA journal_size_limit = 10485760;") # 10MB max WAL size
```

At backend startup:

```python
await db.execute("PRAGMA wal_checkpoint(TRUNCATE);")      # clean WAL on boot
```

These PRAGMAs are set in `db.py` at connection time, not in migration files.

**SOUL.md as file on disk:** The agent's identity document is a plain markdown file in the `data/` directory, not stored in SQLite. Rationale: human-readable via `cat`, versionable in git, injected directly into LLM prompts without serialization. No indirection layer needed.

**Schema (First Light minimal):**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `modules` | Module definitions + state | id, name, spec (JSON), status, vitality_score, created_at, updated_at |
| `memory_core` | Persistent key-value memory | id, key, value, category, created_at |
| `memory_episodic` | Vector-searchable episodes | id, content, embedding (sqlite-vec), module_id, created_at |
| `sessions` | Auth sessions | id, token, created_at, last_seen |
| `schema_version` | Migration tracking | version (integer) |
| `llm_usage` | LLM call cost tracking | id, provider, model, tokens_in, tokens_out, cost_estimate, created_at |

No `users` table in V1 — single-user architecture.

**Migrations:** No framework (no Alembic). A `migrations/` directory with numbered SQL files (`001_init.sql`, `002_add_vitality.sql`). A ~50-line Python script reads the current version from `schema_version` and applies missing files sequentially. First Light will have 2-3 migrations — a migration framework would add ceremony without value.

The migration script includes:
- Each migration wrapped in a transaction (`BEGIN` / `COMMIT`)
- Automatic backup before migration: `cp self.db self.db.backup-{timestamp}`
- On failure: transaction rollback + backup file preserved for manual recovery
- Flag `--dry-run` to display pending migrations without executing them

### Authentication & Security

**Session auth:** UUID v4 token generated on first mobile launch, stored in expo-secure-store. No JWT — unnecessary crypto complexity for a single-user self-hosted system.

**WebSocket authentication:** First message after connection: `{ type: "auth", token: "uuid-here" }`. Not via query parameter (visible in server logs) or header (inconsistent WS support on mobile). Backend verifies token against `sessions` table, creates entry if new.

**API key handling (BYOK):** Keys stored only in expo-secure-store on mobile. Sent to backend via authenticated WebSocket. Backend holds keys in memory for the session duration only — no persistent storage of user API keys on the server. If the backend restarts, the mobile resends keys on next `auth` message.

**Auth flow (First Light):**

1. Mobile generates UUID v4 on first launch → stored in SecureStore
2. WebSocket connection → first message `{ type: "auth", token: "..." }`
3. Backend verifies/creates session in `sessions` table
4. All subsequent messages are associated with this session
5. No token expiration in V1 — single user, single device

**Token regeneration (manual):**

- Message WS `{ type: "auth_reset" }` permet de regenerer le token de session
- L'ancien token est invalide immediatement dans la table `sessions`
- Le backend repond avec un nouveau token que le mobile stocke dans SecureStore
- Pas de rotation automatique en V1, mais la regeneration manuelle est disponible pour les cas de compromission suspectee

### API & Communication Patterns

**WebSocket-only protocol:** No REST endpoints in First Light. A single WebSocket endpoint (`/ws`) handles all communication via typed messages. Each message has a `type` discriminator and a `payload`.

**Note:** `GET /health` existe des First Light pour le healthcheck Docker. Retourne `{ "status": "ok", "providers": [...], "uptime": ... }`. Ce n'est pas une API REST — c'est un endpoint operationnel utilise uniquement par Docker healthcheck et le monitoring. Aucune logique applicative ne passe par cet endpoint.

**Message Protocol (First Light):**

| Direction | Type | Payload | Purpose |
|-----------|------|---------|---------|
| Client→Server | `auth` | `{ token }` | Session authentication |
| Client→Server | `auth_reset` | `{}` | Regenerate session token |
| Client→Server | `chat` | `{ message, context? }` | User message to agent |
| Client→Server | `module_action` | `{ module_id, action }` | Module interaction |
| Client→Server | `log` | `{ layer, event, severity, context }` | Mobile log forwarding |
| Client→Server | `sync` | `{ last_sync: "ISO" }` | Delta sync on reconnection |
| Server→Client | `chat_stream` | `{ delta, done }` | Streaming agent response |
| Server→Client | `module_created` | `{ module_spec }` | New module spec |
| Server→Client | `module_updated` | `{ module_id, spec }` | Module spec update |
| Server→Client | `module_list` | `{ modules[] }` | Full module list sync |
| Server→Client | `module_sync` | `{ modules[], last_sync }` | Delta sync response |
| Server→Client | `error` | `{ code, message, agent_action }` | Structured error |
| Server→Client | `warning` | `{ code, message }` | Non-blocking warnings (cost alerts, etc.) |
| Server→Client | `status` | `{ state, persona? }` | Agent state (idle/thinking/creating) + persona info |
| Server→Client | `usage_summary` | `{ daily, weekly, monthly }` | LLM cost summary |

**TypeScript contract (discriminated union):**

```typescript
type WSMessage =
  | { type: 'auth'; payload: { token: string } }
  | { type: 'auth_reset'; payload: Record<string, never> }
  | { type: 'chat'; payload: { message: string } }
  | { type: 'chat_stream'; payload: { delta: string; done: boolean } }
  | { type: 'module_created'; payload: ModuleSpec }
  | { type: 'module_updated'; payload: { module_id: string; spec: ModuleSpec } }
  | { type: 'module_list'; payload: { modules: ModuleSpec[] } }
  | { type: 'module_sync'; payload: { modules: ModuleSpec[]; last_sync: string } }
  | { type: 'sync'; payload: { last_sync: string } }
  | { type: 'error'; payload: { code: string; message: string; agent_action?: string } }
  | { type: 'warning'; payload: { code: string; message: string } }
  | { type: 'status'; payload: { state: AgentState; persona?: PersonaType } }
  | { type: 'usage_summary'; payload: { daily: number; weekly: number; monthly: number } }
```

TypeScript enforces exhaustive handling via `switch` on `type` — unhandled message types are compile-time errors.

**Streaming strategy:** Chat responses use `chat_stream` with incremental `delta` text and `done: true` for the final chunk. The Creation Ceremony uses `status` messages to animate the Orb through states: `thinking` → `discovering` → `composing` → `done`.

### Mobile Architecture (SDUI)

**Primitive Registry pattern:** A mapping of `type → Component`. The agent outputs a spec with `type: "metric"`, the renderer looks up `registry["metric"]` and renders the corresponding component. Unknown types fall back to `UnknownPrimitive` which displays the requested type and logs a structured error with `agent_action`.

```typescript
// components/sdui/registry.ts
const primitiveRegistry: Record<string, React.ComponentType<any>> = {
  metric: MetricPrimitive,
  list: ListPrimitive,
  text: TextPrimitive,
  status: StatusPrimitive,
  table: TablePrimitive,
};

export const getPrimitive = (type: string) =>
  primitiveRegistry[type] ?? UnknownPrimitive;
```

**First Light primitives (5 only):**

| Primitive | Purpose | Constraint |
|-----------|---------|------------|
| `metric` | Number + label + trend indicator | ~50 lines, pure RN |
| `list` | Ordered items with title | ~50 lines, pure RN |
| `text` | Formatted paragraph | ~50 lines, pure RN |
| `status` | Indicator with semantic color | ~50 lines, pure RN |
| `table` | Simple column/row grid | ~50 lines, pure RN |

Adding a primitive = one new file + one registry entry. Nothing else changes.

**Module lifecycle state machine:**

```
loading → active → refreshing → active
                 → stale → dormant → dead
                 → error (→ retry → active | → error_permanent)
```

State managed per-module in Zustand store. Transitions triggered by WebSocket events or refresh timers.

**Lifecycle triggers:**

| Transition | Trigger | Configurable |
|------------|---------|-------------|
| `active → stale` | 7 jours sans acces | `SELF_STALE_DAYS` (defaut 7) |
| `stale → dormant` | 30 jours sans acces | — |
| `dormant → dead` | 90 jours sans acces OU vitality_score = 0 | — |

**Vitality score formula:**

```
vitality = (acces_7j * 3 + acces_30j) / (age_jours * 0.1 + 1)
```

Normalise sur 0-100. Recalcul : cron backend quotidien a 03:00 UTC. Pas d'appel LLM — calcul purement numerique base sur les timestamps d'acces.

**Module isolation:** Every module renders inside an `ErrorBoundary`. A crashed module shows a fallback card with diagnostic info — other modules are unaffected. The ErrorBoundary produces structured logs with `agent_action` instructions for AI debuggers.

**Render errors vs Data errors:**

- **Render errors:** `ErrorBoundary` React autour de chaque module → affiche une fallback card avec diagnostic info. L'erreur de rendu ne crash que le module concerne.
- **Data errors:** `try/catch` dans `ModuleCard` autour du data fetching → etat "Donnees indisponibles" affiche dans la card sans crash du composant.
- Le `moduleStore` distingue ces deux cas via `dataStatus: 'ok' | 'stale' | 'error'`, distinct du lifecycle `status`. Un module peut etre `status: 'active'` mais `dataStatus: 'error'` si son dernier refresh a echoue.

### LLM Provider Architecture

**Multi-provider strategy with 5 backends:**

| Provider | Mode | Command / SDK | Output | Use Case |
|----------|------|---------------|--------|----------|
| `ClaudeCodeCLI` | CLI | `claude -p "prompt" --output-format json` | JSON stdout | First Light, personal use ($0 with Max subscription) |
| `CodexCLI` | CLI | `codex exec "prompt" --json` | JSONL stdout | Comparison, Claude alternative |
| `KimiCLI` | CLI | `kimi --print -p "prompt" --output-format=stream-json` | JSONL stream | Comparison, economic model |
| `AnthropicAPI` | API | Anthropic Python SDK | JSON response | MVP, BYOK distribution |
| `DeepSeekAPI` | API | OpenAI-compatible SDK | JSON response | Economic heartbeat routing |

**Provider interface:**

```python
@dataclass
class LLMResult:
    content: str
    provider: str
    model: str
    tokens_in: int | None
    tokens_out: int | None
    latency_ms: int
    cost_estimate: float | None

class LLMProvider(Protocol):
    name: str
    async def execute(self, prompt: str, tools: list | None = None) -> LLMResult: ...
    async def health_check(self) -> bool: ...
```

`LLMResult` instead of raw `str` — every call automatically logs provider, latency, token count, and estimated cost. After a week of usage, a `jq` query on logs produces a complete provider comparison.

**CLIProvider base class:** The 3 CLI providers (Claude, Codex, Kimi) share a common `CLIProvider` base that handles `asyncio.create_subprocess_exec`, timeout management, stdout parsing, and error fallback. Each subclass only overrides `_build_command()` and `_parse_output()` (~30-40 lines per provider).

**Health check:** `health_check()` verifies CLI availability (`which claude`, `which codex`, `which kimi`) or API key presence. On backend startup, available providers are logged. If the configured provider is unavailable → clear error with `agent_action: "Install claude CLI or change SELF_LLM_PROVIDER"`.

**Configuration:** Environment variable `SELF_LLM_PROVIDER=claude-cli` selects the active provider. No UI configuration in V1 — backend config only. Intelligent routing by task complexity (premium for creation, economic for heartbeat) is deferred to MVP.

#### Fallback & Retry Strategy

- **Retry:** 1 retry automatique avec backoff 2s sur timeout ou erreur transitoire (HTTP 429, 502, 503, 504, timeout). Pas de retry sur erreurs semantiques (400, 401, prompt invalide).
- **Pas de fallback automatique entre providers en V1.** Si le provider configure echoue, l'erreur est remontee a l'utilisateur. Le fallback chain configurable (ex: claude-cli → deepseek-api) est un deferred MVP.
- **Circuit breaker:** apres 3 echecs consecutifs en 5 minutes, le provider est marque `unhealthy` pendant 60 secondes. Pendant cette periode, toute tentative retourne immediatement une erreur avec `agent_action: "Provider {name} is unhealthy. Check logs or change SELF_LLM_PROVIDER"`. Un message `warning` est envoye au mobile via WebSocket.
- **Deferred MVP:** fallback chain configurable (`SELF_LLM_FALLBACK=deepseek-api`), rotation automatique sur provider unhealthy.

#### Cost Protection

- **Rate limit:** max 10 appels LLM par minute par session (configurable via `SELF_LLM_RATE_LIMIT`). Au-dela, les appels sont rejetes avec `error` code `LLM_RATE_LIMITED` et `agent_action: "Rate limit exceeded. Wait or increase SELF_LLM_RATE_LIMIT"`.
- **Budget tracking:** `cost_estimate` cumule en memoire par session, logue toutes les heures via structlog (`event: "llm_cost_hourly"`, `context: { session_cost, daily_cost }`).
- **Alerte:** seuil configurable `SELF_LLM_COST_ALERT` (defaut $5/jour). Quand le cout quotidien depasse ce seuil, un warning est logue et envoye au mobile via message WS `warning` (`code: "LLM_COST_ALERT"`).
- **Pas de hard stop en V1** — l'alerte est informative, pas bloquante. Le hard cap est un deferred MVP.
- **Persistance:** chaque appel LLM est enregistre dans la table `llm_usage` par `agent.py`. Le message WS `usage_summary` retourne le cout agrege par jour/semaine/mois.

### Infrastructure & Deployment

**Docker Compose (single service):**

```yaml
services:
  backend:
    build: ./apps/backend
    ports: ["8000:8000"]
    volumes: ["./data:/app/data"]
    environment:
      - SELF_LLM_PROVIDER=claude-cli
      - SELF_LOG_LEVEL=info
```

No separate database service — SQLite is a file in the `data/` volume. The mobile runs outside Docker (Expo dev server or native build).

**Dev vs Prod:** Same Docker image, different environment variables. Dev uses `uvicorn --reload`; prod uses a single worker (sufficient for single-user). No Kubernetes, no Terraform — `docker compose up -d` on a Raspberry Pi is the entire deployment.

**Backup/restore:** Copy the `data/` directory (SQLite + SOUL.md). Restore = paste the `data/` directory. No database dump tooling needed.

**CI (minimal):** GitHub Action running `pytest` + `pnpm test` + `pnpm tsc --noEmit`. No automated deployment in V1 — the user runs `git pull && docker compose up -d --build` on their target machine.

### Decision Impact Analysis

**Implementation Sequence:**

1. Module Definition Schema (Zod) — unlocks everything
2. WebSocket message protocol + basic backend (`main.py`)
3. LLMProvider abstraction with ClaudeCodeCLI
4. SDUI Primitive Registry (5 primitives)
5. Module lifecycle state machine
6. Session auth (UUID)
7. Structured logging (mobile → backend)
8. Additional CLI providers (Codex, Kimi)

**Cross-Component Dependencies:**

- Schema → drives both agent output validation (Python/Pydantic) and renderer type safety (TypeScript/Zod)
- WebSocket protocol → used by chat, module updates, logging, auth — changes affect every layer
- LLMProvider → isolated behind Protocol — swapping providers affects zero upstream code
- Primitive Registry → isolated per-component — adding primitives affects zero existing code
- Module state machine → depends on WebSocket events and refresh scheduling

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**15 conflict points identified** where AI agents could make different implementation choices. These rules ensure all agents (Claude Code, Codex, Kimi, or human) produce compatible, consistent code.

### Naming Patterns

**Cross-Stack Boundary Rule (Python ↔ TypeScript):**

| Context | Convention | Example |
|---------|-----------|---------|
| Python code | `snake_case` | `vitality_score`, `created_at` |
| TypeScript code | `camelCase` | `vitalityScore`, `createdAt` |
| SQLite columns | `snake_case` | `vitality_score`, `module_id` |
| SQLite tables | `snake_case` plural | `modules`, `sessions`, `memory_core` |
| JSON over WebSocket | `snake_case` | `{ "module_id": "...", "vitality_score": 42 }` |
| Zod schema fields | `camelCase` | Source of truth, converted at boundaries |
| WebSocket message types | `snake_case` | `chat_stream`, `module_created` |
| Environment variables | `SCREAMING_SNAKE` | `SELF_LLM_PROVIDER`, `SELF_LOG_LEVEL` |
| Error codes | `SCREAMING_SNAKE` | `MODULE_CREATION_FAILED`, `LLM_TIMEOUT` |

**Boundary conversion:** JSON on the WebSocket is always `snake_case`. The mobile converts to `camelCase` on receipt via a `toCamel()` helper (single conversion point, single direction). Python Pydantic models use `snake_case` internally with `model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)` for schema compatibility.

**File and Component Naming:**

| Context | Convention | Example |
|---------|-----------|---------|
| React components | PascalCase file + export | `MetricPrimitive.tsx`, `ModuleCard.tsx` |
| TypeScript services/utils | camelCase file | `logger.ts`, `wsClient.ts` |
| TypeScript types/interfaces | PascalCase | `ModuleSpec`, `AgentState`, `LLMResult` |
| Python modules | snake_case | `base.py`, `modules.py`, `ws_handler.py` |
| Python classes | PascalCase | `ClaudeCodeCLI`, `LLMProvider` |
| Test files (TS) | `*.test.ts` co-located | `MetricPrimitive.test.tsx` next to `MetricPrimitive.tsx` |
| Test files (Python) | `tests/test_*.py` | `tests/test_llm.py`, `tests/test_modules.py` |
| TS directories | kebab-case | `module-schema/`, `sdui/` |
| Python directories | snake_case | `memory_core/` |

### Import & Export Patterns

**Import aliases (mandatory from commit 1):**

```json
// tsconfig.json paths
{
  "paths": {
    "@self/module-schema": ["../../packages/module-schema/src"],
    "@/components/*": ["./components/*"],
    "@/services/*": ["./services/*"],
    "@/stores/*": ["./stores/*"],
    "@/hooks/*": ["./hooks/*"],
    "@/types/*": ["./types/*"],
    "@/utils/*": ["./utils/*"]
  }
}
```

**Rules:**
- Never use relative paths crossing package boundaries (`../../packages/` is forbidden)
- Always use `@self/` for cross-package imports, `@/` for intra-app imports
- Barrel exports per sub-folder only (`sdui/index.ts`, `shell/index.ts`), never a global `components/index.ts`

**Component export pattern:**

```typescript
// Each primitive exports its props type alongside the component
export interface MetricPrimitiveProps {
  label: string;
  value: number;
  trend?: 'up' | 'down' | 'flat';
}
export const MetricPrimitive: React.FC<MetricPrimitiveProps> = ({ ... }) => { ... };
```

No `props: any`. No `Record<string, unknown>` on concrete components. The registry uses `React.ComponentType<any>` but each component is strictly typed.

### Structure Patterns

**Mobile project organization:**

```
apps/mobile/
├── app/                    # Expo Router (pages only, minimal logic)
│   ├── index.tsx           # Entry point
│   └── _layout.tsx         # Root layout
├── components/
│   ├── shell/              # Static UI (Orb, ChatInput)
│   ├── bridge/             # ModuleCard, CreationCeremony
│   └── sdui/               # Primitive registry + all primitives
│       ├── index.ts        # Barrel export for sdui/
│       ├── registry.ts
│       ├── MetricPrimitive.tsx
│       ├── MetricPrimitive.test.tsx
│       └── UnknownPrimitive.tsx
├── services/               # Singletons (logger, wsClient, auth)
├── stores/                 # Zustand stores (one per domain)
├── hooks/                  # Custom React hooks
├── types/                  # TypeScript type definitions
└── utils/                  # Pure functions, helpers (toCamel, etc.)
```

**Rules:**
- `app/` contains only Expo Router pages with minimal logic. Any agent adding business logic to `app/` files is making an error.
- Tests are co-located with their source files (`MetricPrimitive.test.tsx` next to `MetricPrimitive.tsx`)

**Backend project organization:**

```
apps/backend/
├── app/
│   ├── main.py             # FastAPI app + WS endpoint
│   ├── llm/                # LLMProvider — exception to flat structure (5+ polymorphic impls)
│   │   ├── __init__.py     # Re-exports LLMProvider, get_provider()
│   │   ├── base.py         # LLMProvider Protocol + CLIProvider base + LLMResult
│   │   ├── cli_claude.py   # ClaudeCodeCLI
│   │   ├── cli_codex.py    # CodexCLI
│   │   ├── cli_kimi.py     # KimiCLI
│   │   ├── api_anthropic.py # AnthropicAPI
│   │   └── api_deepseek.py  # DeepSeekAPI
│   ├── modules.py          # Module CRUD
│   ├── memory.py           # Memory system
│   ├── agent.py            # Agent orchestration (prompt assembly, tool routing)
│   ├── logging.py          # structlog config
│   ├── db.py               # SQLite connection + migration runner
│   └── models.py           # Pydantic models
├── migrations/
│   ├── 001_init.sql
│   └── ...
├── tests/
│   ├── test_llm.py
│   ├── test_modules.py
│   └── conftest.py         # Shared fixtures
├── data/                   # Runtime data (gitignored)
│   ├── self.db
│   ├── SOUL.md
│   └── personas/           # Persona instruction files
│       ├── flame.md
│       ├── tree.md
│       └── star.md
└── pyproject.toml
```

**Rules:**
- Flat structure — no sub-packages (`app/providers/`, `app/handlers/`). `app/` is a flat module. **Exception unique :** `app/llm/` est un sous-repertoire car il contient 5+ implementations polymorphiques du meme Protocol (`LLMProvider`). Un seul fichier `llm.py` depasserait largement 300 lignes. Cette exception ne cree pas de precedent — aucun autre module ne justifie un sous-repertoire pour First Light.
- If a file exceeds 300 lines, split it — but do not create sub-directories (except `llm/`).
- Tests live in `tests/` directory with `test_` prefix.

### Async-Only Python Rule

**Zero synchronous blocking imports in `app/`:**

| Forbidden | Required Alternative |
|-----------|---------------------|
| `import requests` | `import httpx` (async client) |
| `import sqlite3` | `import aiosqlite` |
| `subprocess.run()` | `asyncio.create_subprocess_exec()` |
| `time.sleep()` | `asyncio.sleep()` |

The entire backend is async (FastAPI). Any synchronous blocking call will freeze the event loop and block all WebSocket connections. Ruff's `ASYNC` rules enforce this automatically.

### Format Patterns

**WebSocket message format (invariant):**

```json
{ "type": "string", "payload": { ... } }
```

Every message follows this exact structure. No variations, no exceptions.

**Error format:**

```json
{
  "type": "error",
  "payload": {
    "code": "MODULE_CREATION_FAILED",
    "message": "LLM timeout after 30s",
    "agent_action": "Check LLM provider health: run 'which claude' or check SELF_LLM_PROVIDER",
    "context": { "module_name": "Weather", "provider": "claude-cli" }
  }
}
```

Error code prefixes: `AUTH_*`, `MODULE_*`, `LLM_*`, `WS_*`, `SCHEMA_*`.

**Date and ID formats:**

| Data | Format | Example |
|------|--------|---------|
| Dates (JSON/DB) | ISO 8601 UTC | `2026-02-22T10:30:00Z` |
| Dates (display) | Localized on mobile | `il y a 2h`, `22 fév.` |
| IDs | UUID v4 | `550e8400-e29b-41d4-a716-446655440000` |

UUIDs are always generated server-side. The mobile never generates IDs.

### Communication Patterns

**Zustand store conventions:**

```typescript
interface ModuleStore {
  // State (nouns)
  modules: Map<string, ModuleState>;

  // Actions (imperative verbs)
  addModule: (spec: ModuleSpec) => void;
  updateModule: (id: string, spec: Partial<ModuleSpec>) => void;
  setModuleStatus: (id: string, status: LifecycleStatus) => void;
  removeModule: (id: string) => void;

  // Selectors (get + descriptive noun)
  getModule: (id: string) => ModuleState | undefined;
  getActiveModules: () => ModuleState[];
}
```

**Rules:**
- Actions = imperative verbs (`add`, `update`, `set`, `remove`)
- Selectors = `get` + descriptive noun
- State = nouns (never `isLoading: boolean` → use a status enum)
- One store per domain: `moduleStore`, `chatStore`, `connectionStore`, `authStore`
- No global store — each store is independent

**WebSocket reconnection pattern (mandatory):**

```
connect → auth → ready
  ↓ (disconnect)
wait(backoff) → reconnect → auth → ready
```

Exponential backoff: 1s, 2s, 4s, max 30s. The `connectionStore` manages status: `disconnected | connecting | connected | reconnecting`. UI shows a discreet indicator.

**Message queue during disconnection:**

```typescript
// services/wsClient.ts
const pendingMessages: WSMessage[] = [];

const send = (msg: WSMessage) => {
  if (connectionStore.getState().status === 'connected') {
    ws.send(JSON.stringify(toSnake(msg)));
  } else {
    pendingMessages.push(msg);
  }
};

// On reconnect, flush pending
const onReconnect = () => {
  pendingMessages.forEach(msg => ws.send(JSON.stringify(toSnake(msg))));
  pendingMessages.length = 0;
};
```

No messages are sent while disconnected — they are queued and flushed on reconnection.

### Process Patterns

**Error handling:**

Backend Python — always log before sending error to client:

```python
log.error("module_creation_failed",
    module_name=name,
    provider=provider.name,
    error=str(e),
    agent_action="Check LLM provider logs for timeout or rate limit")
await ws.send_json({
    "type": "error",
    "payload": {"code": "MODULE_CREATION_FAILED", "message": str(e), ...}
})
```

Mobile TypeScript — errors routed to store, never swallowed:

```typescript
ws.onMessage((msg) => {
  if (msg.type === 'error') {
    logger.error('ws', msg.payload.code, msg.payload);
    errorStore.addError(msg.payload);
  }
});
```

**Absolute rule:** Never `catch (e) {}` empty. Never `console.log(e)` without structure. Everything goes through the structured logger.

**Loading states — status enums, never booleans:**

```typescript
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
type AgentStatus = 'idle' | 'thinking' | 'discovering' | 'composing';
type ModuleStatus = 'loading' | 'active' | 'refreshing' | 'stale' | 'dormant' | 'error';
```

An AI agent must never introduce an `isLoading: boolean` — it is always a status enum.

### Test Patterns

| Aspect | TypeScript | Python |
|--------|-----------|--------|
| Framework | Jest (included with Expo) | pytest |
| Location | Co-located `*.test.tsx` | `tests/test_*.py` |
| Naming | `describe('MetricPrimitive')` + `it('renders value')` | `test_metric_creation()` |
| Fixtures | Factory functions in `__tests__/fixtures/` | `conftest.py` with `@pytest.fixture` |
| Mocks | `jest.mock()` for services | `pytest-mock` with `mocker.patch()` |
| Coverage | No minimum threshold for First Light | No minimum threshold for First Light |

**Test factory pattern (mandatory for module specs):**

```typescript
// __tests__/fixtures/moduleSpec.ts
export const createTestModuleSpec = (overrides?: Partial<ModuleSpec>): ModuleSpec => ({
  id: 'test-module-1',
  type: 'metric',
  name: 'Test Module',
  ...overrides,
});
```

Agents writing tests must use shared factories instead of inventing JSON fixtures inline.

### Linting Enforcement

**TypeScript (ESLint):**
- `no-restricted-imports`: forbid relative cross-package paths (`../../packages/`)
- `no-explicit-any`: strict (except registry)
- `@typescript-eslint/switch-exhaustiveness-check`: force handling all discriminated union types
- `noUncheckedIndexedAccess`: enabled in tsconfig

**Python (Ruff):**
- `ASYNC` rules: detect sync blocking calls in async context
- `I` (isort): enforce import ordering
- `N` (pep8-naming): enforce snake_case
- `pytest --strict-markers`: forbid undeclared markers

**Not automatable (enforced via CLAUDE.md):**
- Structured logs with `agent_action` field on every error
- UUIDs generated server-side only
- Status enums instead of booleans
- Factory functions for test fixtures

## Project Structure & Boundaries

### Complete Project Directory Structure (First Light)

```
self-app/
├── .github/
│   └── workflows/
│       └── ci.yml                    # pytest + pnpm test + tsc --noEmit
├── apps/
│   ├── mobile/                       # Expo SDK 54, RN 0.81, React 19.1
│   │   ├── app/                      # Expo Router — pages only, minimal logic
│   │   │   ├── _layout.tsx           # Root layout (Orb, connection status)
│   │   │   └── index.tsx             # Single screen (Direction D)
│   │   ├── components/
│   │   │   ├── shell/                # Static UI — always visible
│   │   │   │   ├── Orb.tsx           # Pulsing brand mark + agent state
│   │   │   │   ├── ChatInput.tsx     # Message input
│   │   │   │   ├── ChatBubble.tsx    # Agent/user messages
│   │   │   │   └── index.ts
│   │   │   ├── bridge/               # Lifecycle-aware wrappers
│   │   │   │   ├── ModuleCard.tsx    # Module container + ErrorBoundary
│   │   │   │   ├── CreationCeremony.tsx  # Module birth animation
│   │   │   │   └── index.ts
│   │   │   └── sdui/                 # Dynamic primitives
│   │   │       ├── registry.ts       # type → Component mapping
│   │   │       ├── MetricPrimitive.tsx
│   │   │       ├── MetricPrimitive.test.tsx
│   │   │       ├── ListPrimitive.tsx
│   │   │       ├── ListPrimitive.test.tsx
│   │   │       ├── TextPrimitive.tsx
│   │   │       ├── TextPrimitive.test.tsx
│   │   │       ├── StatusPrimitive.tsx
│   │   │       ├── StatusPrimitive.test.tsx
│   │   │       ├── TablePrimitive.tsx
│   │   │       ├── TablePrimitive.test.tsx
│   │   │       ├── UnknownPrimitive.tsx
│   │   │       └── index.ts
│   │   ├── services/                 # Singletons
│   │   │   ├── logger.ts             # Structured JSON → WS to backend
│   │   │   ├── wsClient.ts           # WebSocket + reconnection + message queue
│   │   │   └── auth.ts               # UUID token management (SecureStore)
│   │   ├── stores/                   # Zustand — one per domain
│   │   │   ├── moduleStore.ts        # Module specs, lifecycle state, dataStatus
│   │   │   ├── chatStore.ts          # Chat messages, streaming state
│   │   │   ├── connectionStore.ts    # WS status, reconnection
│   │   │   ├── authStore.ts          # Session token, API keys
│   │   │   └── errorStore.ts         # Error accumulation for UI
│   │   ├── hooks/                    # Custom React hooks
│   │   │   └── useModuleLifecycle.ts # Module state transitions
│   │   ├── types/                    # TypeScript type definitions
│   │   │   ├── ws.ts                 # WSMessage discriminated union
│   │   │   └── module.ts             # ModuleState, LifecycleStatus, AgentState
│   │   ├── utils/                    # Pure functions
│   │   │   ├── toCamel.ts            # snake_case → camelCase converter
│   │   │   ├── toSnake.ts            # camelCase → snake_case converter
│   │   │   └── toCamel.test.ts
│   │   ├── __tests__/
│   │   │   └── fixtures/
│   │   │       └── moduleSpec.ts     # createTestModuleSpec() factory
│   │   ├── app.json                  # Expo config
│   │   ├── metro.config.js           # pnpm monorepo symlink resolution
│   │   ├── tsconfig.json             # Strict max + path aliases
│   │   ├── jest.config.js
│   │   ├── .eslintrc.js              # no-restricted-imports, no-explicit-any, switch-exhaustiveness
│   │   └── package.json
│   │
│   └── backend/                      # Python 3.14, FastAPI
│       ├── app/
│       │   ├── main.py               # FastAPI app + /ws endpoint + /health + startup
│       │   ├── llm/                   # LLMProvider — documented exception to flat structure
│       │   │   ├── __init__.py        # Re-exports LLMProvider, get_provider()
│       │   │   ├── base.py            # LLMProvider Protocol + CLIProvider base + LLMResult
│       │   │   ├── cli_claude.py      # ClaudeCodeCLI implementation
│       │   │   ├── cli_codex.py       # CodexCLI implementation
│       │   │   ├── cli_kimi.py        # KimiCLI implementation
│       │   │   ├── api_anthropic.py   # AnthropicAPI implementation
│       │   │   └── api_deepseek.py    # DeepSeekAPI implementation
│       │   ├── modules.py            # Module CRUD (create, list, update, delete)
│       │   ├── memory.py             # 4-layer memory (core + episodic + sqlite-vec)
│       │   ├── agent.py              # Agent orchestration (prompt assembly, tool routing, LLM usage tracking)
│       │   ├── logging.py            # structlog JSON config
│       │   ├── db.py                 # SQLite connection + migration runner + WAL PRAGMAs
│       │   ├── models.py             # Pydantic models (LLMResult, ModuleSpec, etc.)
│       │   └── config.py             # Settings from env vars (SELF_LLM_PROVIDER, etc.)
│       ├── migrations/
│       │   └── 001_init.sql          # modules, memory_core, memory_episodic, sessions, schema_version, llm_usage
│       ├── tests/
│       │   ├── conftest.py           # Shared fixtures (test DB, mock LLM provider)
│       │   ├── test_llm.py           # LLMProvider implementations
│       │   ├── test_modules.py       # Module CRUD
│       │   ├── test_ws.py            # WebSocket message protocol
│       │   └── test_memory.py        # Memory system
│       ├── data/                     # Runtime data (gitignored)
│       │   ├── self.db               # SQLite database
│       │   ├── SOUL.md               # Agent identity document
│       │   └── personas/             # Persona instruction files
│       │       ├── flame.md          # Bold, proactive, brief
│       │       ├── tree.md           # Calm, thorough, detailed
│       │       └── star.md           # Curious, creative, exploratory
│       ├── pyproject.toml            # uv config, ruff config, pytest config
│       └── Dockerfile
│
├── packages/
│   └── module-schema/                # Shared contract — JSON Schema source of truth
│       ├── src/
│       │   ├── moduleSpec.ts         # Zod schema (THE source of truth) + schemaVersion
│       │   ├── primitives.ts         # Zod schemas per primitive type
│       │   └── index.ts              # Barrel export + CURRENT_SCHEMA_VERSION
│       ├── generated/
│       │   ├── schema.json           # Auto-generated JSON Schema
│       │   └── models.py             # Auto-generated Pydantic models
│       ├── scripts/
│       │   └── generate.ts           # zod-to-json-schema + datamodel-code-generator
│       ├── tsconfig.json
│       └── package.json
│
├── pnpm-workspace.yaml               # apps/*, packages/*
├── package.json                       # Root scripts: dev, dev:mobile, dev:backend, schema:generate
├── docker-compose.yml                 # Backend service + data volume
├── .gitignore                         # data/, node_modules/, .env, __pycache__
├── .env.example                       # SELF_LLM_PROVIDER, SELF_LOG_LEVEL, SELF_LLM_RATE_LIMIT, SELF_LLM_COST_ALERT
└── CLAUDE.md                          # AI agent rules (patterns from step 5)
```

### Architectural Boundaries

**API Boundary (WebSocket `/ws`):**

```
┌─────────────┐         WebSocket          ┌─────────────┐
│   Mobile    │ ◄──────────────────────►    │   Backend   │
│  (Expo RN)  │    typed messages only      │  (FastAPI)  │
│             │    snake_case JSON          │             │
└─────────────┘                            └─────────────┘
       │                                          │
       │ reads from                               │ reads/writes
       ▼                                          ▼
  expo-sqlite                              self.db (SQLite)
  (cache only)                             SOUL.md (file)
```

The WebSocket is the only communication channel. No REST, no direct DB access from mobile. All data flows through typed messages.

**Component Boundaries (Mobile):**

```
Shell (static, always rendered)
  ├── Orb ← reads connectionStore + chatStore (agent status)
  ├── ChatInput → sends 'chat' WS message
  └── ChatBubble ← reads chatStore

Bridge (lifecycle-aware)
  ├── ModuleCard ← reads moduleStore per module
  │   ├── ErrorBoundary (catches SDUI crashes)
  │   └── renders getPrimitive(spec.type)
  └── CreationCeremony ← reads chatStore (status messages)

SDUI (pure, stateless)
  └── Primitives receive props, render, nothing else
```

Rules:
- Shell components talk to stores, never to each other
- Bridge components own lifecycle logic, delegate rendering to SDUI
- SDUI primitives are pure — props in, JSX out, no side effects

**Service Boundaries (Backend):**

```
main.py (WebSocket handler + /health endpoint)
  ├── routes messages by type
  ├── auth check on every message
  │
  ├── chat → agent.py (prompt assembly)
  │            └── llm/ (provider.execute())
  │                 └── returns LLMResult → agent.py inserts into llm_usage
  │
  ├── module_action → modules.py (CRUD)
  │                     └── db.py (SQLite)
  │
  ├── sync → modules.py (delta query by updated_at)
  │
  └── log → logging.py (forward to stdout)
```

Rules:
- `main.py` is the only file that touches the WebSocket object
- `agent.py` orchestrates prompts — it calls `llm/` and `memory.py`, never the DB directly
- `modules.py` and `memory.py` talk to `db.py`, never to each other
- `llm/` is isolated behind the Protocol — zero knowledge of modules, memory, or WebSocket

**Data Boundaries:**

| Boundary | Owner | Access Pattern |
|----------|-------|---------------|
| `self.db` | `db.py` | All DB access goes through `db.py` functions |
| `SOUL.md` | `agent.py` | Read on prompt assembly, written via dedicated function |
| expo-sqlite cache | `moduleStore` | Written on WS receipt, read for offline rendering |
| SecureStore | `auth.ts` | API keys + session token only |
| `data/personas/*.md` | `agent.py` | Read-only persona instruction files |

### Memory Architecture

This section details the 4-layer memory system referenced throughout the architecture.

**SOUL (Identity):**
- Fichier `data/SOUL.md` sur disque
- Injecte integralement dans chaque prompt LLM par `agent.py`
- Modifie par l'agent lui-meme via une fonction dediee dans `agent.py` (ex: apres une phase d'onboarding)
- Pas en base de donnees — fichier plat, lisible via `cat`, versionnable

**Core (Key-Value persistant):**
- Table `memory_core` : `id, key, value, category, created_at`
- Stocke les preferences, faits appris, configurations de l'agent (ex: `persona_type`, `user_timezone`, `preferred_language`)
- Lu par `agent.py` au moment de l'assemblage du prompt
- CRUD via `memory.py`

**Semantic (Vue vectorielle):**
- PAS une table separee — vue vectorielle sur `memory_episodic` via sqlite-vec (similarite cosinus)
- Permet la recherche semantique sur les episodes passes
- Utilise pour l'anti-repetition et la contextualisation

**Episodic (Interactions):**
- Table `memory_episodic` : `id, content, embedding (sqlite-vec FLOAT[384]), module_id, created_at`
- Stocke les interactions significatives (pas chaque message — seulement les evenements importants decides par l'agent)
- Embeddings generes localement

**Pipeline anti-repetition (< 50ms total, pas d'appel LLM):**
1. **Embedding local leger** : all-MiniLM-L6-v2 quantise (~30ms par embedding). Modele charge en memoire au demarrage du backend.
2. **Recherche vectorielle top-5** via sqlite-vec : `<` 5ms pour 10K entrees.
3. **Seuil de similarite** : si cosine similarity > 0.85, le contexte des episodes similaires est injecte dans le prompt pour que le LLM evite la repetition.
4. Total : < 50ms. Zero appel LLM dans ce pipeline.

### Persona Engine

- Persona stockee dans `memory_core` avec la cle `persona_type` (valeurs : `flame`, `tree`, `star`)
- `agent.py` lit la persona courante et injecte les instructions depuis `data/personas/{type}.md`
- Chaque fichier persona definit : verbosity level, confirmation threshold, autonomy level, message length preferences
- La persona est transmise au mobile via le message `status` enrichi (`persona` field) pour adapter l'UI (couleurs, animations de l'Orb)
- Changement de persona : via conversation avec l'agent, qui met a jour `memory_core` et recharge les instructions

### Requirements to Structure Mapping

**FR Category → Files:**

| FR Category | Backend Files | Mobile Files | Schema Files |
|-------------|--------------|-------------|-------------|
| Conversation & Onboarding (FR1-8, FR54) | `agent.py`, `memory.py` | `ChatInput.tsx`, `ChatBubble.tsx`, `chatStore.ts` | — |
| Module Creation (FR9-16) | `agent.py`, `modules.py`, `llm/` | `CreationCeremony.tsx`, `moduleStore.ts` | `moduleSpec.ts`, `primitives.ts` |
| Module Rendering (FR17-22) | — | `registry.ts`, all `*Primitive.tsx`, `ModuleCard.tsx` | `primitives.ts` |
| Module Lifecycle (FR23-28) | `modules.py` (vitality scoring) | `useModuleLifecycle.ts`, `moduleStore.ts` | — |
| Agent Memory (FR29-33) | `memory.py`, `agent.py` | — | — |
| Data Sources & Auth (FR34-39) | `llm/`, `config.py` | `auth.ts`, `authStore.ts` | — |
| Proactive Behavior (FR40-45) | `agent.py` (heartbeat, deferred to MVP) | — (push notifications deferred) | — |
| Configuration (FR46-52, FR55) | `config.py`, `main.py` | — | — |
| Safety & Reversibility (FR53) | `modules.py` (action journal, deferred) | — | — |
| Persona (FR54) | `agent.py`, `data/personas/*.md`, `memory.py` (`memory_core`) | `Orb.tsx` (persona-driven animation) | — |

**Cross-Cutting Concerns → Files:**

| Concern | Files |
|---------|-------|
| Structured logging | `logging.py` (backend), `logger.ts` (mobile), `main.py` (log forwarding) |
| Error handling | `ModuleCard.tsx` (ErrorBoundary), `errorStore.ts`, `models.py` (error codes) |
| Auth | `auth.ts`, `authStore.ts`, `main.py` (auth message handler), `db.py` (sessions table) |
| Schema contract | `packages/module-schema/` → consumed by both `models.py` and `registry.ts` |
| WS reconnection | `wsClient.ts`, `connectionStore.ts` |
| Cost tracking | `llm/` (LLMResult), `agent.py` (llm_usage insert), `main.py` (usage_summary handler) |

### Data Flow

**Module Creation Flow:**

```
User types "Show me the weather"
  → ChatInput → wsClient.send({ type: 'chat', payload: { message: '...' } })
  → Backend main.py receives, routes to agent.py
  → agent.py assembles prompt (SOUL.md + persona instructions + memory + user message)
  → agent.py calls llm/ provider.execute(prompt)
  → LLM returns module spec JSON
  → agent.py validates against Pydantic ModuleSpec model
  → agent.py inserts LLM usage into llm_usage table
  → modules.py saves to self.db
  → main.py sends { type: 'module_created', payload: spec }
  → Mobile wsClient receives, toCamel() converts
  → moduleStore.addModule(spec)
  → ModuleCard renders, registry.getPrimitive(spec.type) → MetricPrimitive
```

**Offline Flow:**

```
App opens without backend connection
  → connectionStore.status = 'connecting'
  → moduleStore loads from expo-sqlite cache
  → UI renders cached modules (read-only, no refresh)
  → When backend available → connectionStore.status = 'connected'
  → pendingMessages flushed
  → Backend sends module_list with latest specs
  → moduleStore + expo-sqlite cache updated
```

#### Sync Protocol

**Delta sync on reconnection:**

- Chaque module a un champ `updated_at` (timestamp ISO 8601)
- A la reconnexion, le mobile envoie : `{ type: "sync", payload: { last_sync: "2026-02-22T10:30:00Z" } }`
- Le backend repond avec uniquement les modules modifies depuis `last_sync` : `{ type: "module_sync", payload: { modules: [...], last_sync: "..." } }`
- Si `last_sync` est `null` ou absent : full sync (equivalent a `module_list`)
- Le mobile stocke `last_sync` dans le `connectionStore` et le met a jour a chaque reception de `module_sync` ou `module_list`

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices work together without conflicts. Expo SDK 54 + RN 0.81 + React 19.1 + Zustand 5 are compatible. Python 3.14 + FastAPI + aiosqlite + structlog form a cohesive async stack. pnpm monorepo with Metro config handles symlinks correctly. 5 CLI/API providers behind a single Protocol follow Clean Architecture.

**Pattern Consistency:** `snake_case` on the wire + `camelCase` in TS + `snake_case` in Python with a single conversion point. Structured JSON logging on both sides with `agent_action`. Discriminated union TS + typed message protocol enable exhaustive compile-time checking. Status enums everywhere (never booleans) — consistent across stores, backend state, and WS protocol.

**Structure Alignment:** The project tree (step 6) maps exactly to decisions (step 4) and patterns (step 5). Backend boundaries (`main.py` sole WS handler, `agent.py` orchestration, `llm/` isolation) are respected in structure. Mobile boundaries (Shell/Bridge/SDUI) map cleanly to the component tree.

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**

| Phase | Total FRs | Covered | Gaps |
|-------|-----------|---------|------|
| First Light (⚡) | 15 | 14 | FR49 QR pairing → requalified to MVP |
| MVP (🚀) | 16 | 15 | FR53 undo → action_journal table in MVP |
| Growth (📈) | 24 | 24 | All deferred by design, architecture supports future implementation |

**Non-Functional Requirements Coverage:**

| Domain | Total | Covered | Notes |
|--------|-------|---------|-------|
| Performance (NFR1-9) | 9 | 9 | Cache-first, streaming, reconnection backoff all architecturally supported |
| Security (NFR10-17) | 8 | 7 | NFR12 token rotation: manual regeneration available, auto-rotation deferred |
| Reliability (NFR18-22) | 5 | 5 | ErrorBoundary, message queue, stateless heartbeat |
| Integration (NFR23-26) | 4 | 3 | NFR25-26 push/OAuth correctly deferred to P1 |
| Scalability (NFR27-29) | 3 | 2 | NFR29 resolved via user_id column (see gap resolution) |
| Accessibility (NFR30-33) | 4 | 4 | Native RN primitives support Dynamic Type, screen readers natively |

### Gap Analysis Results

**4 gaps identified, all resolved:**

**Gap #1 — Primitive names vs. PRD (resolved):**
PRD FR18 lists "Card, List, Text, Metric, Layout" for First Light. Architecture defines 5 SDUI primitives: `metric`, `list`, `text`, `status`, `table`. Resolution: `Card` in the PRD = the `ModuleCard` bridge wrapper (not a SDUI primitive). `Layout` is implicit in the module spec JSON structure. The 5 architecture primitives are the content types inside the card. PRD and architecture are compatible — vocabulary differs but concepts align.

**Gap #2 — NFR29 multi-user schema readiness (resolved):**
PRD requires `user_id` from day one. Architecture said "no users table in V1." Resolution: Add `user_id TEXT DEFAULT 'default'` to all tables (`modules`, `memory_core`, `memory_episodic`). No `users` table in V1, but the column exists so V2 only needs to add the `users` table and populate the field. Zero added complexity — just an ignored column in V1.

**Gap #3 — FR53 undo system (resolved):**
FR53 (🚀 MVP) requires undo within 60 seconds. Resolution: Not in First Light. For MVP, add an `action_journal` table: `id, action_type, payload_before, payload_after, created_at`. Undo = restore `payload_before`. Entries older than 60 seconds are purged. Simple, no framework needed.

**Gap #4 — FR49 QR pairing (resolved):**
FR49 (⚡ First Light) requires QR code onboarding. Resolution: For First Light (developer use only), connection via manual config (backend URL in settings screen). QR code scanning via `expo-camera` arrives in MVP. Requalified from ⚡ to 🚀 — Seb connecting to his own machine doesn't need QR.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (55 FRs, 33 NFRs)
- [x] Scale and complexity assessed (High, 12-15 components)
- [x] Technical constraints identified (solo dev, BYOK, App Store, Expo managed)
- [x] Cross-cutting concerns mapped (trust, agent-UI contract, offline, persona, isolation, cost)

**Architectural Decisions**
- [x] Critical decisions documented with verified versions
- [x] Technology stack fully specified (dual-stack mobile + backend)
- [x] LLM Provider architecture with 5 backends (3 CLI + 2 API)
- [x] Data architecture (SQLite WAL + SOUL.md file + user_id readiness + WAL checkpoint tuning)
- [x] Auth architecture (UUID session, no JWT, manual token regeneration)
- [x] Communication architecture (WebSocket-only + /health, typed protocol, 15 message types)
- [x] SDUI architecture (Primitive Registry, ErrorBoundary + data error isolation, 5 primitives)
- [x] Memory architecture (4 layers: SOUL + Core + Semantic + Episodic, anti-repetition pipeline)
- [x] Persona engine (flame/tree/star, instruction files, transmitted via WS)
- [x] Cost protection (rate limiting, budget tracking, alerts, llm_usage table)
- [x] Schema versioning (schemaVersion field, migrator registry)
- [x] Delta sync protocol (updated_at based, sync/module_sync messages)

**Implementation Patterns**
- [x] 15 conflict points identified and resolved
- [x] Naming conventions (cross-stack boundary rules, 11 contexts)
- [x] Import/export patterns (aliases mandatory, barrel per sub-folder)
- [x] Async-only Python rule (4 forbidden patterns)
- [x] Error handling (structured, never swallowed, agent_action on every error, render vs data errors)
- [x] Test patterns (co-located TS, tests/ Python, factories mandatory)
- [x] Linting enforcement (ESLint + Ruff automated rules)

**Project Structure**
- [x] Complete directory tree with every file (~65 files)
- [x] Architectural boundaries (API, component, service, data) with rules
- [x] FR → file mapping for all 9 FR categories + persona
- [x] Cross-cutting concerns → file mapping
- [x] Data flow diagrams (module creation, offline, delta sync)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — 4 gaps identified, all resolved with clear approaches.

**Key Strengths:**
- LLMProvider abstraction with 5 backends from commit 1 — future-proof and $0 for personal use via CLI
- AI-First Observability — everything debuggable via `docker logs` by an AI agent, no GUI tools needed
- Total module isolation — one crash never affects other modules (ErrorBoundary + data error isolation + fault isolation)
- Schema contract (Zod source of truth) with versioning and migration — single source, auto-generated types on both sides
- 4-layer memory architecture with sub-50ms anti-repetition pipeline (no LLM call)
- Strict consistency patterns — 15 conflict points identified and resolved for multi-agent development
- Cost protection from day one — rate limiting, budget tracking, usage persistence
- Minimal ceremony — no migration framework, no JWT, no Kubernetes — appropriate simplicity for solo dev + single user

**Areas for Future Enhancement:**
- Automatic token rotation (NFR12) — implement for MVP when multi-device support needed
- Full multi-user isolation (NFR29) — `user_id` column ready, `users` table and auth flow in V2
- Undo system (FR53) — `action_journal` table for MVP
- QR pairing (FR49) — `expo-camera` + scan screen for MVP
- Intelligent LLM routing by task complexity — deferred to MVP
- LLM fallback chain configurable — deferred to MVP
- Hard cost cap — deferred to MVP
- Push notifications (APNs/FCM) — deferred to P1

### Implementation Handoff

**AI Agent Guidelines:**
- Read `CLAUDE.md` at project root before any modification
- Follow all architectural decisions exactly as documented in this file
- Use implementation patterns consistently across all components
- Respect project structure and boundaries (especially: `main.py` sole WS handler, `app/` flat backend with `llm/` exception, `app/` minimal mobile)
- Refer to this document for all architectural questions

**First Implementation Priority:**
1. Initialize monorepo (pnpm-workspace.yaml, root package.json, docker-compose.yml)
2. Create `packages/module-schema/` with Zod schema — THE critical path
3. Create `apps/backend/` skeleton (main.py + llm/ + db.py + logging.py)
4. Create `apps/mobile/` from Expo SDK 54 template with Metro config
5. First end-to-end: chat message → agent → LLM → module spec → rendered primitive
