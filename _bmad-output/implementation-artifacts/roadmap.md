# self-app — Roadmap

> **Last updated:** 2026-02-24T09:30 | **Updated by:** SM Agent (Bob)
> **Source of truth:** `sprint-status.yaml` — this file is a visual projection, updated by the SM agent.

## Dashboard

```
╔══════════════════════════════════════════════════════════════╗
║  WAVE 4 · Story 2.2 · BACKLOG                              ║
║  Next milestone: Wave 4 — First Light Complete              ║
╚══════════════════════════════════════════════════════════════╝

TOTAL   [▓▓▓▓░░░░░░░░░░░░░░░░]  12/56 done (21%)

─── Waves (ordre d'exécution) ── chaque bloc = 1 story ───────

W1  Bootstrap      ▓▓▓▓▓▓▓                    7/7   ✓ DONE        🔄 E1 retro ✓
W2  Chat+Render    ▓▓▓▓                        4/4   ✓ DONE
W3  First Module   ▓                           1/1   ✓ DONE        🔄 E3 retro
W4  Backfill       ······                      0/6   << ICI        🔄 E2+E4, First Light retro
W5  MVP Core       ··············              0/14                🔄 E5-E8 retros
W6  Security       ·····                       0/5   * MVP DONE   🔄 E9+E10, MVP retro
W7  Growth         ···················         0/19  * GROWTH      🔄 E11-E15, Growth retro

─── Epics (vue feature) ──────────────────────────────────────

E1  Bootstrap      ▓▓▓▓▓▓▓    7/7  ✓
E2  Conversation   ▓···       1/4   <<    ┐
E3  Creation       ▓▓▓▓       4/4  ✓      ├ First Light
E4  Freshness      ···        0/3         ┘
E5  Memory         ···        0/3  ┐
E6  Onboarding     ····       0/4  │
E7  Interaction    ····       0/4  ├ MVP
E8  Failure        ···        0/3  │
E9  Providers      ···        0/3  │
E10 Heartbeat      ··         0/2  ┘
E11 Lifecycle      ····       0/4  ┐
E12 Genome         ···        0/3  │
E13 Notifs         ···        0/3  ├ Growth
E14 Intelligence   ·····      0/5  │
E15 Admin          ····       0/4  ┘

Legend: ▓ done  ~ review/wip  · backlog
```

---

## Legend

| Symbol | Status |
|--------|--------|
| `[x]` | Done |
| `[~]` | Review |
| `[>]` | In Progress |
| `[-]` | Ready for Dev |
| `[ ]` | Backlog |

---

## Execution Strategy

Stories are **not** executed epic-by-epic. They follow the **critical path** to the First Module Test (story 3.4), then fan out into parallel streams.

```
                ┌─ 1.6 ── 2.1 ─────────────┐
1.4 (done)    ──┤                            ├── 3.4 FIRST MODULE TEST
                └─ 3.1 ── 3.2 ── 3.3 ───────┘
```

### Waves

| Wave | Goal | Stories | Milestone | Retros |
|------|------|---------|-----------|--------|
| **1** | Finish Bootstrap | 1.4, 1.5, 1.6 | Mobile connected + authenticated | E1 retro ✓ |
| **2** | Chat + Primitives | 3.1, 3.2, 2.1, 3.3 | Agent talks + modules render | — |
| **3** | Module Creation E2E | 3.4 | **First Module Test** | E3 retro |
| **4** | Backfill First Light | 2.2, 2.3, 2.4, 4.1, 4.2, 4.3 | First Light complete | E2 + E4 retro, **First Light retro** |
| **5** | MVP Core | 5.x, 6.x, 7.x, 8.x | Memory + onboarding + interactions | E5, E6, E7, E8 retros |
| **6** | MVP Security | 9.x, 10.x | Multi-provider + heartbeat | E9 + E10 retro, **MVP retro** |
| **7** | Growth | 11.x–15.x | Lifecycle + genome + admin | E11–E15 retros, **Growth retro** |

---

## Wave 1 — Finish Bootstrap (Epic 1)

> Goal: mobile app connected, authenticated, offline-capable
> **Complete** | 7/7 done ✓

- `[x]` **1.1** — Initialize Monorepo & Module Definition Schema
- `[x]` **1.1b** — CI Pipeline
- `[x]` **1.2** — Backend Skeleton & Single-Command Deployment
- `[x]` **1.3** — LLM Provider Abstraction & BYOK Configuration
- `[x]` **1.4** — Mobile App Shell & WebSocket Connection
- `[x]` **1.5** — Offline Message Queue & Cached Data Rendering
- `[x]` **1.6** — Session Authentication & Mobile-Backend Pairing

> 🔄 **Retro E1** — done (`/bmad-bmm-retrospective`)

---

