---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: ['_bmad-output/brainstorming/brainstorming-session-2026-02-21.md']
date: 2026-02-21
author: Seb
---

# Product Brief: self-app

## Executive Summary

Self is an open-source, mobile-first application that starts as an empty shell and builds itself entirely around each user's needs through AI-driven conversation. Inspired by OpenClaw's self-improving agent architecture but pushing the concept further — from a chat-based assistant to a complete visual mobile application — Self enables every user to have a truly personalized app without writing a single line of code.

The core insight: one million users should have one million different apps. Self achieves this through a modular brick architecture orchestrated by a personal AI agent with an evolving identity (SOUL), proactive behavior, and anti-repetition memory. The agent observes, learns, and proposes improvements — the app is a living organism that grows with its user.

Built on a BYOK (Bring Your Own Key) model with support for economic LLM providers (Moonshot AI, GLM, MiniMax) and premium models (Claude, GPT, DeepSeek), Self prioritizes accessibility: free, open-source, and designed to help the greatest number of people.

---

## Core Vision

### Problem Statement

Mobile users juggle 5-10+ apps that each handle a fragment of what they actually need, yet none delivers exactly what they want. Current solutions force users to adapt to the app rather than the app adapting to the user. Personalization is limited to themes and settings — never to the core functionality, layout, or behavior of the application itself.

### Problem Impact

- **Fragmented experience**: Users waste time switching between apps that don't communicate
- **One-size-fits-none**: Every app serves the average user, not the individual
- **No proactivity**: Apps wait passively — they never anticipate needs or evolve
- **Emotional disconnect**: Apps are tools, not companions — users feel no attachment or ownership
- **Power users suffer most**: Those with specific, complex needs (sailors, entrepreneurs, creators) are perpetually underserved by generic apps

### Why Existing Solutions Fall Short

| Solution | Gap |
|----------|-----|
| **OpenClaw** | Self-improving agent but desktop/chat-only — no native mobile app, no visual UI bricks |
| **Super-apps (WeChat)** | All-in-one but zero personalization — same app for everyone |
| **No-code builders (Glide, Adalo)** | Require design skills and manual building — no AI agent, no proactivity |
| **Native widgets (iOS/Android)** | Minimal customization, no intelligence, no cross-widget communication |
| **Notion/Obsidian** | Flexible but not mobile-first, no proactive agent, no visual brick architecture |

No existing solution combines: mobile-native + AI-driven construction + proactive self-improvement + visual brick architecture + open-source accessibility.

### Proposed Solution

Self is a mobile application that:

1. **Starts empty** — just a poetic onboarding screen and a conversation with a personal AI agent
2. **Builds itself through conversation** — the user describes needs in natural language, the agent autonomously finds data sources, creates module definitions, and the mobile app renders them dynamically
3. **Evolves autonomously** — the agent analyzes usage patterns, conversations, and context to propose new bricks, reorganize layouts, and refine its understanding of the user (SOUL)
4. **Operates as a living organism** — useful bricks prosper, unused bricks fade, everything communicates through a data ecosystem, the app maintains its own health
5. **Works offline** — graceful degradation with local cache and sync on reconnect
6. **Performs instantly** — dual-loop architecture separates fast UI rendering (<100ms) from slow agent thinking (background), with pre-computed content via crons

### Key Differentiators

1. **Mobile-first living app** — Not a chatbot (OpenClaw), not a builder (Glide). A native mobile app that constructs and reconstructs itself as a living organism.
2. **Biological architecture** — Industry-first: bricks that divide, fuse, and die naturally. Symbiotic relationships between components. Immune system for self-healing. This is not a metaphor — it's the actual architecture principle.
3. **Agentic memory that never repeats** — 4-layer memory with anti-repetition pipeline (ADD/UPDATE/DELETE/NOOP) inspired by Mem0, ensuring the agent truly knows the user.
4. **Evolving persona** — The agent's personality mutates over time based on interaction patterns, starting from 3 onboarding presets (Flame/Tree/Star) and growing organically.
5. **Emotion by design** — Poetic onboarding, agent birth animation, growth narrative. Self is designed to create attachment, not just utility.
6. **Radically open** — Open-source, BYOK, model-agnostic. Free tier via economic LLMs. No vendor lock-in. The user owns their data, their SOUL, their entire app config.

## Target Users

### Primary Users

#### Persona 1: Seb — The Technical Visionary
- **Profile**: Back-end developer, entrepreneur, sailor in Brittany
- **Day 1 need**: "I want a morning briefing with marine weather, business metrics, and smart advice"
- **Month 3 reality**: Self has built a complete operations dashboard Seb never explicitly asked for — it emerged from observing his patterns. The agent detected he checks Stripe after every deployment and created a deploy→revenue correlation brick. The sailing bricks now predict ideal navigation windows 3 days ahead based on historical weather patterns and Seb's preferences.
- **Why Self works for him**: He thinks in systems. He gives Self architectural freedom and the agent thrives. His Self is deeply technical, heavily automated, minimal UI.

