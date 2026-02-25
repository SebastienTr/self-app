/**
 * Edge case tests for CustomTabBar component (story 2-5b).
 *
 * Tests badge boundary values, simultaneous badges, prevented default,
 * and auth status transitions.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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

function makeTabBarProps(overrides: {
  activeIndex?: number;
  onNavigate?: jest.Mock;
  preventDefault?: boolean;
} = {}) {
  const routes = [
    { key: 'Home-key', name: 'Home' },
    { key: 'Chat-key', name: 'Chat' },
    { key: 'Settings-key', name: 'Settings' },
  ];

  const mockNavigate = overrides.onNavigate ?? jest.fn();
  const mockEmit = jest.fn(() => ({
    defaultPrevented: overrides.preventDefault ?? false,
  }));

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
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  };
}

describe('CustomTabBar edge cases', () => {
  beforeEach(() => {
    useModuleStore.setState({ modules: new Map(), newModulesSinceLastHomeVisit: 0 });
    useAuthStore.setState({ authStatus: 'authenticated' });
  });

  describe('badge boundary values', () => {
    it('shows badge with count 1', () => {
      useModuleStore.setState({ newModulesSinceLastHomeVisit: 1 });
      const props = makeTabBarProps();
      const { getByText } = render(<CustomTabBar {...props} />);
      expect(getByText('1')).toBeTruthy();
    });

    it('shows badge with large count', () => {
      useModuleStore.setState({ newModulesSinceLastHomeVisit: 99 });
      const props = makeTabBarProps();
      const { getByText } = render(<CustomTabBar {...props} />);
      expect(getByText('99')).toBeTruthy();
    });
  });

  describe('simultaneous badges', () => {
    it('shows both Home and Settings badges at the same time', () => {
      useModuleStore.setState({ newModulesSinceLastHomeVisit: 2 });
      useAuthStore.setState({ authStatus: 'unconfigured' });
      const props = makeTabBarProps();
      const { getByText } = render(<CustomTabBar {...props} />);
      expect(getByText('2')).toBeTruthy();
      expect(getByText('!')).toBeTruthy();
    });
  });

  describe('prevented default', () => {
    it('does not navigate when event default is prevented', () => {
      const onNavigate = jest.fn();
      const props = makeTabBarProps({
        activeIndex: 0,
        onNavigate,
        preventDefault: true,
      });
      const { getAllByRole } = render(<CustomTabBar {...props} />);
      const tabs = getAllByRole('tab');

      fireEvent.press(tabs[1]);
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('auth status transitions', () => {
    it('shows Settings badge for auth_failed status', () => {
      useAuthStore.setState({ authStatus: 'auth_failed' });
      const props = makeTabBarProps();
      const { getByText } = render(<CustomTabBar {...props} />);
      expect(getByText('!')).toBeTruthy();
    });

    it('shows Settings badge for authenticating status', () => {
      useAuthStore.setState({ authStatus: 'authenticating' });
      const props = makeTabBarProps();
      const { getByText } = render(<CustomTabBar {...props} />);
      expect(getByText('!')).toBeTruthy();
    });

    it('hides Settings badge when authenticated', () => {
      useAuthStore.setState({ authStatus: 'authenticated' });
      const props = makeTabBarProps();
      const { queryByText } = render(<CustomTabBar {...props} />);
      expect(queryByText('!')).toBeNull();
    });
  });

  describe('safe area insets with zero bottom', () => {
    it('renders without crash when bottom inset is 0', () => {
      const props = makeTabBarProps();
      expect(() => render(<CustomTabBar {...props} />)).not.toThrow();
    });
  });

  describe('accessibility', () => {
    it('each tab has proper accessibility role', () => {
      const props = makeTabBarProps();
      const { getAllByRole } = render(<CustomTabBar {...props} />);
      const tabs = getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });

    it('tab accessibility labels default to tab name', () => {
      const props = makeTabBarProps();
      const { getByLabelText } = render(<CustomTabBar {...props} />);
      expect(getByLabelText('Home')).toBeTruthy();
      expect(getByLabelText('Chat')).toBeTruthy();
      expect(getByLabelText('Settings')).toBeTruthy();
    });
  });
});
