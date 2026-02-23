# Story 3.3: Module Rendering Pipeline

Status: review

## Story

As a user,
I want to see modules rendered as native UI components on my phone,
So that the experience feels like a native app, not a web view. (FR17)

## Acceptance Criteria

1. **Given** a valid module definition JSON received via the `module_created` WebSocket message, **When** the mobile app receives it, **Then** the module is rendered using native components from the primitive registry (FR17) — `ModuleCard` selects the correct primitive via `getPrimitive(spec.type)`.

2. **Given** a module definition with a `template` field (e.g., `"metric-dashboard"`, `"data-card"`, `"simple-list"`), **When** rendered, **Then** the composition template registry resolves the template and the module layout follows the template structure — unknown templates fall back to `"data-card"`.

3. **Given** a rendered module, **When** the module spec contains `dataSources` with fetched `data` or nested primitive specs, **Then** the data is displayed with correct formatting, and the module renders in under 100ms (NFR3).

4. **Given** the app in cold start, **When** cached modules exist in expo-sqlite, **Then** cached content is visible and rendered within 2 seconds (NFR1) — validated by the startup timing log already in `App.tsx`.

5. **Given** a module spec with an unknown `type`, **When** rendered, **Then** `UnknownPrimitive` is shown with a structured error log and no crash.

6. **Given** a module rendered inside `ModuleCard`, **When** the module spec contains a field `accessibleLabel`, **Then** the module's root element has that accessible label applied (NFR31).

7. **Given** a module with `dataStatus: 'error'` or a `dataStatus: 'stale'`, **When** displayed, **Then** `FreshnessIndicator` shows the correct "Offline" or "Stale" badge — existing behavior preserved with no regressions.

8. **Given** the `ModuleList` component, **When** modules are added via `module_list` or `module_sync` WebSocket messages, **Then** they render via the pipeline (ModuleList → ModuleCard → template resolution → getPrimitive) with no manual refresh needed.

9. **Given** the composition template registry (`templates.ts`), **When** a new template is added, **Then** it requires only one registry entry — no other changes needed.

10. **Given** each module rendered inside `ModuleCard`, **When** a render error occurs in any SDUI primitive, **Then** `ErrorBoundary` catches it and shows the fallback card — other modules are unaffected (from architecture: module isolation).

## Tasks / Subtasks

