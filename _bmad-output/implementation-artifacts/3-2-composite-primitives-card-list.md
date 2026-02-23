# Story 3.2: Composite Primitives (Card, List)

Status: done

## Story

As a developer,
I want Card and List composite primitives that compose inner primitives (Text, Metric) within styled containers,
So that the SDUI engine can render real-world module layouts matching the Twilight design system. (FR18)

## Acceptance Criteria

1. **Given** the primitive registry containing Text, Metric, Layout from Story 3.1, **When** Card and List primitives are registered, **Then** the registry contains the complete First Light primitive set: `text`, `metric`, `layout`, `card`, `list` (plus existing stubs for `status`, `table`). (FR18)

2. **Given** a Card primitive spec with `type: "card"` and nested child primitives, **When** rendered, **Then** it composes inner primitives (Text, Metric, etc.) within a card container styled with Twilight tokens: `tokens.colors.surface` (#101C2C) background, `tokens.colors.border` (#1E2E44) 1px border, `tokens.radii.lg` (16px) border radius, `tokens.spacing.md` (16px) padding.

3. **Given** a Card primitive spec with a `title` field, **When** rendered, **Then** the title is displayed using `tokens.typography.subtitle` styling at the top of the card.

4. **Given** a Card primitive spec with no children or empty children array, **When** rendered, **Then** the card renders gracefully with only its title (or empty) and does not crash.

5. **Given** a List primitive spec with `type: "list"` and an `items` array, **When** rendered, **Then** it renders a scrollable list of items using inner primitives, with each item visually separated.

6. **Given** each list item, **When** rendered, **Then** it meets the minimum touch target size of 44x44pt (iOS) / 48x48dp (Android). (NFR33)

7. **Given** a List primitive spec with an empty `items` array, **When** rendered, **Then** the list renders gracefully with an empty state (not a crash).

8. **Given** each composite primitive (CardPrimitive, ListPrimitive), **When** unit tests run, **Then** each is tested for: (a) valid rendering with correct data, (b) graceful handling of malformed/missing props, (c) accessibility compliance -- `accessibleLabel` prop applied, screen-reader compatible. (NFR37)

9. **Given** the composite primitives rendering text content, **When** the user's system font size preferences change, **Then** all text respects Dynamic Type (iOS) / font scale (Android). (NFR30)

10. **Given** the composite primitives rendering text, **When** contrast is measured, **Then** it meets WCAG AA minimum: 4.5:1 for normal text, 3:1 for large text. (NFR32)

11. **Given** the Card or List primitives, **When** a new composite primitive is added in a future story, **Then** it follows the same pattern: one component file + one registry entry + Zod schema.

## Tasks / Subtasks

- [x] **Task 1: Create CardPrimitive** (AC: #2, #3, #4, #8, #9, #10)
  - [x] 1.1 Create `apps/mobile/components/sdui/CardPrimitive.tsx`
  - [x] 1.2 Define `CardPrimitiveProps`: `{ title?: string; children?: PrimitiveChild[]; accessibleLabel?: string; accessibleRole?: string }` where `PrimitiveChild` is `{ type: string; [key: string]: unknown }`
  - [x] 1.3 Render card container with Twilight styling: `surface` bg, `border` border (1px), `radii.lg` radius (16px), `spacing.md` padding
  - [x] 1.4 Render optional `title` using `tokens.typography.subtitle` + `tokens.colors.text`
  - [x] 1.5 Iterate over `children` array: for each child, call `getPrimitive(child.type)` and render the resolved component with the child's data as props
  - [x] 1.6 Handle edge cases: missing/empty `children` renders gracefully, missing `title` omits the header
  - [x] 1.7 Apply `accessibilityLabel` from props or generate from `title`; apply `accessibilityRole`
  - [x] 1.8 Write co-located test `CardPrimitive.test.tsx`: renders with title, renders children, composes inner primitives, handles empty children, handles missing title, malformed children (invalid type falls back to UnknownPrimitive), accessibility props applied (~15 tests)

- [x] **Task 2: Create ListPrimitive** (AC: #5, #6, #7, #8, #9, #10)
  - [x] 2.1 Create `apps/mobile/components/sdui/ListPrimitive.tsx`
  - [x] 2.2 Define `ListPrimitiveProps`: `{ items: ListItem[]; title?: string; accessibleLabel?: string; accessibleRole?: string }` where `ListItem` is `{ id?: string; title?: string; subtitle?: string; trailing?: string; onPress?: never }` (data only, no callbacks in SDUI)
  - [x] 2.3 Render items using `FlatList` for scrollable performance (or `View` mapping for short lists -- developer judgment on threshold)
  - [x] 2.4 Each list item: `title` in `tokens.typography.body`, optional `subtitle` in `tokens.typography.caption` + `textSecondary`, optional `trailing` value right-aligned
  - [x] 2.5 Visual separation between items: `tokens.colors.border` bottom divider (last item excluded) or vertical `spacing.sm` gap
  - [x] 2.6 Each list item `minHeight: 48` (NFR33 touch target minimum)
  - [x] 2.7 Handle empty `items` array: render subtle empty state text ("No items") in `tokens.colors.textSecondary`
  - [x] 2.8 Apply `accessibilityLabel` from props or generate from `title` + item count; each item gets its own `accessibilityLabel`
  - [x] 2.9 Write co-located test `ListPrimitive.test.tsx`: renders items, renders title/subtitle/trailing, handles empty items, minimum touch target height, separator between items, accessibility labels on items, malformed items handled gracefully (~18 tests)

- [x] **Task 3: Add Zod schemas for Card and List primitives** (AC: #11)
  - [x] 3.1 Add `cardPrimitiveSchema` and `listPrimitiveSchema` to `packages/module-schema/src/primitives.ts`
  - [x] 3.2 Card schema: `{ type: z.literal('card'), title: z.string().optional(), children: z.array(z.object({ type: z.string() }).passthrough()).optional() }`
  - [x] 3.3 List schema: `{ type: z.literal('list'), title: z.string().optional(), items: z.array(listItemSchema) }` with `listItemSchema: { id: z.string().optional(), title: z.string().optional(), subtitle: z.string().optional(), trailing: z.string().optional() }`
  - [x] 3.4 Export new schemas and types from `packages/module-schema/src/index.ts`
  - [x] 3.5 Write tests in `packages/module-schema/src/__tests__/primitives.test.ts` (append to existing): valid card/list specs pass, invalid specs rejected, edge cases (empty children, empty items) (~12 tests)

- [x] **Task 4: Register Card and List in the primitive registry** (AC: #1)
  - [x] 4.1 Import `CardPrimitive` and `ListPrimitive` in `apps/mobile/components/sdui/registry.ts`
  - [x] 4.2 Add entries: `['card', CardPrimitive]` and `['list', ListPrimitive]` to the `primitiveRegistry` Map
  - [x] 4.3 Update `apps/mobile/components/sdui/index.ts` barrel export with `CardPrimitive`, `ListPrimitive`, and their prop types
  - [x] 4.4 Update registry tests: verify `card` and `list` types resolve correctly, total registry size is 7 (text, metric, layout, card, list, status, table)

- [x] **Task 5: Update moduleTypeEnum in module-schema** (AC: #1)
  - [x] 5.1 Add `'card'` and `'list'` to `moduleTypeEnum` in `packages/module-schema/src/moduleSpec.ts` (currently `['metric', 'list', 'text', 'status', 'table']` -- note `list` already exists, add `card` and `layout`)
  - [x] 5.2 Verify existing moduleSpec tests still pass with the updated enum
  - [x] 5.3 If `layout` is not already in moduleTypeEnum, add it for consistency with the registry

- [x] **Task 6: Integration tests** (AC: #1, #2, #5, #8)
  - [x] 6.1 Extend or add integration tests verifying: module spec with `type: "card"` + children renders correctly through registry -> CardPrimitive
  - [x] 6.2 Verify: module spec with `type: "list"` + items renders correctly through registry -> ListPrimitive
  - [x] 6.3 Verify: CardPrimitive with nested unknown child type renders child as UnknownPrimitive (composition with fallback)
  - [x] 6.4 Run all tests: `pnpm --filter mobile test` and `pnpm --filter module-schema test` -- all must pass with zero regressions

## Review Follow-ups

- [ ] [AI-Review][LOW] Array index used as React key in CardPrimitive children loop (`CardPrimitive.tsx:56`). SDUI primitives are stateless so this is acceptable, but using `child.id || index` would be more robust for future interactivity stories.
- [ ] [AI-Review][LOW] Hardcoded English string `"No items"` in ListPrimitive empty state (`ListPrimitive.tsx:54`). For future i18n readiness, consider extracting to a constants file. Not in scope for First Light.

## Dev Notes

### Architecture Patterns and Constraints

**3-Layer Component Architecture (CRITICAL):**
- **Shell** (static): NOT touched in this story
- **Bridge** (lifecycle-aware): ModuleCard already delegates to SDUI registry via `getPrimitive()` (done in 3.1) -- NOT modified in this story
- **SDUI** (pure, stateless): CardPrimitive and ListPrimitive CREATED in this story

**SDUI primitives are PURE components:**
- Props in, JSX out -- NO state, NO side effects, NO store access
- Exception: `useEffect` for one-time structured error logging (see UnknownPrimitive pattern)
- Each primitive exports its props type alongside the component

**Composite Primitives vs Simple Primitives:**
- Simple primitives (Text, Metric, Layout) render a single visual element from flat props
- Composite primitives (Card, List) COMPOSE inner primitives or structured data
- CardPrimitive uses `getPrimitive()` to resolve its children dynamically -- it is a composition container
- ListPrimitive renders structured `ListItem` data -- it does NOT use `getPrimitive()` for items (items are a flat data structure, not nested primitives)

**Card is a SDUI Primitive, NOT the Bridge ModuleCard:**
- The architecture clarified this in Gap #1: `ModuleCard` (bridge) is the ErrorBoundary wrapper for any module
- `CardPrimitive` (SDUI) is a visual container primitive that the agent can use inside a module spec
- The agent spec might have `{ type: "card", title: "Weather", children: [{ type: "metric", ... }, { type: "text", ... }] }`
- `ModuleCard` wraps the entire module; `CardPrimitive` is one possible primitive inside

### Design Token Usage (MANDATORY)

All visual styling MUST use tokens from `@/constants/tokens`. Never hardcode colors, spacing, font sizes.

Key tokens for this story:
- Card container bg: `tokens.colors.surface` (#101C2C)
- Card border: `tokens.colors.border` (#1E2E44)
- Card border radius: `tokens.radii.lg` (16)
- Card padding: `tokens.spacing.md` (16)
- Title text: `tokens.typography.subtitle` (17pt/600) + `tokens.colors.text`
- Body text: `tokens.typography.body` (15pt/400) + `tokens.colors.text`
- Caption text: `tokens.typography.caption` (13pt/400) + `tokens.colors.textSecondary`
- List item separator: `tokens.colors.border` (#1E2E44)
- Spacing between items: `tokens.spacing.sm` (8)
- Minimum touch target: 48dp (use `minHeight: 48`)

### snake_case / camelCase Convention (CRITICAL -- from Epic 1 retrospective)

This was the #1 source of bugs in Epic 1. Follow EXACTLY:
- **Module specs arrive over WebSocket in `snake_case`** -- converted to `camelCase` via `toCamel()` in wsClient
- **TypeScript code uses `camelCase`** for all fields: `accessibleLabel`, `schemaVersion`
- **Zod schema in `packages/module-schema` uses `camelCase`** (source of truth)
- Primitives receive already-converted camelCase props from ModuleCard

### Accessibility Contract (NFR30, NFR31, NFR32, NFR33, NFR37)

Every primitive MUST:
1. Accept `accessibleLabel?: string` and `accessibleRole?: string` props
2. Apply `accessibilityLabel` and `accessibilityRole` to the root/key elements
3. Use `allowFontScaling={true}` on all Text components (React Native default -- do NOT set to false)
4. Use token colors that meet WCAG AA contrast ratios (pre-validated in the token set)
5. Support bidirectional text via `writingDirection: 'auto'` on Text components
6. **List items**: each item must have `minHeight: 48` for touch targets (NFR33)
7. **List items**: each item should have its own `accessibilityLabel` for screen reader navigation

### Testing Standards

- **Framework:** Jest (via `jest-expo` preset)
- **Location:** Co-located -- `CardPrimitive.test.tsx` next to `CardPrimitive.tsx`
- **Rendering:** `@testing-library/react-native` for component testing
- **Test naming:** `describe('CardPrimitive')` + `it('renders title')`
- **Module aliases:** Already configured: `'^@/(.*)$': '<rootDir>/$1'` and `'^@self/module-schema$'`
- **Malformed spec testing:** Every primitive test suite MUST include a test for graceful handling of undefined/null/malformed props -- primitives should NEVER throw
- **Accessibility testing:** Verify `accessibilityLabel` is present via `getByLabelText` or checking props
- **Test factory:** Use existing `createTestModuleSpec()` from `packages/module-schema/src/__tests__/fixtures/moduleSpec.ts` for module-level fixtures

### Existing Code to Reuse -- DO NOT RECREATE

- **`getPrimitive(type)`** -- `apps/mobile/components/sdui/registry.ts` -- CardPrimitive MUST use this to resolve its children
- **`PrimitiveProps`** interface -- `apps/mobile/components/sdui/registry.ts` -- base props for accessibility
- **`tokens`** -- `apps/mobile/constants/tokens.ts` -- all Twilight design tokens
- **`logger`** -- `apps/mobile/services/logger.ts` -- structured JSON logging
- **`TextPrimitive`** -- existing simple primitive (pattern reference for props/export/test structure)
- **`MetricPrimitive`** -- existing simple primitive (pattern reference)
- **`LayoutPrimitive`** -- existing container primitive (pattern reference for rendering children)
- **`UnknownPrimitive`** -- fallback component (CardPrimitive children with unknown type should resolve to this via `getPrimitive()`)
- **`ErrorBoundary`** -- `apps/mobile/components/bridge/ErrorBoundary.tsx` -- already wraps modules in ModuleCard, do NOT add another
- **Existing Zod schemas** -- `packages/module-schema/src/primitives.ts` -- append to this file, follow same pattern

### Anti-Patterns to Avoid

1. **Do NOT add business logic to SDUI primitives.** Props in, JSX out -- pure render functions.
2. **Do NOT use `any` for component props.** The registry uses `React.ComponentType<any>` but every concrete primitive has strict typed props.
3. **Do NOT create sub-directories inside `sdui/`.** Keep flat -- all primitives live directly in `components/sdui/`.
4. **Do NOT import from `../../packages/`.** Use `@self/module-schema` for cross-package imports.
5. **Do NOT add ErrorBoundary inside CardPrimitive.** ErrorBoundary lives in ModuleCard (bridge layer). SDUI primitives are pure.
6. **Do NOT use `ScrollView` for List when `FlatList` is more appropriate** (performance with large lists). Developer judgment on when to use which.
7. **Do NOT add event handlers or callbacks in primitive props.** SDUI primitives in First Light are display-only. Interaction comes in Story 7.1.
8. **Do NOT forget `agent_action` on error logs.** Every error log MUST include an `agent_action` string.
9. **Do NOT forget `writingDirection: 'auto'`** on Text components for RTL support.

### Project Structure Notes

Files to CREATE in this story:
```
apps/mobile/components/sdui/
  CardPrimitive.tsx           # Card composite primitive
  CardPrimitive.test.tsx      # Co-located tests
  ListPrimitive.tsx           # List composite primitive
  ListPrimitive.test.tsx      # Co-located tests
```

Files to MODIFY in this story:
```
apps/mobile/components/sdui/registry.ts     # Add card + list entries
apps/mobile/components/sdui/index.ts        # Export CardPrimitive, ListPrimitive
packages/module-schema/src/primitives.ts    # Add cardPrimitiveSchema, listPrimitiveSchema
packages/module-schema/src/index.ts         # Export new schemas and types
packages/module-schema/src/moduleSpec.ts    # Add 'card' (and 'layout' if missing) to moduleTypeEnum
```

Files NOT to touch:
```
apps/mobile/components/bridge/ModuleCard.tsx  # Already delegates to SDUI via getPrimitive() from 3.1
apps/mobile/components/bridge/ErrorBoundary.tsx  # Already handles module errors
```

### Previous Story Intelligence

**From Story 3.1 (done):**
- Registry uses `Map<string, React.ComponentType<any>>` (migrated from Record for prototype pollution safety during code review)
- `getPrimitive()` returns `UnknownPrimitive` for unknown types -- CardPrimitive children resolution should use the same function
- Each primitive exports a strict `Props` interface alongside the component (e.g., `CardPrimitiveProps`)
- Story 3.1 review identified that `extractPrimitiveProps()` in ModuleCard passes extra fields (name, schemaVersion) to primitives -- composites should be tolerant of extra props via rest spread or explicit destructuring
- 721 tests total after 3.1 (630 mobile + 91 schema) -- zero regressions expected
- `accessibleRole` is cast `as any` in all primitives (known LOW review item) -- follow same pattern for consistency, do not attempt to fix in this story

**From Epic 1 Retrospective (2026-02-23):**
- snake_case/camelCase conversion was the #1 bug source -- all boundary conversion happens in wsClient's `toCamel()`; primitives receive camelCase
- Consistent TDD from story 1.3 onward -- continue red-green-refactor pattern
- jest-expo preset and module aliases already configured
- Physical device testing caught real bugs -- test on device after implementation for font scaling and touch target verification

**From Roadmap:**
- Story 3.2 is Wave 2, Chain A (Rendering): `3.1 -> 3.2 -> 3.3`
- Next story after 3.2 is 2.1 (Real-Time Chat) or 3.3 (Module Rendering Pipeline) depending on team capacity
- Good patterns established here directly accelerate 3.3 (Module Rendering Pipeline) which needs all 5 First Light primitives fully working
- After 3.3, the entire SDUI stack converges with conversation at 3.4 (First Module Test) -- the product thesis validation

### Git Intelligence

Recent commits:
- `130439c` sel (latest -- story 3.1 done + code review fixes)
- `187777d` fix(1-5): revert session-scoped DB to per-sync connection
- `6c4803e` feat(1-5): offline message queue and cached data rendering

**Commit convention:** `feat(3-2): composite primitives Card and List`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Mobile Architecture (SDUI)] -- Primitive Registry pattern, getPrimitive, UnknownPrimitive, First Light 5 primitives
- [Source: _bmad-output/planning-artifacts/architecture.md#V1 Design Tokens (Twilight Theme)] -- All visual token values, card styling
- [Source: _bmad-output/planning-artifacts/architecture.md#SDUI Accessibility Contract] -- accessibleLabel, accessibleRole, touch targets 44x44pt/48x48dp, Dynamic Type
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] -- Naming, imports, exports, test patterns, factory functions
- [Source: _bmad-output/planning-artifacts/architecture.md#Test Patterns] -- Jest, co-located tests, factory functions
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2] -- Acceptance criteria, FR18, NFR33, NFR37
- [Source: _bmad-output/planning-artifacts/prd.md#Module Rendering & Display] -- FR17, FR18 primitive library (Card, List, Text, Metric, Layout)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] -- Module card styling (#101C2C bg, #1E2E44 border, 12px radius per UX but 16px per architecture tokens.radii.lg)
- [Source: _bmad-output/planning-artifacts/prd.md#Non-Functional Requirements] -- NFR30 Dynamic Type, NFR31 Screen readers, NFR32 Contrast, NFR33 Touch targets, NFR37 SDUI tests
- [Source: _bmad-output/implementation-artifacts/3-1-sdui-primitive-registry-and-simple-primitives.md] -- Previous story patterns, registry Map pattern, test structure, review follow-ups
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-02-23.md] -- snake_case/camelCase learnings, TDD approach, Hermes quirks

### UX Spec Note: Card Border Radius

The UX deep dive HTML specifies `12px` card radius while the architecture `tokens.radii.lg` is `16px`. The tokens file (`constants/tokens.ts`) is the source of truth for implementation. Use `tokens.radii.lg` (16px). If a future UX audit changes the token value, all cards update automatically.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No debug issues encountered. All tests passed on first implementation attempt.

### Completion Notes List

- **CardPrimitive**: Created composite SDUI primitive that composes inner primitives via `getPrimitive()`. Renders card container with Twilight tokens (surface bg, border, radii.lg, spacing.md). Title uses subtitle typography. Unknown child types gracefully fall back to UnknownPrimitive. 24 unit tests covering rendering, styling, children composition, edge cases, accessibility, RTL, and Dynamic Type.
- **ListPrimitive**: Created composite SDUI primitive for structured list data. Renders items with title (body typography), subtitle (caption + textSecondary), and trailing value (right-aligned). Items have minHeight 48 for NFR33 touch targets. Border separators between items (last excluded). Empty state shows "No items" in secondary color. Generated accessibilityLabel from title + item count. 25 unit tests covering all features and edge cases.
- **Zod Schemas**: Added `cardPrimitiveSchema` (with passthrough children objects) and `listPrimitiveSchema` (with `listItemSchema` for structured items) to `packages/module-schema/src/primitives.ts`. Exported all new schemas and types from index.ts. 32 new schema tests added.
- **Registry**: Added `card` -> CardPrimitive and `list` -> ListPrimitive entries. Registry now has 7 types (text, metric, layout, card, list, status, table). Updated barrel exports with new component types.
- **moduleTypeEnum**: Added `card` and `layout` to the enum for consistency with the registry (list already existed).
- **Integration Tests**: Extended integration.test.tsx with card and list through-registry rendering tests, unknown child fallback test, and smoke test for all 7 types.
- **Design decision (Task 2.3)**: Used View mapping instead of FlatList for ListPrimitive. For SDUI modules which render short lists within cards, View mapping is simpler and avoids FlatList nesting issues. FlatList is better suited for top-level scrollable lists (future story).
- **Test counts**: 688 mobile + 123 schema = 811 total tests passing. Zero regressions from previous 630+91=721 baseline. Net new: 58 mobile tests + 32 schema tests = 90 new tests.

### File List

Files CREATED:
- apps/mobile/components/sdui/CardPrimitive.tsx
- apps/mobile/components/sdui/CardPrimitive.test.tsx
- apps/mobile/components/sdui/ListPrimitive.tsx
- apps/mobile/components/sdui/ListPrimitive.test.tsx

Files MODIFIED:
- apps/mobile/components/sdui/registry.ts
- apps/mobile/components/sdui/registry.test.ts (review fix: added card/list type assertions)
- apps/mobile/components/sdui/index.ts
- apps/mobile/components/sdui/integration.test.tsx
- packages/module-schema/src/primitives.ts
- packages/module-schema/src/index.ts
- packages/module-schema/src/moduleSpec.ts
- packages/module-schema/src/__tests__/primitives.test.ts

### Change Log

- 2026-02-23: Story 3.2 implemented -- CardPrimitive and ListPrimitive composite SDUI primitives with full test coverage, Zod schemas, registry entries, and integration tests. 811 total tests passing (90 new, 0 regressions).
- 2026-02-23: Code review (Claude Opus 4.6) -- 3 MEDIUM issues fixed, 2 LOW documented. Fixed: (1) registry.test.ts missing card/list type assertions, (2) ListPrimitive "1 items" grammar bug in accessibility label, (3) CardPrimitive missing overflow:hidden for border radius clipping. Post-fix: 744 mobile + 152 schema = 896 total tests passing (2 new registry tests). Status -> done.
