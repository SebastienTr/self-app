# Story 2.4: Contextual Empty State

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see an inviting empty state that guides me to start a conversation when no modules exist,
so that I know what to do on first use. (FR8)

## Acceptance Criteria

1. **Given** the app has no modules and no conversation history **When** the user opens the app **Then** the Home tab displays a contextual empty state inviting the first conversation (FR8) **And** the orb is visible with its ambient breathing animation (6s cycle, opacity 0.3 to 0.55)

2. **Given** the empty state is displayed **When** the user sees prompt suggestion chips **Then** 3-4 contextual conversation starters are shown (chips: `#12203A` bg, `#E8A84C` border, 16px radius) **And** chips are personalized to the selected persona

3. **Given** the user has "Reduce Motion" system setting enabled **When** the empty state is displayed **Then** the orb shows a static amber glow (no pulse animation) and ambient breathing resolves to a fixed opacity

4. **Given** the user does nothing for 15 seconds on the first screen **When** the nudge timer triggers **Then** a gentle prompt encourages the user to start typing

5. **Given** the user taps a suggestion chip **When** the chip is pressed **Then** the chip text is sent as a user message (via chatStore + wsClient) **And** the app navigates to the Chat tab **And** all chips fade out with a 300ms opacity transition

6. **Given** the user sends their first message (via chip or chat tab) **When** the message is sent **Then** the prompt chips disappear permanently (not shown again for this session)

7. **Given** a persona is active (flame/tree/star) **When** the empty state renders chips **Then** the fourth chip is persona-specific (Flame: "Automate something", Tree: "Let's chat first", Star: "Surprise me") **And** the persona chip has a dashed border style

8. **Given** no persona is active (persona is null) **When** the empty state renders chips **Then** only the 3 universal chips are shown (no persona chip)

## Tasks / Subtasks