## Wave 2 — Chat + Primitives (Epics 2 & 3 interleaved)

> Goal: agent can talk, modules can render natively
> 4 stories | Two dependency chains converge on 3.4

**Chain A — Rendering** (needs 1.4):

- `[x]` **3.1** — SDUI Primitive Registry & Simple Primitives
- `[x]` **3.2** — Composite Primitives (Card, List)
- `[x]` **3.3** — Module Rendering Pipeline

**Chain B — Conversation** (needs 1.4 + 1.6):

- `[x]` **2.1** — Real-Time Chat Interface with Streaming

> Recommended order: `3.1 → 3.2 → 2.1 → 3.3` (start rendering while auth settles)

---

## Wave 3 — First Module Test (Epic 3 finale)

> **THE milestone.** User types → agent creates → module appears.
> 1 story | Depends on: 2.1 + 3.3 + 1.3

- `[x]` **3.4** — Module Creation End-to-End

> If this works, the product thesis is validated. Everything after builds on this.
>
> 🔄 **Retro E3** — à lancer après 3.4 done (dernier story de l'Epic 3)

---

## Wave 4 — Backfill First Light (Epics 2 & 4)

> Goal: complete all First Light stories skipped during the sprint to 3.4
> 6 stories (+ 1.5 if skipped in Wave 1)

- `[ ]` **2.2** — Agent Identity Persistence (SOUL.md) — *blocks Epic 5*
- `[ ]` **2.3** — Persona Preset Selection — *blocks Epic 6*
- `[ ]` **2.4** — Contextual Empty State
- `[ ]` **4.1** — Cron-Based Background Refresh — *blocks 4.2, 10.1*
- `[ ]` **4.2** — Module Vitality Scoring — *blocks 11.1*
- `[ ]` **4.3** — Module Delete, Archive & Restore

> 🔄 **Retro E2** — à lancer après 2.4 done (dernier story de l'Epic 2)
> 🔄 **Retro E4** — à lancer après 4.3 done (dernier story de l'Epic 4)
> 🔄 **Retro First Light** — milestone retro à lancer quand W4 complet (`/bmad-bmm-retrospective`)
>
> **Milestone: First Light complete.** The app works end-to-end.

---

## Wave 5 — MVP Core (Epics 5, 6, 7, 8)

> Goal: memory, onboarding, interactions, failure handling
> 14 stories across 4 parallel streams

### Stream A — Memory (Epic 5) `needs 2.2`

- `[ ]` **5.1** — 4-Layer Memory Architecture
- `[ ]` **5.2** — Memory Classification Pipeline
- `[ ]` **5.3** — Context Recall & Anti-Repetition

### Stream B — Onboarding (Epic 6) `needs 2.3`

- `[ ]` **6.1** — Branded Onboarding Animation
- `[ ]` **6.2** — Persona & Theme Selection During Onboarding
- `[ ]` **6.3** — Creation Ceremony Animation
- `[ ]` **6.4** — Trust-Before-Access Pattern — *blocks Epic 9*

### Stream C — Interaction (Epic 7) `needs 3.3`

- `[ ]` **7.1** — Module Interaction
- `[ ]` **7.2** — Conversational Module Refinement
- `[ ]` **7.3** — Offline Cached Module View — *needs 1.5*
- `[ ]` **7.4** — Undo Last Agent Action — *needs 4.3*

### Stream D — Failure Handling (Epic 8) `needs 3.4`

- `[ ]` **8.1** — Transparent Failure Communication
- `[ ]` **8.2** — Semi-Automatic Creation Fallback
- `[ ]` **8.3** — Proactive Module Proposals — *needs 5.1 + 2.3*

> Recommended interleaving: `5.1 → 6.1 → 8.1 → 7.1 → 5.2 → 6.2 → 8.2 → 7.2 → 5.3 → 6.3 → 6.4 → 7.3 → 7.4 → 8.3`
>
> 🔄 **Retro E5** — après 5.3 | **Retro E6** — après 6.4 | **Retro E7** — après 7.4 | **Retro E8** — après 8.3

---

## Wave 6 — MVP Security & Proactivity (Epics 9, 10)

> Goal: secure API key management, proactive heartbeat
> 5 stories

### Epic 9: Multi-Provider Routing `needs 6.4`

- `[ ]` **9.1** — Secure API Key Storage
- `[ ]` **9.2** — Multi-Provider Selection & Routing
- `[ ]` **9.3** — API Key Validation on First Use

### Epic 10: Proactive Heartbeat `needs 4.1`

- `[ ]` **10.1** — Heartbeat Module State Evaluation
- `[ ]` **10.2** — Pre-Computation Before Usage Time — *needs 5.1*

> 🔄 **Retro E9** — après 9.3 | **Retro E10** — après 10.2
> 🔄 **Retro MVP** — milestone retro à lancer quand W6 complet (`/bmad-bmm-retrospective`)
>
> **Milestone: MVP complete.** The product is usable daily.

---

## Wave 7 — Growth (Epics 11–15)

> Goal: lifecycle management, genome sharing, notifications, advanced AI, admin
> 19 stories across 5 parallel streams

### Stream E — Lifecycle (Epic 11) `needs 4.2`

- `[ ]` **11.1** — Lifecycle State Transitions
- `[ ]` **11.2** — Dormancy Notification & Revival — *needs 13.1*
- `[ ]` **11.3** — Cleanup Recommendations
- `[ ]` **11.4** — Module Organization (Categories, Tabs, Reordering)

### Stream F — Genome (Epic 12) `needs 3.4 + 2.2 + 5.1`

- `[ ]` **12.1** — Genome Export & Data Portability
- `[ ]` **12.2** — Genome Import & Security Validation
- `[ ]` **12.3** — Guided Genome Review

### Stream G — Notifications (Epic 13) `needs 10.1`

- `[ ]` **13.1** — Push Notification Delivery
- `[ ]` **13.2** — Active Hours Configuration
- `[ ]` **13.3** — Per-Module Notification Muting

### Stream H — Advanced Intelligence (Epic 14)

- `[ ]` **14.1** — Warm-Up Conversational Mode — *needs 8.3*
- `[ ]` **14.2** — Post-Onboarding Persona Change — *needs 2.3*
- `[ ]` **14.3** — Manual Data Input Fallback — *needs 8.2*
- `[ ]` **14.4** — Agent Knowledge Summary — *needs 5.1*
- `[ ]` **14.5** — Memory Correction & Deletion — *needs 14.4*

### Stream I — Admin (Epic 15)

- `[ ]` **15.1** — OAuth Proxy for External Services — *needs 6.4 + 9.1*
- `[ ]` **15.2** — Cost Monitoring & Transparency — *needs 9.3*
- `[ ]` **15.3** — Detailed Admin Decision Logs
- `[ ]` **15.4** — Admin Configuration Panel — *needs 9.2 + 10.1 + 13.2* (last story)

> Recommended order: `11.4 → 12.1 → 13.1 → 14.2 → 15.3 → 11.1 → 12.2 → 13.2 → 14.4 → 15.1 → 11.3 → 12.3 → 13.3 → 14.5 → 15.2 → 14.1 → 14.3 → 11.2 → 15.4`
>
> 11.2 and 15.4 are last — they depend on nearly everything else.
>
> 🔄 **Retro E11–E15** — après chaque dernier story d'epic
> 🔄 **Retro Growth** — milestone retro finale quand W7 complet (`/bmad-bmm-retrospective`)

---

## Dependency Map (key cross-epic blockers)

```
1.4  ──→ 1.5, 1.6, 3.1           (mobile shell unlocks everything)
1.6  ──→ 2.1                      (auth unlocks conversation)
2.1  ──→ 2.2, 3.4, 8.1           (chat unlocks agent features)
2.2  ──→ 2.3, 5.1, 6.1           (SOUL unlocks memory + onboarding)
2.3  ──→ 6.2, 8.3, 14.2          (persona unlocks onboarding + proactive)
3.4  ──→ 4.1, 8.1, everything    (creation unlocks the product)
4.1  ──→ 4.2, 10.1               (cron unlocks vitality + heartbeat)
4.2  ──→ 11.1                    (vitality unlocks lifecycle)
5.1  ──→ 5.2, 8.3, 10.2, 14.4   (memory unlocks intelligence)
6.4  ──→ 9.1, 15.1               (trust unlocks security features)
10.1 ──→ 10.2, 13.1              (heartbeat unlocks notifications)
13.1 ──→ 11.2, 13.2, 13.3        (push unlocks notification features)
```

---

## Retrospective Policy

🔄 Deux types de rétros sont planifiées :

| Type | Quand | Commande |
|------|-------|----------|
| **Epic retro** | Après la dernière story d'un epic (E1–E15) | `/bmad-bmm-retrospective` |
| **Milestone retro** | Aux jalons majeurs : First Light (W4), MVP (W6), Growth (W7) | `/bmad-bmm-retrospective` |

Les rétros épiques sont rapides (15-20 min) et focalisées sur l'epic terminé. Les rétros milestone sont plus approfondies et couvrent tout le travail depuis le dernier jalon.

> Le SM rappelle automatiquement de lancer la rétro quand une wave se termine.

---

## Update Policy

This roadmap is maintained by the **SM agent (Bob)** and updated:
- After each story status change (in-progress, review, done)
- After sprint planning sessions
- After course corrections or retrospectives

To request an update: invoke the SM agent and ask for a roadmap refresh.
