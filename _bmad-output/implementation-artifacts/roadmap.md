# self-app — Roadmap

> **Last updated:** 2026-02-25T12:00 | **Updated by:** SM Agent (Bob)
> **Source of truth:** `sprint-status.yaml` — this file is a visual projection, updated by the SM agent.
> **Baseline note:** dashboard/wave totals track `59` epic stories currently in `sprint-status.yaml` (including post-PRD additions `1.7`, `2.5`, and `2.5b`) + `Prep.1` = `60` total stories.
> **Latest change:** Story 2.3 (Persona Preset Selection) completed — three agent persona presets (Flame/Tree/Star) with backend prompt injection and mobile Settings UI.

## Dashboard

```
╔══════════════════════════════════════════════════════════════╗
║  WAVE 4 · Story 2.4 · BACKLOG                              ║
║  Next milestone: First Light Complete                       ║
╚══════════════════════════════════════════════════════════════╝

TOTAL   [▓▓▓▓▓▓░░░░░░░░░░░░░░]  18/60 done (30%)

─── Waves (ordre d'exécution) ── chaque bloc = 1 story ───────

W1  Bootstrap      ▓▓▓▓▓▓▓▓                   8/8   ✓ DONE        🔄 E1 retro ✓
W2  Chat+Render    ▓▓▓▓                        4/4   ✓ DONE
W3  First Module   ▓                           1/1   ✓ DONE        🔄 E3 retro ✓
PP  Preparation    ▓                           1/1   ✓ DONE
W4  Backfill       ▓▓▓▓····                    4/8   << ICI        🔄 E2+E4, First Light retro
W5  MVP Core       ··············              0/14                🔄 E5-E8 retros
W6  Security       ·····                       0/5   * MVP DONE   🔄 E9+E10, MVP retro
W7  Growth         ···················         0/19  * GROWTH      🔄 E11-E15, Growth retro

─── Epics (vue feature) ──────────────────────────────────────

E1  Bootstrap      ▓▓▓▓▓▓▓▓   8/8  ✓
E2  Conversation   ▓▓▓▓▓·     5/6  <<    ┐
E3  Creation       ▓▓▓▓       4/4  ✓      ├ First Light
E4  Freshness      ···        0/3         ┘
PP  Preparation    ▓          1/1  ✓   (critical path cleared)
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

Legend: ▓ done  ~ review/wip  - ready-for-dev  · backlog
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
| **1** | Finish Bootstrap | 1.4, 1.5, 1.6, 1.7 | Mobile connected + authenticated + observable | E1 retro ✓ |
| **2** | Chat + Primitives | 3.1, 3.2, 2.1, 3.3 | Agent talks + modules render | — |
| **3** | Module Creation E2E | 3.4 | **First Module Test** | E3 retro ✓ |
| **Prep** | Agent Dev Autonomy | Prep.1 | Agent can test, screenshot, debug autonomously | — |
| **4** | Backfill First Light | 2.2, 2.5, 2.5b, 2.3, 2.4, 4.1, 4.2, 4.3 | First Light complete | E2 + E4 retro, **First Light retro** |
| **5** | MVP Core | 5.x, 6.x, 7.x, 8.x | Memory + onboarding + interactions | E5, E6, E7, E8 retros |
| **6** | MVP Security | 9.x, 10.x | Multi-provider + heartbeat | E9 + E10 retro, **MVP retro** |
| **7** | Growth | 11.x–15.x | Lifecycle + genome + admin | E11–E15 retros, **Growth retro** |

---

## Wave 1 — Finish Bootstrap (Epic 1)

> Goal: mobile app connected, authenticated, offline-capable
> **Complete** | 8/8 done ✓
> Features clés: monorepo, backend, abstraction LLM/BYOK, shell mobile, sync WebSocket, cache offline, pairing session, observabilité corrélée.
> Objectif: sécuriser la fondation technique et la boucle de connexion mobile ↔ backend avant toute feature produit avancée.
> Sortie attendue: application mobile stable, authentifiée et capable de reprendre l'expérience même en contexte réseau imparfait.

- `[x]` **1.1** — Initialize Monorepo & Module Definition Schema
- `[x]` **1.1b** — CI Pipeline
- `[x]` **1.2** — Backend Skeleton & Single-Command Deployment
- `[x]` **1.3** — LLM Provider Abstraction & BYOK Configuration
- `[x]` **1.4** — Mobile App Shell & WebSocket Connection
- `[x]` **1.5** — Offline Message Queue & Cached Data Rendering
- `[x]` **1.6** — Session Authentication & Mobile-Backend Pairing
- `[x]` **1.7** — Observability & Correlation IDs

> 🔄 **Retro E1** — done (`/bmad-bmm-retrospective`)

---

## Wave 2 — Chat + Primitives (Epics 2 & 3 interleaved)

> Goal: agent can talk, modules can render natively
> 4 stories | Two dependency chains converge on 3.4
> Features clés: chat temps réel en streaming + registre de primitives SDUI + composants composites + pipeline de rendu.
> Objectif: rendre visible la valeur produit (conversation + UI dynamique) avec une base de rendu native réutilisable.
> Sortie attendue: l'agent répond en temps réel et les modules peuvent être affichés correctement côté mobile.

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
> Features clés: création de module end-to-end depuis le prompt utilisateur jusqu'au rendu du module généré.
> Objectif: valider la thèse produit et l'intégration complète des briques backend, LLM, chat et rendu.
> Sortie attendue: démo fiable du flux "je demande → l'agent crée → le module apparaît", prête à être consolidée.

- `[x]` **3.4** — Module Creation End-to-End

> If this works, the product thesis is validated. Everything after builds on this.
>
> 🔄 **Retro E3** — done ✓

---

## Preparation — Agent Dev Autonomy (Critical Path)

> **Blocker for Wave 4.** The dev agent must be able to test, screenshot, and debug autonomously before continuing.
> Source: Epic 3 Retrospective Action Item #1
> 1 story | First use case: fix keyboard avoidance bug on Android

- `[x]` **Prep.1** — Agent Dev Autonomy (dev-tools.sh, adb screenshots, log reading, keyboard bug fix)

> ✅ **Done.** Dev agent can now capture screenshots, read logs, and debug visually. Keyboard avoidance bug fixed. Critical path to Wave 4 cleared.

---

## Wave 4 — Backfill First Light (Epics 2 & 4)

> Goal: complete all First Light stories skipped during the sprint to 3.4
> 8 stories (+ 1.5 if skipped in Wave 1)
> Features clés: architecture écran two-mode (Chat/Dashboard), persistance d'identité agent, presets de persona, empty state contextuel, refresh cron, scoring de vitalité, archive/restore.
> Objectif: terminer le socle "First Light" laissé de côté pour débloquer proprement memory, onboarding, lifecycle et proactivité.
> Sortie attendue: First Light complet avec dépendances critiques levées pour accélérer les waves MVP suivantes.

- `[x]` **2.2** — Agent Identity Persistence (SOUL.md) — *blocks Epic 5*
- `[x]` **2.5** — Screen Mode Architecture (Chat & Dashboard) — *blocks 2.5b*
- `[x]` **2.5b** — Tab Navigation Architecture (Home/Chat/Settings) — *depends on 2.5, blocks 2.4*
- `[x]` **2.3** — Persona Preset Selection — *blocks Epic 6*
- `[ ]` **2.4** — Contextual Empty State — *depends on 2.5b*
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
> Features clés: mémoire (capture/rappel), onboarding guidé, interactions et raffinements de modules, gestion d'échec/fallbacks.
> Objectif: transformer le prototype validé en expérience MVP cohérente, personnalisée et robuste au quotidien.
> Sortie attendue: cœur produit complet avec création, personnalisation, interaction, résilience et signaux de valeur récurrents.

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
> Features clés: stockage sécurisé des clés API, routing multi-provider, validation BYOK, heartbeat proactif, pré-calculs.
> Objectif: renforcer confiance/sécurité et améliorer la réactivité perçue via des traitements en arrière-plan.
> Sortie attendue: MVP prêt pour usage quotidien avec garde-fous de sécurité et comportements proactifs utiles.

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
> Features clés: lifecycle & organisation, export/import genome, notifications, capacités IA avancées, admin & observabilité.
> Objectif: préparer la phase de croissance avec rétention, portabilité, contrôle utilisateur et outillage d'exploitation.
> Sortie attendue: plateforme extensible orientée scale, avec gouvernance, engagement et opérations mieux maîtrisés.

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
2.2  ──→ 2.3, 2.5, 5.1, 6.1     (SOUL unlocks identity + screen modes + memory)
2.5  ──→ 2.5b                     (screen mode architecture unlocks tab navigation)
2.5b ──→ 2.4                      (tab navigation unlocks empty state)
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

## Dev Infrastructure Notes

### Tunnel Mode Required for Android Physical Device

**Problème récurrent :** L'erreur "Failed to download remote update" dans Expo Go sur Android signifie que le téléphone ne peut pas atteindre l'IP LAN du Mac. Cela arrive systématiquement avec certaines configurations réseau (Wi-Fi isolant les clients, firewall, etc.).

**Cause :** `./self.sh` utilise le mode LAN par défaut. Metro expose le bundle sur `http://<IP_LAN>:8081` et le backend sur `ws://<IP_LAN>:8000/ws`. Si le téléphone ne peut pas joindre cette IP, le bundle ne se télécharge pas.