#### Persona 2: Clara — The Non-Technical Creative
- **Profile**: Freelance illustrator, manages commissions, social media, client relationships
- **Day 1 need**: "I just want to stop forgetting client deadlines and track what I'm owed"
- **Month 3 reality**: Self has evolved into her creative business hub. It started with a simple deadline tracker and invoice list. The agent noticed she always checks Instagram engagement after posting, so it added a social analytics brick. It detected she mentions "burnout" in conversations periodically and now proactively suggests lighter weeks when the pattern emerges.
- **Why Self works for her**: She never touches configuration. She talks to her agent (Tree persona — patient, collaborative) and bricks appear. Her Self looks nothing like Seb's — colorful, visual, emotion-driven.

#### Persona 3: Marc — The Optimizer Dad
- **Profile**: Project manager, father of two, fitness enthusiast
- **Day 1 need**: "I need to stop juggling 8 apps for family, work, and fitness"
- **Month 3 reality**: Self merged his family calendar with meal planning, added a grocery list that auto-generates from meal choices, tracks his running progress, and reminds him of school events. The agent learned that Wednesday evenings are sacred family time and never proposes work-related bricks during that window.
- **Why Self works for him**: He's an optimizer by nature. He actively shapes his Self, requests specific bricks, and loves the "simplify" function to trim what he doesn't use. His Self is structured, efficient, metric-heavy.

### The Biological Reality

These three personas illustrate Self's core promise: **same app, radically different organisms**.

| Dimension | Seb's Self | Clara's Self | Marc's Self |
|-----------|-----------|-------------|------------|
| **Personality** | Flame (autonomous) | Tree (collaborative) | Flame (autonomous) |
| **Brick count (month 3)** | 25+ (technical, data-heavy) | 12 (visual, simple) | 18 (structured, balanced) |
| **Agent proactivity** | Very high — acts freely | Medium — suggests, waits | High — acts on routines |
| **Evolution pattern** | DevOps-like: fast iterations | Organic: slow, gentle growth | Scheduled: weekly reviews |
| **Bricks that died** | 3 (replaced by better ones) | 1 (never used) | 5 (over-optimized, trimmed) |

### Secondary Users

- **Genome Cloners**: Users who discover Self through a shared configuration (e.g., "Freelance Illustrator starter pack" shared by Clara). They import a genome as starting point, then their Self mutates to fit their own needs.
- **Brick Contributors**: Developers who build and share connectors or brick templates through the open-source community. They may or may not use Self daily — they contribute to the ecosystem.
- **Curious Explorers**: Users attracted by the poetic onboarding who don't have a specific need yet. They open Self out of curiosity, chat with the agent, and discover needs they didn't know they had.

### User Journey

**Phase 1 — Discovery & First Contact**
- Finds Self through GitHub, word of mouth, or a shared genome link
- Downloads the app. Opens it. Poetic animation. Chooses a persona. First conversation.
- Within 5 minutes: first bricks appear based on the conversation
- **Aha moment**: "Wait, it actually built what I described?"

**Phase 2 — Building & Trust (Week 1-2)**
- Daily interactions shape the app. More bricks emerge.
- The agent asks a few questions, proposes improvements
- User starts trusting the agent's suggestions
- **Aha moment**: "It remembered what I said 3 days ago without me repeating it"

**Phase 3 — Living Together (Month 1-3)**
- The agent proposes bricks the user never asked for — and they're relevant
- Unused bricks fade. Useful ones become more prominent.
- The SOUL deepens. The persona mutates subtly.
- **Aha moment**: "It built something I didn't know I needed, and it's exactly right"

**Phase 4 — Symbiosis (Month 3+)**
- Self is indispensable. The user can't imagine going back to 8 separate apps.
- The app is a unique organism — no other Self looks like this one.
- User shares bricks or genome with friends.
- **Aha moment**: "This is MY app. Nobody else has this."

## Success Metrics

### User Success Metrics

| Metric | Target (3 months) | Measurement |
|--------|-------------------|-------------|
| **Daily Active Open** | 60%+ of users open Self at least once per day | App open events / registered users |
| **Prompt Frequency** | Average 3+ prompts per day per active user | Agent interaction count |
| **Brick Engagement** | 5+ active bricks per user after 2 weeks | Bricks with interaction in last 7 days |
| **Retention (D7)** | 50%+ of new users still active after 7 days | D7 cohort retention |
| **Retention (D30)** | 30%+ of new users still active after 30 days | D30 cohort retention |
| **Agent Trust Signal** | 70%+ acceptance rate on agent proposals | Accepted proposals / total proposals |
| **Organic Evolution** | At least 1 agent-proposed brick accepted per user per month | Proactive brick adoptions |

