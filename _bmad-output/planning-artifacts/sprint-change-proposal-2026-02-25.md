# Sprint Change Proposal — Tab Navigation Architecture

**Date:** 2026-02-25
**Author:** Seb (via Correct Course workflow)
**Scope:** Moderate — Document updates + new story
**Status:** Pending approval

---

## Section 1: Issue Summary

### Problem Statement

Story 2.5 (Screen Mode Architecture) implemented a two-mode auto-transition system with crossfade animations between Chat Mode and Dashboard Mode. After UX testing, this system was found to be **overengineered and unpredictable**:

- 7 different transition triggers (keyboard state, timers, agent status, app foreground, module count...)
- ~120 lines of transition logic in App.tsx
- 1-second delay before Dashboard transition creates confusion
- The app decides which screen the user sees — not the user
- Chat input always visible even on Dashboard (layout competition)

### Discovery Context

Discovered during implementation review of Story 2.5. A new UX specification was created (`ux-tab-navigation.html`) with 6 mockups demonstrating the replacement approach.

### Evidence

- `ux-tab-navigation.html`: Complete replacement spec with before/after comparison, mockups, tab bar spec, ModuleLink spec, navigation flows
- Story 2.5 implementation code: `screenModeStore.ts`, crossfade logic in `App.tsx`, keyboard-driven mode transitions

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact | Details |
|------|--------|---------|
| **Epic 2** (Conversational Shell) | **Direct** | Story 2.5 superseded by 2.5b. Story 2.4 dependency updated. Design Direction description updated. |
| **Epic 11** (Module Lifecycle) | **Minor** | Story 11.4 terminology: "Dashboard Mode" → "Home tab" |
| All other epics | **None** | No functional scope change |

### Story Impact

| Story | Change |
|-------|--------|
| **2.5** (Screen Mode Architecture) | Marked as superseded by 2.5b |
| **2.5b** (Tab Navigation Architecture) | **New story** — replaces 2.5's navigation approach |
| **2.4** (Contextual Empty State) | Dependency changed: 2.5 → 2.5b. AC updated: "Chat Mode" → "Home tab" |
| **11.4** (Module Organization) | AC terminology: "Dashboard Mode" → "Home tab" |

### Artifact Conflicts

| Document | Modifications | Severity |
|----------|--------------|----------|
| `epics.md` | 6 edits (Design Direction, 2.5 note, new 2.5b, 2.4 dependency+AC, 11.4 ACs) | Moderate |
| `prd.md` | 1 edit (FR22 terminology) | Minor |
| `architecture.md` | 4 edits (full section replacement, 3 file tree lines) | Major |
| `ux-design-specification.md` | 7 edits (superseded section, ChatInputBar, StatusLine, roadmap, mode behavior, tablet) | Moderate |
| `implementation-readiness-report-2026-02-23.md` | 6 edits (terminology updates across assessment) | Minor |
| `roadmap.md` | Already updated | Done |
| `sprint-status.yaml` | Already updated | Done |

### Technical Impact

- `screenModeStore.ts`: Deleted entirely (story 2.5b implementation)
- `App.tsx`: ~120 lines of crossfade/transition logic replaced by ~20 lines of tab navigator config
- `useKeyboardVisible.ts`: Retained but purpose narrowed (Chat tab input margin only, no longer drives mode transitions)
- New component: `ModuleLink` (Chat → Home tab bridge)
- New: Tab navigator setup (`@react-navigation/bottom-tabs` or Expo Router `app/(tabs)/`)

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment

The issue is addressed by:
1. Adding Story 2.5b within the existing Epic 2 structure
2. Updating all document references from two-mode/crossfade terminology to tab navigation terminology
3. Story 2.5's implementation will be replaced during 2.5b development

### Rationale

- **Effort: Low** — Tab navigation is a standard React Navigation pattern, simpler than the system it replaces
- **Risk: Low** — Well-understood, battle-tested pattern used by virtually all mobile apps
- **Timeline: No impact** — Tab navigation is faster to implement than crossfade transitions
- **Scope: Unchanged** — Same features (dashboard, chat, settings), different navigation pattern
- **UX: Improved** — User controls navigation explicitly; no surprising auto-transitions

### Alternatives Considered

