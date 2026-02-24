---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-e-01-discovery, step-e-02-review, step-e-03-edit]
lastEdited: '2026-02-22'
editHistory:
  - date: '2026-02-22'
    changes: 'PRD corrections batch: harmonized First Module Test timing (60s/30s), added FR56-FR61 (reconnection, offline, API key validation, genome security), added NFR34-NFR38 (rate limiting, input sanitization, Docker hardening, SDUI test coverage, i18n), enriched FR11 module definition format, justified NFR6 anti-repetition budget, added MVP deprioritization note, added metrics clarification vs NFR13, added OAuth proxy complexity note, fixed unrealistic user journey APIs (Clara: Mastodon, Marc: Open Food Facts), added cron vs heartbeat routing clarification, formalized Trust Test validation gate, added LLM output testing strategy'
  - date: '2026-02-21'
    changes: 'Validation-guided edits: +2 FRs (FR54 trust-before-access, FR55 Docker deployment), FR16/FR37 promoted to MVP, 7 orphan FRs grounded in journeys, Failure Signals section added, 3 success criteria added, NFR/FR implementation leakage cleaned, P2 cross-reference note added'
classification:
  projectType: mobile_app
  domain: general
  complexity: high
  projectContext: greenfield
inputDocuments: ['_bmad-output/planning-artifacts/product-brief-self-app-2026-02-21.md', '_bmad-output/brainstorming/brainstorming-session-2026-02-21.md']
workflowType: 'prd'
briefCount: 1
researchCount: 0
brainstormingCount: 1
projectDocsCount: 0
---

# Product Requirements Document - self-app

**Author:** Seb
**Date:** 2026-02-21

## Executive Summary

**An app that does nothing? No — an app that does everything.**

Self is an open-source, mobile-first application that starts as an empty shell and constructs itself entirely around each user's needs through AI-driven conversation. A Python backend hosts an autonomous agent (inspired by OpenClaw's gateway architecture) that finds APIs, creates module definitions, fetches data, and sends structured rendering instructions to a React Native thin client via WebSocket. The mobile app's dynamic rendering engine interprets these instructions using a library of native UI primitives — no app store update required to display new functionality.