**Solution :** Toujours lancer avec le flag `--tunnel` :

```bash
./self.sh --tunnel
```

Cela crée deux tunnels ngrok :
1. **Backend tunnel** — `ngrok http 8000` (API port 4041, évite le conflit avec Expo sur 4040)
2. **Metro tunnel** — via `expo start --tunnel` (utilise `@expo/ngrok` dans les devDependencies)

Le mode tunnel set automatiquement `EXPO_PUBLIC_DEV_BACKEND_URL=wss://<tunnel>/ws` et passe le pairing token via `EXPO_PUBLIC_DEV_PAIRING_TOKEN`.

**Historique :** Découvert et corrigé dans `d9adb6e fix(dev): simplify self.sh, add tunnel mode, fix Hermes crypto`. Inclut aussi le fix pour `crypto.randomUUID()` absent dans Hermes (chatStore.ts).

**Autres fixes liés (même session) :**
- `04b0308 fix(ui): compact header, keyboard handling, Android edge-to-edge polish`
- `softInputMode: "adjustResize"` dans app.json pour le clavier Android avec `edgeToEdgeEnabled`
- Lazy require dans CardPrimitive.tsx pour casser le cycle registry ↔ CardPrimitive

---

## Update Policy

This roadmap is maintained by the **SM agent (Bob)** and updated:
- After each story status change (in-progress, review, done)
- After sprint planning sessions
- After course corrections or retrospectives

To request an update: invoke the SM agent and ask for a roadmap refresh.