| Alternative | Why not |
|-------------|---------|
| Rollback to Phase system | Already superseded; same problems |
| Keep two-mode with fixes | Fundamental design issue, not a bug — auto-transitions are inherently unpredictable |
| Reduce to 2 tabs (Home + Chat) | Settings needs a permanent home; 3 tabs is standard |

---

## Section 4: Detailed Change Proposals

### Document 1: `epics.md` — 6 edits

**1A. Design Direction (line 209)**
- OLD: Two-mode screen architecture with crossfade transitions
- NEW: Tab navigation architecture with Home/Chat/Settings tabs + ModuleLink bridge

**1B. Story 2.5 note (line 655)**
- Add superseded notice pointing to Story 2.5b

**1C. New Story 2.5b**
- Full story with 7 acceptance criteria covering tab bar, ModuleLink, badges, empty state

**1D. Story 2.4 dependency (line 663)**
- OLD: Depends on 2.5, "Chat Mode with 0 modules"
- NEW: Depends on 2.5b, "Home tab with 0 modules"

**1E. Story 2.4 AC (line 669)**
- OLD: "Chat Mode with contextual empty state"
- NEW: "Home tab displays contextual empty state"

**1F. Story 11.4 ACs (lines 1447-1453)**
- OLD: "Dashboard Mode", "modes transition (Chat ↔ Dashboard)"
- NEW: "Home tab", remove mode transition reference

### Document 2: `prd.md` — 1 edit

**2A. FR22 (line 697)**
- OLD: "Dashboard Mode — full-screen module gallery"
- NEW: "Home tab (module dashboard)"

### Document 3: `architecture.md` — 4 edits

**3A. Full section replacement (lines 591-634)**
- OLD: Two-Mode Screen Architecture with screenModeStore, transition rules, crossfade
- NEW: Tab Navigation Architecture with tab definitions, ModuleLink bridge, badge system

**3B. File tree index.tsx (line 1162)**
- OLD: "Single screen — two-mode rendering"
- NEW: "Tab navigator — Home / Chat / Settings"

**3C. File tree useKeyboardVisible (line 1189)**
- OLD: "mode transitions"
- NEW: "Chat tab input margin"

**3D. File tree screenModeStore (line 1198)**
- Line removed entirely

### Document 4: `ux-design-specification.md` — 7 edits

**4A. Flow P1-B (lines 916-955)** — Superseded notice + collapsed historical content
**4B. ChatInputBar (line 1026)** — "both modes" → "Chat tab"
**4C. ChatInputBar focused state (line 1035)** — Remove mode transition trigger
**4D. StatusLine (line 1076)** — "Dashboard Mode" → "Home tab"
**4E. Roadmap table (line 1150)** — "Dashboard Mode support" → "Home tab dashboard support"
**4F. Mode-dependent behavior (lines 1189-1196)** — Rewrite for tab architecture + ModuleLink
**4G. Tablet strategy (line 1321)** — "Dashboard Mode" → "Home tab"

### Document 5: `implementation-readiness-report-2026-02-23.md` — 6 edits

**5A-5F.** Terminology updates: "two-mode architecture" → "tab navigation architecture", "crossfade" removed, Story 2.5 references → Story 2.5b

---

## Section 5: Implementation Handoff

### Change Scope: Moderate

Document updates can be applied immediately by the current workflow. Story 2.5b implementation is handled by the dev agent.

### Handoff Plan

| Role | Responsibility |
|------|---------------|
| **Current workflow** (Correct Course) | Apply all 24 document edits across 5 files |
| **Dev agent** | Implement Story 2.5b (tab navigator, ModuleLink, badge system, Settings tab) |
| **QA** | Verify all document cross-references are consistent after edits |

### Success Criteria

- [ ] All 5 documents updated with consistent tab navigation terminology
- [ ] Story 2.5b added to epics.md with complete acceptance criteria
- [ ] No remaining references to "Chat Mode", "Dashboard Mode", "crossfade", or "screenModeStore" in planning artifacts (except historical/superseded sections)
- [ ] sprint-status.yaml includes 2-5b entry (already done)
- [ ] roadmap.md includes 2.5b (already done)

---

*Generated by Correct Course workflow (BMM) — 2026-02-25*
