# Story 3.1: SDUI Primitive Registry & Simple Primitives

Status: done

## Story

As a developer,
I want a primitive registry that maps type identifiers to native React Native components, with simple primitives (Text, Metric, Layout) and an UnknownPrimitive fallback,
So that the SDUI rendering engine foundation is established with independently testable, accessible building blocks for module display.

## Acceptance Criteria

1. **Given** the mobile app, **When** the SDUI engine initializes, **Then** the primitive registry maps type identifiers to native components for: `text`, `metric`, and a `layout` container (stack/grid). (FR18)

2. **Given** a module spec referencing a known primitive type (e.g., `type: "metric"`), **When** the renderer calls `getPrimitive(type)`, **Then** the correct native component is returned.

3. **Given** a module spec referencing an unknown primitive type (e.g., `type: "chart"`), **When** the renderer calls `getPrimitive(type)`, **Then** `UnknownPrimitive` is returned and a structured error is logged with `agent_action` indicating the unregistered type.

4. **Given** each SDUI primitive (TextPrimitive, MetricPrimitive, LayoutPrimitive, UnknownPrimitive), **When** unit tests run, **Then** each primitive is tested for: (a) valid rendering with correct data, (b) graceful handling of malformed/missing props, (c) accessibility compliance — `accessibleLabel` prop applied, screen-reader compatible. (NFR37)

5. **Given** the TextPrimitive rendering text content, **When** the text includes RTL content (Arabic, Hebrew) or non-Latin characters (Chinese, Japanese), **Then** the text renders correctly with proper directionality. (NFR38)

6. **Given** any SDUI primitive rendering text, **When** the user's system font size preferences change, **Then** all text respects Dynamic Type (iOS) / font scale (Android). (NFR30)

7. **Given** any SDUI primitive rendering text, **When** contrast is measured, **Then** it meets WCAG AA minimum: 4.5:1 for normal text, 3:1 for large text. (NFR32)

8. **Given** each SDUI primitive, **When** it accepts `accessibleLabel` and `accessibleRole` props, **Then** interactive elements have screen-reader-compatible labels. (NFR31)

9. **Given** the primitive registry, **When** a new primitive is added in a future story, **Then** it requires only: one new component file + one registry entry in `registry.ts`. No other file changes.

## Tasks / Subtasks

