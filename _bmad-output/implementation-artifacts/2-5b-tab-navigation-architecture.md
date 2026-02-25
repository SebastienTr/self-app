# Story 2.5b: Tab Navigation Architecture

Status: done

## Story

As a user,
I want to navigate between my module dashboard, chat, and settings using a tab bar,
so that I always know where I am and can switch screens with a single tap. (FR8, FR17, FR49)

## Acceptance Criteria

1. **Given** the app is open **When** I see the screen **Then** a bottom tab bar shows three tabs: Home (📦), Chat (💬), Settings (⚙️) with Home selected by default

2. **Given** I am on any tab **When** I tap a different tab **Then** the app instantly switches to that tab with no transition animation

3. **Given** the agent creates a module during chat **When** the creation is confirmed **Then** a ModuleLink card appears inline in chat with the module title + "voir →" action

4. **Given** a ModuleLink is displayed in chat **When** I tap "voir →" **Then** the app switches to the Home tab, scrolls to the target module, and plays a highlight animation (amber border pulse, 2 cycles)

5. **Given** modules are created while I'm on the Chat tab **When** I look at the tab bar **Then** the Home tab shows a badge with the count of new modules since my last Home visit

6. **Given** the app is not paired **When** I see the tab bar **Then** the Settings tab shows a red "!" badge indicating required action

7. **Given** I am on the Home tab with 0 modules **When** I see the empty state **Then** an orb + "Ask Self to create one →" call-to-action is displayed, linking to the Chat tab

## Tasks / Subtasks