**The "Symbiosis" Indicator**: A user has reached symbiosis when they have 5+ active bricks, open daily, and have accepted at least 3 agent-proposed changes. Target: 20% of users reach symbiosis within 3 months.

### Business Objectives (Open Source / Impact-Driven)

| Objective | Target (6 months) | Target (12 months) |
|-----------|-------------------|---------------------|
| **GitHub Stars** | 1,000+ | 10,000+ |
| **Registered Users** | 500+ | 5,000+ |
| **Weekly Active Users** | 100+ | 1,000+ |
| **Community Contributions** | 10+ PRs from external contributors | 50+ PRs, 5+ community connectors |
| **Shared Genomes** | 20+ public genome configurations | 100+ public genomes |
| **Brick/Connector Ecosystem** | 10 official + 5 community connectors | 15 official + 20 community connectors |

### Key Performance Indicators

**Leading Indicators (predict success):**
- **Onboarding completion rate** — % of downloads that complete persona choice + first conversation. Target: 70%+
- **Time to first brick** — How fast from first open to first functional brick. Target: < 5 minutes
- **Second session rate** — % of users who come back after first use. Target: 50%+

**Health Indicators (ongoing):**
- **Agent memory quality** — % of interactions where user has to repeat information. Target: < 5%
- **Brick survival rate** — % of created bricks still active after 30 days (bio health). Target: 60%+
- **Performance** — App open to content visible. Target: < 2 seconds (cached), < 5 seconds (fresh)

**Failure Signals (pivot triggers):**
- D7 retention drops below 20%
- Average prompts per user drops below 1/day after first week
- Onboarding completion rate below 40%
- More than 30% of users never create a second brick
- Zero community contributions after 3 months of public release

## MVP Scope