- [x] **Task 1: Create the primitive registry** (AC: #1, #2, #3, #9)
  - [x] 1.1 Create `apps/mobile/components/sdui/registry.ts` with `getPrimitive(type: string)` function
  - [x] 1.2 Define the `PrimitiveProps` base interface with `accessibleLabel?: string` and `accessibleRole?: string`
  - [x] 1.3 Map known types to components: `text` → TextPrimitive, `metric` → MetricPrimitive, `status` → UnknownPrimitive (stub), `table` → UnknownPrimitive (stub), `layout` → LayoutPrimitive
  - [x] 1.4 Return `UnknownPrimitive` for any unregistered type
  - [x] 1.5 Create `apps/mobile/components/sdui/index.ts` barrel export
  - [x] 1.6 Write unit tests for registry.ts: known type returns correct component, unknown type returns UnknownPrimitive (10 tests)

- [x] **Task 2: Create UnknownPrimitive fallback** (AC: #3)
  - [x] 2.1 Create `apps/mobile/components/sdui/UnknownPrimitive.tsx` — displays requested type name and a user-friendly "Unsupported module type" message
  - [x] 2.2 Log structured error with `logger.error('sdui', 'unknown_primitive', { type, agent_action: "Check if primitive type '{type}' exists in the registry" })`
  - [x] 2.3 Style with Twilight tokens: `surface` bg, `error` border, `textSecondary` text
  - [x] 2.4 Write co-located unit test `UnknownPrimitive.test.tsx`: renders type name, logs error, has accessible label (8 tests)

- [x] **Task 3: Create TextPrimitive** (AC: #4, #5, #6, #7, #8)
  - [x] 3.1 Create `apps/mobile/components/sdui/TextPrimitive.tsx`
  - [x] 3.2 Props: `{ text: string; variant?: 'title' | 'subtitle' | 'body' | 'caption'; accessibleLabel?: string; accessibleRole?: string }`
  - [x] 3.3 Map variant to `tokens.typography[variant]` — default to `body`
  - [x] 3.4 Use `tokens.colors.text` for primary variants, `tokens.colors.textSecondary` for `caption`
  - [x] 3.5 Support RTL via React Native's built-in `writingDirection: 'auto'` style prop (NFR38)
  - [x] 3.6 Respect Dynamic Type via `allowFontScaling={true}` (default in RN, verify not disabled) (NFR30)
  - [x] 3.7 Write co-located test `TextPrimitive.test.tsx`: renders text, applies variant styles, renders with missing variant (defaults body), handles empty text, accessibility props applied (14 tests)

- [x] **Task 4: Create MetricPrimitive** (AC: #4, #6, #7, #8)
  - [x] 4.1 Create `apps/mobile/components/sdui/MetricPrimitive.tsx`
  - [x] 4.2 Props: `{ value: string | number; label: string; unit?: string; trend?: 'up' | 'down' | 'flat'; accessibleLabel?: string; accessibleRole?: string }`
  - [x] 4.3 Render value with `tokens.typography.metric` (28pt/700), label with `tokens.typography.caption`, unit with `tokens.typography.metricUnit`
  - [x] 4.4 Trend indicator: `up` → `tokens.colors.success` + "▲", `down` → `tokens.colors.error` + "▼", `flat` → `tokens.colors.textSecondary` + "—"
  - [x] 4.5 `accessibleLabel` defaults to `"${label}: ${value} ${unit ?? ''}"` if not provided
  - [x] 4.6 Write co-located test `MetricPrimitive.test.tsx`: renders value/label/unit, trend indicators render correctly, missing optional props handled, accessibility label generated (21 tests)

- [x] **Task 5: Create LayoutPrimitive (stack/grid container)** (AC: #1, #4, #8)
  - [x] 5.1 Create `apps/mobile/components/sdui/LayoutPrimitive.tsx`
  - [x] 5.2 Props: `{ direction?: 'vertical' | 'horizontal'; columns?: number; gap?: number; children: React.ReactNode; accessibleLabel?: string; accessibleRole?: string }`
  - [x] 5.3 `direction: 'vertical'` → `flexDirection: 'column'` (default), `direction: 'horizontal'` → `flexDirection: 'row'`
  - [x] 5.4 When `columns` is provided, render as grid using `flexWrap: 'wrap'` with `width: ${100/columns}%` per child
  - [x] 5.5 `gap` defaults to `tokens.spacing.md` (16)
  - [x] 5.6 Write co-located test `LayoutPrimitive.test.tsx`: renders children, vertical/horizontal layout, grid with columns, default gap applied, accessibility props (13 tests)

- [x] **Task 6: Extend module-schema with primitive-specific Zod schemas** (AC: #1)
  - [x] 6.1 Create `packages/module-schema/src/primitives.ts` with Zod schemas for each primitive's data contract: `textPrimitiveSchema`, `metricPrimitiveSchema`, `layoutPrimitiveSchema`
  - [x] 6.2 Export from `packages/module-schema/src/index.ts`
  - [x] 6.3 Write tests in `packages/module-schema/src/__tests__/primitives.test.ts` — valid specs pass, invalid specs rejected with clear errors (21 tests)

- [x] **Task 7: Update ModuleCard to delegate to SDUI registry** (AC: #2, #3)
  - [x] 7.1 Modify `apps/mobile/components/bridge/ModuleCard.tsx` to import `getPrimitive` from `@/components/sdui`
  - [x] 7.2 Extract `spec.type` from the module spec and call `getPrimitive(type)` to get the component
  - [x] 7.3 Render the resolved primitive component inside the existing card container (keep ErrorBoundary wrapping)
  - [x] 7.4 Pass relevant spec fields as primitive props (parse from `spec` based on type)
  - [x] 7.5 Update ModuleCard tests to verify primitive delegation (4 new delegation tests added)

- [x] **Task 8: Integration smoke test** (AC: #1, #2, #3, #9)
  - [x] 8.1 Write an integration test that verifies the full path: module spec → getPrimitive → renders correct component
  - [x] 8.2 Verify each registered type renders without error
  - [x] 8.3 Verify unknown type shows UnknownPrimitive fallback
  - [x] 8.4 Run all tests: `pnpm --filter mobile test` and `pnpm --filter module-schema test` (532 mobile + 53 schema = 585 total, all pass)

## Dev Notes

### Architecture Patterns and Constraints

**3-Layer Component Architecture (CRITICAL):**
- **Shell** (static, always visible): Orb, ChatInput, ChatBubble — NOT touched in this story
- **Bridge** (lifecycle-aware): ModuleCard wraps SDUI primitives in ErrorBoundary — MODIFIED in this story (Task 7)
- **SDUI** (pure, stateless): Primitives receive props, render JSX, no side effects — CREATED in this story

**SDUI primitives are PURE components:**
- Props in, JSX out — NO state, NO side effects, NO store access
- The registry uses `React.ComponentType<any>` but each concrete component is strictly typed (no `props: any`)
- Each primitive exports its props type alongside the component

**Registry Pattern (from architecture):**
```typescript
// components/sdui/registry.ts
const primitiveRegistry: Record<string, React.ComponentType<any>> = {
  metric: MetricPrimitive,
  text: TextPrimitive,
  status: StatusPrimitive,
  table: TablePrimitive,
};

export const getPrimitive = (type: string) =>
  primitiveRegistry[type] ?? UnknownPrimitive;
```

Adding a primitive = one new file + one registry entry. Nothing else changes.

**Note on First Light primitives vs. this story:**
Architecture defines 5 First Light primitives: `metric`, `list`, `text`, `status`, `table`. This story (3.1) implements the REGISTRY + 3 simple primitives: `text`, `metric`, and `layout` (stack/grid). Story 3.2 adds composite primitives: `card` and `list`. The `status` and `table` primitives can be registered as stubs pointing to `UnknownPrimitive` for now and implemented later, OR fully implemented in this story if time permits — developer judgment call.

### Primitive Names vs. PRD Clarification

The PRD FR18 lists "Card, List, Text, Metric, Layout" for First Light. Architecture clarifies:
- `Card` = the `ModuleCard` bridge wrapper (not a SDUI primitive)
- `Layout` = implicit in the module spec JSON structure (stack/grid container)
- The 5 architecture primitives (`metric`, `list`, `text`, `status`, `table`) are content types INSIDE the card
- This story focuses on `text`, `metric`, and `layout` — the foundational building blocks

### Design Token Usage (MANDATORY)

All visual styling MUST use tokens from `@/constants/tokens`. Never hardcode colors, spacing, font sizes.

Key tokens for SDUI primitives:
- Card/container bg: `tokens.colors.surface` (#101C2C)
- Card border: `tokens.colors.border` (#1E2E44)
- Primary text: `tokens.colors.text` (#E4ECF4)
- Secondary text: `tokens.colors.textSecondary` (#7899BB)
- Accent: `tokens.colors.accent` (#E8A84C)
- Success: `tokens.colors.success` (#5CB8A0)
- Error: `tokens.colors.error` (#CC5F5F)
- Typography: `tokens.typography.metric` (28pt/700), `tokens.typography.body` (15pt/400), etc.
- Spacing: `tokens.spacing.{xs|sm|md|lg|xl}` (4/8/16/24/32)
- Radii: `tokens.radii.{sm|md|lg}` (4/8/16)

### snake_case / camelCase Convention (CRITICAL — from Epic 1 retrospective)

This was the #1 source of bugs in Epic 1. Follow EXACTLY:
- **Module specs arrive over WebSocket in `snake_case`** → converted to `camelCase` via `toCamel()` in wsClient
- **TypeScript code uses `camelCase`** for all fields: `moduleId`, `accessibleLabel`, `schemaVersion`
- **Zod schema in `packages/module-schema` uses `camelCase`** (source of truth)
- The `ModuleSpec` type in `types/ws.ts` is a minimal placeholder — the full Zod-inferred type from `@self/module-schema` is the canonical type

### Accessibility Contract (NFR30, NFR31, NFR32, NFR33, NFR37, NFR38)

Every primitive MUST:
1. Accept `accessibleLabel?: string` and `accessibleRole?: string` props
2. Apply `accessibilityLabel` and `accessibilityRole` to the root element
3. Use `allowFontScaling={true}` on all Text components (React Native default — do NOT set to false)
4. Use token colors that meet WCAG AA contrast ratios (pre-validated in the token set)
5. Support bidirectional text via `writingDirection: 'auto'` on Text components
6. Meet minimum touch targets: 44x44pt / 48x48dp for any interactive element (NFR33 — primarily for Story 3.2+ but set up patterns now)

### Testing Standards

- **Framework:** Jest (via `jest-expo` preset)
- **Location:** Co-located — `MetricPrimitive.test.tsx` next to `MetricPrimitive.tsx`
- **Mock setup:** `@testing-library/react-native` for rendering tests
- **Test naming:** `describe('MetricPrimitive')` + `it('renders value and label')`
- **Module aliases:** Already configured in `jest.config.js`: `'^@/(.*)$': '<rootDir>/$1'`
- **Test factory:** Use `createTestModuleSpec()` from `packages/module-schema/src/__tests__/fixtures/moduleSpec.ts` for any module spec fixtures
- **Malformed spec testing:** Every primitive test suite MUST include a test for graceful handling of undefined/null/malformed props — primitives should NEVER throw; render a sensible fallback or empty state
- **Accessibility testing:** Verify `accessibilityLabel` is present on the root element via `getByLabelText` or checking props

### Existing Logger Pattern

All errors MUST go through the structured logger. Pattern from existing codebase:
```typescript
import { logger } from '@/services/logger';
logger.error('sdui', 'unknown_primitive', {
  type: requestedType,
  agent_action: `Primitive type '${requestedType}' not found in registry. Check components/sdui/registry.ts`,
});
```

Never `catch (e) {}` empty. Never `console.log(e)` without structure.

### Project Structure Notes

Files to CREATE in this story:
```
apps/mobile/components/sdui/
├── registry.ts                   # type → Component mapping + getPrimitive()
├── registry.test.ts              # Registry tests
├── TextPrimitive.tsx             # Text display primitive
├── TextPrimitive.test.tsx        # Co-located tests
├── MetricPrimitive.tsx           # Metric display primitive
├── MetricPrimitive.test.tsx      # Co-located tests
├── LayoutPrimitive.tsx           # Stack/grid container primitive
├── LayoutPrimitive.test.tsx      # Co-located tests
├── UnknownPrimitive.tsx          # Fallback for unregistered types
├── UnknownPrimitive.test.tsx     # Co-located tests
└── index.ts                      # Barrel export

packages/module-schema/src/
├── primitives.ts                 # Zod schemas for primitive data contracts
└── __tests__/primitives.test.ts  # Schema validation tests
```

Files to MODIFY in this story:
```
apps/mobile/components/bridge/ModuleCard.tsx  # Delegate to SDUI registry
packages/module-schema/src/index.ts           # Export primitives
```

**Alignment with architecture directory structure:** All SDUI files go in `apps/mobile/components/sdui/`. Per architecture rules: barrel exports per sub-folder only (`sdui/index.ts`), never a global `components/index.ts`.

### Existing Code to Reuse

- **ErrorBoundary:** Already exists in `apps/mobile/components/bridge/ErrorBoundary.tsx` — wraps each module, catches render errors with structured logging. Do NOT recreate.
- **FreshnessIndicator:** Already exists — shows data age. Keep in ModuleCard alongside the SDUI primitive.
- **tokens.ts:** Already exists at `apps/mobile/constants/tokens.ts` — all Twilight design tokens.
- **logger.ts:** Already exists at `apps/mobile/services/logger.ts` — structured JSON logging.
- **moduleStore.ts:** Already exists — manages module state with `Map<string, ModuleState>`. The `spec` field contains the `ModuleSpec` that primitives will consume.
- **createTestModuleSpec():** Already exists in `packages/module-schema/src/__tests__/fixtures/moduleSpec.ts`.
- **ModuleSpec type in ws.ts:** Minimal placeholder (`moduleId` + index signature). Primitives should define their own strict prop types.

### Anti-Patterns to Avoid

1. **Do NOT add business logic to SDUI primitives.** Primitives are pure render functions. No store access, no WebSocket calls, no state.
2. **Do NOT use `any` for component props.** The registry uses `React.ComponentType<any>` but every concrete primitive has strict typed props.
3. **Do NOT create sub-directories inside `sdui/`.** Keep flat — all primitives live directly in `components/sdui/`.
4. **Do NOT import from `../../packages/`.** Use `@self/module-schema` alias for cross-package imports.
5. **Do NOT use boolean flags for states.** Use status enums if needed (unlikely for pure primitives).
6. **Do NOT forget `agent_action` on error logs.** Every error log MUST include an `agent_action` string telling an AI debugger what to check.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Mobile Architecture (SDUI)] — Primitive Registry pattern, getPrimitive, UnknownPrimitive fallback
- [Source: _bmad-output/planning-artifacts/architecture.md#V1 Design Tokens (Twilight Theme)] — All visual token values
- [Source: _bmad-output/planning-artifacts/architecture.md#SDUI Accessibility Contract] — accessibleLabel, accessibleRole, touch targets, Dynamic Type
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] — Naming, imports, exports, test patterns
- [Source: _bmad-output/planning-artifacts/architecture.md#Test Patterns] — Jest, co-located tests, factory functions
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1] — Acceptance criteria, FR18, NFR37, NFR38, NFR30, NFR32
- [Source: _bmad-output/planning-artifacts/prd.md#Module Rendering & Display] — FR17, FR18 primitive library
- [Source: _bmad-output/planning-artifacts/prd.md#Non-Functional Requirements] — NFR30 Dynamic Type, NFR31 Screen readers, NFR32 Contrast, NFR33 Touch targets, NFR37 SDUI tests, NFR38 Bidi text
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] — 3-layer component architecture (Shell/Bridge/SDUI), Constrained Composition Principle
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-02-23.md] — snake_case/camelCase bugs, async patterns, test evolution learnings

### Previous Story Intelligence

**From Epic 1 Retrospective (2026-02-23):**
- **snake_case/camelCase conversion was the #1 bug source** across 3/7 stories. The convention: JSON on WebSocket = `snake_case`, TypeScript = `camelCase`, Zod schema = `camelCase`. All boundary conversion happens in `toCamel()` in wsClient. Primitives receive already-converted camelCase props.
- **Test count grew from 0 to 994** across Epic 1. TDD pattern (red-green-refactor) was respected from story 1.3 onward. Continue this pattern.
- **Hermes runtime quirks:** `crypto.randomUUID()` was unavailable — use platform-appropriate APIs. Not directly relevant here but be aware of Hermes limitations.
- **jest-expo preset and module aliases** are already configured. The `@/` alias maps to `<rootDir>/`. `@self/module-schema` maps to `<rootDir>/../../packages/module-schema/src`.
- **Physical device testing** compensated for mobile knowledge gaps. After implementing primitives, test on a physical device to verify rendering, font scaling, and RTL behavior.

**From Roadmap:**
- Story 3.1 is the FIRST story in Wave 2 (Chat + Primitives)
- Next story after 3.1 is 3.2 (Composite Primitives: Card, List)
- The rendering chain (3.1 → 3.2 → 3.3) converges with the conversation chain (2.1) at 3.4 (First Module Test)
- Good patterns established here directly impact the velocity of 3.2, 3.3, and 3.4

### Git Intelligence

Recent commits (Epic 1 done):
- `130439c` sel (latest)
- `187777d` fix(1-5): revert session-scoped DB to per-sync connection
- `6c4803e` feat(1-5): offline message queue and cached data rendering
- `b31d304` feat(1-4): mobile app shell and WebSocket connection
- `a4f2438` feat(1-3): LLM provider abstraction with 5 providers

**Patterns established:**
- Commit messages use conventional commits: `feat(story-id): description`
- For this story: `feat(3-1): SDUI primitive registry and simple primitives`
- Tests are always included in the same commit as the implementation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No blockers or halts encountered during implementation.

### Completion Notes List

- Implemented full SDUI primitive registry with `getPrimitive()` function and 5 registered types (text, metric, layout + stubs for status, table)
- Created 4 primitive components: TextPrimitive (variant-based typography, RTL, Dynamic Type), MetricPrimitive (value/label/unit/trend with color-coded indicators), LayoutPrimitive (stack/grid with columns and gap), UnknownPrimitive (fallback with structured error logging)
- All primitives are pure (no state, no side effects, no store access) and export strict TypeScript props types alongside the component
- All primitives support `accessibleLabel` and `accessibleRole` props, `writingDirection: 'auto'`, and respect `allowFontScaling` defaults
- Created Zod validation schemas in `packages/module-schema/src/primitives.ts` for wire-format validation of text, metric, and layout primitive specs
- Updated ModuleCard bridge component to delegate rendering to SDUI registry via `getPrimitive(spec.type)`
- Followed TDD throughout: wrote failing tests first, then implemented, then verified all green
- Total new tests: 95 (8 UnknownPrimitive + 14 TextPrimitive + 21 MetricPrimitive + 13 LayoutPrimitive + 10 registry + 21 schema + 8 integration)
- Total test count: 585 (532 mobile + 53 module-schema), all passing, zero regressions
- `status` and `table` types registered as stubs pointing to UnknownPrimitive per story dev notes (to be implemented in future stories)
- All styling uses design tokens from `tokens.ts` -- no hardcoded colors, spacing, or font sizes
- Extensibility pattern confirmed: adding a new primitive requires only 1 new component file + 1 registry entry

### File List

**Created:**
- apps/mobile/components/sdui/registry.ts
- apps/mobile/components/sdui/registry.test.ts
- apps/mobile/components/sdui/index.ts
- apps/mobile/components/sdui/UnknownPrimitive.tsx
- apps/mobile/components/sdui/UnknownPrimitive.test.tsx
- apps/mobile/components/sdui/TextPrimitive.tsx
- apps/mobile/components/sdui/TextPrimitive.test.tsx
- apps/mobile/components/sdui/MetricPrimitive.tsx
- apps/mobile/components/sdui/MetricPrimitive.test.tsx
- apps/mobile/components/sdui/LayoutPrimitive.tsx
- apps/mobile/components/sdui/LayoutPrimitive.test.tsx
- apps/mobile/components/sdui/integration.test.tsx
- packages/module-schema/src/primitives.ts
- packages/module-schema/src/__tests__/primitives.test.ts

**Modified:**
- apps/mobile/components/bridge/ModuleCard.tsx
- apps/mobile/components/bridge/ModuleCard.test.tsx
- packages/module-schema/src/index.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-02-23: Story 3.1 implemented - SDUI primitive registry with TextPrimitive, MetricPrimitive, LayoutPrimitive, UnknownPrimitive; Zod schemas for primitive data contracts; ModuleCard updated to delegate to SDUI registry; 95 new tests added (585 total, all passing)
- 2026-02-23: Code review (adversarial) — 4 HIGH/MEDIUM issues fixed, 3 LOW documented. Registry migrated from Record to Map (prototype pollution fix), hardcoded fontSize replaced with design token, writingDirection added to trend indicator, `as any` removed from grid width. 721 total tests passing (630 mobile + 91 schema), zero regressions.

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] `accessibleRole` is cast to `any` in all four primitives (UnknownPrimitive.tsx:48, TextPrimitive.tsx:53, MetricPrimitive.tsx:57, LayoutPrimitive.tsx:57). Consider using React Native's `AccessibilityRole` union type for `accessibleRole` prop instead of `string` to get compile-time safety.
- [ ] [AI-Review][LOW] Story Completion Notes claims "Total new tests: 95" and "585 total" but actual counts are 186 SDUI/bridge tests and 721 total (630 mobile + 91 schema). The discrepancy suggests the initial test count was accurate for the base implementation before edge cases were added. Consider updating the Completion Notes to reflect actual totals.
- [ ] [AI-Review][LOW] `ModuleCard.extractPrimitiveProps()` removes only `moduleId` from the spec before passing all remaining fields to the primitive component. Extra fields like `name`, `schemaVersion`, etc. get spread as unknown props. Consider allowlisting known primitive fields per type or using the Zod schema `.parse()` to extract only valid fields.
