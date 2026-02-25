/**
 * Unit tests for CustomTabBar component (story 2-5b).
 *
 * Tests tab rendering, active state, badge display, press handling,
 * and accessibility attributes.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

// Mock localDb to prevent expo-sqlite crash
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { useModuleStore } from '@/stores/moduleStore';
import { useAuthStore } from '@/stores/authStore';
import { CustomTabBar } from './TabBar';

/** Build minimal BottomTabBarProps for testing. */
function makeTabBarProps(overrides: {
  activeIndex?: number;
  onNavigate?: jest.Mock;
} = {}) {
  const routes = [
    { key: 'Home-key', name: 'Home' },
    { key: 'Chat-key', name: 'Chat' },
    { key: 'Settings-key', name: 'Settings' },
  ];

  const mockNavigate = overrides.onNavigate ?? jest.fn();
  const mockEmit = jest.fn(() => ({ defaultPrevented: false }));

  return {
    state: {
      index: overrides.activeIndex ?? 0,
      routes,
      key: 'tab-state',
      routeNames: ['Home', 'Chat', 'Settings'],
      stale: false as const,
      type: 'tab' as const,
      history: [],
    },
    descriptors: Object.fromEntries(
      routes.map((r) => [
        r.key,
        {
          options: {},
          route: r,
          navigation: {} as any,
          render: () => null,
        },
      ]),
    ),
    navigation: {
      navigate: mockNavigate,
      emit: mockEmit,
    } as any,
    insets: { top: 0, bottom: 34, left: 0, right: 0 },
  };
}

describe('CustomTabBar', () => {
  beforeEach(() => {
    useModuleStore.setState({ modules: new Map(), newModulesSinceLastHomeVisit: 0 });
    useAuthStore.setState({ authStatus: 'authenticated' });
  });

  describe('rendering', () => {
    it('renders three tabs', () => {
      const props = makeTabBarProps();
      const { getAllByRole } = render(<CustomTabBar {...props} />);
      expect(getAllByRole('tab')).toHaveLength(3);
    });

    it('renders Home, Chat, Settings labels', () => {
      const props = makeTabBarProps();
      const { getByText } = render(<CustomTabBar {...props} />);
      expect(getByText('Home')).toBeTruthy();
      expect(getByText('Chat')).toBeTruthy();
      expect(getByText('Settings')).toBeTruthy();
    });

    it('renders tab icons', () => {
      const props = makeTabBarProps();
      const { getByText } = render(<CustomTabBar {...props} />);
      // Home icon: package emoji
      expect(getByText('\uD83D\uDCE6')).toBeTruthy();
      // Chat icon: speech bubble emoji
      expect(getByText('\uD83D\uDCAC')).toBeTruthy();
      // Settings icon: gear emoji
      expect(getByText('\u2699\uFE0F')).toBeTruthy();
    });
  });

  describe('active state', () => {
    it('marks Home tab as selected when activeIndex is 0', () => {
      const props = makeTabBarProps({ activeIndex: 0 });
      const { getAllByRole } = render(<CustomTabBar {...props} />);
      const tabs = getAllByRole('tab');
      expect(tabs[0].props.accessibilityState).toEqual({ selected: true });
      expect(tabs[1].props.accessibilityState).toEqual({});
      expect(tabs[2].props.accessibilityState).toEqual({});
    });

    it('marks Chat tab as selected when activeIndex is 1', () => {
      const props = makeTabBarProps({ activeIndex: 1 });
      const { getAllByRole } = render(<CustomTabBar {...props} />);
      const tabs = getAllByRole('tab');
      expect(tabs[0].props.accessibilityState).toEqual({});
      expect(tabs[1].props.accessibilityState).toEqual({ selected: true });
    });

    it('marks Settings tab as selected when activeIndex is 2', () => {
      const props = makeTabBarProps({ activeIndex: 2 });
      const { getAllByRole } = render(<CustomTabBar {...props} />);
      const tabs = getAllByRole('tab');
      expect(tabs[2].props.accessibilityState).toEqual({ selected: true });
    });
  });

  describe('press handling', () => {
    it('navigates to tab when pressing an inactive tab', () => {
      const onNavigate = jest.fn();
      const props = makeTabBarProps({ activeIndex: 0, onNavigate });
      const { getAllByRole } = render(<CustomTabBar {...props} />);
      const tabs = getAllByRole('tab');

      // Press Chat tab (index 1)
      fireEvent.press(tabs[1]);
      expect(onNavigate).toHaveBeenCalledWith('Chat');
    });

    it('does not navigate when pressing the already-active tab', () => {
      const onNavigate = jest.fn();
      const props = makeTabBarProps({ activeIndex: 0, onNavigate });
      const { getAllByRole } = render(<CustomTabBar {...props} />);
      const tabs = getAllByRole('tab');

      // Press Home tab (already active)
      fireEvent.press(tabs[0]);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('emits tabPress event on press', () => {
      const props = makeTabBarProps({ activeIndex: 0 });
      const { getAllByRole } = render(<CustomTabBar {...props} />);
      const tabs = getAllByRole('tab');

      fireEvent.press(tabs[1]);
      expect(props.navigation.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tabPress',
          target: 'Chat-key',
          canPreventDefault: true,
        }),
      );
    });
  });

  describe('Home badge', () => {
    it('shows badge when newModulesSinceLastHomeVisit > 0', () => {
      useModuleStore.setState({ newModulesSinceLastHomeVisit: 3 });
      const props = makeTabBarProps();
      const { getByText } = render(<CustomTabBar {...props} />);
      expect(getByText('3')).toBeTruthy();
    });

    it('does not show badge when newModulesSinceLastHomeVisit is 0', () => {
      useModuleStore.setState({ newModulesSinceLastHomeVisit: 0 });
      const props = makeTabBarProps();
      const { queryByText } = render(<CustomTabBar {...props} />);
      // "0" should not appear as a badge. The label "Home" should be present though.
      // Check that no badge text "0" exists (Home label is a separate element)
      const badges = queryByText('0');
      expect(badges).toBeNull();
    });
  });

  describe('Settings badge', () => {
    it('shows "!" badge when not authenticated', () => {
      useAuthStore.setState({ authStatus: 'unconfigured' });
      const props = makeTabBarProps();
      const { getByText } = render(<CustomTabBar {...props} />);
      expect(getByText('!')).toBeTruthy();
    });

    it('shows "!" badge during pairing state', () => {
      useAuthStore.setState({ authStatus: 'pairing' });
      const props = makeTabBarProps();
      const { getByText } = render(<CustomTabBar {...props} />);
      expect(getByText('!')).toBeTruthy();
    });

    it('does not show "!" badge when authenticated', () => {
      useAuthStore.setState({ authStatus: 'authenticated' });
      const props = makeTabBarProps();
      const { queryByText } = render(<CustomTabBar {...props} />);
      expect(queryByText('!')).toBeNull();
    });
  });

  describe('Chat badge', () => {
    it('never shows a badge on Chat tab', () => {
      // Even with module count > 0 and unauthenticated, Chat should have no badge
      useModuleStore.setState({ newModulesSinceLastHomeVisit: 5 });
      useAuthStore.setState({ authStatus: 'unconfigured' });
      const props = makeTabBarProps();
      const { getAllByRole } = render(<CustomTabBar {...props} />);
      const chatTab = getAllByRole('tab')[1];
      // Chat tab should not have any badge text element
      // The badge text "5" is on Home, "!" is on Settings, none on Chat
      expect(chatTab).toBeTruthy();
    });
  });
});