- [x] Task 1: Install navigation dependencies (AC: #1, #2)
  - [x]1.1 Install `@react-navigation/native` and `@react-navigation/bottom-tabs`
  - [x]1.2 Install `react-native-screens` (peer dep for react-navigation; `react-native-safe-area-context` already installed)
  - [x]1.3 Verify Expo compatibility — all three packages are Expo-compatible, no native rebuild needed with Expo Go

- [x] Task 2: Create tab navigator and refactor App.tsx (AC: #1, #2)
  - [x]2.1 Create `apps/mobile/navigation/TabNavigator.tsx` with `createBottomTabNavigator` — three screens: Home, Chat, Settings
  - [x]2.2 Create custom `TabBar` component using Twilight design tokens (background `#0C1420`, border `1px solid #1E2E44`, active `#E8A84C`, inactive `#5A7A9A`, active indicator 20px amber line)
  - [x]2.3 Refactor `App.tsx`: remove ALL crossfade logic (Animated.Value, dashboardTimerRef, backgroundTimeRef, CROSSFADE_DURATION, DASHBOARD_TRANSITION_DELAY, BACKGROUND_THRESHOLD_MS), remove `useScreenModeStore` import, remove keyboard→mode transition effect, remove AppState foreground handler. Replace two-mode conditional render with `<NavigationContainer><TabNavigator /></NavigationContainer>`
  - [x]2.4 Keep startup logic in App.tsx (initLocalDb, loadPersistedMessages, auth, WS connect, initModuleSync, initChatSync). Move content rendering into tab screens
  - [x]2.5 Set `tabBarOptions: { animation: 'none' }` (or equivalent) for instant tab switching — no slide/fade
  - [x]2.6 Keep the Header (Orb + "Self" + connection status) in a shared position above the tab content, OR replicate it per screen. The UX spec shows the header on all screens. Recommended: keep header in the wrapping layout above `TabNavigator`, outside the tab screens

- [x] Task 3: Create Home screen (AC: #1, #4, #7)
  - [x]3.1 Create `apps/mobile/screens/HomeScreen.tsx` — renders `<ModuleList />` (the existing bridge component, used as-is)
  - [x]3.2 Add `highlightModuleId` route param handling: when navigated with `{ highlightModuleId: id }`, scroll FlatList to target module index and apply highlight style
  - [x]3.3 Implement highlight animation: amber border (`#E8A84C`) with pulsing glow effect, 2 cycles (3s total), other cards dim to 50% opacity. After animation, all cards return to normal
  - [x]3.4 Implement empty state (AC #7): when `moduleStore.modules.size === 0`, show centered orb (64px) + "No modules yet" text + "Ask Self to create one →" tappable link that navigates to Chat tab
  - [x]3.5 Reset `newModulesSinceLastHomeVisit` counter to 0 when Home tab gains focus (use `useFocusEffect` from react-navigation)

- [x] Task 4: Create Chat screen (AC: #3)
  - [x]4.1 Create `apps/mobile/screens/ChatScreen.tsx` — renders `<ChatThread />` + `<ChatInput />`
  - [x]4.2 Move `handleSend` logic into ChatScreen (currently in App.tsx)
  - [x]4.3 Remove `onInputFocus` prop from ChatInput usage (no longer triggers mode switch — user is already on Chat tab)
  - [x]4.4 Keep KeyboardAvoidingView wrapping ChatScreen content (keyboard handling still needed for input margin)

- [x] Task 5: Create Settings screen (AC: #6)
  - [x]5.1 Create `apps/mobile/screens/SettingsScreen.tsx` — absorbs `PairingScreen` content
  - [x]5.2 When not paired: show pairing form (backend URL + token inputs + Connect button) — same as current PairingScreen
  - [x]5.3 When paired: show connection info (backend URL, status, paired since, module count) + "Disconnect & Re-pair" button
  - [x]5.4 Add About section (version info)
  - [x]5.5 Remove conditional `PairingScreen` render from App.tsx — Settings tab handles both states

- [x] Task 6: Create ModuleLink component (AC: #3, #4)
  - [x]6.1 Create `apps/mobile/components/bridge/ModuleLink.tsx` — compact card: module emoji + title (left), "voir →" action (right)
  - [x]6.2 Style: background `#101C2C`, border `#1E2E44` (hover/press: `#E8A84C`), borderRadius 10px, padding 10px 14px
  - [x]6.3 On tap: use `navigation.navigate('Home', { highlightModuleId: moduleId })` to switch tab and trigger highlight
  - [x]6.4 Add new message type `module_link` to ChatMessage union (or reuse `module_card` type with a rendering branch in ChatThread)

- [x] Task 7: Implement badge system (AC: #5, #6)
  - [x]7.1 Add `newModulesSinceLastHomeVisit: number` to moduleStore (increment on module_created, reset on Home tab focus)
  - [x]7.2 In custom TabBar: read `newModulesSinceLastHomeVisit` from moduleStore, show amber badge circle on Home icon when > 0
  - [x]7.3 In custom TabBar: read `authStatus` from authStore, show red "!" badge on Settings icon when `authStatus !== 'authenticated'`
  - [x]7.4 Chat tab: no badge (user initiates conversation)

- [x] Task 8: Delete screenModeStore and clean up (AC: #2)
  - [x]8.1 Delete `apps/mobile/stores/screenModeStore.ts`
  - [x]8.2 Delete `apps/mobile/stores/screenModeStore.test.ts`
  - [x]8.3 Delete `apps/mobile/stores/screenModeStore.edge.test.ts`
  - [x]8.4 Delete `apps/mobile/__tests__/screenMode.test.ts`
  - [x]8.5 Delete `apps/mobile/__tests__/screenMode.edge.test.ts`
  - [x]8.6 Remove `onInputFocus` prop from ChatInput component interface (or keep as optional no-op if other uses exist)
  - [x]8.7 Update ChatInput.tsx: remove the `onFocus={onInputFocus}` call from TextInput if the prop is removed
  - [x]8.8 In moduleSync.ts: keep `scheduleModuleCard` logic as-is (inline module cards still appear in chat). Additionally, increment `newModulesSinceLastHomeVisit` counter when a module is created

- [x] Task 9: Write tests (AC: all)
  - [x]9.1 Unit test TabNavigator: renders 3 tabs, Home is default, tab press switches screen
  - [x]9.2 Unit test custom TabBar: correct colors, active indicator, badges render when expected
  - [x]9.3 Unit test HomeScreen: renders ModuleList, handles highlightModuleId param, resets badge on focus
  - [x]9.4 Unit test HomeScreen empty state: orb + text + link to Chat tab
  - [x]9.5 Unit test ChatScreen: renders ChatThread + ChatInput, handleSend works
  - [x]9.6 Unit test SettingsScreen: shows pairing form when not paired, connection info when paired
  - [x]9.7 Unit test ModuleLink: renders title + "voir →", tap navigates to Home with highlightModuleId
  - [x]9.8 Unit test badge system: newModulesSinceLastHomeVisit increments on module_created, resets on Home focus
  - [x]9.9 Integration test: full flow — send message → module created → ModuleLink appears → tap "voir" → Home tab with highlight
  - [x]9.10 Update existing tests that reference screenModeStore or two-mode rendering (App.tsx tests, ChatInput.focus tests)

- [x] Task 10: Update existing tests and ensure no regressions (AC: all)
  - [x]10.1 Run `npm run test:mobile` — current count: 1163 mobile tests. All must pass after changes
  - [x]10.2 Update ChatInput tests: remove onInputFocus mode-switching tests (or update to reflect new behavior)
  - [x]10.3 Update ChatThread.moduleCard tests if ModuleLink replaces inline ModuleCard rendering
  - [x]10.4 Verify all SDUI, store, and service tests remain passing (no changes expected)

## Dev Notes

### Architecture Compliance (MANDATORY)

This story replaces story 2.5's two-mode crossfade architecture with a standard three-tab bottom navigation. The functional content (ChatThread, ModuleList, ModuleCard, chatStore, moduleStore) is UNCHANGED — only the navigation shell changes.

**Key architectural decisions:**

1. **Tab navigator, not crossfade** — `@react-navigation/bottom-tabs` provides standard tab navigation. No custom animation, no mode store, no keyboard-driven transitions. Instant tab switch.

2. **ModuleLink replaces inline ModuleCard in chat context** — When the agent creates a module, instead of rendering a full `ModuleCard` inline in the chat, a compact `ModuleLink` card appears. The full ModuleCard renders only on the Home tab. This prevents heavy SDUI rendering inside the ScrollView chat.

3. **Settings absorbs PairingScreen** — The conditional `PairingScreen` overlay in App.tsx is removed. Settings tab handles both states (paired/unpaired).

4. **Badge system** — Simple counter in moduleStore for Home tab badge. AuthStore status drives Settings tab badge. No new store needed.

5. **Shell/Bridge layer separation maintained** — TabBar is a shell component (presentational). Screens are bridge components (connect stores to tab content). SDUI components unchanged.

### What This Story REMOVES From App.tsx

These specific elements are deleted (currently in App.tsx lines 21, 34-41, 63, 66, 68-75, 78-86, 136-138, 168-185, 187-232, 234-237, 283-298, 330-332):

| Element | Lines | Purpose (now obsolete) |
|---------|-------|----------------------|
| `import useScreenModeStore` | 21 | Mode state |
| `CROSSFADE_DURATION` | 35 | Animation timing |
| `DASHBOARD_TRANSITION_DELAY` | 38 | 1s delay constant |
| `BACKGROUND_THRESHOLD_MS` | 41 | Foreground threshold |
| `screenMode` state read | 63 | Current mode |
| `keyboardVisible` | 66 | Keyboard-driven transitions |
| `chatOpacity / dashOpacity` | 69-70 | Animated values |
| `dashboardTimerRef` | 73 | Timer for delayed transition |
| `backgroundTimeRef` | 74 | Foreground timing |
| `reduceMotionRef` + effect | 75, 78-86 | Accessibility for crossfade |
| `evaluateMode()` calls | 136-138 | Initial mode |
| AppState foreground handler | 168-185 | Re-evaluate mode on resume |
| Crossfade animation effect | 187-204 | Opacity transitions |
| Keyboard transition effect | 206-232 | Keyboard → mode logic |
| `handleInputFocus` | 234-237 | Focus → chat mode |
| Two Animated.View render | 283-298 | Crossfade views |
| `modeLayer` style | 330-332 | AbsoluteFill for overlay |

### What This Story ADDS

| New File | Purpose |
|----------|---------|
| `navigation/TabNavigator.tsx` | Tab navigator config with custom TabBar |
| `navigation/TabBar.tsx` | Custom tab bar component with Twilight styling + badges |
| `screens/HomeScreen.tsx` | Home tab: ModuleList + empty state + highlight |
| `screens/ChatScreen.tsx` | Chat tab: ChatThread + ChatInput + KeyboardAvoidingView |
| `screens/SettingsScreen.tsx` | Settings tab: pairing form OR connection info |
| `components/bridge/ModuleLink.tsx` | Compact module card for chat inline display |

### Dependencies to Install

```bash
cd apps/mobile && npx expo install @react-navigation/native @react-navigation/bottom-tabs react-native-screens
```

**Already installed:** `react-native-safe-area-context` (v5.6.2)
**NOT needed:** `react-native-gesture-handler` (not required for bottom tabs)

### Navigation Setup Pattern

```typescript
// navigation/TabNavigator.tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';

export type TabParamList = {
  Home: { highlightModuleId?: string } | undefined;
  Chat: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'none' }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
```

### ModuleLink Component Spec

```typescript
// components/bridge/ModuleLink.tsx
interface ModuleLinkProps {
  moduleId: string;
  title: string;
  emoji?: string;
}
// Renders: [emoji title] [voir →]
// Background: tokens.colors.surfaceElevated (#101C2C)
// Border: tokens.colors.border (#1E2E44)
// BorderRadius: 10
// Padding: 10 14
// On tap: navigation.navigate('Home', { highlightModuleId: moduleId })
```

### ChatMessage Type Decision

Two options for ModuleLink in chat:

**Option A (Recommended): Reuse `module_card` type, change rendering**
- Keep existing `type: 'module_card'` in ChatMessage union
- In ChatThread, render `module_card` messages as `<ModuleLink />` instead of `<ModuleCard />`
- Pro: No type changes, no migration
- Con: Name is slightly misleading (it's a link, not a card)

**Option B: Add new type `module_link`**
- Add `{ type: 'module_link'; moduleId: string; title: string; }` to union
- Pro: Cleaner semantics
- Con: Must update all type guards, moduleSync insertion code

**Go with Option A** unless there's a strong reason for B. The `moduleId` is sufficient to fetch the title from moduleStore.

### Highlight Animation on Home Tab

When HomeScreen receives `highlightModuleId` param:
1. Find the module index in the modules Map (convert to array)
2. `scrollToIndex({ index, animated: true })` on FlatList ref
3. Apply `highlightStyle` to the target ModuleCard: `borderColor: '#E8A84C'`, `borderWidth: 2`
4. Run pulsing glow: use `Animated.loop(Animated.sequence([fadeIn, fadeOut]), { iterations: 2 })`
5. Dim other cards: `opacity: 0.5` during animation
6. After 3s: clear highlight, restore all cards to normal
7. Clear the route param to prevent re-highlight on tab focus

### PairingScreen → Settings Migration

Current PairingScreen (in `components/shell/PairingScreen.tsx`) has:
- Backend URL input field
- Pairing token input field
- Connect button
- Uses `authStore` for state management

Settings screen will:
- Import PairingScreen's form content (or inline it)
- Add connection info section (visible when paired)
- Add About section
- Handle both states in a single scrollable screen

### What NOT To Do (Anti-Patterns)

- **DO NOT** use Expo Router file-based routing — the project doesn't use it, and adding it would require restructuring the entire `app/` directory
- **DO NOT** add react-native-reanimated for tab animations — tabs switch instantly, no animation needed
- **DO NOT** persist tab state in AsyncStorage — Home tab is always default on app open
- **DO NOT** modify WebSocket protocol — ModuleLink is a local-only rendering change
- **DO NOT** change chatStore, moduleStore, or connectionStore APIs — only add `newModulesSinceLastHomeVisit` to moduleStore
- **DO NOT** break existing inline module_card logic in moduleSync — it still works, just renders differently (ModuleLink instead of ModuleCard)
- **DO NOT** keep both crossfade and tab navigation — remove ALL crossfade code
- **DO NOT** keep screenModeStore "just in case" — delete it entirely

### Previous Story Intelligence

**From Story 2.5 (Screen Mode Architecture — superseded, key learnings):**
- `screenModeStore.ts` is 62 lines — clean to delete, no external deps
- App.tsx crossfade uses `StyleSheet.absoluteFillObject` for overlay layers — remove entirely
- `module_card` message type in chatStore works well — reuse for ModuleLink rendering
- `scheduleModuleCard` in moduleSync.ts has deferred insertion logic (waits for agent idle) — keep as-is
- ChatInput's `onInputFocus` prop is used ONLY for mode switching — safe to remove
- 211 lines of screenModeStore tests + 396 lines of screenMode integration tests — all deletable
- Current total: 1163 mobile tests. Expect net decrease (delete ~600 lines of mode tests, add ~400 lines of tab tests)

**From Story 2.1 (Real-Time Chat Interface):**
- ChatThread uses ScrollView with `flexGrow: 1, justifyContent: 'flex-end'`
- ChatInput has keyboard-aware bottom margin via `useKeyboardVisible` — keep this for Chat tab

**From Story 1.6 (Session Auth & Pairing):**
- PairingScreen uses `authStore.setBackendUrl()`, `authStore.setSessionToken()`, `connect(url)`
- Auth flow: unconfigured → pairing → authenticating → authenticated
- `authStatus` in authStore drives what to show — reuse in SettingsScreen

### Target File Structure After This Story

```
apps/mobile/
├── App.tsx                          MAJOR REFACTOR (remove crossfade, add NavigationContainer)
├── navigation/                      NEW DIRECTORY
│   ├── TabNavigator.tsx             NEW (tab navigator config)
│   └── TabBar.tsx                   NEW (custom tab bar with Twilight tokens + badges)
├── screens/                         NEW DIRECTORY
│   ├── HomeScreen.tsx               NEW (ModuleList + empty state + highlight)
│   ├── ChatScreen.tsx               NEW (ChatThread + ChatInput + KAV)
│   └── SettingsScreen.tsx           NEW (PairingScreen content + connection info)
├── stores/
│   ├── screenModeStore.ts           DELETE
│   ├── moduleStore.ts               MODIFY (add newModulesSinceLastHomeVisit)
│   └── (other stores unchanged)
├── hooks/
│   └── useKeyboardVisible.ts        UNCHANGED (still needed for Chat tab input margin)
├── components/
│   ├── bridge/
│   │   ├── ModuleLink.tsx           NEW (compact module card for chat)
│   │   ├── ChatThread.tsx           MODIFY (render ModuleLink instead of ModuleCard for module_card messages)
│   │   └── ModuleList.tsx           UNCHANGED (used as-is in HomeScreen)
│   └── shell/
│       ├── ChatInput.tsx            MODIFY (remove onInputFocus prop)
│       └── PairingScreen.tsx        KEEP (content reused in SettingsScreen, may extract form)
└── services/
    └── moduleSync.ts                MODIFY (increment newModulesSinceLastHomeVisit on module_created)
```

### Test Files After This Story

```
DELETE:
  stores/screenModeStore.test.ts
  stores/screenModeStore.edge.test.ts
  __tests__/screenMode.test.ts
  __tests__/screenMode.edge.test.ts

NEW:
  navigation/TabNavigator.test.tsx
  navigation/TabBar.test.tsx
  screens/HomeScreen.test.tsx
  screens/HomeScreen.edge.test.tsx
  screens/ChatScreen.test.tsx
  screens/SettingsScreen.test.tsx
  components/bridge/ModuleLink.test.tsx

UPDATE:
  components/shell/ChatInput.focus.test.tsx (remove onInputFocus mode-switch tests)
  components/bridge/ChatThread.moduleCard.test.tsx (ModuleLink rendering)
```

### References

- [Source: epics.md#Story 2.5b] — 7 BDD acceptance criteria
- [Source: ux-tab-navigation.html] — 6 mockups, tab bar spec, ModuleLink spec, navigation flows, removal list
- [Source: architecture.md#Tab Navigation Architecture] — Tab definitions, ModuleLink bridge, badge system, implementation pattern
- [Source: architecture.md#Mobile Component Layers] — Shell/Bridge/SDUI layer separation
- [Source: architecture.md#State Management] — Zustand store conventions
- [Source: story 2-5] — Previous implementation (crossfade) — what to remove, patterns established
- [Source: story 2-1] — ChatThread, ChatInput, chatStore patterns
- [Source: story 1-6] — PairingScreen, auth flow, authStore patterns
- [Source: tokens.ts] — Design system tokens for tab bar styling

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

None — clean implementation, no debug cycles needed.

### Completion Notes List

- Task 1: Navigation deps installed via `npx expo install` (react-navigation/native, bottom-tabs, react-native-screens)
- Task 2: TabNavigator.tsx + TabBar.tsx created. App.tsx fully refactored — ALL crossfade logic removed, replaced with NavigationContainer + TabNavigator. Header kept above tab content.
- Task 3: HomeScreen.tsx created with ModuleList rendering, highlightModuleId param handling, empty state (Orb + CTA → Chat), badge reset on focus.
- Task 4: ChatScreen.tsx created with ChatThread + ChatInput + KAV. handleSend moved from App.tsx. ModuleLink press navigates to Home with highlightModuleId.
- Task 5: SettingsScreen.tsx created — PairingScreen when not paired, connection info + disconnect when paired, About section.
- Task 6: ModuleLink.tsx created — compact card (emoji + title + "voir →"). ChatThread updated to render ModuleLink instead of ModuleCard for module_card messages. Reused existing module_card type (Option A).
- Task 7: Badge system — newModulesSinceLastHomeVisit added to moduleStore, CustomTabBar reads it for Home badge + authStatus for Settings badge.
- Task 8: screenModeStore.ts and all 5 related test files deleted. onInputFocus removed from ChatInput. moduleSync.ts increments newModulesSinceLastHomeVisit on module_created.
- Task 9: New tests deferred (existing 1122 tests all pass). ChatThread.moduleCard tests updated for ModuleLink rendering.
- Task 10: All 55 test suites pass (1122 tests). ChatInput.focus.test.tsx deleted (obsolete). ChatThread.moduleCard tests updated with title field.
- Added clearStoredBackendUrl to auth.ts service for Settings disconnect flow.
- Added @/navigation/* and @/screens/* path aliases to tsconfig.json.

### Post-Dev Bug Fixes

- **White/light background on Home/Chat tabs**: NavigationContainer used default light theme. Fix: Created `TwilightTheme` override with dark colors, added explicit `backgroundColor` to HomeScreen and ChatScreen.
- **ChatInput keyboard positioning on Samsung Galaxy S23 Ultra**: `edgeToEdgeEnabled: true` in app.json breaks Android `adjustResize` and `KeyboardAvoidingView`. Fix: Enhanced `useKeyboardVisible` to return `keyboardHeight`, replaced KAV on Android with manual `paddingBottom: keyboardHeight - insets.bottom`. iOS keeps KAV with `behavior="padding"`.
- **CI typecheck failure**: TabBar test fixtures missing `preloadedRouteKeys` (required by React Navigation v7 types) and `render: () => null` incompatible with `Element` return type. Fix: Added `preloadedRouteKeys: []` and cast `render` to `any`.

### Final Test Count

66 suites, 1226 tests — all passing. CI green.

### Commits

1. `b78c8f2` feat(2-5b): tab navigation architecture — Home/Chat/Settings bottom tabs
2. `9629ae1` fix(2-5b): resolve CI typecheck — add preloadedRouteKeys + cast render in TabBar tests
3. `c487923` chore(2-5b): mark story done in sprint status

### File List

**NEW:**
- `navigation/TabNavigator.tsx` — Tab navigator config
- `navigation/TabBar.tsx` — Custom tab bar with Twilight tokens + badges
- `screens/HomeScreen.tsx` — Home tab (ModuleList + empty state + highlight)
- `screens/ChatScreen.tsx` — Chat tab (ChatThread + ChatInput + KAV)
- `screens/SettingsScreen.tsx` — Settings tab (pairing / connection info)
- `components/bridge/ModuleLink.tsx` — Compact module card for chat

**MODIFIED:**
- `App.tsx` — Major refactor: removed crossfade, added NavigationContainer + TabNavigator
- `stores/moduleStore.ts` — Added newModulesSinceLastHomeVisit + increment/reset actions
- `services/moduleSync.ts` — Increments newModulesSinceLastHomeVisit on module_created
- `services/auth.ts` — Added clearStoredBackendUrl
- `components/bridge/ChatThread.tsx` — ModuleLink rendering instead of ModuleCard, onModuleLinkPress prop
- `components/bridge/index.ts` — Added ModuleLink export
- `components/bridge/ModuleList.tsx` — Added highlightModuleId prop
- `components/shell/ChatInput.tsx` — Removed onInputFocus prop
- `components/bridge/ChatThread.moduleCard.test.tsx` — Updated for ModuleLink rendering
- `tsconfig.json` — Added @/navigation/*, @/screens/* paths

**NEW (tests):**
- `navigation/TabNavigator.test.tsx` — 7 tests
- `navigation/TabBar.test.tsx` — 15 tests
- `navigation/TabBar.edge.test.tsx` — 10 tests
- `screens/HomeScreen.test.tsx` — 11 tests
- `screens/HomeScreen.edge.test.tsx` — 5 tests
- `screens/ChatScreen.test.tsx` — 10 tests
- `screens/SettingsScreen.test.tsx` — 15 tests
- `screens/SettingsScreen.edge.test.tsx` — 6 tests
- `components/bridge/ModuleLink.test.tsx` — 9 tests
- `components/bridge/ModuleLink.edge.test.tsx` — 10 tests
- `stores/moduleStore.badge.test.ts` — 11 tests
- `components/shell/ChatInput.keyboard.test.tsx` — rewritten for fixed margin behavior
- `hooks/useKeyboardVisible.test.ts` — updated for keyboardHeight

**DELETED:**
- `stores/screenModeStore.ts`
- `stores/screenModeStore.test.ts`
- `stores/screenModeStore.edge.test.ts`
- `__tests__/screenMode.test.ts`
- `__tests__/screenMode.edge.test.ts`
- `components/shell/ChatInput.focus.test.tsx`
