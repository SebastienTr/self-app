---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/ux-twilight-deep-dive.html'
---

# self-app - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for self-app, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Conversation & Onboarding (9 FRs)**

- FR1 `⚡`: User can engage in natural language conversation with the agent in any language
- FR2 `⚡`: User can select a persona preset (Flame / Tree / Star) during onboarding that shapes agent interaction style, autonomy level, and communication tone
- FR3 `🚀`: User can experience a guided onboarding flow on first launch introducing the product concept with a branded visual animation sequence
- FR4 `📈`: User can receive conversational discovery prompts when they express no specific need (warm-up mode with 2-3 exchanges before first suggestion)
- FR5 `⚡`: User can view agent responses in real-time as they are streamed
- FR6 `🚀`: Agent can adapt its communication style and proactivity level based on the selected persona preset
- FR7 `📈`: User can change their persona preset at any time after onboarding
- FR8 `⚡`: User can view a contextual empty state that invites conversation when no modules exist yet
- FR54 `🚀`: System defers all data access permission requests and external service connection prompts until the user has received value from at least one conversation exchange

**Module Creation & Management (8 FRs)**

- FR9 `⚡`: User can request creation of a new module by describing their need in natural language
- FR10 `⚡`: Agent can autonomously discover relevant APIs and data sources matching a user's request
- FR11 `⚡`: Agent can create complete module definitions in a structured, versioned format that the rendering engine can interpret. The module definition format shall include at minimum: module name, type, data sources (array), layout template, refresh interval, and schema_version
- FR12 `🚀`: Agent can present a semi-automatic creation flow when full autonomous creation fails
- FR13 `📈`: User can provide manual data input to populate a module when no suitable API is available
- FR14 `🚀`: Agent can explain transparently why module creation failed, including the reason, what was attempted, and concrete alternative approaches
- FR15 `🚀`: Agent can propose new modules proactively based on observed user patterns; user can accept or decline each proposal
- FR16 `🚀`: User can refine or query a specific module through contextual conversation

**Module Rendering & Display (6 FRs)**

- FR17 `⚡`: User can view modules rendered as native UI components on their mobile device
- FR18 `⚡`: Agent can compose module layouts from a library of UI rendering primitives (First Light: Card, List, Text, Metric, Layout; MVP adds: Chart, Map, Timeline, Table, Form, Badge)
- FR19 `🚀`: User can interact with rendered modules (tap, scroll, expand details, navigate within module content)
- FR20 `📈`: User can organize modules into user-defined categories or tabs
- FR21 `🚀`: User can view the last cached state of modules when the backend is unreachable, with a clear indication of when data was last refreshed
- FR22 `📈`: User can reorder and arrange modules on their home view

**Connection Resilience & Offline (3 FRs)**

- FR56 `⚡`: The system shall automatically reconnect to the backend within 3 seconds of detecting a connection loss, using exponential backoff
- FR57 `⚡`: The system shall queue user messages during disconnection and deliver them in order upon reconnection
- FR58 `⚡`: The system shall render cached module data when the backend is unavailable

**Module Lifecycle (6 FRs)**

- FR23 `🚀`: System can track module usage metrics (open frequency, recency, interaction depth) and compute a vitality score
- FR24 `📈`: System can transition modules through lifecycle states (active → declining → dormant → dead) based on vitality thresholds
- FR25 `📈`: User can receive a notification when a module becomes dormant, with the option to revive or remove it
- FR26 `🚀`: User can manually delete, archive, or restore any module at any time
- FR27 `📈`: User can ask the agent which modules are unused and receive a cleanup recommendation
- FR28 `⚡`: Agent can set a default refresh schedule for each module based on data type; user can override the schedule for any module

**Agent Memory & Identity (5 FRs)**

- FR29 `⚡`: Agent can maintain a persistent identity, personality, and accumulated knowledge across all sessions (SOUL.md)
- FR30 `🚀`: Agent can remember and accurately reference user preferences, context, and details from past conversations without the user repeating information
- FR31 `🚀`: Agent can classify each interaction for memory curation: add new knowledge, update existing knowledge, delete outdated knowledge, or skip
- FR32 `📈`: User can view a human-readable summary of what the agent knows about them, organized by topic
- FR33 `📈`: User can correct or delete specific agent memories

**Data Sources & Authentication (7 FRs)**

- FR34 `🚀`: User can securely store API keys for external services
- FR35 `📈`: User can connect external services via a simplified OAuth flow (single "Connect" button)
- FR36 `⚡`: User can configure their own LLM provider API keys (BYOK)
- FR37 `🚀`: User can select between 2 or more LLM providers and configure routing preferences
- FR38 `📈`: User can view token usage and estimated costs per action and per time period
- FR39 `🚀`: System can authenticate the mobile client with the backend and maintain a secure session across reconnections
- FR59 `🚀`: The system shall validate API key validity on first use and notify the user immediately if a key is expired, revoked, or has insufficient quota

**Proactive Behavior & Notifications (6 FRs)**

- FR40 `⚡`: System can periodically refresh module data in the background via scheduled HTTP calls (cron, no LLM)
- FR41 `🚀`: Agent can evaluate module states during heartbeat cycles and detect significant changes worthy of user attention
- FR42 `📈`: User can receive push notifications for significant data changes detected by the agent
- FR43 `📈`: User can configure active hours during which notifications and heartbeat activity are permitted
- FR44 `📈`: User can mute notifications per-module or globally
- FR45 `🚀`: Agent can prepare fresh data before the user's typical usage time so content is ready on app open

**Configuration, Sharing & Administration (8 FRs)**

- FR46 `📈`: User can export their complete Self configuration as a portable genome file
- FR47 `📈`: User can import a genome from a URL, file, or deep link
- FR48 `📈`: User can review imported genome modules individually and choose to keep, modify, or remove each one
- FR49 `⚡`: User can connect their mobile app to a self-hosted backend through a single-action pairing flow
- FR50 `📈`: Admin can view detailed logs of all agent decisions, actions, and errors
- FR51 `📈`: Admin can monitor and configure heartbeat intervals, model routing, and cost thresholds
- FR52 `📈`: User can export all their data for portability
- FR55 `⚡`: Admin can deploy the complete backend using a single command with default configuration requiring only an LLM API key

**Genome Security (2 FRs)**

- FR60 `📈`: The system shall validate all URLs in an imported genome against an allowlist of known API patterns before activation
- FR61 `📈`: The system shall display a security summary of genome contents before user confirms import

**Safety & Reversibility (1 FR)**

- FR53 `🚀`: User can undo the last agent action (module creation, module deletion, memory update) within 60 seconds of the action completing

**Total: 61 Functional Requirements** (⚡ First Light: 17 | 🚀 MVP: 18 | 📈 Growth: 26)

### NonFunctional Requirements

**Performance (9 NFRs)**

- NFR1: App cold start to cached content visible < 2 seconds
- NFR2: App warm start to interactive < 500ms
- NFR3: Module render from server spec < 100ms
- NFR4: Fresh module creation end-to-end < 30 seconds (First Light: < 60s)
- NFR5: WebSocket reconnection < 1 second
- NFR6: Anti-repetition memory classification < 50ms per interaction
- NFR7: Agent conversational response (first token) < 1 second
- NFR8: Heartbeat HEARTBEAT_OK cost < 500 tokens per run
- NFR9: Cron module refresh < 5 seconds per module

**Security & Privacy (11 NFRs)**

- NFR10: API keys and LLM provider tokens encrypted at rest (AES-256 or platform secure enclave)
- NFR11: All mobile ↔ backend communication encrypted in transit (TLS 1.3 minimum)
- NFR12: Session authentication with token rotation
- NFR13: No telemetry or analytics sent to any third party by default
- NFR14: All user data stored locally or on user's self-hosted server
- NFR15: LLM provider API calls contain no identifying metadata beyond what the user configures
- NFR16: Secure deletion — when user deletes data, it is removed from all storage layers
- NFR17: OAuth proxy handles token storage server-side; mobile client never sees raw OAuth tokens
- NFR34: Backend shall enforce rate limiting of 60 requests per minute per session
- NFR35: Backend shall validate and sanitize all user input before database storage
- NFR36: Docker deployment shall run as non-root user with read-only filesystem except for data volume

**Reliability (5 NFRs)**