- [x] Task 1: Create PromptChips component (AC: #2, #5, #6, #7, #8)
  - [x] 1.1 Create `apps/mobile/components/shell/PromptChips.tsx` as a shell component
  - [x] 1.2 Props: `onChipPress: (text: string) => void`, `persona: PersonaType | null`, `visible: boolean`
  - [x] 1.3 Render 3 universal chips: "What's the weather like?", "Track something for me", "Help me organize my week"
  - [x] 1.4 Render a 4th persona-specific chip (dashed border) when `persona` is not null: Flame: "Automate something", Tree: "Let's chat first", Star: "Surprise me"
  - [x] 1.5 Style chips per UX spec: `accentSubtle` (#12203A) background, `accent` (#E8A84C) text + solid border. Persona chip: dashed border. Border radius 16px, padding 7px 14px. Minimum touch target 44pt height (use `minHeight: 44`)
  - [x] 1.6 Implement fade-out animation: when `visible` transitions from true to false, fade out all chips with 300ms opacity animation (`tokens.animation.chipDismiss.duration`). Use `Animated.timing` with `useNativeDriver: true`
  - [x] 1.7 Layout: horizontal `flexWrap: 'wrap'` row with `gap: 6px` and `paddingHorizontal: 14px`
  - [x] 1.8 Export from `components/shell/index.ts`

- [x] Task 2: Create AmbientBackground component (AC: #1, #3)
  - [x] 2.1 Create `apps/mobile/components/shell/AmbientBackground.tsx` as a shell component
  - [x] 2.2 Render an absolutely positioned `View` covering the parent with a radial-gradient-like effect using overlapping View layers (expo-linear-gradient not in package.json, used fallback per dev notes)
  - [x] 2.3 Implement breathing animation: opacity oscillating between 0.3 and 0.55 on a 6s cycle (`tokens.animation.breathe.duration`). Use `Animated.loop` with `Animated.sequence` of two `Animated.timing` calls
  - [x] 2.4 Respect Reduce Motion: if system setting enabled, show static opacity at 0.42 (midpoint) with no animation. Use `AccessibilityInfo.isReduceMotionEnabled()` check
  - [x] 2.5 Colors: use dark navy blue radial approximation — two overlapping View layers: one covering top half (`#1A2844`), one at bottom-right with faint amber (`rgba(232,168,76,0.08)`)
  - [x] 2.6 Export from `components/shell/index.ts`

- [x] Task 3: Create NudgePrompt component (AC: #4)
  - [x] 3.1 Create `apps/mobile/components/shell/NudgePrompt.tsx` as a shell component
  - [x] 3.2 Props: `visible: boolean`
  - [x] 3.3 Display text: "Try tapping a suggestion or type anything" (from UX flow P0-B)
  - [x] 3.4 Style: `textSecondary` color, `caption` typography, centered, with a fade-in animation (400ms, `tokens.animation.fadeIn.duration`)
  - [x] 3.5 Only renders when `visible` is true. Fade in on appearance
  - [x] 3.6 Export from `components/shell/index.ts`

- [x] Task 4: Enhance HomeScreen empty state (AC: #1, #2, #3, #4, #5, #6, #7, #8)
  - [x] 4.1 Replace the current minimal empty state in `HomeScreen.tsx` with a full contextual empty state layout
  - [x] 4.2 Layout (top to bottom): AmbientBackground (absolute, behind everything) -> centered content area (Orb 64px + "No modules yet" text + "Ask Self to create one" link) -> NudgePrompt (below center content) -> PromptChips (above the bottom of the screen, positioned near where the tab bar is)
  - [x] 4.3 Read persona from `useConnectionStore((s) => s.persona)` and pass to PromptChips
  - [x] 4.4 Read message count from `useChatStore((s) => s.messages.length)` to determine if chips should be visible (visible only when messages.length === 0)
  - [x] 4.5 Implement chip press handler: call `useChatStore.getState().addUserMessage(chipText)`, call `send({ type: 'chat', payload: { message: chipText } })`, then `navigation.navigate('Chat')`
  - [x] 4.6 Implement 15s nudge timer: start a `setTimeout` on mount when `messages.length === 0`. Clear on unmount or when a message is sent. Set `showNudge` state to true after 15s. Reset timer if user navigates away (use `addListener('blur')`)
  - [x] 4.7 Keep the existing "Ask Self to create one" link to Chat tab as the primary CTA

- [x] Task 5: Write tests for PromptChips (AC: #2, #5, #7, #8)
  - [x] 5.1 Create `apps/mobile/components/shell/PromptChips.test.tsx`
  - [x] 5.2 Test: renders 3 universal chips when persona is null
  - [x] 5.3 Test: renders 4 chips when persona is "flame" (4th = "Automate something")
  - [x] 5.4 Test: renders 4 chips when persona is "tree" (4th = "Let's chat first")
  - [x] 5.5 Test: renders 4 chips when persona is "star" (4th = "Surprise me")
  - [x] 5.6 Test: persona chip has dashed border style
  - [x] 5.7 Test: tapping a chip calls onChipPress with chip text
  - [x] 5.8 Test: chips meet minimum 44pt touch target height
  - [x] 5.9 Test: all chips have accessible labels

- [x] Task 6: Write tests for AmbientBackground (AC: #1, #3)
  - [x] 6.1 Create `apps/mobile/components/shell/AmbientBackground.test.tsx`
  - [x] 6.2 Test: renders without crashing
  - [x] 6.3 Test: uses absolute positioning to fill parent
  - [x] 6.4 Test: respects reduce motion (static opacity when enabled)

- [x] Task 7: Write tests for NudgePrompt (AC: #4)
  - [x] 7.1 Create `apps/mobile/components/shell/NudgePrompt.test.tsx`
  - [x] 7.2 Test: renders nudge text when visible is true
  - [x] 7.3 Test: does not render content when visible is false
  - [x] 7.4 Test: text content matches expected nudge message

- [x] Task 8: Write tests for enhanced HomeScreen empty state (AC: all)
  - [x] 8.1 Update `apps/mobile/screens/HomeScreen.test.tsx` with new tests
  - [x] 8.2 Test: empty state shows AmbientBackground
  - [x] 8.3 Test: empty state shows PromptChips when no messages exist
  - [x] 8.4 Test: PromptChips not shown when messages exist (user already chatted)
  - [x] 8.5 Test: chip press sends message, navigates to Chat
  - [x] 8.6 Test: nudge appears after 15s of inactivity (use jest.advanceTimersByTime)
  - [x] 8.7 Test: nudge does not appear if user interacts before 15s
  - [x] 8.8 Test: nudge timer clears on unmount
  - [x] 8.9 Test: persona chip rendered when persona is set in connectionStore

- [x] Task 9: Write edge case tests (AC: all)
  - [x] 9.1 Updated `apps/mobile/screens/HomeScreen.edge.test.tsx` with contextual empty state edge tests
  - [x] 9.2 Edge: chips disappear when first message arrives mid-view (chatStore subscription)
  - [x] 9.3 Edge: rapid chip taps only send one message (debounce or disable after first tap)
  - [x] 9.4 Edge: persona changes while empty state visible (re-renders with new persona chip)
  - [x] 9.5 Edge: navigate away and back resets nudge timer
  - [x] 9.6 Edge: modules appear while on empty state (transitions to ModuleList)
  - [x] 9.7 Create `apps/mobile/components/shell/PromptChips.edge.test.tsx`
  - [x] 9.8 Edge: fade-out animation completes before component unmounts

- [x] Task 10: Run all tests and verify no regressions (AC: all)
  - [x] 10.1 Run mobile tests — all 1303 tests pass across 73 suites (was 1272)
  - [x] 10.2 New test count: 31 new tests across 6 new/modified test files
  - [x] 10.3 Run backend tests — all 866 backend tests pass (no backend changes)

## Dev Notes

### Architecture Compliance (MANDATORY)

This is story 2.4 in Epic 2 (Conversational Shell & Agent Identity). It is the LAST story in Epic 2. It enhances the existing minimal empty state (from story 2-5b) into a full contextual empty state per the UX specification.

**Key architectural decisions:**

1. **Mobile-only story** — No backend changes. All new components are shell-layer (static, not SDUI). The prompt chips, ambient background, and nudge are purely client-side.

2. **Shell layer components** — PromptChips, AmbientBackground, and NudgePrompt are all shell-layer components (go in `components/shell/`). They do NOT access stores directly. They receive data via props from HomeScreen (which is a screen/bridge layer component).

3. **Chips send messages via wsClient** — When a chip is tapped, the HomeScreen handler calls `addUserMessage()` on chatStore AND `send()` on wsClient, then navigates to Chat. This is the same pattern used in `ChatScreen.handleSend()`.

4. **Persona data from connectionStore** — The `persona` field is already available in `connectionStore` (added in story 2-3). HomeScreen reads it and passes to PromptChips.

5. **Chat history from chatStore** — The `messages` array length determines chip visibility. Chips show ONLY when `messages.length === 0` (true first launch with no conversation history).

6. **Existing empty state is a STARTING POINT** — Story 2-5b created a basic empty state in HomeScreen (Orb + text + link). This story ENHANCES it with ambient background, prompt chips, and nudge. The existing Orb, "No modules yet" text, and "Ask Self to create one" link remain.

### Existing HomeScreen Empty State (from story 2-5b)

The current empty state in `apps/mobile/screens/HomeScreen.tsx` renders:
```tsx
<View style={styles.emptyContainer}>
  <Orb size={64} />
  <Text style={styles.emptyTitle}>No modules yet</Text>
  <TouchableOpacity onPress={goToChat} accessibilityRole="link">
    <Text style={styles.emptyLink}>Ask Self to create one {'\u2192'}</Text>
  </TouchableOpacity>
</View>
```

This story wraps this with AmbientBackground, adds PromptChips below, and adds NudgePrompt.

### PromptChips Spec (from UX Design)

**Universal chips (always shown):**
1. "What's the weather like?"
2. "Track something for me"
3. "Help me organize my week"

**Persona-specific chip (4th chip, dashed border):**
- Flame: "Automate something"
- Tree: "Let's chat first"
- Star: "Surprise me"

**Styling:**
- Background: `tokens.colors.accentSubtle` (#12203A)
- Text + border color: `tokens.colors.accent` (#E8A84C)
- Border: 1px solid for universal, 1px dashed for persona chip
- Border radius: 16px (`tokens.radii.lg`)
- Padding: 7px 14px
- Min height: 44 (touch target NFR33)
- Layout: horizontal `flexWrap: 'wrap'`, `gap: 6`

**Behavior:**
- Tapping sends the chip text as a user message
- All chips fade out with 300ms transition (`tokens.animation.chipDismiss`)
- Chips disappear permanently after first user message

### AmbientBackground Spec (from UX Design)

The ambient background creates a "gently alive" atmosphere. It is NOT a flat color but a layered gradient effect with a breathing animation.

**Implementation approach:** Since React Native does not have CSS radial gradients, use `expo-linear-gradient` (built into Expo SDK 54) to approximate the effect:
- Layer 1: A top-to-center gradient from `#1A2844` to `transparent` (approximates the blue glow)
- Layer 2: A bottom-right gradient with faint amber `rgba(232,168,76,0.08)` (the warm accent)

**Breathing animation:** Opacity oscillates 0.3 to 0.55 over 6s (`tokens.animation.breathe.duration`).

**Reduce Motion:** Static opacity at 0.42 (visual midpoint).

**Alternative approach if expo-linear-gradient is complex:** Use two overlapping `View` components with solid background colors and varying opacity. The visual effect will be simpler but still conveys the "alive" atmosphere. The dev agent should evaluate which approach looks better.

### Nudge Timer Spec

- Timer starts when HomeScreen empty state mounts AND `messages.length === 0`
- After 15 seconds, show NudgePrompt text: "Try tapping a suggestion or type anything"
- Timer resets if user navigates away (blur event) and restarts on focus
- Timer clears on unmount
- Timer cancels if a message is sent (messages.length changes from 0)

### Chip Press Flow (exact sequence)

```
1. User taps chip → onChipPress(chipText) fires
2. HomeScreen handler:
   a. useChatStore.getState().addUserMessage(chipText)
   b. send({ type: 'chat', payload: { message: chipText } })
   c. navigation.navigate('Chat')
3. PromptChips receive visible=false (messages.length > 0 now)
4. Chips fade out with 300ms animation
```

This mirrors the exact same flow as typing in ChatScreen's ChatInput and pressing send. The import path for `send` is `@/services/wsClient`.

### What NOT To Do (Anti-Patterns)

- **DO NOT** add expo-linear-gradient as a new dependency if it's not already available — use plain Views with backgroundColor as a simpler fallback. Check if `expo-linear-gradient` is in package.json first
- **DO NOT** modify ChatScreen or ChatThread — the chip press handler navigates to Chat, it does not inject anything into the chat UI directly
- **DO NOT** modify chatStore or wsClient — reuse existing `addUserMessage()` and `send()` as-is
- **DO NOT** modify the backend — this is a pure mobile UI story
- **DO NOT** persist chip visibility state in AsyncStorage — derive from `messages.length === 0` (ephemeral)
- **DO NOT** use react-native-reanimated — the project uses React Native built-in `Animated` API only
- **DO NOT** break existing tests — current test count: 1272 mobile, 866 backend
- **DO NOT** modify the Orb component — it already handles reduced motion and animation states correctly
- **DO NOT** create a new store — all state can be derived from existing chatStore + connectionStore
- **DO NOT** add the ambient background to non-empty-state screens — it only shows when modules.size === 0

### Previous Story Intelligence

**From Story 2-5b (Tab Navigation Architecture — done):**
- HomeScreen already has the empty state scaffold (Orb + text + link)
- Navigation is via `navigation.navigate('Chat')` — same pattern for chip press
- `useModuleStore((s) => s.modules.size)` checks module count — already used
- `useFocusEffect` not used yet (addListener('focus') is used for badge reset) — use same pattern for nudge timer
- Test mocking pattern: Orb and ModuleList are mocked in HomeScreen tests
- Final test count: 1226 tests, 66 suites

**From Story 2-3 (Persona Preset Selection — done):**
- `connectionStore.persona` holds current persona (PersonaType | null)
- PersonaType is `'flame' | 'tree' | 'star'` (defined in `types/ws.ts`)
- PersonaSelector already uses persona-specific text per type — follow same mapping pattern
- `useConnectionStore((s) => s.persona)` is the selector pattern

**From Story 2-5 (Screen Mode Architecture — done, superseded by 2-5b):**
- `tokens.animation.chipDismiss.duration` (300ms) already exists in tokens.ts
- `tokens.animation.breathe.duration` (6000ms) already exists in tokens.ts
- `tokens.animation.fadeIn.duration` (400ms) already exists in tokens.ts

**Git Intelligence (recent commits):**
- `8a9ee4b` docs(2-3): persona SVG illustrations
- `2baed0e` feat(2-3): persona SVG illustrations to PersonaSelector
- `14bc3d8` feat(2-3): add persona preset selection
- `580292e` feat(settings): add Reset local data button
- `9fa0c71` fix(ui): slim down tab bar, input field, header
- Pattern: commits use `feat(story-key): description` convention

### Dependency Check

**Already available (no new installs needed):**
- `react-native` Animated API (for fade animations)
- `AccessibilityInfo` from react-native (for reduce motion)
- `tokens.ts` has all needed animation duration tokens
- `connectionStore` has `persona` field
- `chatStore` has `messages` array and `addUserMessage()`
- `wsClient` has `send()`

**Potentially needed:**
- `expo-linear-gradient` — Check if already in `package.json`. If not, install via `npx expo install expo-linear-gradient`. If this is unwanted, fallback to overlapping Views with backgroundColor

### Target File Structure After This Story

```
apps/mobile/
├── screens/
│   ├── HomeScreen.tsx              MODIFY (enhance empty state with new components)
│   ├── HomeScreen.test.tsx         MODIFY (add empty state enhancement tests)
│   └── HomeScreen.edge.test.tsx    NEW (edge case tests for empty state)
├── components/
│   └── shell/
│       ├── PromptChips.tsx         NEW (suggestion chips component)
│       ├── PromptChips.test.tsx    NEW (unit tests)
│       ├── PromptChips.edge.test.tsx NEW (edge case tests)
│       ├── AmbientBackground.tsx   NEW (breathing gradient background)
│       ├── AmbientBackground.test.tsx NEW (unit tests)
│       ├── NudgePrompt.tsx         NEW (15s inactivity nudge)
│       ├── NudgePrompt.test.tsx    NEW (unit tests)
│       └── index.ts               MODIFY (add 3 new exports)
└── (all other files unchanged)
```

### Project Structure Notes

- All new components go in `components/shell/` (static UI, not SDUI)
- No new stores, services, or types files needed
- No backend changes
- No new navigation routes or tabs
- HomeScreen is the only existing file modified (plus its tests and shell/index.ts barrel)

### References

- [Source: epics.md#Story 2.4] — FR8, 4 BDD acceptance criteria (empty state, chips, reduce motion, nudge)
- [Source: ux-design-specification.md#The Magical First Screen] — Ambient background, agent greeting, prompt suggestions (3+1 chips), free input
- [Source: ux-design-specification.md#PromptChips] — Component spec: accentSubtle bg, accent text+border, dashed for persona, 16px radius, 7px 14px padding, 300ms fade-out
- [Source: ux-design-specification.md#Chip Types] — Suggestion (solid accent border), Persona (dashed accent border)
- [Source: ux-design-specification.md#Animation Tokens] — breathe 6s, chipDismiss 300ms, fadeIn 400ms
- [Source: ux-tab-navigation.html#Empty State] — Mockup: orb 64px + "No modules yet" + "Ask Self to create one" + ambient gradient
- [Source: ux-design-specification.md#Flow P0-B] — Onboarding flow: chip tap or free text or 15s nudge
- [Source: tokens.ts] — accentSubtle #12203A, accent #E8A84C, radii.lg 16, animation.chipDismiss 300, animation.breathe 6000
- [Source: story 2-5b] — HomeScreen empty state scaffold, navigation patterns, test mocking patterns
- [Source: story 2-3] — connectionStore.persona, PersonaType, persona-specific text mapping
- [Source: architecture.md#Mobile Component Layers] — Shell/Bridge/SDUI separation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug issues encountered. All tests passed on first implementation attempt after minor test assertion fixes.

### Completion Notes List

- Created PromptChips shell component with 3 universal + 1 persona-specific chip, proper styling (accentSubtle bg, accent border, 16px radius, 44pt min height), fade-out animation (300ms), and dashed border for persona chip
- Created AmbientBackground shell component using overlapping View layers (expo-linear-gradient not in project deps, used plain View fallback per dev notes). Breathing animation oscillates opacity 0.3-0.55 over 6s. Respects Reduce Motion (static 0.42 opacity)
- Created NudgePrompt shell component with 400ms fade-in animation, only renders when visible
- Enhanced HomeScreen empty state: AmbientBackground behind everything, centered Orb/text/CTA, NudgePrompt below center, PromptChips at bottom
- Chip press handler: addUserMessage + send + navigate('Chat'), with chipPressedRef guard for rapid tap debounce
- 15s nudge timer with blur/focus reset and proper cleanup on unmount
- Chip visibility derived from chatStore messages.length === 0 (no new store needed)
- All 3 new shell components exported from components/shell/index.ts
- 31 new tests across 6 test files, all passing. Zero regressions (1303 mobile, 866 backend)

### File List

- apps/mobile/components/shell/PromptChips.tsx (NEW)
- apps/mobile/components/shell/PromptChips.test.tsx (NEW)
- apps/mobile/components/shell/PromptChips.edge.test.tsx (NEW)
- apps/mobile/components/shell/AmbientBackground.tsx (NEW)
- apps/mobile/components/shell/AmbientBackground.test.tsx (NEW)
- apps/mobile/components/shell/NudgePrompt.tsx (NEW)
- apps/mobile/components/shell/NudgePrompt.test.tsx (NEW)
- apps/mobile/components/shell/index.ts (MODIFIED - added 3 exports)
- apps/mobile/screens/HomeScreen.tsx (MODIFIED - enhanced empty state)
- apps/mobile/screens/HomeScreen.test.tsx (MODIFIED - added contextual empty state tests)
- apps/mobile/screens/HomeScreen.edge.test.tsx (MODIFIED - added contextual empty state edge tests)
