# self-app — Roadmap

> **Last updated:** 2026-02-23 | **Updated by:** Bob (SM)
> **Source of truth:** `sprint-status.yaml` — this file is a visual projection, updated by the SM agent.

## Legend

| Symbol | Status |
|--------|--------|
| `[x]` | Done |
| `[~]` | Review |
| `[>]` | In Progress |
| `[-]` | Ready for Dev |
| `[ ]` | Backlog |

---

## Project Progress

```
[▓░░░░░░░░░░░░░░░░░░░] 1/56 stories done (2%)
```

| Phase | Stories | Done | Status |
|-------|---------|------|--------|
| ⚡ First Light | 18 | 1 | **In Progress** |
| 🚀 MVP | 19 | 0 | Backlog |
| 📈 Growth | 19 | 0 | Backlog |

**Current focus:** Epic 1 — Project Bootstrap & Developer Connection
**Next up:** Story 1.1b (CI Pipeline) — ready for dev

---

## Phase 1 — First Light ⚡

> Foundation: monorepo, backend, mobile shell, chat interface, SDUI primitives, data refresh
> 18 stories | 1 done

### Epic 1: Project Bootstrap & Developer Connection `in-progress`

> 1/7 done | FRs: FR36, FR39, FR49, FR55–58

- `[x]` **1.1** — Initialize Monorepo & Module Definition Schema
- `[-]` **1.1b** — CI Pipeline
- `[ ]` **1.2** — Backend Skeleton & Single-Command Deployment
- `[ ]` **1.3** — LLM Provider Abstraction & BYOK Configuration
- `[ ]` **1.4** — Mobile App Shell & WebSocket Connection
- `[ ]` **1.5** — Offline Message Queue & Cached Data Rendering
- `[ ]` **1.6** — Session Authentication & Mobile-Backend Pairing

### Epic 2: Conversational Shell & Agent Identity `backlog`

> 0/4 done | FRs: FR1, FR2, FR5, FR8, FR29

- `[ ]` **2.1** — Real-Time Chat Interface with Streaming
- `[ ]` **2.2** — Agent Identity Persistence
- `[ ]` **2.3** — Persona Preset Selection
- `[ ]` **2.4** — Contextual Empty State

### Epic 3: Autonomous Module Creation & Native Rendering `backlog`

> 0/4 done | FRs: FR9–11, FR17–18, FR28

- `[ ]` **3.1** — SDUI Primitive Registry & Simple Primitives
- `[ ]` **3.2** — Composite Primitives (Card, List)
- `[ ]` **3.3** — Module Rendering Pipeline
- `[ ]` **3.4** — Module Creation End-to-End

### Epic 4: Module Data Freshness & Management `backlog`

> 0/3 done | FRs: FR23, FR26, FR40

- `[ ]` **4.1** — Cron-Based Background Refresh
- `[ ]` **4.2** — Module Vitality Scoring
- `[ ]` **4.3** — Module Delete, Archive & Restore

---

## Phase 2 — MVP 🚀

> Core product: memory, onboarding, interactions, failure handling, multi-provider, heartbeat
> 19 stories | 0 done

### Epic 5: Agent Memory & Never-Repeat Promise `backlog`

> 0/3 done | FRs: FR30–31

- `[ ]` **5.1** — 4-Layer Memory Architecture
- `[ ]` **5.2** — Memory Classification Pipeline
- `[ ]` **5.3** — Context Recall & Anti-Repetition

### Epic 6: Polished Onboarding & Trust Architecture `backlog`

> 0/4 done | FRs: FR3, FR6, FR54

- `[ ]` **6.1** — Branded Onboarding Animation
- `[ ]` **6.2** — Persona & Theme Selection During Onboarding
- `[ ]` **6.3** — Creation Ceremony Animation
- `[ ]` **6.4** — Trust-Before-Access Pattern

### Epic 7: Module Interaction & Refinement `backlog`

> 0/4 done | FRs: FR16, FR19, FR21, FR53

- `[ ]` **7.1** — Module Interaction
- `[ ]` **7.2** — Conversational Module Refinement
- `[ ]` **7.3** — Offline Cached Module View
- `[ ]` **7.4** — Undo Last Agent Action

### Epic 8: Intelligent Failure & Proactive Suggestions `backlog`

> 0/3 done | FRs: FR12, FR14–15

- `[ ]` **8.1** — Transparent Failure Communication
- `[ ]` **8.2** — Semi-Automatic Creation Fallback
- `[ ]` **8.3** — Proactive Module Proposals

### Epic 9: Multi-Provider Routing & API Key Management `backlog`

> 0/3 done | FRs: FR34, FR37, FR59

- `[ ]` **9.1** — Secure API Key Storage
- `[ ]` **9.2** — Multi-Provider Selection & Routing
- `[ ]` **9.3** — API Key Validation on First Use

### Epic 10: Proactive Heartbeat & Pre-Computation `backlog`

> 0/2 done | FRs: FR41, FR45

- `[ ]` **10.1** — Heartbeat Module State Evaluation
- `[ ]` **10.2** — Pre-Computation Before Usage Time

---

## Phase 3 — Growth 📈

> Enrichment: lifecycle, genome sharing, notifications, advanced AI, admin
> 19 stories | 0 done

### Epic 11: Module Lifecycle & Organization `backlog`

> 0/4 done | FRs: FR20, FR22, FR24–25, FR27

- `[ ]` **11.1** — Lifecycle State Transitions
- `[ ]` **11.2** — Dormancy Notification & Revival
- `[ ]` **11.3** — Cleanup Recommendations
- `[ ]` **11.4** — Module Organization (Categories, Tabs, Reordering)

### Epic 12: Genome Sharing & Community `backlog`

> 0/3 done | FRs: FR46–48, FR52, FR60–61

- `[ ]` **12.1** — Genome Export & Data Portability
- `[ ]` **12.2** — Genome Import & Security Validation
- `[ ]` **12.3** — Guided Genome Review

### Epic 13: Notifications & Active Hours `backlog`

> 0/3 done | FRs: FR42–44

- `[ ]` **13.1** — Push Notification Delivery
- `[ ]` **13.2** — Active Hours Configuration
- `[ ]` **13.3** — Per-Module Notification Muting

### Epic 14: Advanced Agent Intelligence `backlog`

> 0/5 done | FRs: FR4, FR7, FR13, FR32–33

- `[ ]` **14.1** — Warm-Up Conversational Mode
- `[ ]` **14.2** — Post-Onboarding Persona Change
- `[ ]` **14.3** — Manual Data Input Fallback
- `[ ]` **14.4** — Agent Knowledge Summary
- `[ ]` **14.5** — Memory Correction & Deletion

### Epic 15: Administration & Integrations `backlog`

> 0/4 done | FRs: FR35, FR38, FR50–51

- `[ ]` **15.1** — OAuth Proxy for External Services
- `[ ]` **15.2** — Cost Monitoring & Transparency
- `[ ]` **15.3** — Detailed Admin Decision Logs
- `[ ]` **15.4** — Admin Configuration Panel

---

## Update Policy

This roadmap is maintained by the **SM agent (Bob)** and updated:
- After each story status change (in-progress, review, done)
- After sprint planning sessions
- After course corrections or retrospectives

To request an update: invoke the SM agent and ask for a roadmap refresh.