The core product thesis: one million users should have one million different apps. When a user says "I want marine weather between Audierne and Belle-Île", the agent autonomously identifies the appropriate API (Stormglass, Open-Meteo Marine), creates a module definition with data sources, transform logic, display spec, and lifecycle rules, then delivers a renderable result combining Map, Cards, and Timeline components. A built-in heartbeat system (inspired by OpenClaw's HEARTBEAT.md) ensures modules stay fresh and users receive push notifications for significant changes.

Target users range from technical power users (back-end developers, entrepreneurs) who give the agent maximum autonomy, to non-technical users (freelancers, parents) who simply describe needs in natural language. The agent adapts via a 4-layer memory system with anti-repetition pipeline (ADD/UPDATE/DELETE/NOOP, inspired by Mem0), an evolving SOUL.md identity file, and persona presets (Flame/Tree/Star) that shape interaction style.

Built on BYOK (Bring Your Own Key) with intelligent model routing — premium models (Claude, DeepSeek) for module creation, economic models (Moonshot AI, GLM) for simple queries — Self prioritizes accessibility: free, open-source, no vendor lock-in.

### What Makes This Special

**No existing product combines these capabilities on mobile.** OpenClaw validates the self-improving agent concept but is desktop/chat-only with no visual UI. No-code builders (Glide, Adalo) require manual design. Super-apps (WeChat) offer zero personalization. Native widgets lack intelligence and cross-communication.

Self's differentiators:
1. **Autonomous module creation** — The agent doesn't assemble from a fixed catalog. It creates modules on-demand by finding APIs, writing definitions, and composing UI primitives — like OpenClaw creates skills, but with native mobile rendering.
2. **Biological architecture principle** — Modules that prosper with use, fade when ignored, and evolve through user interaction. Not a metaphor — a real architecture pattern governing module lifecycle.
3. **Memory that never repeats** — 4-layer memory (SOUL + Core Memory always in context, Semantic + Episodic stores on-demand) with anti-repetition pipeline ensuring the agent truly knows the user.
4. **Heartbeat-driven proactivity** — Background scheduler refreshes data, prepares briefings before the user wakes, and alerts on significant changes — the app works while you sleep.
5. **Timing** — LLMs now achieve ~70-80% success on autonomous API integration for well-documented services. Server-Driven UI is production-proven (Airbnb, Netflix). Google's A2UI protocol standardizes agent-to-UI communication. All building blocks exist; nobody has assembled them for mobile.

For detailed competitive analysis, see **Market Context & Competitive Landscape** in the Innovation section. For timing analysis, see **Timing as Strategic Advantage**.

## Project Classification

- **Project Type:** Mobile application (React Native) with Python backend gateway
- **Domain:** Consumer AI / Personal productivity — no regulated domain constraints
- **Complexity:** High — novel autonomous agent architecture, multi-tier system (mobile + backend + LLM providers), 4-layer memory, dynamic UI rendering, heartbeat scheduling, BYOK model routing
- **Project Context:** Greenfield — no existing codebase, no legacy constraints

## Success Criteria

### User Success

**The "First Module Test":** A new user completes onboarding (persona choice + first conversation) and sees a working, data-driven module within 60 seconds (First Light) / 30 seconds (MVP). This is the make-or-break moment — if the agent can't deliver a tangible result from a natural language request in under 60 seconds, the product fails.

**The "Never Repeat" Promise:** The agent references previous conversations accurately. Users never have to re-explain context. Target: < 5% of interactions require the user to repeat information.

**The "It Knows Me" Signal:** After 2 weeks of use, 80%+ of users agree (survey) that the agent understands their preferences and context. Measured through accuracy of proactive suggestions and module proposals. This validates that the SOUL.md identity file and 4-layer memory system produce a tangible sense of personalization.

**The "It Built What I Needed" Moment:** Users discover that the agent created a module they didn't explicitly request but that matches their patterns. This is the transition from tool to companion. Target: at least 1 agent-proposed module accepted per user per month.

**Engagement Signals:**
- Daily Active Open: 60%+ of users open Self at least once per day
- Prompt Frequency: Average 3+ prompts per day per active user
- Module Engagement: 5+ active modules per user after 2 weeks
- Agent Trust: 70%+ acceptance rate on agent proposals

**Retention Gates:**
- D7: 50%+ (users come back after first week)
- D30: 30%+ (users stay after first month)
- Symbiosis indicator: 20% of users reach 5+ active modules + daily open + 3+ accepted agent proposals within 3 months

**Metrics clarification:** All usage metrics are computed locally on the backend from existing structured logs and database queries. No external analytics service is used. The user can query usage via a local admin endpoint. NFR13 (zero telemetry) applies to external data transmission only — local computation of metrics from existing data is explicitly permitted.

### Business Success

This is an open-source, impact-driven project. Business success = adoption + community.

| Metric | 6-Month Target | 12-Month Target |
|--------|---------------|-----------------|
| GitHub Stars | 1,000+ | 10,000+ |
| Registered Users | 500+ | 5,000+ |
| Weekly Active Users | 100+ | 1,000+ |
| Community PRs | 10+ external | 50+ external, 5+ community modules |

Community contribution targets are validated through open-source distribution strategy and developer experience quality. Alex's journey (Docker optimization PR) and Fatima's (genome sharing) demonstrate the two primary contribution patterns: code contributions and content contributions.
| Shared Genomes | 20+ public configs | 100+ public configs |

**Go/No-Go for V2:** 50+ users with 3+ active modules each, D7 retention > 30%.

### Failure Signals (Pivot Triggers)

If any of these conditions persist for 2+ weeks after public MVP launch, the product thesis requires re-evaluation:

- **D7 retention drops below 20%** — users don't find enough value to return
- **Average prompts per active user drops below 1/day** after the first week — conversation loop is broken
- **Onboarding completion rate below 40%** — first experience fails to engage
- **More than 30% of users never create a second module** — the "magic" doesn't compound
- **Zero community contributions after 3 months of public release** — open-source thesis unsupported

These signals complement the Go/No-Go gate by providing continuous operational monitoring rather than a single checkpoint.

### Technical Success

- **Module creation reliability:** Agent successfully creates a working module from natural language request >=70% of the time for well-documented APIs
- **Rendering coverage:** Zero "unsupported module" errors — any structured data the agent produces can be displayed
- **Heartbeat efficiency:** HEARTBEAT_OK (no-action) runs cost < 500 tokens. Active runs use economic model for detection, premium model only when action needed
- **Performance:** See NFR1–NFR9 for detailed performance targets with measurement methods
- **Memory anti-repetition:** ADD/UPDATE/DELETE/NOOP pipeline correctly classifies >=90% of interactions
- **Cross-platform:** Identical functionality on iOS and Android — an architectural guarantee of the React Native + SDUI approach, validated through automated cross-platform test suites rather than user journey testing
- **BYOK routing:** Seamless switching between LLM providers with no user-visible degradation

### Measurable Outcomes

| Outcome | Measurement | Target |
|---------|------------|--------|
| Onboarding completion | % completing persona + first conversation | 70%+ |
| Time to first module | First open → first working module | < 60s (First Light) / < 30s (MVP) |
| Second session rate | % returning after first use | 50%+ |
| Module diversity per user | Distinct module types created | 3+ after 2 weeks |
| Module survival rate | % modules still active at 30 days | 60%+ |
| Module pruning acceptance | % of dormancy suggestions users accept (revive or remove vs. ignore) | 70%+ |
| Persona satisfaction | % of users who keep their initially chosen persona for at least 2 weeks | 80%+ |
| Heartbeat value | % of app opens with pre-computed fresh data | 80%+ |

## Product Scope

**Architecture:** Python backend (FastAPI + WebSocket) + React Native thin client + BYOK LLM providers

Development is split into a two-stage MVP (Alpha "First Light" → Full MVP), followed by Growth (P1) and Vision phases (V2/V3). The detailed phase breakdown, feature allocation, critical path, risk mitigation, and scope decision rules are documented in the **Project Scoping & Phased Development** section below.

**Core MVP capabilities (6):** Conversational Shell, Autonomous Module Creation, Dynamic Rendering Engine (SDUI), 4-Layer Memory with anti-repetition, BYOK + Model Routing, Heartbeat System.

## User Journeys

### Journey 1: Seb — The Technical Visionary (Primary User, Success Path)

**Opening Scene:** It's a Tuesday morning in Audierne, Brittany. Seb is a back-end developer who runs a small SaaS business and sails on weekends. He currently juggles Stripe dashboard, Météo-France, Google Calendar, Notion, and a custom Grafana — none of them talk to each other. He checks 6 apps before his first coffee. He heard about Self on Hacker News and thinks "OpenClaw for mobile — interesting."

**Rising Action:** Seb downloads Self. A poetic animation plays — a seed of light. He picks Flame (autonomous). The agent asks: "What's on your mind?" Seb types: "Je veux la météo marine entre Audierne et Belle-Île." Within 30 seconds, the agent responds: it found Open-Meteo Marine API, created a module definition, and the screen now shows a Map with his route, Cards with wind/wave conditions at key waypoints, and a Timeline of the next 48 hours. Seb stares at his phone. "Wait, it actually built that?"

Next day, 7:15am. Seb opens Self — the marine weather module is already fresh. The heartbeat prepared it at 6:50. He says: "Ajoute mes revenus Stripe de la semaine." The agent asks for his Stripe API key, stores it securely, and within a minute a Metric card appears showing weekly MRR, a Chart with the 30-day trend, and a Badge for new subscribers. Two modules, zero configuration. The agent creates a Metric card for Stripe — but it's showing lifetime revenue, not weekly MRR. Seb taps undo. The module vanishes. He rephrases: "Revenus Stripe de la semaine seulement." The agent gets it right on the second try. The undo felt natural — a safety net, not a setback.

**Climax:** Week 2. Seb opens Self and sees something he never asked for: the agent's work report. "Pendant la nuit, j'ai détecté que le vent passe force 7 sur ton trajet samedi. J'ai aussi remarqué que tu vérifies Stripe après chaque déploiement — voici la corrélation deploy→revenue de cette semaine." Seb realizes the agent is not just fetching data — it's understanding his patterns. He gives it more freedom.

**Resolution:** Month 3. Seb's Self has 25+ modules — a complete operations + sailing dashboard he never explicitly designed. It emerged. The agent knows his schedule, his business rhythms, his sailing preferences. When a client's API key expires on a Sunday morning, the agent catches it in the heartbeat and pushes a notification before the user sees errors. Seb shares his genome on GitHub — "Back-end Dev + Sailor starter pack."

**Requirements revealed:** Module creation from natural language, API key management, heartbeat pre-computation, agent work reports, push notifications, genome export.

---

### Journey 2: Clara — The Non-Technical Creative (Primary User, Accessibility Path)

**Opening Scene:** Clara is a freelance illustrator in Lyon. She tracks client deadlines on sticky notes, invoices in a spreadsheet she hates, and frequently forgets to follow up on unpaid work. She can't code. She found Self because a designer friend shared her "Freelance Creative" genome link on Instagram.

**Rising Action:** Clara taps the genome link. Self opens with the same poetic animation, but she starts from her friend's config — a few modules already there (client list, deadline tracker). She picks Tree (collaborative). The agent greets her warmly: "I see you're starting from a creative freelance setup. Tell me about your work." Clara types: "I'm an illustrator, I have about 12 active clients, and I keep forgetting who owes me money."

The agent does NOT immediately ask for data access. Instead, it builds trust first. "Let's start simple. Tell me about your most urgent deadline." Clara describes a commission due Friday. The agent creates a clean Deadline card right from the conversation — no spreadsheet needed, no permissions asked. Clara sees immediate value from just talking.

Over the next few days, the agent helps Clara track 3 more deadlines and 2 unpaid invoices — all from conversation. Only after Clara has experienced a week of value and naturally says "I wish it could just pull everything from my spreadsheet" does the agent suggest: "I can connect to your Google Sheet if you share the link — that way I'll always be up to date." Clara trusts the agent by now. She shares the link. The agent uses the backend's OAuth proxy to handle Google's authentication flow — Clara sees only a "Connect" button, never a technical screen. Within a minute, a clean List appears with all her clients, amounts owed, and due dates — color-coded by urgency.

**Climax:** Month 1. Clara regularly posts her illustrations on Mastodon, where she's built a following in the illustration community. She opens Self after each post to check engagement — a habit the agent noticed. One morning, a new module appears she never requested: "Social Performance" showing her last 10 posts' engagement metrics (boosts, favorites, replies) via the Mastodon API, with a trend line. She's surprised. "How did you know I wanted this?" The agent explains: "Tu vérifies Mastodon après chaque publication. J'ai pensé que ça t'aiderait de voir la tendance." Clara smiles. She says "oui, garde-le."

Two weeks later, during a stressful period, the agent notices she mentioned "overwhelmed" twice in conversations. It gently suggests: "Tu as 4 deadlines cette semaine. Veux-tu que je propose un planning réaliste?" Clara accepts. A simple Timeline appears with her week reorganized. No productivity jargon. Just clarity.

**Resolution:** Month 3. Clara's Self looks nothing like Seb's — 12 modules, colorful, visual, emotion-driven. She never touched a setting. She told her agent what she needed, and it built everything. Her Tree persona is patient, always asks before adding things, and knows her work rhythm. By now, Clara realizes she no longer needs the agent to ask before every action. She switches from Tree to Flame — the persona shift is immediate, the agent's tone becomes more confident, its suggestions bolder. Clara grins: she's grown with her app. She tells her illustrator friends: "It's like having a business manager who actually gets creative work."

**Requirements revealed:** Genome import as starting point, **trust-before-access pattern** (demonstrate value from conversation before requesting data permissions), OAuth proxy for non-technical users (one "Connect" button, zero technical screens), agent that observes usage patterns, proactive suggestions with user confirmation (Tree persona = always asks), emotional intelligence in agent responses.

---

### Journey 3: Marc — The Optimizer Dad (Primary User, Edge Case — Failure & Recovery)

**Opening Scene:** Marc is a project manager, father of two (ages 7 and 10), and runs 5km three times a week. He currently uses: Google Calendar (family + work), MyFitnessPal (running), Todoist (tasks), a family WhatsApp group, and a meal planning app that nobody in the family actually follows. He's an optimizer by nature — he wants one app that connects everything.

**Rising Action:** Marc picks Flame (autonomous) and immediately dumps his wishlist: "I want my family calendar, my running log, meal planning for the week, and a grocery list that auto-generates from meals." The agent tackles them one by one — Google Calendar via OAuth proxy (one button, like Clara), a simple running tracker (manual input for now), and a meal planner with grocery list generation.

But Marc isn't satisfied with "good enough." He asks: "Can the grocery list show nutritional info and price estimates?" The agent connects to the Open Food Facts API — an open-source database of food products with nutritional data and crowd-sourced pricing. Within a minute, Marc's grocery list shows estimated calories per item and average price ranges. He asks: "Compare prices between brands for my usual items." The agent builds a comparison module pulling from Open Food Facts' product database, showing price-per-unit across brands for his most frequently listed items.

**Climax — The Failure Arc:** Week 2. Marc asks for something the agent can't do: "I want to track my kids' school grades from Pronote." The agent tries. It searches for Pronote's API. There isn't one — Pronote is a closed French school platform with no public API and aggressive anti-scraping measures.

The agent doesn't silently fail or pretend. It responds transparently:

"I've investigated Pronote and I can't access it automatically — there's no public API and the platform blocks external access. Here's what I can do instead:

1. **Manual entry** — you enter grades as they come in, I'll track trends and averages
2. **Photo capture** — take a screenshot of Pronote, I'll extract the data via OCR
3. **Notification** — I'll remind you to check Pronote every Friday afternoon

Which approach works for you?"

Marc chooses option 1 with a Friday reminder. He appreciates the honesty — the agent explained WHY it failed, offered concrete alternatives, and didn't oversell. Over the next few weeks, Marc enters grades manually. The agent builds a progress chart per subject and per child. When his daughter's math grades drop 3 points over two weeks, the agent flags it: "Math trend is declining for Léa — might be worth checking in with her."

**The Learned Behavior:** Week 3. Marc realizes something: Self has learned that Wednesday evenings are untouchable. Every Wednesday at 17h, the agent silences work-related modules and surfaces only family content — the kids' homework schedule, dinner plan, evening activity options. Marc never configured this rule. The agent inferred it from 3 weeks of behavior.

That same week, the agent recommends organic meal options based on a single conversation about healthy eating. Marc laughs — he's not an organic shopper. He opens the memory view, deletes the incorrect preference. The correction is instant. The agent never mentions organic again.

**Resolution:** Month 2. Marc's Self is structured, metric-heavy — 18 modules organized into Family, Fitness, and Work tabs. He drags his Running module above the Family Calendar on workout mornings, rearranging his home view like a dashboard he tunes weekly. He actively trims what doesn't work (5 modules deleted). He loves the "simplify" mindset — asking the agent "what haven't I used this month?" and removing dead weight. The Pronote workaround works well enough. Marc's lesson: the agent is honest about its limits, and that honesty builds more trust than a perfect track record.

**Requirements revealed:** Multi-source integration (OAuth proxy for Calendar), manual data input fallback when APIs fail, **agent failure transparency as a core UX pattern** (explain why, offer alternatives, don't oversell), OCR from screenshots as fallback input, learned behavioral patterns (Wednesday rule), module organization (tabs/categories), module lifecycle management (identify and remove unused modules), notification reminders as lightweight modules.

---

### Journey 4: Alex — The Self-Hoster (Admin, Single-User V1)

**Opening Scene:** Alex is a DevOps engineer who found Self on GitHub. He wants to self-host the Python backend for himself first — he values data sovereignty and doesn't want his SOUL data on anyone else's server.

**Rising Action:** Alex clones the repo. The README walks him through: Docker Compose with the Python backend (FastAPI), a SQLite database for memory, and optional Redis for caching. He runs `docker-compose up`, configures his Claude API key in `.env`, and the backend starts on port 8000. He downloads the mobile app and connects by scanning a QR code that encodes the server URL + auth token.

Alex is a single user running his own instance. The setup takes 10 minutes. He starts using Self like Seb — technical, autonomous, power-user style. His data never leaves his server.

**Climax:** Three weeks in. Alex notices the LLM costs are higher than expected — the heartbeat is running every 30 minutes, and module creation is using Claude Opus for everything. He opens the backend config and adjusts: heartbeat interval to 60 minutes, economic model (Moonshot) for heartbeat detection, premium model (Claude) only for module creation. Costs drop 60%. He also discovers the logs show every agent decision — full transparency and auditability.

Between cost optimizations, Alex opens the agent's knowledge summary — a human-readable view of everything the agent has learned, organized by topic. He scans for unexpected inferences. Nothing surprising. The transparency satisfies his security mindset.

One morning, a module creation fails. Alex checks the logs: the agent tried to call a TikTok analytics API that requires OAuth2 with a redirect URI, and the flow broke in the backend's OAuth proxy. The error is clear, the logs are detailed, the recovery path is obvious. He opens a GitHub issue with the log snippet.

**Resolution:** Month 2. Alex has a stable, self-hosted Self instance. He monitors costs via the logs, tweaks model routing, and contributes a Docker optimization PR back to the open-source project. Before a server migration, Alex exports all his data — conversations, modules, memory, SOUL — as a portable archive. The export completes in seconds. Full data sovereignty, fully portable. He's considering opening it up to his partner in V2 when multi-user support ships.

**Requirements revealed:** Docker Compose single-user deployment, QR code onboarding for mobile-to-server pairing, model routing configuration, detailed logging with agent decision audit trail, cost transparency (tokens used per action), graceful error reporting with actionable logs. **Multi-user isolation deferred to V2.**

---

### Journey 5: Fatima — The Genome Cloner (Secondary User, Community Discovery)

**Opening Scene:** Fatima is a freelance translator who sees a tweet: "This 'Freelance Translator' genome for Self changed how I manage my projects. Free, open-source." A link to a GitHub gist follows. Fatima has never heard of Self but is curious — she's tired of juggling DeepL, Google Sheets for quotes, and email for client communication.

**Rising Action:** Fatima taps the genome link. The app store page opens — she installs Self. On first launch, instead of the empty shell experience, she sees: "You're starting from a shared genome: 'Freelance Translator Pack' (v1.2). This includes 6 modules: Client Pipeline, Quote Calculator, Project Deadlines, Language Pair Tracker, Daily Word Count, and Invoice Generator. You can keep, modify, or remove any of these."

Fatima picks Star (custom — she wants to define her own interaction style). The agent presents the imported modules one by one: "Here's your Client Pipeline. It tracks clients by name, language pair, and status. Want to customize it or try it as-is?" Fatima explores each module, keeps 4, removes 2 (she doesn't track word count or language pairs that granularly), and asks: "Can you add a module for translation memory — terms I want to be consistent about across projects?"

During a rush translation job, Fatima mutes notifications for everything except Project Deadlines — she needs focus, not updates. The per-module muting lets her silence the noise without losing her safety net.

**Climax:** Week 2. Fatima's Self has diverged significantly from the original genome. She added her own modules, the agent learned her specific workflow (she always quotes in EUR, prefers weekly invoicing, and works in FR↔AR and FR↔EN). The genome was a starting point, but her Self is now uniquely hers. She realizes the power: she didn't start from zero, but she also didn't get stuck in someone else's workflow.

**Resolution:** Month 1. Fatima exports her own genome — "Freelance Translator AR/FR/EN" — and shares it on the Self community. A translator in Morocco imports it and starts their own divergent evolution. The cycle continues.

**Requirements revealed:** Genome import flow (from URL/link) with version metadata, guided module review on import (keep/modify/remove each), persona selection independent of genome, module customization post-import, genome export with metadata (version, description, author), genome format must be portable and serializable.

---

### Journey 6: Yuki — The Curious Explorer (Secondary User, No Initial Need)

**Opening Scene:** Yuki is a university student in Bordeaux studying environmental science. She sees Self on Product Hunt with the tagline "An app that does nothing? No — an app that does everything." She downloads it purely out of curiosity — she doesn't have a specific problem to solve.

**Rising Action:** Yuki picks Tree (collaborative). The poetic onboarding plays. The agent asks: "What's on your mind?" Yuki types: "I don't really know what I need. I just thought this was cool."

The agent doesn't rush to create modules. It enters **warm-up mode** — a conversational discovery phase designed for users without a clear need. "No problem at all. I'm curious about you. What does a typical week look like?" Yuki describes her routine. The agent listens, asks follow-up questions: "What part of your week feels the most chaotic?" "What do you wish you had more time for?" This goes on for 2-3 exchanges — no modules proposed yet.

Then Yuki mentions "thesis research" and the agent picks up on it, asking about her topic: biodiversity impact of urban heat islands. Only now does the agent make its first suggestion — a News aggregator pulling from environmental science RSS feeds filtered for urban ecology keywords. It's modest, relevant, and earned through conversation. Yuki is mildly impressed but not overwhelmed.

**Climax:** Week 2. Yuki mentioned in passing that she's stressed about her thesis deadline (April 15). The agent remembers. One morning, a simple module appears: a countdown to April 15 with a weekly milestone tracker. The agent says: "Based on what you've told me about your thesis chapters, here's a suggested timeline. Adjust it if it doesn't fit." Yuki stares at it. She never asked for a thesis planner. But it's exactly what she needed and was avoiding.

She starts using it daily. Then she asks: "Can you track the weather in Bordeaux? I need to plan my field sampling days — I can't collect samples when it rains." A weather module appears with a 10-day forecast highlighting dry windows.

**Resolution:** Month 2. Yuki went from "I don't know what I need" to 8 active modules — thesis tracker, weather for field work, environmental news, café shift schedule, lecture notes reminder, and three she didn't plan. Her Self discovered her needs through conversation. She tells her classmates: "It figured out what I needed before I did."

**Note:** Cross-module intelligence (weather suggesting optimal field sampling days based on thesis timeline) is a **V2 feature** — requires an event/data bus between modules. In V1, modules are independent; the user makes the connection manually.

**Requirements revealed:** Graceful handling of users with no initial need, **warm-up conversational mode** (2-3 discovery exchanges before first suggestion), progressive module suggestion based on conversation cues, agent remembering casual mentions for later use, proactive but gentle suggestions (Tree persona). Cross-module intelligence deferred to V2.

---

### Journey Requirements Summary

| Capability | Seb | Clara | Marc | Alex | Fatima | Yuki | MVP Priority |
|-----------|-----|-------|------|------|--------|------|-------------|
| Module creation from natural language | Core | Core | Core | — | Via genome | Core | **P0** |
| Trust-before-access pattern | — | Core | — | — | — | — | **P0** |
| Warm-up conversational mode | — | — | — | — | — | Core | **P1** |
| API key management | Yes | — | — | Config | — | — | **P0** |
| OAuth proxy (one-button connect) | — | Yes | Yes | — | — | — | **P1** |
| Heartbeat pre-computation | Yes | Yes | Yes | Admin | Yes | Yes | **P0** |
| Push notifications | Yes | — | — | — | — | — | **P1** |
| Agent work reports | Yes | — | — | — | — | — | **P2** |
| Agent failure transparency | — | — | Core | Logs | — | — | **P0** |
| Manual data input fallback | — | — | Yes | — | — | — | **P1** |
| OCR from screenshots | — | — | Nice-to-have | — | — | — | **P2** |
| Genome import/export | Export | — | — | — | Import+Export | — | **P1** |
| Guided genome review | — | — | — | — | Core | — | **P1** |
| Docker single-user deployment | — | — | — | Core | — | — | **P0** |
| Multi-user isolation | — | — | — | V2 | — | — | **V2** |
| Model routing config | — | — | — | Yes | — | — | **P1** |
| Detailed logging / audit trail | — | — | — | Core | — | — | **P1** |
| Module organization (tabs) | — | — | Yes | — | — | — | **P1** |
| Module lifecycle (trim unused) | — | — | Yes | — | Yes | — | **P1** |
| Learned behavioral patterns | — | — | Yes | — | — | — | **P2** |
| Cross-module intelligence | — | — | — | — | — | V2 | **V2** |
| Conversational need discovery | — | — | — | — | — | Core | **P1** |

**Note:** Capabilities marked P2 in this table correspond to features in the Phase 2 (V2) table in the Project Scoping section. They are included here for traceability to user journeys but are not part of the Functional Requirements capability contract (FR list) until promoted to a development phase.

## Innovation & Novel Patterns

### Detected Innovation Areas

Self combines six distinct innovation vectors — none individually unprecedented, but their convergence on mobile creates a genuinely new product category.

#### 1. Autonomous Module Creation (Category-Defining Innovation)

**What:** An AI agent that autonomously discovers APIs, writes module definitions (data sources, transform logic, display spec, lifecycle rules), fetches data, and delivers renderable results — all from a natural language request.

**Why it matters:** No existing product does this on mobile. OpenClaw validates the concept on desktop/chat but lacks visual rendering. No-code builders (Glide, Adalo) assemble from fixed catalogs. Self *creates* ex nihilo — a Blue Ocean innovation.

**Defensive Moat:** The accumulated SOUL.md and 4-layer memory constitute the real switching cost. The longer a user interacts with Self, the more irreplaceable the agent's understanding becomes. This is not a data lock-in (users own their data) — it's an *intelligence lock-in* that competitors cannot replicate without equivalent interaction history.

**Progressive Fallback:** At ~70-80% autonomous success rate for well-documented APIs, the 20-30% failure case must be graceful. When full autonomous creation fails, the agent falls back progressively:
1. **Semi-automatic mode** — Agent shows what it found (API candidates, partial definitions) and asks the user to help connect the dots
2. **Manual input mode** — Agent creates a module shell with manual data entry (like Marc's Pronote workaround)
3. **Community fallback** — Agent searches SelfAppHub for existing module definitions that match the request

#### 2. AI-as-Controller for Server-Driven UI (Integration Innovation)

**What:** Server-Driven UI (SDUI) is production-proven at Airbnb, Netflix, and Uber. Google's A2UI protocol standardizes agent-to-UI communication. The innovation is *not* SDUI itself — it's **connecting an autonomous AI agent as the controller** for a SDUI rendering engine. No product has done this: an agent that decides what UI to build, composes it from native primitives, and pushes it to a mobile client in real-time.

**Why it matters:** This eliminates the traditional development bottleneck. Adding "functionality" to the app requires zero code changes, zero app store updates — just an agent decision and a rendering instruction.

#### 3. Biological Architecture (Lifecycle Innovation)

**What:** Modules are living entities with measurable lifecycle metrics — not a metaphor, an architecture pattern.

**Concrete Metrics:**
- **Vitality Score** (0-100): Composite of usage frequency, recency, and interaction depth
- **Growth Rate**: Positive when usage increases week-over-week
- **Decay Threshold**: Vitality < 30 for 14+ days triggers dormancy warning
- **Dormancy**: Vitality < 15 for 30+ days — module moves to archive, resources freed
- **Death**: User confirms removal or 60+ days dormant with no interaction

**Why it matters:** Every other app accumulates clutter. Self self-prunes. Modules that serve the user thrive; those that don't, fade. This mirrors natural selection and produces an app that stays relevant over time without manual cleanup.

#### 4. Anti-Repetition Memory Pipeline (Intelligence Innovation)

**What:** 4-layer memory system (SOUL.md + Core Memory always in context, Semantic Store + Episodic Store on-demand via SQLite + sqlite-vec) with an anti-repetition pipeline that classifies every interaction as ADD/UPDATE/DELETE/NOOP — inspired by Mem0's approach.

**Why it matters:** Current AI assistants have no persistent personality or memory across sessions (ChatGPT's memory is shallow). Self's agent *never forgets* and *never repeats*. The anti-repetition pipeline ensures memory is curated, not just accumulated.

**Performance Constraint:** The ADD/UPDATE/DELETE/NOOP classification must execute within a **< 50ms latency budget** per interaction to avoid degrading conversational UX. This is achievable with local sqlite-vec embeddings and lightweight classification on the backend.

#### 5. Heartbeat-Driven Mobile Experience (Proactivity Innovation)

**What:** A dual-tier background system: (a) Module refresh crons — pure HTTP calls on timer, no LLM involvement, near-zero cost; (b) Agent heartbeat — periodic wake (default 30min) using economic model for detection, premium model only when action needed. HEARTBEAT_OK optimization means most runs cost < 500 tokens.

**Why it matters:** Mobile apps are passive — they wait for you to open them. Self works while you sleep. When Seb opens his phone at 7:15am, marine weather is already fresh. This transforms the mobile experience from pull to push.

#### 6. Genome as Application Exchange Format (Ecosystem Innovation)

**What:** A portable, versioned, serializable format (JSON/YAML) that encodes a complete Self configuration — modules, agent personality, memory seeds, layout preferences. Not a template. Not a widget pack. A **genome** — a starting point that diverges through individual use.

**Why it matters:** No product allows you to export a complete *app configuration* and import it as a personalized starting point. App stores distribute apps. Self distributes *genomes* — the DNA of an app that evolves differently in every host. This creates a new distribution paradigm: Fatima imports a "Freelance Translator" genome and within 2 weeks, her Self has diverged into something uniquely hers.

### Timing as Strategic Advantage

The convergence window for Self is **now** — and it's temporary.

| Building Block | Maturity | Timeline |
|---------------|----------|----------|
| LLMs capable of autonomous API integration | Claude 4+, GPT-5 achieve 70-80% on well-documented APIs | Became viable 2025 |
| Server-Driven UI in production | Airbnb (2023), Google A2UI protocol (2025) | Standard emerging now |
| Agent memory research | Mem0, MemGPT, LangGraph memory patterns | Exploding 2025-2026 |
| LLM cost trajectory | -90% in 2 years, making heartbeat economically viable | Accelerating |
| Mobile agent infrastructure | Python backend + WebSocket + BYOK is fully feasible | Ready now |

**Window estimate:** 12-18 months before major platform players (Apple Intelligence, Google Gemini) integrate similar autonomous capabilities natively into their ecosystems. Self's advantage: open-source, BYOK, no vendor lock-in, and a head start on the memory/personality layer.

### Market Context & Competitive Landscape

| Competitor / Category | What They Do | What They Don't Do |
|----------------------|-------------|-------------------|
| **OpenClaw** | Self-improving agent, skill creation, HEARTBEAT.md, ClawHub marketplace (5,700+ skills) | Desktop/chat only, no visual UI rendering, no mobile experience |
| **No-code builders** (Glide, Adalo, FlutterFlow) | Visual app building from templates and components | No AI autonomy, manual design required, no memory, no proactive behavior |
| **Super-apps** (WeChat, Grab) | Many services in one app | Zero personalization, fixed feature set, no AI agent |
| **Native widgets** (iOS, Android) | Simple data display on homescreen | No intelligence, no cross-communication, no agent, limited customization |
| **Apple Intelligence + Shortcuts** | On-device AI, system integration, Siri actions | Closed ecosystem, no autonomous module creation (yet), no persistent agent personality, no BYOK |
| **AI agent hardware** (Rabbit R1, Humane AI Pin) | Dedicated agent-first devices, autonomous task execution | Dedicated hardware (adoption barrier), limited UI, commercially struggling — but validate the concept |
| **ChatGPT / Claude chat** | Conversational AI with memory | No persistent UI, no mobile modules, no proactive behavior, no visual rendering |

**Self's unique position:** Open-source + BYOK + no dedicated hardware + autonomous creation + native mobile rendering + persistent personality. No existing product combines all six.

### Validation Approach

| Innovation | Validation Method | Signal #0 (Trust Gate) | Success Threshold |
|-----------|------------------|----------------------|-------------------|
| Autonomous Module Creation | End-to-end test: 50 natural language requests across 10 API categories | Do users **adopt** agent-created modules or immediately delete them? Qualitative test with 10 users. | ≥70% successful module creation; ≥80% adoption rate of created modules |
| AI-as-Controller SDUI | Rendering coverage test: agent-generated specs vs. primitive library | Do users perceive agent-composed UIs as "real app" quality? | Zero "unsupported" errors; user satisfaction ≥ 4/5 on UI quality |
| Biological Architecture | 30-day lifecycle simulation with synthetic usage patterns | Do users find auto-pruning helpful or alarming? | Vitality scores correlate with actual usage; ≥70% user approval of dormancy suggestions |
| Anti-Repetition Memory | Conversation replay test: 100 interactions, measure repeat rate | — | < 5% interaction repeat rate; classification latency < 50ms |
| Heartbeat System | Cost + freshness test: 7-day heartbeat simulation | — | < 500 tokens per HEARTBEAT_OK; ≥80% of opens show fresh data |
| Genome Exchange | Round-trip test: export → import → divergence tracking | Do users modify imported genomes or use them as-is? | Successful import ≥95%; ≥60% of users customize within first week |

**Signal #0 — The Trust Gate:** Validation gate: Before public release, conduct a structured usability test with 10 participants. Protocol: unassisted first-module creation on a fresh install. Success criterion: 8/10 participants create a functional module within 90 seconds without assistance. If fewer than 6/10 succeed, the onboarding flow must be redesigned before release. This gate is tracked as a milestone in the project roadmap.

### Risk Mitigation

Key innovation risks and their mitigations. For the complete risk mitigation strategy (technical, market, and resource risks with contingency plans), see the **Risk Mitigation Strategy** in the Project Scoping section.

| Risk | Impact | Mitigation |
|------|--------|------------|
| Autonomous creation < 50% success | Core value prop fails | Progressive fallback (semi-auto → manual → community); curated starter APIs |
| User distrust of autonomous creation | Adoption barrier | Signal #0 trust test; trust-before-access pattern; full transparency; easy undo |
| App Store rejection | No distribution | SDUI is production-proven (Airbnb, Netflix); no dynamic code execution |
| Apple/Google build native equivalent | Market disruption | 12-18 month head start; open-source moat; SOUL.md intelligence lock-in |

## Mobile App Specific Requirements

### Project-Type Overview

Self is a **React Native cross-platform application** (iOS + Android) that functions as a thin rendering client. The mobile app does not contain business logic — it receives structured rendering instructions from a Python backend (FastAPI + WebSocket) and composes native UI primitives accordingly. This Server-Driven UI architecture means the mobile client is a stable, rarely-updated shell while all intelligence lives on the backend.

### Platform Requirements

| Requirement | Specification |
|------------|---------------|
| Framework | React Native (Expo managed workflow recommended for faster iteration) |
| iOS minimum | iOS 16+ (covers ~95% of active devices) |
| Android minimum | Android 10+ / API 29 (covers ~90% of active devices) |
| Rendering engine | Native UI primitives (no WebView for core modules) |
| Communication | WebSocket (persistent) for real-time updates + REST fallback for initial handshake |
| Local storage | SQLite (via expo-sqlite) for module cache + offline state |
| Secure storage | expo-secure-store for API keys and auth tokens |
| State management | Lightweight (Zustand or Jotai) — most state is server-driven |

**Cross-Platform Parity:** Feature parity between iOS and Android is a hard requirement. No platform-exclusive functionality in MVP. Platform-specific adaptations limited to navigation patterns (bottom tabs iOS, material drawer Android) and notification handling.

### Device Permissions

| Permission | Purpose | When Requested | MVP Priority |
|-----------|---------|---------------|-------------|
| Internet | Core functionality — WebSocket to backend | Always (required) | **P0** |
| Push Notifications | Heartbeat alerts, significant changes | After first module created (trust-before-access) | **P1** |
| Camera | OCR fallback for manual data input (screenshot → data) | Only when user requests OCR feature | **P2** |
| Background Refresh | Keep heartbeat data fresh between app opens | After user enables heartbeat modules | **P1** |
| Secure Enclave / Keychain | Store API keys and BYOK LLM provider tokens | During API key input flow | **P0** |

**Permission Philosophy:** Follow the trust-before-access pattern from Clara's journey. Never request permissions at first launch. Demonstrate value first, then request permissions when the user action naturally requires it.

### Offline Mode

**MVP approach: Cache-first, not offline-first.**

- **Cached content:** Last-known module state stored locally in SQLite. When user opens the app without connectivity, they see the last cached render — not a blank screen.
- **Offline indicator:** Clear visual indicator when backend is unreachable. Modules show "last updated" timestamp.
- **Queue behavior:** User messages typed offline are queued and sent when connection restores.
- **No offline intelligence in V1:** The agent requires the backend (LLM providers are cloud-based). Offline mode in V1 is strictly "display cached data + queue inputs."
- **Full offline mode (V2):** Embedded local model (e.g., Phi-3, Llama) for basic conversational intelligence offline, with sync when reconnected.

### Push Notification Strategy

**Dual-tier notification system matching the dual-tier heartbeat:**

| Tier | Source | Frequency | Content | Priority |
|------|--------|-----------|---------|----------|
| **Module refresh** | Cron-triggered HTTP data fetch (no LLM) | Per module schedule (15min–24h) | "Marine weather updated" / significant data change | Normal |
| **Agent insight** | Heartbeat agent detection (economic LLM) | Default every 30min during active hours | "Wind force 7 detected on your Saturday route" | High |

**Notification Rules:**
- Respect active hours (configurable, default 7h–23h)
- Batch low-priority notifications (max 3 per hour)
- High-priority notifications delivered immediately (agent determines significance)
- User can mute per-module or globally
- **HEARTBEAT_OK = no notification** — silence is the default, alerts are the exception

**Technical Implementation:**
- iOS: APNs via backend push service
- Android: FCM via backend push service
- Backend determines notification content and priority — mobile client just displays

### App Store Compliance

**Risk level: Low.** The SDUI architecture is production-proven and App Store compliant.

| Compliance Area | Status | Justification |
|----------------|--------|---------------|
| **No dynamic code execution** | Compliant | App renders from native primitives via JSON specs — no JavaScript injection, no eval(), no remote code loading |
| **SDUI precedent** | Strong | Airbnb, Netflix, Uber, Spotify use SDUI in production iOS apps. Apple explicitly allows server-driven layout composition |
| **Google A2UI protocol** | Emerging standard | Google's Agent-to-UI protocol standardizes this pattern |
| **Content policy** | Compliant | User-generated content (modules) is personal and local — no UGC moderation needed for App Store |
| **BYOK model** | Compliant | User provides their own API keys — app doesn't proxy paid AI services |
| **Background activity** | Requires care | Background refresh must use iOS Background Tasks API correctly; excessive background activity triggers App Store review |
| **Privacy nutrition label** | Required | Must accurately declare: network usage, local storage, optional camera, push notifications, no tracking |

**Pre-submission strategy:** Prepare App Store reviewer notes explaining the SDUI architecture, referencing Airbnb/Netflix precedent. Include a demo video showing module creation to prevent confusion about "dynamic content."

### Implementation Considerations

**QR Code Onboarding (Self-Hosted):** For users running their own backend (Alex's journey), the mobile app connects via QR code scanning that encodes server URL + one-time auth token. This avoids manual URL entry and provides a secure initial handshake.

**Deep Link Support:** Genome import via URL (Fatima's journey) requires deep link handling — `selfapp://import?genome=<url>` or Universal Links for App Store discoverability.

**Performance Budgets:** See NFR1–NFR9 in the Non-Functional Requirements section for complete performance targets with measurement methods.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach: Experience MVP — "The First Module Test"**

The minimum viable product must prove one thesis: *a user can talk to an AI agent in natural language and get a working, data-driven module rendered on their phone within 60 seconds.* If this works, everything else follows. If it doesn't, no amount of features will save the product.

This is not a feature MVP (checkbox of capabilities) or a platform MVP (build the ecosystem first). It's an **experience MVP** — the goal is to deliver one magical moment that validates the core product thesis: autonomous module creation with native mobile rendering.

**Resource Requirements:** Solo developer (Seb) + BYOK LLM access. The architecture (Python backend + React Native thin client) is deliberately chosen to be buildable by a single full-stack developer. No dedicated designer needed — SDUI primitives provide consistent visual quality. No DevOps team needed — Docker Compose single-command deployment.

### Two-Stage MVP: First Light → Full MVP

To avoid a 6-month development tunnel with nothing to show, the MVP is split into two stages with distinct validation gates.

#### P0-core — Alpha "First Light"

**Goal:** Prove the core thesis with the simplest possible implementation.
**Timeline target:** 6-8 weeks.
**Definition of Done:** Seb can say "météo marine Audierne–Belle-Île" and see a rendered module on his phone in < 60 seconds.

**Capabilities:**

| Capability | Scope | Notes |
|-----------|-------|-------|
| Conversational shell | Basic chat interface, persona selection | No poetic onboarding animation yet |
| Autonomous module creation | Core creation pipeline | THE differentiator — this is the sprint |
| SDUI rendering engine | 5 primitives: Card, List, Text, Metric, Layout (Stack/Grid) | Chart, Map, Timeline added in P0-full |
| Memory | SOUL.md + Core Memory (always in context) | Semantic + Episodic stores deferred to P0-full |
| BYOK | 1 provider (Claude) | Multi-provider routing in P0-full |
| Module refresh | Cron-based HTTP data fetch (no LLM) | Agent heartbeat deferred to P0-full |
| Deployment | Docker Compose single-command | Self-hosted only |
| Module Definition Format | JSON schema — the architectural backbone | FIRST deliverable (everything depends on this) |

**Architectural Critical Path (build sequence):**

```
1. Module Definition Format (JSON schema)     ← FIRST — everything depends on this
2. Python backend skeleton (FastAPI + WebSocket)
3. Agent ↔ LLM integration (module creation pipeline)
4. SDUI rendering engine (5 primitives, React Native)
5. Memory layer (SOUL.md + Core Memory)
6. Module refresh crons (HTTP, no LLM)
7. Docker packaging
```

Each step validates the next. This is a pipeline, not a backlog.

#### P0-full — MVP Release

**Goal:** Ship a publicly usable product that passes the First Module Test with external users.
**Timeline target:** 4-5 months after First Light.
**Definition of Done:** First Module Test passes with 5 external users (module created in < 30 seconds). D7 retention > 30%.

**Prioritization note:** MVP scope assumes full-time solo development. If velocity is lower than projected, the following FRs are deprioritized within P0-full (in order): FR49 QR pairing, FR53 undo system, FR45 notification scheduling. Core module creation and rendering pipeline takes absolute priority.

**Adds to First Light:**

| Capability | Rationale |
|-----------|-----------|
| Full onboarding (poetic animation, persona presets Flame/Tree/Star) | First impression matters for non-technical users |
| Extended SDUI primitives (+Chart, +Map, +Timeline, +Table, +Form, +Badge) | Cover all journey module types |
| 4-layer memory (+ Semantic Store + Episodic Store via sqlite-vec) | "Never repeat" promise requires full memory |
| Anti-repetition pipeline (ADD/UPDATE/DELETE/NOOP) | Memory curation, < 50ms latency budget |
| BYOK multi-provider + model routing | 2-3 providers (Claude premium + DeepSeek/Moonshot economic) |
| Agent heartbeat (LLM-driven detection) | Proactive insights beyond simple data refresh |
| Agent failure transparency | Trust through honesty (Marc's journey) |
| Trust-before-access pattern | Never ask permissions before proving value |
| API key secure management (expo-secure-store) | Required for any external API module |
| QR code onboarding (self-hosted) | Mobile ↔ backend pairing |
| WebSocket real-time updates | Live module updates without polling |
| Cache-first offline behavior | No blank screen on disconnection |

### Post-MVP Features

#### P1 — Growth-Ready Release

**Definition of Done:** 10+ module types validated, push notifications working, genome import/export functional.

| Capability | Rationale | Dependency |
|-----------|-----------|------------|
| Push notifications (APNs + FCM) | Heartbeat value is invisible without notifications | Heartbeat must work first |
| OAuth proxy (one-button connect) | Non-technical users need this for Calendar, Sheets | Module creation must work first |
| Genome import/export | Community distribution — Fatima's journey | Module format must be stable |
| Guided genome review (keep/modify/remove) | UX for genome import | Genome format required |
| Warm-up conversational mode | Yuki's journey — users with no clear need | Chat shell must work first |
| Module organization (tabs/categories) | Marc's journey — 18+ modules need structure | Multiple modules must exist |
| Module lifecycle management (vitality score, dormancy) | Biological architecture — auto-prune unused | Usage tracking required |
| Model routing configuration UI | Alex's journey — cost control | BYOK backend must work first |
| Detailed logging / audit trail | Self-hoster trust + debugging | Backend must be functional |
| Manual data input fallback | Marc's Pronote workaround | Module shell rendering required |
| Conversational need discovery | Progressive suggestion from conversation cues | Memory must work first |
| Deep link support (genome URL import) | Fatima's journey | Genome format required |

#### Phase 2 — Growth (V2)

| Feature | Value | Prerequisite |
|---------|-------|-------------|
| SelfAppHub marketplace | Community module sharing — network effects | Stable module definition format |
| Multi-user isolation | Couples, families, teams on shared backend | Single-user must be rock-solid |
| Cross-module intelligence | "Weather says rain → reschedule field sampling" | Event/data bus between modules |
| Advanced proactive behavior | Pattern detection, unsolicited module proposals | Behavioral analytics + trust established |
| Persona mutation | Agent personality evolves with interaction | Extensive interaction data needed |
| Offline mode with local model | Phi-3/Llama for basic intelligence offline | On-device inference optimization |
| Module self-improvement | Agent optimizes its own modules from usage | Module analytics required |
| Agent work reports | "Here's what I did overnight" briefing | Heartbeat + logging mature |
| OCR from screenshots | Photo → structured data (Pronote workaround) | Camera permission + vision model |
| Learned behavioral patterns | "Wednesday evenings = family time" auto-detection | Extensive usage history needed |

#### Phase 3 — Vision (V3)

| Feature | Description |
|---------|------------|
| Cross-user pollination | "Users like you also have this module" recommendations |
| Agent-to-agent communication | Modules that collaborate and share data autonomously |
| Biological speciation | Emergent Self archetypes (Self Freelance, Self Student, Self Sailor) |
| Self Compose | Shareable complete app configurations (genomes on steroids) |
| Voice-first interaction | Full voice control for hands-free use |
| Multi-device sync | Desktop companion, tablet layout, wearable glance |

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Mitigation | Contingency |
|------|-----------|-------------|
| Module creation success < 50% | Curated "starter APIs" list (Open-Meteo, Stripe, Google Calendar) for reliable first experiences | Progressive fallback: semi-auto → manual → community |
| SDUI primitive library insufficient | Start with 5 primitives for First Light, expand to 10+ for MVP; agent learns to compose complex UIs from simple parts | Add primitives driven by actual agent demand, not speculation |
| Memory latency degrades UX | Anti-repetition pipeline budget: < 50ms; sqlite-vec local embeddings | Batch classification async if budget exceeded |
| WebSocket reliability on mobile | Automatic reconnection with exponential backoff; REST fallback | Cache-first ensures no blank screen on disconnection |
| Module Definition Format instability | Design format first (critical path step 1); version from day one; breaking changes only before MVP | Format is the backbone — get it right early |

**Market Risks:**

| Risk | Mitigation | Validation Signal |
|------|-----------|------------------|
| Users don't trust autonomous creation | Signal #0 trust test with 10 users before scaling | ≥80% adoption rate of agent-created modules |
| No clear "aha moment" | First Module Test — if first module doesn't wow, iterate until it does | Second session rate > 50% |
| Apple/Google build native equivalent | 12-18 month head start; open-source community moat; SOUL.md intelligence lock-in | Community growth: 1,000+ GitHub stars in 6 months |
| AI ecosystem fatigue | Market is saturated with "AI-powered" vaporware. Self must **show, not tell**: 30-second GIF on README ("I typed this → got this"), no buzzwords, no "revolutionary AI", just the rendered result | Launch traction: 100+ stars in first week from organic HN/Reddit |

**Resource Risks:**

| Scenario | Impact | Contingency |
|----------|--------|-------------|
| Solo developer bottleneck | Slower iteration, risk of burnout | First Light in 6-8 weeks validates before committing to full MVP. If First Light fails, pivot early |
| LLM costs higher than expected | Heartbeat becomes expensive | HEARTBEAT_OK optimization; increase intervals; economic model only for detection; cron-only refresh for First Light |
| API providers change terms/pricing | Key modules break | BYOK means user absorbs provider costs; multi-provider fallback; community maintains API adapters |

### Scope Decision Rules

When in doubt about whether a feature belongs in the current phase, apply these filters in order:

0. **Can you build it this week?** → If no, it's not P0-core (solo dev discipline)
1. **Does the First Module Test fail without it?** → Must-have for P0-core
2. **Does it prevent a P0 journey from completing?** → Must-have for P0-full
3. **Can it be done manually by the user for now?** → Defer
4. **Does it only matter at 100+ users?** → Defer to V2
5. **Is it an optimization of something that must exist first?** → Defer until the base exists

## Functional Requirements

**This FR list is the capability contract for all downstream work.** UX designers will only design what's listed here. Architects will only support what's listed here. Epic breakdown will only implement what's listed here. Any capability not listed will not exist in the final product unless explicitly added.

**Phase Legend:** `⚡ First Light` = P0-core (6-8 week alpha) · `🚀 MVP` = P0-full · `📈 Growth` = P1

### Conversation & Onboarding

- **FR1** `⚡`: User can engage in natural language conversation with the agent in any language
- **FR2** `⚡`: User can select a persona preset (Flame / Tree / Star) during onboarding that shapes agent interaction style, autonomy level, and communication tone
- **FR3** `🚀`: User can experience a guided onboarding flow on first launch introducing the product concept with a branded visual animation sequence
- **FR4** `📈`: User can receive conversational discovery prompts when they express no specific need (warm-up mode with 2-3 exchanges before first suggestion)
- **FR5** `⚡`: User can view agent responses in real-time as they are streamed
- **FR6** `🚀`: Agent can adapt its communication style and proactivity level based on the selected persona preset
- **FR7** `📈`: User can change their persona preset at any time after onboarding
- **FR8** `⚡`: User can view a contextual empty state that invites conversation when no modules exist yet
- **FR54** `🚀`: System defers all data access permission requests and external service connection prompts until the user has received value from at least one conversation exchange

### Module Creation & Management

- **FR9** `⚡`: User can request creation of a new module by describing their need in natural language
- **FR10** `⚡`: Agent can autonomously discover relevant APIs and data sources matching a user's request
- **FR11** `⚡`: Agent can create complete module definitions in a structured, versioned format that the rendering engine can interpret. The module definition format shall include at minimum: module name, type, data sources (array), layout template, refresh interval, and schema_version. The format shall support forward compatibility (adding optional fields without breaking existing modules). Every stored module spec must include a schema_version field.
- **FR12** `🚀`: Agent can present a semi-automatic creation flow when full autonomous creation fails, showing discovered candidates and asking user to help connect the pieces
- **FR13** `📈`: User can provide manual data input to populate a module when no suitable API is available
- **FR14** `🚀`: Agent can explain transparently why module creation failed, including the reason, what was attempted, and concrete alternative approaches
- **FR15** `🚀`: Agent can propose new modules proactively based on observed user patterns; user can accept or decline each proposal
- **FR16** `🚀`: User can refine or query a specific module through contextual conversation (e.g., "show only days under force 4")

### Module Rendering & Display

- **FR17** `⚡`: User can view modules rendered as native UI components on their mobile device
- **FR18** `⚡`: Agent can compose module layouts from a library of UI rendering primitives (First Light: Card, List, Text, Metric, Layout; MVP adds: Chart, Map, Timeline, Table, Form, Badge)
- **FR19** `🚀`: User can interact with rendered modules (tap, scroll, expand details, navigate within module content)
- **FR20** `📈`: User can organize modules into user-defined categories or tabs
- **FR21** `🚀`: User can view the last cached state of modules when the backend is unreachable, with a clear indication of when data was last refreshed
- **FR22** `📈`: User can reorder and arrange modules on their dashboard view (Dashboard Mode — full-screen module gallery)

### Connection Resilience & Offline

- **FR56** `⚡`: The system shall automatically reconnect to the backend within 3 seconds of detecting a connection loss, using exponential backoff
- **FR57** `⚡`: The system shall queue user messages during disconnection and deliver them in order upon reconnection
- **FR58** `⚡`: The system shall render cached module data when the backend is unavailable

### Module Lifecycle

- **FR23** `🚀`: System can track module usage metrics (open frequency, recency, interaction depth) and compute a vitality score
- **FR24** `📈`: System can transition modules through lifecycle states (active → declining → dormant → dead) based on vitality thresholds
- **FR25** `📈`: User can receive a notification when a module becomes dormant, with the option to revive or remove it
- **FR26** `🚀`: User can manually delete, archive, or restore any module at any time
- **FR27** `📈`: User can ask the agent which modules are unused and receive a cleanup recommendation
- **FR28** `⚡`: Agent can set a default refresh schedule for each module based on data type; user can override the schedule for any module

### Agent Memory & Identity

- **FR29** `⚡`: Agent can maintain a persistent identity, personality, and accumulated knowledge across all sessions (SOUL.md)
- **FR30** `🚀`: Agent can remember and accurately reference user preferences, context, and details from past conversations without the user repeating information
- **FR31** `🚀`: Agent can classify each interaction for memory curation: add new knowledge, update existing knowledge, delete outdated knowledge, or skip
- **FR32** `📈`: User can view a human-readable summary of what the agent knows about them, organized by topic
- **FR33** `📈`: User can correct or delete specific agent memories

### Data Sources & Authentication

- **FR34** `🚀`: User can securely store API keys for external services
- **FR35** `📈`: User can connect external services via a simplified OAuth flow (single "Connect" button, no technical screens). *OAuth proxy complexity note:* Self-hosted deployments on dynamic IPs or localhost may not support OAuth redirect flows for all providers. First implementation targets providers supporting localhost redirect URIs (Google, GitHub). Providers requiring registered domains are deferred until a tunnel/proxy solution is validated.
- **FR36** `⚡`: User can configure their own LLM provider API keys (BYOK)
- **FR37** `🚀`: User can select between 2 or more LLM providers and configure routing preferences (premium model for creation, economic model for simple queries)
- **FR38** `📈`: User can view token usage and estimated costs per action and per time period
- **FR39** `🚀`: System can authenticate the mobile client with the backend and maintain a secure session across reconnections
- **FR59** `🚀`: The system shall validate API key validity on first use and notify the user immediately if a key is expired, revoked, or has insufficient quota

### Proactive Behavior & Notifications

- **FR40** `⚡`: System can periodically refresh module data in the background via scheduled HTTP calls (cron, no LLM)
- **FR41** `🚀`: Agent can evaluate module states during heartbeat cycles and detect significant changes worthy of user attention

**Module refresh routing:** Each module definition includes a `refreshStrategy` field with values `cron` (simple HTTP fetch, no LLM) or `heartbeat` (LLM-evaluated refresh). First Light uses `cron` only. MVP adds `heartbeat`. The agent sets this field at module creation time based on data source complexity.
- **FR42** `📈`: User can receive push notifications for significant data changes detected by the agent
- **FR43** `📈`: User can configure active hours during which notifications and heartbeat activity are permitted
- **FR44** `📈`: User can mute notifications per-module or globally
- **FR45** `🚀`: Agent can prepare fresh data before the user's typical usage time so content is ready on app open

### Configuration, Sharing & Administration

- **FR46** `📈`: User can export their complete Self configuration (modules, personality, memory seeds, preferences) as a portable genome file
- **FR47** `📈`: User can import a genome from a URL, file, or deep link
- **FR48** `📈`: User can review imported genome modules individually and choose to keep, modify, or remove each one
- **FR49** `⚡`: User can connect their mobile app to a self-hosted backend through a single-action pairing flow (no manual URL entry)
- **FR50** `📈`: Admin can view detailed logs of all agent decisions, actions, and errors
- **FR51** `📈`: Admin can monitor and configure heartbeat intervals, model routing, and cost thresholds
- **FR52** `📈`: User can export all their data (conversations, modules, memory, SOUL) for portability
- **FR55** `⚡`: Admin can deploy the complete backend using a single command with default configuration requiring only an LLM API key

### Genome Security (P1)

- **FR60** `📈`: The system shall validate all URLs in an imported genome against an allowlist of known API patterns before activation
- **FR61** `📈`: The system shall display a security summary of genome contents (number of modules, API endpoints referenced, permissions required) before user confirms import

### Safety & Reversibility

- **FR53** `🚀`: User can undo the last agent action (module creation, module deletion, memory update) within 60 seconds of the action completing

## Non-Functional Requirements

### Performance

| NFR | Metric | Target | Measurement | Rationale |
|-----|--------|--------|-------------|-----------|
| **NFR1:** App cold start to cached content visible | Time from tap to first render | < 2 seconds | Automated performance test on mid-range device | Users abandon apps that feel slow on launch; cached content must appear instantly to build trust |
| **NFR2:** App warm start to interactive | Time from background resume to usable | < 500ms | Automated test | Mobile users switch apps frequently; resume must feel instantaneous |
| **NFR3:** Module render from server spec | Time from receiving JSON spec to native render complete | < 100ms | In-app profiling | SDUI rendering must feel native, not web-like; perceptible delay breaks the illusion |
| **NFR4:** Fresh module creation end-to-end | Time from user request to rendered module | < 30 seconds (First Light: < 60s acceptable) | End-to-end test including LLM + API call | The "First Module Test" depends on fast creation; 30s (MVP) / 60s (First Light) keeps the conversational flow |
| **NFR5:** WebSocket reconnection | Time from disconnection detected to reconnected | < 1 second | Network simulation test | Mobile networks are unreliable; seamless reconnection prevents data staleness |
| **NFR6:** Anti-repetition memory classification | Latency per interaction for memory curation | < 50ms | Backend profiling | Classification runs on every interaction; latency above 50ms degrades conversational UX. Budget validated by: local embedding model (all-MiniLM-L6-v2 quantized, ~30ms) + sqlite-vec similarity search (<5ms at 10K entries) + threshold comparison (~1ms). No LLM call required in the anti-repetition path. |
| **NFR7:** Agent conversational response (first token) | Time from user message to first streamed token | < 1 second | End-to-end latency test | Conversational AI needs fast first-token to feel responsive; streaming mitigates total generation time |
| **NFR8:** Heartbeat HEARTBEAT_OK cost | Token usage when nothing needs attention | < 500 tokens per run | Token counting per heartbeat cycle | Heartbeat runs every 30min; high cost per run makes the system economically unviable for BYOK users |
| **NFR9:** Cron module refresh | Time for HTTP data fetch + cache update | < 5 seconds per module | Background task profiling | Pre-computed data must be ready before user opens app; slow refresh defeats the heartbeat value proposition |

### Security & Privacy

| NFR | Requirement | Verification | Rationale |
|-----|------------|-------------|-----------|
| **NFR10:** API keys and LLM provider tokens encrypted at rest | AES-256 or platform secure enclave | Security audit | BYOK model means users store sensitive API keys; compromise exposes their accounts and billing |
| **NFR11:** All mobile ↔ backend communication encrypted in transit | TLS 1.3 minimum | Certificate pinning test | Conversations and SOUL data transit the network; interception exposes the user's complete profile |
| **NFR12:** Session authentication with token rotation | Token-based auth with refresh mechanism; session invalidation on logout | Auth flow test | Self-hosted backends are internet-accessible; stolen session tokens grant full agent access |
| **NFR13:** No telemetry or analytics sent to any third party by default | Zero network calls to external analytics services unless user explicitly enables | Network traffic audit | Core differentiator: "radically open, no vendor lock-in." Any hidden telemetry destroys trust and open-source credibility |
| **NFR14:** All user data (conversations, memory, SOUL, modules) stored locally or on user's self-hosted server | No cloud dependency for data storage; no data leaves user's infrastructure | Architecture review | Data sovereignty is a founding principle; Alex's journey explicitly requires no external data dependency |
| **NFR15:** LLM provider API calls contain no identifying metadata beyond what the user configures | Agent sends only the prompt and configured model parameters; no user IDs, device IDs, or tracking | API call inspection | Users must trust that their BYOK keys don't leak identity; privacy-conscious users (Alex) will audit this |
| **NFR16:** Secure deletion — when user deletes data, it is removed from all storage layers | No ghost data in any storage layer after deletion | Data lifecycle test | FR33 allows memory deletion; incomplete deletion violates user trust and potentially GDPR right-to-erasure |
| **NFR17:** OAuth proxy handles token storage server-side; mobile client never sees raw OAuth tokens for external services | Tokens stored on backend, mobile receives only a session reference | Architecture review | Non-technical users (Clara) must never encounter OAuth complexity; token exposure creates security risk |
| **NFR34:** The backend shall enforce rate limiting of 60 requests per minute per session on all endpoints | Rate limit enforcement verified under load | Rate limit test | Prevent abuse on self-hosted instances |
| **NFR35:** The backend shall validate and sanitize all user input before database storage to prevent injection attacks | No raw user input in SQL queries; parameterized queries mandatory | Security audit + injection test suite | SQLite parameterized queries mandatory |
| **NFR36:** The Docker deployment shall run as non-root user with read-only filesystem except for the data volume | Container runs as UID != 0; filesystem mounted read-only | Docker security scan + runtime audit | Container hardening baseline |

### Reliability

| NFR | Metric | Target | Measurement | Rationale |
|-----|--------|--------|-------------|-----------|
| **NFR18:** Cache-first rendering — app displays last known state when backend is unreachable | Cached content visible on offline open | 100% of modules | Airplane mode test | Users open Self expecting content; a blank screen on disconnection destroys the "app that works for you" promise |
| **NFR19:** Message queue for offline input — user messages typed offline are delivered when connection restores | Message loss on reconnection | Zero | Network interruption test | Lost messages mean lost user intent; the agent must never silently drop a request |
| **NFR20:** Graceful degradation — individual module refresh failure does not affect other modules or the app | Module failure isolation | Other modules continue to render and refresh | Fault injection test | Autonomous module creation means diverse API dependencies; one failing API must not cascade to the entire app |
| **NFR21:** Heartbeat system resilience — missed heartbeat cycles do not cause data loss or state corruption | State integrity after extended disconnection | Clean recovery, zero data loss | Extended offline simulation | Mobile connectivity is intermittent; the heartbeat must be resilient to gaps without corrupting state |
| **NFR22:** Agent error recovery — LLM provider errors (timeout, rate limit, quota) produce structured user-facing messages (error category, explanation, suggested next action), not crashes | Unhandled exceptions from LLM provider failures | Zero | Error injection test | BYOK means varied providers with different error modes; Marc's journey shows failure transparency builds trust |

### Integration

| NFR | Metric | Target | Measurement | Rationale |
|-----|--------|--------|-------------|-----------|
| **NFR23:** LLM provider abstraction — switching between providers requires only API key configuration, no code changes | Provider support with identical agent capabilities | Minimum 2 providers (Claude + one economic model) | Provider swap test | BYOK is a core differentiator; provider lock-in contradicts the open-source, no-vendor-lock-in promise |
| **NFR24:** External API timeout handling — module creation and refresh calls to third-party APIs timeout gracefully | API call timeout with structured error (error category, explanation, suggested next action) | Default 10 seconds; configurable per module | Slow API simulation | Agent autonomously calls unknown APIs; uncontrolled timeouts freeze the UX and waste LLM tokens |
| **NFR25:** Push notification delivery for heartbeat alerts | Time from backend trigger to notification delivery | < 30 seconds on both iOS and Android | End-to-end push test | Heartbeat value is invisible without notifications; delayed alerts reduce the "app works while you sleep" promise |
| **NFR26:** OAuth proxy compatibility — support major OAuth2 providers (Google, Stripe, GitHub minimum) through a unified backend flow | User-facing OAuth complexity | User sees only a "Connect" button; all complexity handled server-side | Provider integration tests | Clara's journey requires zero technical screens; OAuth complexity is the #1 barrier for non-technical users |

### Scalability

| NFR | Metric | Target | Measurement | Rationale |
|-----|--------|--------|-------------|-----------|
| **NFR27:** Single-user backend handles 50+ active modules without performance degradation | Response time under load | No degradation at 50+ active modules | Load test on single deployment instance | MVP is single-user; 50 modules is the upper bound from user journeys (Seb: 25+, Marc: 18) |
| **NFR28:** Memory store with vector search handles 10,000+ episodic entries without query degradation | Query latency at scale | No degradation at 10,000+ entries | Query performance benchmark | 6 months of active use at 50+ interactions/day |
| **NFR29:** Architecture supports future multi-user isolation without rewriting core components | Schema readiness for multi-tenancy | user_id in database schema, API routes, and auth model from day one | Architecture review | V1 is single-user but V2 multi-user must not require core rewrites |

### Accessibility (Baseline)

| NFR | Requirement | Target | Rationale |
|-----|------------|--------|-----------|
| **NFR30:** Dynamic type support — all text respects user's system font size preferences | iOS Dynamic Type / Android font scale honored | Manual testing across scale settings | SDUI renders dynamic content; ignoring system font preferences makes modules unreadable for visually impaired users |
| **NFR31:** Screen reader compatibility — all interactive elements have accessible labels | VoiceOver (iOS) and TalkBack (Android) can navigate all core flows | Screen reader walkthrough | Conversation-first interface is naturally accessible; rendered modules must maintain this accessibility |
| **NFR32:** Minimum contrast ratio — all text meets readable contrast against backgrounds | WCAG AA (4.5:1 for normal text, 3:1 for large text) | Contrast checker tool | Agent-composed UIs must meet baseline readability; poor contrast undermines the "real app quality" perception |
| **NFR33:** Touch target size — all tappable elements meet minimum size | 44x44pt (iOS) / 48x48dp (Android) minimum | UI audit | Dynamically composed layouts risk cramped touch targets; minimum sizes prevent frustrating mis-taps |

### Testing & Quality

| NFR | Requirement | Verification | Rationale |
|-----|------------|-------------|-----------|
| **NFR37:** All SDUI primitives shall have unit tests verifying rendering with valid specs, graceful handling of malformed specs, and accessibility compliance (labels, contrast) | Test coverage report for all primitives; CI gate on primitive changes | Automated test suite in CI | LLM-generated specs are non-deterministic; primitives must be defensively tested |

**LLM output testing strategy:** Agent tests use deterministic mock LLM responses (fixture-based). Integration tests verify the pipeline with real LLM calls but assert structural validity (valid JSON, known primitive types) rather than exact content.

### Internationalization

| NFR | Requirement | Target | Rationale |
|-----|------------|--------|-----------|
| **NFR38:** The SDUI rendering engine shall support bidirectional text (LTR and RTL) and non-Latin character sets in all text primitives | Correct rendering of Arabic, Chinese, Hebrew, etc. in all text-bearing primitives | Rendering test with multilingual content samples | Agent communicates in user's language; module content may include Arabic, Chinese, etc. |

**Note:** Full app UI localization (system strings, error messages) is deferred to P1. Agent conversation is inherently multilingual via LLM.