### Architecture Overview

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌─────────────┐
│   Mobile App        │     │   Python Backend          │     │ LLM Provider│
│   (React Native)    │◄───►│   (Gateway + Agent)       │◄───►│ (BYOK)      │
│                     │     │                           │     │             │
│ • Chat interface    │     │ • Agent orchestration     │     │ • Claude    │
│ • Dynamic renderer  │     │ • Module creator          │     │ • DeepSeek  │
│ • Module display    │     │ • API caller              │     │ • Moonshot  │
│ • Local cache       │     │ • Memory (SOUL + SQLite)  │     │ • GLM       │
│                     │     │ • Heartbeat scheduler     │     │             │
└─────────────────────┘     └──────────────────────────┘     └─────────────┘
```

Inspired by OpenClaw's gateway architecture but adapted for mobile: the Python backend is the brain (agent reasoning, API calls, module creation, heartbeat), the mobile app is the body (rendering, interaction), and LLM providers are the intelligence (BYOK, model-agnostic).

### Core Features

#### 1. Conversational Shell (Mobile)
- Poetic onboarding with persona choice (Flame/Tree/Star)
- Chat-first interface — the conversation IS the app builder
- No menus, no settings screens at first open — just a conversation

#### 2. Autonomous Module Creation (Backend)
The defining feature. When a user says "I want marine weather between Audierne and Belle-Île", the agent:
1. **Understands the intent** — marine weather, specific geographic zone, likely a sailor
2. **Finds the right data source** — searches its knowledge for marine weather APIs (e.g., Open-Meteo Marine, Météo-France API, Stormglass)
3. **Creates a module definition** — writes a structured definition describing data sources, refresh logic, and display layout
4. **Fetches the data** — calls the API, transforms the response
5. **Sends a renderable result** — the mobile app receives structured data + display instructions and renders it dynamically

A module definition (inspired by OpenClaw's SKILL.md) includes:
- **Data sources**: API endpoints, authentication, parameters, refresh schedule
- **Transform logic**: How to extract and format the relevant data
- **Display spec**: Which UI primitives to compose (map, cards, charts, lists, tables)
- **Lifecycle rules**: When to refresh, when to notify, when to archive

The agent writes these definitions autonomously — no pre-built catalog needed.

#### 3. Dynamic Rendering Engine (Mobile)
A library of UI primitives that the rendering engine composes based on module definitions:
- **Data display**: Card, List, Table, Key-Value, Metric, Badge
- **Visualization**: Chart (line, bar, pie), Map (with markers/routes), Timeline
- **Input**: Text, Select, Toggle, Date picker
- **Layout**: Stack, Grid, Tabs, Expandable section

The agent composes these primitives freely. No app update needed to display new modules — the rendering engine interprets whatever the agent produces.

#### 4. Memory System (Backend)
- **SOUL.md**: Agent identity + user profile, always in context (~2,500 tokens)
- **Core Memory**: Key facts, preferences, patterns — always in context
- **Semantic Store**: SQLite + sqlite-vec for long-term memory, searched on-demand
- **Anti-repetition pipeline**: ADD/UPDATE/DELETE/NOOP per interaction (inspired by Mem0)

#### 5. BYOK + Model Routing
- Support 2-3 LLM providers at launch: Claude (premium) + DeepSeek or Moonshot AI (economic)
- User configures their own API key
- Intelligent routing: module creation uses capable model, simple queries use economic model

#### 6. Heartbeat System (Backend)
A lightweight periodic agent loop inspired by OpenClaw's HEARTBEAT.md pattern:
- **Module refresh crons**: Each module definition includes a refresh schedule (e.g., marine weather every 6h, Stripe metrics daily). The backend scheduler executes data fetches without LLM involvement — pure HTTP calls on a timer.
- **Agent heartbeat**: A configurable periodic wake (default every 30 minutes during active hours) where the agent evaluates a HEARTBEAT.md checklist against current state. Uses an economic model for detection, premium model only when action is needed.
- **HEARTBEAT_OK optimization**: If nothing requires attention, the run costs near-zero tokens. No notification sent to user.
- **Active hours**: Heartbeat restricted to user's configured hours (e.g., 7h-22h, timezone-aware). Respects the SOUL — if the agent knows the user wakes at 7h, the morning briefing is prepared at 6h50.
- **Push notifications**: When the heartbeat detects something significant (weather alert, API down, meaningful data change), the backend pushes a notification to the mobile app.

### The "Day 1 Seb" Scenario

> **Day 1, 14h**: Seb says "Je veux la météo marine entre Audierne et Belle-Île"
> → Agent creates the module, fetches data, mobile renders it: a **Map** (Audierne to Belle-Île with waypoints) + **Cards** (conditions at key points) + **Timeline** (weather evolution over next 48h).

> **Day 1, 14h05**: Seb says "Ajoute les horaires de marée pour le Raz de Sein"
> → Agent updates the existing module — adds tide data source, adds a **Chart** (tide curve). No new module, the existing one evolves.

> **Day 2, 6h50**: Backend heartbeat prepares fresh weather data before Seb wakes.
> **Day 2, 7h15**: Seb opens Self → marine weather is already there, up to date, zero wait.

> **Day 3, 15h**: Heartbeat detects wind shifting to force 7 on Seb's route → push notification: "Conditions dégradées sur ton trajet Audierne-Belle-Île, vent force 7 prévu demain matin."

### Out of Scope (V2+)

| Feature | Reason for Deferral |
|---------|-------------------|
| **SelfAppHub marketplace** | Need critical mass of modules first — V1 supports export/import as files |
| **Advanced proactive behavior** | V1 heartbeat handles refresh + basic alerts. V2 adds pattern detection, unsolicited module proposals, and autonomous optimization |
| **Persona mutation** | Fixed persona presets in V1 — organic evolution in V2 |
| **Offline mode** | Backend-dependent in V1 — local cache + embedded model in V2 |
| **Community sharing / pollination** | Foundation (export/import) in V1 — social features in V2 |
| **Module self-improvement** | Agent creates and updates on request in V1 — autonomous optimization in V2 |
| **Gamification** | Not essential to core value proposition |
| **Relationship graph memory** | SQLite + vectors sufficient for V1 — graph in V2 |
| **Canary deployment of modules** | Modules go live immediately in V1 — preview/rollback in V2 |

### MVP Success Criteria

| Criteria | Validation |
|----------|-----------|
| **5-minute magic** | A new user gets a working, data-driven module within 5 minutes of first conversation |
| **Module diversity** | The agent can autonomously create 10+ distinct module types (weather, calendar, metrics, lists, maps, trackers...) |
| **Memory works** | The agent never asks the same question twice — references previous conversations accurately |
| **Dynamic rendering** | Any structured data the agent produces can be displayed — no "unsupported module" errors |
| **Cross-platform** | Works on iOS and Android |
| **Module evolution** | Users can ask the agent to modify existing modules through conversation |
| **Heartbeat delivers** | Pre-computed data is ready before the user opens the app; significant changes trigger push notifications |
| **Go/no-go for V2** | 50+ users with 3+ active modules each, D7 retention > 30% |

### Future Vision

**V2 — The Living Organism (6-12 months)**
- Advanced proactive agent: observes patterns, proposes modules before being asked
- SelfAppHub: community marketplace for sharing module definitions
- Persona mutation: agent personality evolves based on interaction patterns
- Module self-improvement: agent optimizes its own modules based on usage data
- Basic offline: local cache + queue for sync

**V3 — Symbiosis (12-24 months)**
- Cross-user pollination: "Users like you also have this module"
- Embedded local model for offline intelligence
- Module ecosystem with community contributions
- Self Compose: shareable complete app configurations (genomes)
- Agent-to-agent communication: modules that collaborate