- NFR18: Cache-first rendering — app displays last known state when backend is unreachable (100%)
- NFR19: Message queue for offline input — zero message loss on reconnection
- NFR20: Graceful degradation — individual module refresh failure does not affect other modules
- NFR21: Heartbeat system resilience — missed heartbeat cycles do not cause data loss or state corruption
- NFR22: Agent error recovery — LLM provider errors produce structured user-facing messages, not crashes

**Integration (4 NFRs)**

- NFR23: LLM provider abstraction — switching between providers requires only API key configuration
- NFR24: External API timeout handling — default 10 seconds; configurable per module
- NFR25: Push notification delivery < 30 seconds on both iOS and Android
- NFR26: OAuth proxy compatibility — support Google, Stripe, GitHub minimum

**Scalability (3 NFRs)**

- NFR27: Single-user backend handles 50+ active modules without performance degradation
- NFR28: Memory store with vector search handles 10,000+ episodic entries without query degradation
- NFR29: Architecture supports future multi-user isolation without rewriting core (user_id from day one)

**Accessibility (4 NFRs)**

- NFR30: Dynamic type support — all text respects user's system font size preferences
- NFR31: Screen reader compatibility — all interactive elements have accessible labels
- NFR32: Minimum contrast ratio — WCAG AA (4.5:1 normal, 3:1 large)
- NFR33: Touch target size — 44×44pt (iOS) / 48×48dp (Android) minimum

**Testing & Quality (1 NFR)**

- NFR37: All SDUI primitives shall have unit tests verifying rendering with valid specs, graceful handling of malformed specs, and accessibility compliance

**Internationalization (1 NFR)**

- NFR38: SDUI rendering engine shall support bidirectional text (LTR and RTL) and non-Latin character sets

**Total: 38 Non-Functional Requirements**

### Additional Requirements

**From Architecture:**

- Starter template: Composed monorepo based on byCedric/expo-monorepo-example with Expo SDK 54 + FastAPI backend
- Module Definition JSON Schema as Zod source of truth with auto-generation pipeline (Zod → JSON Schema → TypeScript types + Pydantic models)
- Schema versioning with `schemaVersion` field and migrator registry for breaking changes
- LLMProvider abstraction with 5 backends from commit 1 (3 CLI: Claude, Codex, Kimi + 2 API: Anthropic, DeepSeek)
- CLIProvider base class with health_check for all CLI-based providers
- AI-First Observability: structured JSON logging with `agent_action` field on every error, 3-stream unified logging (mobile → WS → backend stdout)
- WebSocket-only protocol with typed discriminated union messages (15 message types), `GET /health` for Docker healthcheck only
- SDUI Primitive Registry pattern: `type → Component` mapping with UnknownPrimitive fallback
- UUID session auth (not JWT) — token generated on mobile, verified on first WS message
- Single SQLite file (WAL mode) + SOUL.md file on disk — no external database service
- Delta sync protocol: `updated_at` based, sync/module_sync messages for reconnection
- 15 consistency patterns for multi-agent development (naming, imports, async-only Python, error handling, status enums, test factories)
- Cost protection: rate limiting (10 LLM calls/min), budget tracking, `llm_usage` table, configurable cost alerts
- Circuit breaker for LLM providers: 3 failures in 5min → 60s cooldown
- Retry: 1 auto-retry with 2s backoff on transient errors (429, 502-504, timeout)
- Migration system: numbered SQL files, backup before migration, transaction-wrapped, `--dry-run` flag
- `user_id TEXT DEFAULT 'default'` on all tables for V2 multi-user readiness
- Persona engine: `data/personas/*.md` instruction files, transmitted via WS `status` message
- 4-layer memory: SOUL (file) + Core (key-value) + Semantic (vector view on episodic) + Episodic (sqlite-vec embeddings)
- Anti-repetition pipeline: all-MiniLM-L6-v2 quantized (~30ms) + sqlite-vec top-5 (<5ms) + threshold 0.85

**From UX Design Specification:**

