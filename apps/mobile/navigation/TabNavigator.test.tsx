/**
 * Unit tests for TabNavigator (story 2-5b).
 *
 * Tests three-tab setup, initial route, and screen names.
 * Uses a lightweight mock of @react-navigation/bottom-tabs to verify
 * configuration without rendering the full navigation stack.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock localDb to prevent expo-sqlite crash
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock useKeyboardVisible
jest.mock('@/hooks/useKeyboardVisible', () => ({
  useKeyboardVisible: () => ({ keyboardVisible: false }),
}));

// Mock logger
jest.mock('@/services/logger', () => ({
  logger: { info: jest.fn(), warning: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock Orb (HomeScreen empty state uses it)
jest.mock('@/components/shell/Orb', () => ({
  Orb: () => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'orb' });
  },
}));

// Track screen registrations via createBottomTabNavigator mock
const registeredScreens: { name: string; component: any }[] = [];
let navigatorConfig: any = {};

jest.mock('@react-navigation/bottom-tabs', () => {
  const React = require('react');
  const { View, Text } = require('react-native');

  function MockScreen({ name, component }: { name: string; component: any }) {
    registeredScreens.push({ name, component });
    return null;
  }

  function MockNavigator({ children, initialRouteName, screenOptions, tabBar }: any) {
    navigatorConfig = { initialRouteName, screenOptions, tabBar };
    return React.createElement(View, { testID: 'tab-navigator' }, children);
  }

  return {
    createBottomTabNavigator: () => ({
      Navigator: MockNavigator,
      Screen: MockScreen,
    }),
  };
});

import React from 'react';
import { render } from '@testing-library/react-native';

import { TabNavigator } from './TabNavigator';

describe('TabNavigator', () => {
  beforeEach(() => {
    registeredScreens.length = 0;
    navigatorConfig = {};
  });

  it('renders the tab navigator', () => {
    const { getByTestId } = render(<TabNavigator />);
    expect(getByTestId('tab-navigator')).toBeTruthy();
  });

  it('registers exactly 3 screens', () => {
    render(<TabNavigator />);
    expect(registeredScreens).toHaveLength(3);
  });

  it('registers Home, Chat, and Settings screens', () => {
    render(<TabNavigator />);
    const names = registeredScreens.map((s) => s.name);
    expect(names).toContain('Home');
    expect(names).toContain('Chat');
    expect(names).toContain('Settings');
  });

  it('sets Home as initial route', () => {
    render(<TabNavigator />);
    expect(navigatorConfig.initialRouteName).toBe('Home');
  });

  it('configures headerShown to false', () => {
    render(<TabNavigator />);
    expect(navigatorConfig.screenOptions?.headerShown).toBe(false);
  });

  it('configures animation to none for instant switching', () => {
    render(<TabNavigator />);
    expect(navigatorConfig.screenOptions?.animation).toBe('none');
  });

  it('provides a custom tabBar component', () => {
    render(<TabNavigator />);
    expect(navigatorConfig.tabBar).toBeDefined();
    expect(typeof navigatorConfig.tabBar).toBe('function');
  });
});