- [x] **Task 1: Create the composition template registry** (AC: #2, #9)
  - [x] 1.1 Create `apps/mobile/components/sdui/templates.ts` with `TemplateDefinition` interface and `templateRegistry` Map
  - [x] 1.2 Define `TemplateDefinition`: `{ layout: { type: 'stack' | 'grid'; direction?: 'vertical' | 'horizontal'; columns?: number }; slots: TemplateSlot[] }` and `TemplateSlot`: `{ role: string; primitive: string | string[]; min?: number; max?: number; optional?: boolean }`
  - [x] 1.3 Register the 3 First Light templates exactly as defined in architecture:
    - `'metric-dashboard'`: 2-column grid, slots: `[{ role: 'metrics', primitive: 'metric', min: 2, max: 4 }, { role: 'chart', primitive: 'chart', optional: true }]`
    - `'data-card'`: vertical stack, slots: `[{ role: 'header', primitive: 'text', variant: 'title' }, { role: 'content', primitive: ['list', 'table'], min: 1, max: 1 }]`
    - `'simple-list'`: vertical stack, slots: `[{ role: 'list', primitive: 'list', min: 1, max: 1 }]`
  - [x] 1.4 Export `getTemplate(name: string): TemplateDefinition` — returns `templateRegistry.get(name) ?? templateRegistry.get('data-card')!` (fallback to data-card per architecture)
  - [x] 1.5 Export from `apps/mobile/components/sdui/index.ts` barrel
  - [x] 1.6 Write co-located unit tests `templates.test.ts`: each known template resolves, unknown template falls back to `data-card`, `getTemplate` returns correct shape, adding a template needs only 1 registry entry (~10 tests)

- [x] **Task 2: Extend ModuleCard to use template-aware rendering** (AC: #1, #2, #3, #6, #10)
  - [x] 2.1 Update `ModuleCard.extractPrimitiveProps()` to properly scope props by primitive type — use allowlist approach: for each primitive type, pass only the fields that primitive expects, not the entire spec spread. This fixes the known LOW review item from 3.1.
  - [x] 2.2 Read `spec.template` in `ModuleCardContent` and call `getTemplate(template)` to resolve the template definition
  - [x] 2.3 Use the template's `layout` to set `LayoutPrimitive` direction/columns for the module's root layout
  - [x] 2.4 Apply `accessibilityLabel` from `spec.accessibleLabel` to the module's root `View` container (AC #6, NFR31)
  - [x] 2.5 Preserve existing card chrome (title, `FreshnessIndicator`, `ErrorBoundary`) — do NOT remove existing behavior
  - [x] 2.6 For the `data-card` template (most common): render the `type` primitive in a vertical stack inside the card container
  - [x] 2.7 Update `ModuleCard.test.tsx`: add tests for template resolution, `accessibleLabel` applied to root, `data-card` fallback, template-based layout rendering (~8 new tests)

- [x] **Task 3: Add `templates.ts` Zod schema to module-schema** (AC: #2, #9)
  - [x] 3.1 Confirm `templateEnum` in `packages/module-schema/src/moduleSpec.ts` already has `'metric-dashboard'`, `'data-card'`, `'simple-list'` — it does (already `z.enum(['metric-dashboard', 'data-card', 'simple-list'])`)
  - [x] 3.2 No schema changes needed — the schema already has `template: templateEnum.default('data-card')` — this task is verification only
  - [x] 3.3 Verify existing schema tests still pass: `pnpm --filter module-schema test` — zero regressions

- [x] **Task 4: Add render performance measurement** (AC: #3, #4)
  - [x] 4.1 In `ModuleCardContent`, use `React.useEffect` with a `Date.now()` start time captured before render to log render duration: `logger.info('sdui', 'module_rendered', { module_id, render_ms, template, type })`
  - [x] 4.2 If `render_ms > 100`, log with `severity: 'warn'` and `agent_action: "Module render exceeded 100ms NFR3 target. Check primitive complexity."` (NFR3)
  - [x] 4.3 Verify the existing startup timing in `App.tsx` logs `startup_ms` — this already handles NFR1. No additional work needed for cold start.
  - [x] 4.4 Write test: `ModuleCard` logs render timing via logger mock (verify `logger.info` called with `'module_rendered'` event)

- [x] **Task 5: End-to-end integration test for the rendering pipeline** (AC: #1, #2, #5, #7, #8)
  - [x] 5.1 Create `apps/mobile/components/bridge/pipeline.test.tsx` with pipeline tests:
    - Verify unknown `type` renders `UnknownPrimitive` without crashing the pipeline
    - Verify `dataStatus: 'stale'` shows `FreshnessIndicator` with `"Stale"` badge (via `ModuleCard`)
    - Verify `dataStatus: 'error'` shows `Offline` badge via `ModuleCard`
    - Verify multiple modules render via `ModuleList` with no manual refresh
    - Verify `ErrorBoundary` isolates failures (one bad module doesn't crash others)
  - [x] 5.2 Verify each of the 3 First Light templates renders a module spec without error: `metric-dashboard` with metric primitive, `data-card` with text primitive, `simple-list` with list primitive
  - [x] 5.3 Run all tests: `pnpm --filter mobile test` — 779 tests pass (35 new), zero regressions from 744 baseline

## Dev Notes

### Architecture Patterns and Constraints

**3-Layer Component Architecture (CRITICAL):**
- **Shell** (static): NOT touched in this story
- **Bridge** (lifecycle-aware): `ModuleCard.tsx`, `ModuleList.tsx` — MODIFIED in this story
- **SDUI** (pure, stateless): `templates.ts` CREATED; primitives NOT modified

**Rendering Pipeline (current state after 3.1 + 3.2):**
```
ModuleList (FlatList) → ModuleCard (ErrorBoundary wrapper)
  → ModuleCardContent
    → getPrimitive(spec.type)
    → <PrimitiveComponent {...extractPrimitiveProps(spec)} type={primitiveType} />
    → FreshnessIndicator
```

**Rendering Pipeline (target state after 3.3):**
```
ModuleList (FlatList) → ModuleCard (ErrorBoundary wrapper)
  → ModuleCardContent
    → getTemplate(spec.template)        ← NEW: template resolution
    → LayoutPrimitive (template layout) ← NEW: template-driven layout wrapper
    → getPrimitive(spec.type)           ← existing
    → <PrimitiveComponent {...scoped props} /> ← fixed: scoped, not full spread
    → FreshnessIndicator               ← unchanged
```

**Critical note on `extractPrimitiveProps`:** The current implementation spreads ALL spec fields (except `moduleId`) as primitive props. This passes `name`, `schemaVersion`, `dataSources`, `refreshInterval`, `template`, `accessibleLabel` etc. as unknown props into primitives. For story 3.3, fix this to scope props per primitive type. See the existing LOW review item in 3.1 completion notes: `ModuleCard.extractPrimitiveProps()` removes only `moduleId` from the spec before passing all remaining fields.

**What `extractPrimitiveProps` should do after this story:**
- For `type: 'text'` → pass only `{ text, variant, accessibleLabel, accessibleRole }`
- For `type: 'metric'` → pass only `{ value, label, unit, trend, accessibleLabel, accessibleRole }`
- For `type: 'layout'` → pass only `{ direction, columns, gap, accessibleLabel, accessibleRole }`
- For `type: 'card'` → pass only `{ title, children, accessibleLabel, accessibleRole }`
- For `type: 'list'` → pass only `{ items, title, accessibleLabel, accessibleRole }`
- For unknown types → pass `{ type }` only (matches `UnknownPrimitive` requirements)

**Template Registry Pattern (from architecture `templates.ts` spec):**
```typescript
// components/sdui/templates.ts
const templateRegistry = new Map<string, TemplateDefinition>([
  ['metric-dashboard', {
    layout: { type: 'grid', columns: 2 },
    slots: [
      { role: 'metrics', primitive: 'metric', min: 2, max: 4 },
      { role: 'chart', primitive: 'chart', optional: true },
    ],
  }],
  ['data-card', {
    layout: { type: 'stack', direction: 'vertical' },
    slots: [
      { role: 'header', primitive: 'text', variant: 'title' },
      { role: 'content', primitive: ['list', 'table'], min: 1, max: 1 },
    ],
  }],
  ['simple-list', {
    layout: { type: 'stack', direction: 'vertical' },
    slots: [{ role: 'list', primitive: 'list', min: 1, max: 1 }],
  }],
]);

export const getTemplate = (name: string): TemplateDefinition =>
  templateRegistry.get(name) ?? templateRegistry.get('data-card')!;
```

**First Light templates only (3). MVP adds 3 more:** `map-with-details`, `timeline-view`, `chart-with-context` — do NOT implement these now.

### Module Spec Shape (CRITICAL — camelCase after toCamel())

Module specs arrive over WebSocket as `snake_case` and are converted to `camelCase` by `wsClient.ts`'s `toCamel()` before reaching the store. `ModuleCard` receives camelCase:

```typescript
// What ModuleCard receives from moduleStore (already camelCase)
{
  moduleId: "uuid-here",
  name: "Weather",
  type: "card",            // primitive type: text | metric | layout | card | list
  template: "data-card",   // composition template
  dataSources: [...],
  refreshInterval: 3600,
  schemaVersion: 1,
  accessibleLabel: "Weather forecast for Paris",
  // Primitive-specific data (e.g., for type: 'metric'):
  value: "22",
  label: "Temperature",
  unit: "°C",
  trend: "up",
  // Or for type: 'card':
  title: "Weather",
  children: [{ type: 'metric', value: '22', label: 'Temperature' }]
}
```

The `spec` from `moduleStore` is typed as `ModuleSpec` from `@/types/ws.ts` which is `{ moduleId: string; [key: string]: unknown }`. For more specific handling, access the primitive-specific fields via `spec as Record<string, unknown>`.

### Design Token Usage (MANDATORY)

Do NOT introduce new hardcoded values. The card chrome styling in `ModuleCard` already uses tokens correctly:
- `tokens.colors.surface` (#101C2C) — card background
- `tokens.colors.border` (#1E2E44) — border color
- `tokens.radii.lg` (16) — border radius
- `tokens.spacing.md` (16) — padding
- `tokens.typography.subtitle` — module title

For any template-driven layout, use `LayoutPrimitive` which already handles `direction` and `columns` via tokens internally.

### snake_case / camelCase Convention (CRITICAL — #1 bug source from Epic 1)

- **Wire format (WebSocket JSON):** `snake_case` — `module_id`, `data_sources`, `refresh_interval`
- **TypeScript code and Zod schemas:** `camelCase` — `moduleId`, `dataSources`, `refreshInterval`
- **Conversion point:** ONLY in `wsClient.ts`'s `toCamel()` — primitives always receive camelCase
- Never convert again in `ModuleCard` or primitives — the conversion is already done

### Existing Code to Reuse — DO NOT RECREATE

- **`getPrimitive(type)`** — `apps/mobile/components/sdui/registry.ts` — already in `ModuleCard`
- **`LayoutPrimitive`** — `apps/mobile/components/sdui/LayoutPrimitive.tsx` — use for template layout wrapper
- **`ErrorBoundary`** — `apps/mobile/components/bridge/ErrorBoundary.tsx` — already wraps `ModuleCardContent`
- **`FreshnessIndicator`** — `apps/mobile/components/bridge/FreshnessIndicator.tsx` — already in `ModuleCard`
- **`ModuleList`** — `apps/mobile/components/bridge/ModuleList.tsx` — renders `ModuleCard`s, NOT modified
- **`moduleSync.ts`** — `apps/mobile/services/moduleSync.ts` — registers WS handlers, NOT modified
- **`moduleStore`** — `apps/mobile/stores/moduleStore.ts` — `addModule`, `updateModule`, `loadFromCache` already work
- **`tokens`** — `apps/mobile/constants/tokens.ts` — all Twilight tokens
- **`logger`** — `apps/mobile/services/logger.ts` — structured logging
- **`createTestModuleSpec()`** — `packages/module-schema/src/__tests__/fixtures/moduleSpec.ts` — use for test fixtures

### Accessibility Contract (NFR31)

`spec.accessibleLabel` MUST be passed to the card root `View` as `accessibilityLabel`. The module spec schema enforces this field as required (`z.string().min(1)` in `moduleSpecSchema`). Every module spec will have it — the agent generates it during module creation.

Apply it to the outermost module `View`:
```typescript
<View
  style={styles.card}
  accessibilityLabel={spec.accessibleLabel as string | undefined}
>
```

### Performance Contract (NFR1, NFR3)

- **NFR3: Module render < 100ms** — measure from when `ModuleCardContent` begins rendering to when `useEffect` fires post-render. Log with `logger.info('sdui', 'module_rendered', { module_id, render_ms })`. If > 100ms, log as warning.
- **NFR1: Cold start < 2s** — already handled by `App.tsx` startup timing log. The `loadFromCache` → `moduleStore.loadFromCache` → `ModuleList` → `ModuleCard` chain renders synchronously from cached data on startup. No additional work needed.

### Anti-Patterns to Avoid

1. **Do NOT modify existing SDUI primitives** (TextPrimitive, MetricPrimitive, etc.) — they are already correct.
2. **Do NOT add state or side effects to SDUI primitives** — they are pure render functions. The render timing measurement belongs in `ModuleCard` (bridge layer), not in primitives.
3. **Do NOT recreate `ModuleList`** — it already works. Only `ModuleCard` needs updating.
4. **Do NOT add a second `ErrorBoundary`** inside `ModuleCard` — it already wraps `ModuleCardContent`.
5. **Do NOT spread the full spec as primitive props** — use the scoped allowlist approach (Task 2.1).
6. **Do NOT implement MVP templates** (`map-with-details`, `timeline-view`, `chart-with-context`) — First Light only.
7. **Do NOT add `agent_action: null`** — only include `agent_action` on error logs, never on info logs. The field must be present but set to null only on error entries (from logger pattern).
8. **Do NOT break the `src/index.ts` exports** in `components/sdui` — use the barrel pattern to export `getTemplate` and `TemplateDefinition`.

### Project Structure Notes

Files to CREATE in this story:
```
apps/mobile/components/sdui/
  templates.ts             # Composition template registry + getTemplate()
  templates.test.ts        # Co-located tests for templates
apps/mobile/components/bridge/
  pipeline.test.tsx        # OR extend integration.test.tsx
```

Files to MODIFY in this story:
```
apps/mobile/components/bridge/ModuleCard.tsx      # Template resolution, scoped props, accessibleLabel
apps/mobile/components/bridge/ModuleCard.test.tsx # New tests for template/accessibility/render timing
apps/mobile/components/sdui/index.ts              # Export getTemplate, TemplateDefinition
```

Files NOT to touch:
```
apps/mobile/components/sdui/registry.ts           # Already correct — 7 types registered
apps/mobile/components/sdui/*Primitive.tsx         # Primitives are done — DO NOT MODIFY
apps/mobile/components/bridge/ModuleList.tsx       # Already works — NOT modified
apps/mobile/services/moduleSync.ts                 # Already handles all WS module messages
apps/mobile/stores/moduleStore.ts                  # Already correct
packages/module-schema/src/moduleSpec.ts           # templateEnum already correct
```

### Previous Story Intelligence

**From Story 3.2 (done, 2026-02-23):**
- Registry now has 7 types: `text`, `metric`, `layout`, `card`, `list`, `status`, `table` (status/table are UnknownPrimitive stubs)
- `CardPrimitive` uses `getPrimitive()` to resolve children dynamically — composite pattern
- `ListPrimitive` uses flat `ListItem` data (NOT recursive `getPrimitive()`) — different pattern
- Total test count after 3.2: 744 mobile + 152 schema = 896 total (post code-review fixes)
- LOW review item open: `ModuleCard.extractPrimitiveProps()` passes all spec fields — fix in THIS story (Task 2.1)
- LOW review item open: Array index used as React key in CardPrimitive — NOT in scope for 3.3
- LOW review item open: Hardcoded "No items" string in ListPrimitive — NOT in scope for 3.3

**From Story 3.1 (done):**
- Registry uses `Map` (NOT `Record`) for prototype pollution safety — use `Map` for `templateRegistry` too
- `accessibleRole` is cast `as any` in all primitives — follow same pattern for consistency
- `extractPrimitiveProps()` in `ModuleCard` passes extra fields (name, schemaVersion) — FIX IN THIS STORY
- jest-expo preset and module aliases already configured: `@/` → `<rootDir>/`, `@self/module-schema` → package src

**From Epic 1 Retrospective:**
- snake_case/camelCase was #1 bug source — all conversion at wsClient boundary, primitives receive camelCase
- TDD (red-green-refactor) maintained from story 1.3 — continue this pattern
- Physical device testing caught real bugs (font scaling, touch targets) — test on device for render timing

### Git Intelligence

Recent commits:
- `130439c` sel (latest — story 3.1/3.2 done + code review fixes)
- `187777d` fix(1-5): revert session-scoped DB to per-sync connection
- `6c4803e` feat(1-5): offline message queue and cached data rendering

**Commit convention:** `feat(3-3): module rendering pipeline with composition templates`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Mobile Architecture (SDUI)] — Template Registry pattern, getTemplate, 3 First Light templates with full slot definitions
- [Source: _bmad-output/planning-artifacts/architecture.md#Phase Morphing Interface (Direction D)] — Module rendering phases (Phase 0-3), layout rules
- [Source: _bmad-output/planning-artifacts/architecture.md#V1 Design Tokens (Twilight Theme)] — all visual token values
- [Source: _bmad-output/planning-artifacts/architecture.md#SDUI Accessibility Contract] — accessibleLabel required in spec, NFR31
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] — naming, imports, async, testing
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Flow — Module Creation Flow] — full pipeline description
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3] — Acceptance criteria, FR17, NFR1, NFR3
- [Source: _bmad-output/planning-artifacts/prd.md#Module Rendering & Display] — FR17, FR18 rendering requirements
- [Source: _bmad-output/planning-artifacts/prd.md#Non-Functional Requirements] — NFR1 cold start, NFR3 render speed, NFR30 Dynamic Type, NFR31 screen readers, NFR32 contrast, NFR37 SDUI tests
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] — 3-layer component architecture, Constrained Composition Principle, 6 composition templates
- [Source: _bmad-output/implementation-artifacts/3-2-composite-primitives-card-list.md] — Previous story patterns, open review items, file list
- [Source: _bmad-output/implementation-artifacts/3-1-sdui-primitive-registry-and-simple-primitives.md] — Registry Map pattern, extractPrimitiveProps LOW issue
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-02-23.md] — snake_case/camelCase learnings, TDD approach

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No debug issues encountered. All implementations followed red-green-refactor TDD cycle cleanly.

### Completion Notes List

- **Task 1 (Template Registry):** Created `templates.ts` with `TemplateDefinition`, `TemplateSlot`, and `TemplateLayout` interfaces. Used `Map` (not `Record`) consistent with `primitiveRegistry` pattern. `getTemplate()` falls back to `data-card` for unknown names. 14 unit tests in `templates.test.ts` all pass.

- **Task 2 (ModuleCard template-aware rendering):** Updated `ModuleCardContent` to read `spec.template`, call `getTemplate()`, and wrap the primitive inside a `LayoutPrimitive` with template-driven `direction`/`columns`. Fixed the LOW review item from 3.1: `extractPrimitiveProps` now uses an allowlist switch per primitive type (text/metric/layout/card/list/unknown), preventing `schemaVersion`, `dataSources`, `refreshInterval`, `template` etc. from leaking into primitives. Applied `spec.accessibleLabel` as `accessibilityLabel` on the root `View` (NFR31). 8 new tests added to `ModuleCard.test.tsx` (23 total).

- **Task 3 (Schema verification):** Confirmed `templateEnum` already has all 3 First Light templates and `template: templateEnum.default('data-card')` in `moduleSpecSchema`. No schema changes needed. 152 schema tests pass with zero regressions.

- **Task 4 (Render timing):** Added `renderStartRef = React.useRef(Date.now())` captured before render and a `useEffect(() => {...}, [])` hook to log `module_rendered` event with `render_ms`, `template`, `type`. Uses `logger.warning` with `agent_action` if > 100ms (NFR3), `logger.info` otherwise. Test in `ModuleCard.test.tsx` verifies `logger.info` called with `module_rendered`.

- **Task 5 (Pipeline integration tests):** Created `pipeline.test.tsx` with 12 tests covering: all 3 primitive types via pipeline, unknown type as `UnknownPrimitive`, `dataStatus: stale` shows `Stale` badge, `dataStatus: error` shows `Offline` badge, all 3 First Light templates render without error, `ModuleList` renders multiple modules, and `ErrorBoundary` isolation verified.

- **Final test count:** 779 mobile tests (up from 744 baseline, +35 new tests) + 152 schema tests = 931 total. All 31 test suites pass.

### File List

- `apps/mobile/components/sdui/templates.ts` (CREATED)
- `apps/mobile/components/sdui/templates.test.ts` (CREATED)
- `apps/mobile/components/bridge/pipeline.test.tsx` (CREATED)
- `apps/mobile/components/bridge/ModuleCard.tsx` (MODIFIED — template-aware rendering, scoped extractPrimitiveProps, accessibilityLabel, render timing)
- `apps/mobile/components/bridge/ModuleCard.test.tsx` (MODIFIED — 9 new tests for template resolution, accessibleLabel, render timing logging)
- `apps/mobile/components/sdui/index.ts` (MODIFIED — export getTemplate, TemplateDefinition, TemplateSlot, TemplateLayout)

### Change Log

- 2026-02-23: Implemented Story 3.3 — module rendering pipeline with composition templates. Created template registry (`templates.ts`) with 3 First Light templates. Updated `ModuleCard` with template-aware rendering via `getTemplate()` + `LayoutPrimitive`, fixed scoped `extractPrimitiveProps` (LOW review item from 3.1), applied `accessibilityLabel` (NFR31), added render timing logging (NFR3). Created `pipeline.test.tsx` for end-to-end pipeline integration tests. All 779 mobile tests + 152 schema tests pass.