- Direction D morphing interface: single screen that transforms from chat-dominant (0 modules) to dashboard-dominant (9+ modules) with imperceptible transitions
- Metamorphosis thresholds: Phase 0 (0 modules), Phase 1 (1-3), Phase 2 (4-8), Phase 3 (9+) — bidirectional
- Twilight theme as default (deep navy #0C1420 + amber #E8A84C) — V1 ships Twilight only; additional themes (Ink, Moss, Dawn) deferred to P1 via token swapping
- Theme selection deferred to P1 — V1 onboarding includes persona selection only
- Orb as brand mark: amber pulsing circle communicating agent state (4s rest, 1.5s creating, static settled)
- Creation Ceremony: multi-step animation (ambient shift → orb pulse → progress steps → module slide-in)
- 3-layer component architecture: Shell (static) / Bridge (lifecycle-aware) / SDUI (pure primitives)
- Constrained Composition Principle: agent selects from pre-validated layout templates, never free-form primitive assembly
- 6 composition templates: metric-dashboard, data-card, map-with-details, timeline-view, simple-list, chart-with-context
- Design tokens: single token object (colors, spacing, typography, radii, shadows) — V1 ships one set per theme
- Typography: system fonts (SF Pro / Roboto), 6-token type scale (title 22pt, subtitle 17pt, body 15pt, caption 13pt, metric 28pt, metricUnit 15pt)
- 8px base grid for spacing (xs:4, sm:8, md:16, lg:24, xl:32)
- Equal-weight acceptance/rejection UI for agent proposals (no dark patterns)
- Emotional design progression: Wonder → Recognition → Quiet Competence → Intimacy → Ownership
- Agent failure: 3 distinct types (Impossible, Temporary, Misunderstood) each with specific recovery flow
- Prompt suggestion chips on first screen (3-4 contextual chips + persona-specific)
- 15s nudge if user does nothing on first screen
- Undo toast visible for 10s (per UX) within 60s window (per FR53)
- Reduced motion support: static states replace animations when system setting enabled

**From UX Twilight Deep Dive (HTML):**

- Detailed color palette specifications for Twilight theme (13 semantic tokens with exact hex values)
- Phone mockup specifications for key screens (first screen, creation ceremony, dashboard)
- Orb animation specifications: radial gradient (#F0C060 → #E8A84C → #D4943C), orbPulse keyframes
- Chat bubble styling: agent messages (left-aligned, #162436 bg, 16px radius) / user messages (right-aligned, #1A3050 bg with border)
- Module card styling: #101C2C background, #1E2E44 border, 12px radius
- Metric grid styling: 2-column grid, #162436 background per item
- Creation ceremony visual: gradient background with amber radial glow, shimmer progress bar
- Chip styling: #12203A background, amber border, 16px radius
- Ambient breathing animation: 6s cycle, opacity 0.3→0.55

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 2 | Natural language conversation |
| FR2 | Epic 2 | Persona preset selection |
| FR3 | Epic 6 | Guided onboarding animation |
| FR4 | Epic 14 | Warm-up conversational mode (Agent Intelligence) |
| FR5 | Epic 2 | Real-time streaming responses |
| FR6 | Epic 6 | Persona-adapted communication |
| FR7 | Epic 14 | Change persona after onboarding (Agent Intelligence) |
| FR8 | Epic 2 | Contextual empty state |
| FR9 | Epic 3 | Request module via natural language |
| FR10 | Epic 3 | Autonomous API discovery |
| FR11 | Epic 3 | Module definition creation |
| FR12 | Epic 8 | Semi-automatic creation fallback |
| FR13 | Epic 14 | Manual data input (Agent Intelligence) |
| FR14 | Epic 8 | Failure transparency |
| FR15 | Epic 8 | Proactive module proposals |
| FR16 | Epic 7 | Refine module via conversation |
| FR17 | Epic 3 | Native UI rendering |
| FR18 | Epic 3 | SDUI primitive library |
| FR19 | Epic 7 | Module interaction (tap, scroll) |
| FR20 | Epic 11 | Module organization (tabs) |
| FR21 | Epic 7 | Cached offline view |
| FR22 | Epic 11 | Reorder modules |
| FR23 | Epic 4 | Vitality score tracking |
| FR24 | Epic 11 | Lifecycle state transitions |
| FR25 | Epic 11 | Dormancy notification |
| FR26 | Epic 4 | Delete/archive/restore module |
| FR27 | Epic 11 | Cleanup recommendation |
| FR28 | Epic 3 | Refresh schedule (module spec property) |
| FR29 | Epic 2 | Agent persistent identity (SOUL.md) |
| FR30 | Epic 5 | Remember user context |
| FR31 | Epic 5 | Memory classification (ADD/UPDATE/DELETE/NOOP) |
| FR32 | Epic 14 | Knowledge summary view (Agent Intelligence) |
| FR33 | Epic 14 | Memory correction/deletion (Agent Intelligence) |
| FR34 | Epic 9 | Secure API key storage |
| FR35 | Epic 15 | OAuth flow (Administration) |
| FR36 | Epic 1 | BYOK LLM key configuration |
| FR37 | Epic 9 | Multi-provider routing |
| FR38 | Epic 15 | Cost transparency (Administration) |
| FR39 | Epic 1 | Session authentication |
| FR40 | Epic 4 | Cron-based module refresh |
| FR41 | Epic 10 | Heartbeat evaluation |
| FR42 | Epic 13 | Push notifications |
| FR43 | Epic 13 | Active hours configuration |
| FR44 | Epic 13 | Per-module notification muting |
| FR45 | Epic 10 | Pre-computation before usage time |
| FR46 | Epic 12 | Genome export |
| FR47 | Epic 12 | Genome import |
| FR48 | Epic 12 | Guided genome review |
| FR49 | Epic 1 | QR pairing (mobile ↔ backend) |
| FR50 | Epic 15 | Detailed admin logs (Administration) |
| FR51 | Epic 15 | Admin configuration (Administration) |
| FR52 | Epic 12 | Full data export |
| FR53 | Epic 7 | Undo last agent action (60s) |
| FR54 | Epic 6 | Trust-before-access |
| FR55 | Epic 1 | Single-command Docker deployment |
| FR56 | Epic 1 | Auto-reconnection with backoff |
| FR57 | Epic 1 | Offline message queue |
| FR58 | Epic 1 | Cached data rendering |
| FR59 | Epic 9 | API key validation |
| FR60 | Epic 12 | Genome URL allowlist validation |
| FR61 | Epic 12 | Genome security summary |

**Coverage: 61/61 FRs mapped — 0 orphans**

## Epic List

### Epic 1: Project Bootstrap & Developer Connection
The developer can deploy the self-app backend with a single Docker command, configure their LLM API key, and connect the mobile app — establishing a resilient WebSocket connection with auto-reconnection, offline message queuing, and cached data rendering.
**FRs covered:** FR36, FR39, FR49, FR55, FR56, FR57, FR58
**Phase:** ⚡ First Light + 🚀 MVP (FR39, FR49)

### Epic 2: Conversational Shell & Agent Identity
The user can have a real-time streamed conversation with an AI agent that has a persistent identity (SOUL.md), a chosen persona (Flame/Tree/Star), and a contextual empty state inviting the first interaction.
**FRs covered:** FR1, FR2, FR5, FR8, FR29
**Phase:** ⚡ First Light

### Epic 3: Autonomous Module Creation & Native Rendering
The user describes a need in natural language and the agent autonomously discovers APIs, creates a module definition with refresh strategy, and renders a native UI module on the phone using SDUI primitives. THE core thesis.
**FRs covered:** FR9, FR10, FR11, FR17, FR18, FR28
**Phase:** ⚡ First Light

### Epic 4: Module Data Freshness & Management
Modules stay fresh automatically via cron-based background refresh. The user can track module vitality and delete/archive/restore modules.
**FRs covered:** FR23, FR26, FR40
**Phase:** ⚡ First Light (FR40) + 🚀 MVP (FR23, FR26)

### Epic 5: Agent Memory & Never-Repeat Promise
The agent remembers user preferences and context across sessions, classifies each interaction for memory curation (ADD/UPDATE/DELETE/NOOP), and never asks the user to repeat information.
**FRs covered:** FR30, FR31
**Phase:** 🚀 MVP

### Epic 6: Polished Onboarding & Trust Architecture
New users experience a polished onboarding flow with branded animation, persona selection, theme choice, and creation ceremony. The agent adapts its communication style to the persona and defers all permission requests until value is demonstrated (trust-before-access).
**FRs covered:** FR3, FR6, FR54
**Phase:** 🚀 MVP

### Epic 7: Module Interaction & Refinement
The user can interact with rendered modules (tap, scroll, expand), refine them through follow-up conversation, view cached states offline, and undo any agent action within 60 seconds.
**FRs covered:** FR16, FR19, FR21, FR53
**Phase:** 🚀 MVP

### Epic 8: Intelligent Failure & Proactive Suggestions
When the agent cannot fulfill a request, it explains WHY transparently and offers concrete alternatives (semi-automatic creation). The agent also proactively suggests new modules based on observed user patterns.
**FRs covered:** FR12, FR14, FR15
**Phase:** 🚀 MVP

### Epic 9: Multi-Provider Routing & API Key Management
The user can use multiple LLM providers with intelligent routing (premium for creation, economic for heartbeat), securely store external API keys, and receive immediate validation feedback on key status.
**FRs covered:** FR34, FR37, FR59
**Phase:** 🚀 MVP

### Epic 10: Proactive Heartbeat & Pre-Computation
The agent works in the background during heartbeat cycles — evaluating module states, detecting significant changes, and preparing fresh data before the user's typical usage time.
**FRs covered:** FR41, FR45
**Phase:** 🚀 MVP

### Epic 11: Module Lifecycle & Organization
Modules transition through lifecycle states (active → declining → dormant → dead) based on vitality thresholds. Users receive dormancy notifications and cleanup recommendations. Modules can be organized into categories/tabs and reordered.
**FRs covered:** FR20, FR22, FR24, FR25, FR27
**Phase:** 📈 Growth

### Epic 12: Genome Sharing & Community
Users can export their complete Self configuration as a portable genome file and import genomes from URLs or deep links. Imported genomes undergo security validation and guided review (keep/modify/remove per module). Full data export for portability.
**FRs covered:** FR46, FR47, FR48, FR52, FR60, FR61
**Phase:** 📈 Growth

### Epic 13: Notifications & Active Hours
Users receive push notifications for significant data changes detected by the heartbeat. Notifications respect configurable active hours and can be muted per-module or globally.
**FRs covered:** FR42, FR43, FR44
**Phase:** 📈 Growth

### Epic 14: Advanced Agent Intelligence
Advanced agent features: warm-up mode for users with no clear need, persona changes post-onboarding, manual data input fallback, and agent knowledge transparency (view/correct/delete memories).
**FRs covered:** FR4, FR7, FR13, FR32, FR33
**Phase:** 📈 Growth

### Epic 15: Administration & Integrations
Admin and integration tools: OAuth proxy for external service connections, cost monitoring and transparency, detailed agent decision logs, and heartbeat/routing configuration.
**FRs covered:** FR35, FR38, FR50, FR51
**Phase:** 📈 Growth

---

## Epic 1: Project Bootstrap & Developer Connection

**Goal:** The developer can deploy the self-app backend with a single Docker command, configure their LLM API key, and connect the mobile app — establishing a resilient WebSocket connection with auto-reconnection, offline message queuing, and cached data rendering.

**FRs covered:** FR36, FR39, FR49, FR55, FR56, FR57, FR58

### Story 1.1: Initialize Monorepo & Module Definition Schema *(Enabler)*

As a developer,
I want to clone the repository and have a working monorepo with a shared module definition schema,
So that I have type-safe contracts between mobile and backend from day one.

**Acceptance Criteria:**

**Given** a fresh clone of the repository
**When** I run `pnpm install` at the root
**Then** all workspace dependencies are resolved without errors (apps/mobile, apps/backend, packages/module-schema)

**Given** the module-schema package with Zod source definitions
**When** I run the schema generation command
**Then** JSON Schema, TypeScript types, and Pydantic models are generated in their respective output directories
**And** the generated TypeScript types are importable from `@self-app/module-schema`
**And** the generated Pydantic models are importable from `module_schema`

**Given** a module definition object
**When** it is validated against the Zod schema
**Then** it validates successfully for valid specs and rejects invalid specs with descriptive errors
**And** the schema includes at minimum: module name, type, data sources (array), layout template, refresh interval, schema_version, and accessibleLabel (FR11, NFR31)

### Story 1.1b: CI Pipeline *(Enabler)*

As a developer,
I want a CI pipeline that validates code quality on every push,
So that regressions are caught before merging.

**Acceptance Criteria:**

**Given** a push to any branch
**When** the CI pipeline runs
**Then** it executes: TypeScript type checking (`tsc --noEmit`), Python tests (`pytest`), and JavaScript tests (`pnpm test`)

**Given** any CI check fails
**When** a PR is opened
**Then** the PR is blocked from merging until all checks pass

**Given** the CI configuration
**When** inspected
**Then** it uses the `.github/workflows/ci.yml` file defined in the architecture

### Story 1.2: Backend Skeleton & Single-Command Deployment

As a developer,
I want to deploy the complete backend with a single Docker command,
So that I can start working immediately with minimal configuration. (FR55)

**Acceptance Criteria:**

**Given** a `.env` file with only `LLM_API_KEY` configured
**When** I run `docker-compose up`
**Then** the backend starts successfully with default configuration
**And** a SQLite database file is created with WAL mode enabled
**And** all initial migration SQL files are applied in order

**Given** a running backend container
**When** I send a GET request to `/health`
**Then** I receive a 200 response with system status information
**And** the container runs as non-root user with read-only filesystem except for data volume (NFR36)

**Given** a running backend
**When** I inspect the logs
**Then** all log entries are structured JSON with an `agent_action` field on error entries
**And** the log includes the applied migration count and schema version

### Story 1.3: LLM Provider Abstraction & BYOK Configuration

As a developer,
I want to configure my own LLM API key and have a working provider abstraction,
So that I can choose my preferred LLM provider and switch freely. (FR36)

**Acceptance Criteria:**

**Given** a backend with `LLM_API_KEY` set to a valid Anthropic key
**When** the backend starts
**Then** the Anthropic provider is registered and its health_check returns healthy
**And** the `llm_usage` table exists for cost tracking

**Given** the LLMProvider abstraction layer
**When** a provider encounters 3 failures within 5 minutes
**Then** the circuit breaker opens and requests failover to the next configured provider
**And** the circuit resets after 60 seconds of cooldown

**Given** a transient error (429, 502-504, timeout)
**When** an LLM call fails
**Then** the system retries once with 2-second backoff before surfacing the error

**Given** the provider registry
**When** queried for available providers
**Then** 5 providers are returned with their type (3 CLI: Claude, Codex, Kimi + 2 API: Anthropic, DeepSeek)
**And** each CLI provider extends a CLIProvider base class with health_check method
**And** switching providers requires only API key configuration (NFR23)

### Story 1.4: Mobile App Shell & WebSocket Connection

As a user,
I want the mobile app to connect to my backend via WebSocket with automatic reconnection,
So that my connection is always stable. (FR56)

**Acceptance Criteria:**

**Given** the mobile app is launched for the first time
**When** a backend URL is configured
**Then** a WebSocket connection is established using the typed discriminated union protocol
**And** connection status is visible to the developer (connected/connecting/disconnected)

**Given** an active WebSocket connection
**When** the connection is lost (backend restart, network change)
**Then** the app automatically reconnects within 3 seconds using exponential backoff (FR56)
**And** the reconnection attempt count is visible in logs

### Story 1.5: Offline Message Queue & Cached Data Rendering

As a user,
I want my messages to be queued when offline and my modules to remain visible from cache,
So that I never lose work and can still use the app without a connection. (FR57, FR58)

**Acceptance Criteria:**

**Given** the connection is lost while the user types a message
**When** the user sends messages during disconnection
**Then** all messages are queued locally in order (FR57)
**And** upon reconnection, queued messages are delivered in the original order
**And** zero messages are lost (NFR19)

**Given** modules exist in the local cache
**When** the backend is unreachable
**Then** cached module data is rendered from local storage (FR58, NFR18)
**And** the app remains usable with last-known data

### Story 1.6: Session Authentication & Mobile-Backend Pairing

As a user,
I want to connect my mobile app to my self-hosted backend through a simple pairing flow,
So that my session is secure and persistent across reconnections. (FR39, FR49)

**Acceptance Criteria:**

**Given** a running backend instance
**When** the user accesses the pairing interface
**Then** a UUID session token and backend URL are available for pairing (QR code or manual entry)

**Given** the user enters the backend URL on mobile
**When** the mobile app initiates pairing
**Then** a session is established and the UUID token is stored securely on the device
**And** the first WebSocket message includes session verification

**Given** an authenticated session
**When** the WebSocket connection drops and reconnects
**Then** the session is maintained without requiring re-pairing (FR39)
**And** token rotation occurs according to security policy (NFR12)

**Given** an invalid or expired session token
**When** the mobile app attempts to connect
**Then** the connection is rejected with a clear error message
**And** the user is prompted to re-pair

**Given** all tables in the database
**When** I inspect the schema
**Then** every table includes `user_id TEXT DEFAULT 'default'` for future multi-user readiness (NFR29)

---

## Epic 2: Conversational Shell & Agent Identity

**Goal:** The user can have a real-time streamed conversation with an AI agent that has a persistent identity (SOUL.md), a chosen persona (Flame/Tree/Star), and a contextual empty state inviting the first interaction.

**FRs covered:** FR1, FR2, FR5, FR8, FR29

### Story 2.1: Real-Time Chat Interface with Streaming

As a user,
I want to send messages in natural language and see the agent's response stream in real-time,
So that conversation feels natural and responsive. (FR1, FR5)

**Acceptance Criteria:**

**Given** the chat interface is open
**When** I type a message and send it
**Then** the message appears in the conversation thread instantly with user-bubble styling (right-aligned, #1A3050 bg with border)

**Given** a message is sent to the agent
**When** the agent responds
**Then** the response text streams token by token in real-time (FR5) with agent-bubble styling (left-aligned, #162436 bg)
**And** the first token appears within 1 second (NFR7)

**Given** the chat interface
**When** I send messages in any language
**Then** the agent responds in the same language (FR1)

**Given** the agent encounters an LLM provider error
**When** the error occurs during response generation
**Then** a structured, user-facing error message is displayed instead of a crash (NFR22)

### Story 2.2: Agent Identity Persistence

As a user,
I want my agent to have a persistent identity and personality across sessions,
So that it feels like the same assistant every time. (FR29)

**Acceptance Criteria:**

**Given** a fresh backend installation
**When** the agent initializes for the first time
**Then** a SOUL.md file is created on disk with default identity parameters

**Given** a SOUL.md file exists
**When** a new session begins
**Then** the agent loads its identity from SOUL.md and maintains consistent personality

**Given** the agent has accumulated knowledge over multiple sessions
**When** I start a new session
**Then** the agent's personality and accumulated knowledge are preserved (FR29)

**Given** the SOUL.md file is corrupted or deleted between sessions
**When** the agent initializes
**Then** a new default SOUL.md is regenerated automatically
**And** the agent logs a warning indicating identity was reset

### Story 2.3: Persona Preset Selection

As a user,
I want to select a persona preset (Flame / Tree / Star) that shapes my agent's interaction style,
So that the agent matches my preferred communication tone. (FR2)

**Acceptance Criteria:**

**Given** the app is running and no persona is selected
**When** the user is prompted to choose
**Then** three persona options are presented: Flame (autonomous/efficient), Tree (collaborative/warm), Star (customizable)

**Given** the user selects a persona
**When** the selection is confirmed
**Then** the agent loads the corresponding persona instruction file from `data/personas/*.md`
**And** the persona is transmitted to the mobile client via WebSocket `status` message

**Given** a persona is active
**When** the agent communicates
**Then** its tone, autonomy level, and proactivity match the persona definition (FR2)

### Story 2.4: Contextual Empty State

As a user,
I want to see an inviting empty state that guides me to start a conversation when no modules exist,
So that I know what to do on first use. (FR8)

**Acceptance Criteria:**

**Given** the app has no modules and no conversation history
**When** the user opens the app
**Then** a contextual empty state is displayed inviting the first conversation (FR8)
**And** the orb is visible with its ambient breathing animation (6s cycle, opacity 0.3→0.55)

**Given** the empty state is displayed
**When** the user sees prompt suggestion chips
**Then** 3-4 contextual conversation starters are shown (chips: #12203A bg, amber border, 16px radius)
**And** chips are personalized to the selected persona

**Given** the user has "Reduce Motion" system setting enabled
**When** the empty state is displayed
**Then** the orb shows a static amber glow (no pulse animation) and ambient breathing resolves to a fixed opacity

**Given** the user does nothing for 15 seconds on the first screen
**When** the nudge timer triggers
**Then** a gentle prompt encourages the user to start typing

---

## Epic 3: Autonomous Module Creation & Native Rendering

**Goal:** The user describes a need in natural language and the agent autonomously discovers APIs, creates a module definition with refresh strategy, and renders a native UI module on the phone using SDUI primitives. THE core thesis.

**FRs covered:** FR9, FR10, FR11, FR17, FR18, FR28

### Story 3.1: SDUI Primitive Registry & Simple Primitives (Text, Metric, Layout)

As a developer,
I want a primitive registry with simple primitives (Text, Metric, Layout),
So that the rendering engine foundation is established with independently testable building blocks. (FR18)

**Acceptance Criteria:**

**Given** the mobile app
**When** the SDUI engine initializes
**Then** the primitive registry maps type identifiers to native components for: Text, Metric, Layout (FR18)

**Given** a module spec referencing a known primitive type
**When** the renderer processes it
**Then** the correct native component is used

**Given** a module spec referencing an unknown primitive type
**When** the renderer processes it
**Then** an UnknownPrimitive fallback is displayed gracefully

**Given** each SDUI primitive
**When** unit tests run
**Then** each primitive is tested for valid rendering, malformed spec handling, and accessibility compliance (NFR37)

**Given** the SDUI rendering engine
**When** rendering text content
**Then** bidirectional text (LTR and RTL) and non-Latin character sets are supported (NFR38)
**And** all text respects the user's system font size preferences (NFR30)
**And** minimum contrast ratio meets WCAG AA: 4.5:1 normal text, 3:1 large text (NFR32)

### Story 3.2: Composite Primitives (Card, List)

As a developer,
I want Card and List composite primitives that build on the simple primitives,
So that the SDUI engine can render real-world module layouts. (FR18)

**Acceptance Criteria:**

**Given** the primitive registry with Text, Metric, Layout from Story 3.1
**When** Card and List primitives are added
**Then** the registry contains the complete First Light set: Text, Metric, Layout, Card, List

**Given** a Card primitive spec
**When** rendered
**Then** it composes inner primitives (Text, Metric) within a card container
**And** the card uses Twilight styling (#101C2C bg, #1E2E44 border, 12px radius)

**Given** a List primitive spec
**When** rendered
**Then** it renders a scrollable list of items using inner primitives
**And** each list item meets touch target minimum size (NFR33)

**Given** each composite primitive
**When** unit tests run
**Then** each is tested for valid rendering, malformed spec handling, and accessibility compliance (NFR37)

### Story 3.3: Module Rendering Pipeline

As a user,
I want to see modules rendered as native UI components on my phone,
So that the experience feels like a native app, not a web view. (FR17)

**Acceptance Criteria:**

**Given** a valid module definition JSON
**When** the mobile app receives it via WebSocket
**Then** the module is rendered using native components from the primitive registry (FR17)

**Given** a module definition with a layout template
**When** rendered
**Then** the layout follows the constrained composition template (metric-dashboard, data-card, simple-list, etc.)
**And** the module card uses Twilight styling (#101C2C bg, #1E2E44 border, 12px radius)

**Given** a rendered module
**When** the module includes dynamic data
**Then** the data is displayed with correct formatting and the module renders in under 100ms (NFR3)

**Given** the app in cold start
**When** cached modules exist
**Then** cached content is visible within 2 seconds (NFR1)

### Story 3.4: Module Creation End-to-End (Request → Discovery → Definition → Render)

As a user,
I want to describe a need in natural language and get a working native module on my phone,
So that I go from idea to result in a single conversation. (FR9, FR10, FR11, FR28)

**Acceptance Criteria:**

**Given** the chat interface
**When** the user describes a need (e.g., "I want to track the weather")
**Then** the agent identifies the request as a module creation intent (FR9)
**And** the user sees acknowledgment that creation has started

**Given** a module creation intent
**When** the agent searches for relevant data sources
**Then** it discovers APIs matching the user's request (FR10)

**Given** discovered APIs
**When** the agent creates the module definition
**Then** the definition follows the module-schema format with all required fields (FR11)
**And** the definition includes a default refresh schedule appropriate for the data type (FR28)
**And** it passes Zod schema validation

**Given** a completed module definition
**When** it is sent to the mobile app
**Then** it renders correctly using the SDUI pipeline from Story 3.3

**Given** a module with a refresh schedule
**When** the user disagrees with the default
**Then** the user can override the refresh interval for that module (FR28)

**Given** the end-to-end creation pipeline
**When** measured from user request to module visible
**Then** the total time is under 60 seconds for First Light, under 30 seconds for MVP (NFR4)

---

## Epic 4: Module Data Freshness & Management

**Goal:** Modules stay fresh automatically via cron-based background refresh. The user can track module vitality and delete/archive/restore modules.

**FRs covered:** FR23, FR26, FR40

### Story 4.1: Cron-Based Background Refresh

As a user,
I want my modules to stay fresh automatically,
So that I always see up-to-date data without manual action. (FR40)

**Acceptance Criteria:**

**Given** a module with a configured refresh schedule
**When** the scheduled time arrives
**Then** the backend executes an HTTP call to the module's data source(s) without LLM involvement (FR40)

**Given** a refresh completes successfully
**When** new data is available
**Then** the module's cached data is updated and pushed to connected mobile clients via delta sync

**Given** a refresh fails for one module
**When** other modules have different schedules
**Then** the failure does not affect other module refreshes (NFR20)

**Given** a module refresh
**When** measured
**Then** it completes in under 5 seconds per module (NFR9)

### Story 4.2: Module Vitality Scoring

As a user,
I want the system to track how much I use each module,
So that I can understand which modules are most valuable. (FR23)

**Acceptance Criteria:**

**Given** a module exists
**When** the user opens, interacts with, or views it
**Then** usage metrics are recorded (open frequency, recency, interaction depth) (FR23)

**Given** accumulated usage metrics
**When** the vitality score is computed
**Then** it reflects a weighted combination of the tracked dimensions

**Given** the vitality score
**When** exposed via agent context
**Then** the agent can reference module engagement in conversation

### Story 4.3: Module Delete, Archive & Restore

As a user,
I want to manually delete, archive, or restore any module at any time,
So that I stay in control of my dashboard. (FR26)

**Acceptance Criteria:**

**Given** a module on the dashboard
**When** the user chooses to delete it
**Then** the module is removed from the dashboard

**Given** a module on the dashboard
**When** the user chooses to archive it
**Then** the module is hidden but its data and definition are preserved

**Given** an archived module
**When** the user chooses to restore it
**Then** the module reappears on the dashboard with its last known data

**Given** any delete/archive/restore action
**When** the action completes
**Then** a confirmation is displayed and the action is recorded for potential reversal
**And** the action can be reversed if an undo mechanism is available (see Epic 7)

---

## Epic 5: Agent Memory & Never-Repeat Promise

**Goal:** The agent remembers user preferences and context across sessions, classifies each interaction for memory curation (ADD/UPDATE/DELETE/NOOP), and never asks the user to repeat information.

**FRs covered:** FR30, FR31

### Story 5.1: 4-Layer Memory Architecture

As a user,
I want the agent to remember my preferences and context across sessions,
So that I never have to repeat myself. (FR30)

**Acceptance Criteria:**

**Given** the backend
**When** the memory system initializes
**Then** 4 memory layers are available: SOUL (file), Core (key-value), Semantic (vector view), Episodic (sqlite-vec embeddings)

**Given** a user preference is expressed in conversation (e.g., "I prefer Celsius")
**When** the agent processes the message
**Then** the preference is stored in Core memory

**Given** stored preferences exist
**When** the user starts a new session
**Then** the agent references known preferences without asking again (FR30)

**Given** the episodic memory store
**When** it contains 10,000+ entries
**Then** vector search queries complete without degradation (NFR28)

### Story 5.2: Memory Classification Pipeline

As a user,
I want the agent to intelligently curate its memory,
So that it keeps only relevant and accurate information. (FR31)

**Acceptance Criteria:**

**Given** the agent processes a user interaction
**When** it evaluates the message
**Then** it classifies the interaction as ADD (new knowledge), UPDATE (refine existing), DELETE (outdated), or NOOP (no memory action) (FR31)

**Given** the classification pipeline
**When** measured end-to-end
**Then** it completes in under 50ms per interaction (NFR6)

**Given** the anti-repetition pipeline
**When** a new interaction is processed
**Then** it checks semantic similarity against existing episodic entries using all-MiniLM-L6-v2 with threshold 0.85

**Given** an UPDATE classification
**When** processed
**Then** the existing memory entry is refined rather than duplicated

**Given** a set of known similar pairs (similarity > 0.85) and dissimilar pairs (similarity < 0.85)
**When** tested against the anti-repetition threshold
**Then** the pipeline correctly identifies duplicates with precision ≥ 90% and recall ≥ 85%

### Story 5.3: Context Recall & Anti-Repetition

As a user,
I want the agent to proactively reference past conversations,
So that our interactions feel continuous and knowledgeable.

**Acceptance Criteria:**

**Given** the user asks about a topic previously discussed
**When** the agent formulates a response
**Then** it references relevant past context from episodic memory

**Given** the agent has answered a question before
**When** a semantically similar question is asked
**Then** the agent references its previous answer rather than starting from scratch

**Given** the anti-repetition check
**When** a new piece of knowledge is semantically similar (>0.85) to an existing entry
**Then** the pipeline flags it and the agent updates rather than duplicates

---

## Epic 6: Polished Onboarding & Trust Architecture

**Goal:** New users experience a polished onboarding flow with branded animation, persona selection, theme choice, and creation ceremony. The agent adapts its communication style to the persona and defers all permission requests until value is demonstrated (trust-before-access).

**FRs covered:** FR3, FR6, FR54

### Story 6.1: Branded Onboarding Animation

As a new user,
I want to experience a polished visual introduction,
So that I understand the product concept and feel welcomed. (FR3)

**Acceptance Criteria:**

**Given** the app is launched for the very first time
**When** the onboarding begins
**Then** a branded visual animation sequence introduces the product concept (FR3)

**Given** the animation is playing
**When** the user has the system reduced-motion setting enabled
**Then** static states replace animations

**Given** the onboarding
**When** it completes
**Then** the user transitions smoothly to the persona and theme selection

### Story 6.2: Persona & Theme Selection During Onboarding

As a new user,
I want to choose my persona and visual theme during onboarding,
So that the app feels personalized from the first moment. (FR6)

**Acceptance Criteria:**

**Given** the onboarding flow
**When** the user reaches the customization step
**Then** persona options (Flame/Tree/Star) are presented with clear descriptions of each style

**Given** persona options
**When** the user selects one
**Then** the agent adapts its communication style and proactivity level immediately (FR6)

**Given** the selection
**When** confirmed
**Then** the app applies the chosen persona persistently and uses the Twilight theme (V1 ships one theme; additional themes deferred to P1)

### Story 6.3: Creation Ceremony Animation *(UX Req: Creation Ceremony)*

As a user,
I want to witness a visually meaningful moment when a module is created,
So that the creation feels like a significant event, not a loading screen.

**Acceptance Criteria:**

**Given** a module creation is triggered
**When** the agent begins building
**Then** the creation ceremony animation plays (ambient shift → orb pulse → progress steps → module slide-in)
**And** the orb transitions from rest (4s cycle) to creating state (1.5s cycle)

**Given** the ceremony is playing
**When** progress steps complete
**Then** visible agent reasoning is shown (not just a generic loading spinner)

**Given** the creation completes
**When** the module is ready
**Then** it slides into the dashboard with a satisfying transition
**And** the orb returns to settled static state

**Given** reduced motion is enabled
**When** the ceremony plays
**Then** simplified static transitions replace animations

### Story 6.4: Trust-Before-Access Pattern

As a user,
I want the app to demonstrate value before asking for permissions,
So that I trust the app before giving it access to my data. (FR54)

**Acceptance Criteria:**

**Given** a new user
**When** they start using the app
**Then** no data access permissions or external service connections are requested initially (FR54)

**Given** the user has had at least one valuable conversation exchange
**When** permissions are needed for a specific feature
**Then** the request is deferred until that moment

**Given** a permission request
**When** presented
**Then** the request explains clearly why it's needed and what value it enables

---

## Epic 7: Module Interaction & Refinement

**Goal:** The user can interact with rendered modules (tap, scroll, expand), refine them through follow-up conversation, view cached states offline, and undo any agent action within 60 seconds.

**FRs covered:** FR16, FR19, FR21, FR53

### Story 7.1: Module Interaction

As a user,
I want to interact with rendered modules (tap, scroll, expand),
So that I can explore data within each module. (FR19)

**Acceptance Criteria:**

**Given** a rendered module
**When** the user taps on an element
**Then** the appropriate detail view or action is triggered (FR19)

**Given** a scrollable module (list, timeline)
**When** the user scrolls
**Then** content scrolls smoothly within the module

**Given** a module with expandable content
**When** the user taps to expand
**Then** additional details are revealed

**Given** all interactive elements
**When** rendered
**Then** touch targets meet minimum size: 44×44pt (iOS) / 48×48dp (Android) (NFR33)
**And** all interactive elements have accessible labels (NFR31)

### Story 7.2: Conversational Module Refinement

As a user,
I want to refine a specific module through follow-up conversation,
So that I can adjust it without starting from scratch. (FR16)

**Acceptance Criteria:**

**Given** an existing module on the dashboard
**When** the user references it in conversation (e.g., "change the weather module to Celsius")
**Then** the agent identifies the target module (FR16)

**Given** a refinement request
**When** the agent processes it
**Then** the module definition is updated with the requested changes

**Given** the updated module definition
**When** sent to the mobile app
**Then** the module re-renders with the changes visible immediately

### Story 7.3: Offline Cached Module View

As a user,
I want to view the last cached state of modules when offline,
So that I still get value from the app without a connection. (FR21)

**Acceptance Criteria:**

**Given** modules have been rendered at least once
**When** the backend becomes unreachable
**Then** the last cached state of each module is displayed (FR21)

**Given** cached modules are displayed
**When** the user views them
**Then** a clear indication shows when data was last refreshed

**Given** the app returns online
**When** the connection is restored
**Then** modules refresh automatically with fresh data

### Story 7.4: Undo Last Agent Action

As a user,
I want to undo the last agent action within 60 seconds,
So that I can recover from mistakes without stress. (FR53)

**Acceptance Criteria:**

**Given** the agent performs a significant action (module creation, module deletion, memory update)
**When** the action completes
**Then** an undo toast appears visible for 10 seconds (FR53)

**Given** the undo toast is visible
**When** the user taps "Undo"
**Then** the action is fully reversed

**Given** 60 seconds have passed since the action
**When** the user tries to undo
**Then** the undo option is no longer available and the action is permanent

**Given** an undo is triggered
**When** it completes
**Then** the user sees confirmation that the action was reversed

---

## Epic 8: Intelligent Failure & Proactive Suggestions

**Goal:** When the agent cannot fulfill a request, it explains WHY transparently and offers concrete alternatives (semi-automatic creation). The agent also proactively suggests new modules based on observed user patterns.

**FRs covered:** FR12, FR14, FR15

### Story 8.1: Transparent Failure Communication

As a user,
I want the agent to explain clearly why something failed,
So that I understand the issue and can take action. (FR14)

**Acceptance Criteria:**

**Given** module creation fails
**When** the agent communicates the failure
**Then** it explains: the reason, what was attempted, and concrete alternative approaches (FR14)

**Given** a failure type is "Impossible" (can't be done)
**When** communicated
**Then** the agent explains the fundamental limitation in everyday language

**Given** a failure type is "Temporary" (try again later)
**When** communicated
**Then** the agent indicates what changed and when to retry

**Given** a failure type is "Misunderstood" (wrong interpretation)
**When** communicated
**Then** the agent asks for clarification with specific suggestions

### Story 8.2: Semi-Automatic Creation Fallback

As a user,
I want a guided creation flow when full autonomous creation fails,
So that I can still get a working module. (FR12)

**Acceptance Criteria:**

**Given** autonomous module creation fails
**When** the agent falls back
**Then** it presents a semi-automatic creation flow guiding the user through decisions (FR12)

**Given** the semi-automatic flow
**When** the user provides input at each step
**Then** the agent creates the module definition with user-guided parameters

**Given** the fallback flow
**When** complete
**Then** the resulting module is indistinguishable from an autonomously created one

### Story 8.3: Proactive Module Proposals

As a user,
I want the agent to suggest useful modules based on my patterns,
So that I discover tools I didn't know I needed. (FR15)

**Acceptance Criteria:**

**Given** the agent has observed user patterns over time
**When** it identifies a relevant module opportunity
**Then** it proposes the module proactively (FR15)

**Given** a proposal is presented
**When** the user sees it
**Then** accept and decline options have equal visual weight (no dark patterns)

**Given** the user declines a proposal
**When** declined
**Then** the rejection costs zero effort and the agent does not re-propose the same concept

**Given** the user accepts a proposal
**When** confirmed
**Then** the module creation flow begins normally

---

## Epic 9: Multi-Provider Routing & API Key Management

**Goal:** The user can use multiple LLM providers with intelligent routing (premium for creation, economic for heartbeat), securely store external API keys, and receive immediate validation feedback on key status.

**FRs covered:** FR34, FR37, FR59

### Story 9.1: Secure API Key Storage

As a user,
I want to securely store API keys for external services,
So that my credentials are protected at rest. (FR34)

**Acceptance Criteria:**

**Given** the user has an API key for an external service
**When** they store it
**Then** the key is encrypted at rest using AES-256 or platform secure enclave (FR34, NFR10)

**Given** stored API keys
**When** the backend processes them
**Then** keys are decrypted only when needed for API calls and never logged in plaintext

**Given** secure deletion is requested (user removes a key)
**When** deleted
**Then** the key is removed from all storage layers (NFR16)

### Story 9.2: Multi-Provider Selection & Routing

As a user,
I want to select between LLM providers and configure routing preferences,
So that I can optimize for cost, quality, or speed. (FR37)

**Acceptance Criteria:**

**Given** multiple LLM providers are configured
**When** the user accesses routing settings
**Then** available providers are listed with their status (FR37)

**Given** routing preferences
**When** the user configures them
**Then** the system routes requests according to the configured strategy (e.g., premium for creation, economic for heartbeat)

**Given** rate limiting is active
**When** more than 10 LLM calls per minute are attempted
**Then** excess calls are rate-limited with user-facing feedback

### Story 9.3: API Key Validation on First Use

As a user,
I want immediate feedback when I enter an API key,
So that I know right away if it works. (FR59)

**Acceptance Criteria:**

**Given** the user enters a new API key
**When** the system validates it on first use
**Then** the user is notified immediately if the key is expired, revoked, or has insufficient quota (FR59)

**Given** a valid key
**When** validation passes
**Then** the key status shows as "active" with provider information

**Given** a key becomes invalid after initial validation
**When** the next API call fails
**Then** the user receives a clear notification about the key status change

---

## Epic 10: Proactive Heartbeat & Pre-Computation

**Goal:** The agent works in the background during heartbeat cycles — evaluating module states, detecting significant changes, and preparing fresh data before the user's typical usage time.

**FRs covered:** FR41, FR45

### Story 10.1: Heartbeat Module State Evaluation

As a user,
I want the agent to monitor my modules in the background and detect significant changes,
So that I'm aware of important events without checking manually. (FR41)

**Acceptance Criteria:**

**Given** modules exist with refresh data
**When** a heartbeat cycle runs
**Then** the agent evaluates module states against change detection rules (FR41)

**Given** a change meets a significance threshold (value delta > configured %, new item in tracked list, status change in monitored field, or data source error after previous success)
**When** evaluated
**Then** the change is flagged for user attention with a structured change summary (field, old value, new value, change type)

**Given** a heartbeat run
**When** measured for cost
**Then** a HEARTBEAT_OK cycle costs less than 500 tokens (NFR8)

**Given** the heartbeat system
**When** a cycle is missed or fails
**Then** no data loss or state corruption occurs (NFR21)

### Story 10.2: Pre-Computation Before Usage Time

As a user,
I want the agent to prepare fresh data before I typically use the app,
So that content is ready when I open it. (FR45)

**Acceptance Criteria:**

**Given** the agent has observed the user's typical usage patterns (at least 5 data points of app-open times)
**When** approaching the user's typical app-open time (within a configurable window, default 15 minutes before)
**Then** the agent triggers pre-computation to refresh modules whose data is older than their refresh interval (FR45)

**Given** pre-computation is running
**When** it completes
**Then** module data is fresh and ready for immediate display on app open
**And** stale modules (data age > 2× refresh interval) are prioritized

**Given** the user's schedule changes
**When** the pattern shifts
**Then** the pre-computation timing adapts automatically

---

## Epic 11: Module Lifecycle & Organization

**Goal:** Modules transition through lifecycle states (active → declining → dormant → dead) based on vitality thresholds. Users receive dormancy notifications and cleanup recommendations. Modules can be organized into categories/tabs and reordered.

**FRs covered:** FR20, FR22, FR24, FR25, FR27

### Story 11.1: Lifecycle State Transitions

As a user,
I want modules to naturally transition through lifecycle states,
So that my dashboard stays relevant without manual cleanup. (FR24)

**Acceptance Criteria:**

**Given** a module with a vitality score
**When** the score drops below defined thresholds
**Then** the module transitions through states: active → declining → dormant → dead (FR24)

**Given** lifecycle transitions
**When** bidirectional (user re-engages with a declining module)
**Then** the module can transition back to active

**Given** state transitions
**When** they occur
**Then** the user can see the current state of each module

### Story 11.2: Dormancy Notification & Revival

As a user,
I want to be notified when a module becomes dormant,
So that I can decide to revive or remove it. (FR25)

**Acceptance Criteria:**

**Given** a module transitions to dormant state
**When** the transition occurs
**Then** the user receives a notification with options to revive or remove (FR25)

**Given** the user chooses to revive
**When** confirmed
**Then** the module returns to active state and refreshes its data

**Given** the user chooses to remove
**When** confirmed
**Then** the module is archived (not permanently deleted without explicit action)

### Story 11.3: Cleanup Recommendations

As a user,
I want to ask the agent which modules are unused,
So that I can keep my dashboard clean. (FR27)

**Acceptance Criteria:**

**Given** the user asks about unused modules
**When** the agent evaluates
**Then** it recommends modules for cleanup based on vitality scores (FR27)

**Given** the cleanup recommendation
**When** presented
**Then** each module shows its last interaction date and vitality score

**Given** the user agrees to clean up
**When** confirmed per module
**Then** the selected modules are archived

### Story 11.4: Module Organization (Categories, Tabs & Reordering)

As a user,
I want to organize modules into categories and reorder them on my home view,
So that my dashboard reflects my priorities and mental model. (FR20, FR22)

**Acceptance Criteria:**

**Given** multiple modules exist
**When** the user creates a category
**Then** modules can be assigned to user-defined categories or tabs (FR20)

**Given** categorized modules
**When** viewing the dashboard
**Then** modules are grouped by category
**And** uncategorized modules appear in a default "All" view

**Given** modules on the dashboard
**When** the user initiates reordering
**Then** modules can be rearranged by drag-and-drop or similar gesture (FR22)

**Given** a new module order or category assignment
**When** saved
**Then** the order and categories persist across sessions

**Given** the dashboard in different layout phases (Phase 1-3)
**When** reorganized
**Then** the layout adapts to the current morphing phase

**Given** "Reduce Motion" system setting is enabled
**When** modules are added, removed, or phases transition
**Then** layout changes are instant (no animated transitions)

---

## Epic 12: Genome Sharing & Community

**Goal:** Users can export their complete Self configuration as a portable genome file and import genomes from URLs or deep links. Imported genomes undergo security validation and guided review (keep/modify/remove per module). Full data export for portability.

**FRs covered:** FR46, FR47, FR48, FR52, FR60, FR61

### Story 12.1: Genome Export & Data Portability

As a user,
I want to export my complete Self configuration or all my data,
So that I can share my setup or maintain portability. (FR46, FR52)

**Acceptance Criteria:**

**Given** the user requests genome export
**When** the export runs
**Then** the complete Self configuration is packaged as a portable genome file (FR46)

**Given** the user requests full data export
**When** the export runs
**Then** all user data is exported in a standard format for portability (FR52)

**Given** the exported file
**When** inspected
**Then** it contains all module definitions, persona settings, and user preferences (but no raw API keys)

### Story 12.2: Genome Import & Security Validation

As a user,
I want to import a genome from a URL, file, or deep link with security checks,
So that I can safely adopt someone else's configuration. (FR47, FR60, FR61)

**Acceptance Criteria:**

**Given** a genome file, URL, or deep link
**When** the user initiates import
**Then** the system loads and parses the genome (FR47)

**Given** a genome with URLs
**When** validated
**Then** all URLs are checked against an allowlist of known API patterns before activation (FR60)

**Given** a validated genome
**When** security summary is generated
**Then** the user sees a clear summary of genome contents before confirming import (FR61)

**Given** a security concern is detected
**When** displayed
**Then** the specific risk is highlighted with an explanation

### Story 12.3: Guided Genome Review

As a user,
I want to review imported genome modules individually,
So that I control exactly what gets added to my app. (FR48)

**Acceptance Criteria:**

**Given** a genome passes security validation
**When** the review begins
**Then** each module is presented individually for review (FR48)

**Given** a module in review
**When** the user evaluates it
**Then** they can choose to keep, modify, or remove each module

**Given** the review is complete
**When** confirmed
**Then** only approved modules are imported into the user's configuration

---

## Epic 13: Notifications & Active Hours

**Goal:** Users receive push notifications for significant data changes detected by the heartbeat. Notifications respect configurable active hours and can be muted per-module or globally.

**FRs covered:** FR42, FR43, FR44

### Story 13.1: Push Notification Delivery

As a user,
I want to receive push notifications for significant data changes,
So that I'm informed about important events even when the app is closed. (FR42)

**Acceptance Criteria:**

**Given** the heartbeat detects a significant change
**When** a notification is triggered
**Then** the user receives a push notification on their device (FR42)

**Given** a push notification
**When** delivered
**Then** it arrives within 30 seconds on both iOS and Android (NFR25)

**Given** the notification
**When** tapped
**Then** the app opens to the relevant module

### Story 13.2: Active Hours Configuration

As a user,
I want to configure active hours for notifications,
So that I'm not disturbed outside my preferred times. (FR43)

**Acceptance Criteria:**

**Given** notification settings
**When** the user configures active hours
**Then** notifications and heartbeat activity are only permitted during those hours (FR43)

**Given** outside active hours
**When** a significant change is detected
**Then** the notification is queued until the next active period

**Given** active hours configuration
**When** changed
**Then** the new schedule takes effect immediately

### Story 13.3: Per-Module Notification Muting

As a user,
I want to mute notifications per-module or globally,
So that I control which modules can notify me. (FR44)

**Acceptance Criteria:**

**Given** a module
**When** the user mutes its notifications
**Then** that module no longer triggers push notifications (FR44)

**Given** global mute is enabled
**When** any module triggers a notification
**Then** no push notifications are sent

**Given** a muted module
**When** unmuted
**Then** notifications resume for new changes

---

## Epic 14: Advanced Agent Intelligence

**Goal:** Advanced agent features: warm-up mode for users with no clear need, persona changes post-onboarding, manual data input fallback, and agent knowledge transparency (view/correct/delete memories).

**FRs covered:** FR4, FR7, FR13, FR32, FR33

### Story 14.1: Warm-Up Conversational Mode

As a user,
I want the agent to help me discover what I need when I have no specific request,
So that I can explore the app's potential. (FR4)

**Acceptance Criteria:**

**Given** a user expresses no specific need
**When** the agent detects this
**Then** it initiates warm-up mode with 2-3 conversational discovery prompts before making a suggestion (FR4)

**Given** warm-up mode
**When** the user engages
**Then** the agent gradually narrows down useful module suggestions

**Given** the user identifies a need during warm-up
**When** they express it
**Then** normal module creation flow begins

### Story 14.2: Post-Onboarding Persona Change

As a user,
I want to change my persona preset at any time after onboarding,
So that I can adapt the agent's style as my preferences evolve. (FR7)

**Acceptance Criteria:**

**Given** a persona is active
**When** the user requests a change
**Then** all three persona options are presented with the current one highlighted (FR7)

**Given** a new persona is selected
**When** confirmed
**Then** the agent immediately adapts its communication style, tone, and proactivity

**Given** the persona change
**When** applied
**Then** no data or modules are lost

### Story 14.3: Manual Data Input Fallback

As a user,
I want to provide data manually when no suitable API exists,
So that I can create modules for anything. (FR13)

**Acceptance Criteria:**

**Given** no suitable API is found for a user's request
**When** the agent detects this
**Then** it offers a manual data input option (FR13)

**Given** the manual input flow
**When** the user provides data
**Then** the agent structures it into a valid module definition

**Given** manually entered data
**When** the module is created
**Then** it renders identically to API-driven modules

### Story 14.4: Agent Knowledge Summary

As a user,
I want to view what the agent knows about me,
So that I can verify its accuracy and feel in control. (FR32)

**Acceptance Criteria:**

**Given** the agent has accumulated knowledge
**When** the user requests a summary
**Then** a human-readable summary is displayed organized by topic (FR32)

**Given** the knowledge summary
**When** viewed
**Then** each entry shows its source (conversation date or context)

**Given** the summary
**When** reviewed
**Then** the user can navigate to specific memories for correction

### Story 14.5: Memory Correction & Deletion

As a user,
I want to correct or delete specific agent memories,
So that the agent's knowledge stays accurate. (FR33)

**Acceptance Criteria:**

**Given** the knowledge summary
**When** the user identifies an incorrect memory
**Then** they can correct it with accurate information (FR33)

**Given** a memory marked for deletion
**When** the user confirms
**Then** it is removed from all memory layers (NFR16)

**Given** a correction or deletion
**When** applied
**Then** the agent's future behavior reflects the change immediately

---

## Epic 15: Administration & Integrations

**Goal:** Admin and integration tools: OAuth proxy for external service connections, cost monitoring and transparency, detailed agent decision logs, and heartbeat/routing configuration.

**FRs covered:** FR35, FR38, FR50, FR51

### Story 15.1: OAuth Proxy for External Services

As a user,
I want to connect external services via a simplified OAuth flow,
So that my modules can access rich data sources. (FR35)

**Acceptance Criteria:**

**Given** an external service requires OAuth
**When** the user initiates connection
**Then** a single "Connect" button starts the OAuth flow (FR35)

**Given** the OAuth flow
**When** tokens are obtained
**Then** they are stored server-side; the mobile client never sees raw OAuth tokens (NFR17)

**Given** the OAuth proxy
**When** implemented
**Then** it supports at minimum Google, Stripe, and GitHub (NFR26)

### Story 15.2: Cost Monitoring & Transparency

As a user,
I want to view token usage and estimated costs,
So that I can manage my LLM spending. (FR38)

**Acceptance Criteria:**

**Given** LLM usage is tracked in the `llm_usage` table
**When** the user requests cost information
**Then** usage is displayed per action and per time period (FR38)

**Given** cost thresholds are configured
**When** daily spending exceeds the threshold
**Then** an alert is triggered

**Given** the cost view
**When** displayed
**Then** it shows breakdown by provider and action type

### Story 15.3: Detailed Admin Decision Logs

As an admin,
I want to view detailed logs of agent decisions and actions,
So that I can understand and debug agent behavior. (FR50)

**Acceptance Criteria:**

**Given** the agent makes decisions
**When** logged
**Then** detailed decision logs capture the reasoning, action taken, and outcome (FR50)

**Given** the admin log view
**When** accessed
**Then** logs are filterable by time, action type, and outcome

**Given** all logs
**When** structured
**Then** they follow the AI-first observability pattern with `agent_action` fields

### Story 15.4: Admin Configuration Panel

As an admin,
I want to configure heartbeat intervals, model routing, and cost thresholds,
So that I can tune the system for my needs. (FR51)

**Acceptance Criteria:**

**Given** the admin interface
**When** accessed
**Then** heartbeat intervals, model routing, and cost thresholds are configurable (FR51)

**Given** a configuration change
**When** applied
**Then** the change takes effect without requiring a restart

**Given** the configuration
**When** saved
**Then** the settings persist across backend restarts
