/**
 * Edge case tests for HomeScreen (story 2-5b).
 *
 * Tests focus listener cleanup, multiple focus events, transition from
 * empty to non-empty state, and badge reset idempotency.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock localDb to prevent expo-sqlite crash
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

// Mock Orb component
jest.mock('@/components/shell/Orb', () => ({
  Orb: ({ size }: { size?: number }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'orb', style: { width: size, height: size } });
  },
}));

// Mock ModuleList
jest.mock('@/components/bridge/ModuleList', () => ({
  ModuleList: () => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'module-list' });
  },
}));

import React from 'react';
import { render } from '@testing-library/react-native';

import { useModuleStore } from '@/stores/moduleStore';
import { HomeScreen } from './HomeScreen';

function makeHomeProps(overrides: {
  params?: { highlightModuleId?: string };
} = {}) {
  const focusListeners: Array<() => void> = [];

  return {
    props: {
      navigation: {
        navigate: jest.fn(),
        addListener: jest.fn((event: string, cb: () => void) => {
          if (event === 'focus') focusListeners.push(cb);
          return () => {
            const idx = focusListeners.indexOf(cb);
            if (idx >= 0) focusListeners.splice(idx, 1);
          };
        }),
        setParams: jest.fn(),
      } as any,
      route: {
        key: 'Home-key',
        name: 'Home' as const,
        params: overrides.params,
      } as any,
    },
    triggerFocus: () => {
      for (const cb of [...focusListeners]) cb();
    },
  };
}

describe('HomeScreen edge cases', () => {
  beforeEach(() => {
    useModuleStore.setState({
      modules: new Map(),
      newModulesSinceLastHomeVisit: 0,
    });
  });

  describe('focus listener cleanup', () => {
    it('unregisters focus listener on unmount', () => {
      const unsubscribe = jest.fn();
      const addListener = jest.fn(() => unsubscribe);
      const props = {
        navigation: {
          navigate: jest.fn(),
          addListener,
          setParams: jest.fn(),
        } as any,
        route: {
          key: 'Home-key',
          name: 'Home' as const,
          params: undefined,
        } as any,
      };

      const { unmount } = render(<HomeScreen {...props} />);
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('multiple focus events', () => {
    it('resets badge count on every focus event', () => {
      const { props, triggerFocus } = makeHomeProps();
      render(<HomeScreen {...props} />);

      // Set count to 3, focus resets
      useModuleStore.setState({ newModulesSinceLastHomeVisit: 3 });
      triggerFocus();
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(0);

      // Set count to 7, focus resets again
      useModuleStore.setState({ newModulesSinceLastHomeVisit: 7 });
      triggerFocus();
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(0);
    });

    it('is idempotent — resetting already-zero count is safe', () => {
      const { props, triggerFocus } = makeHomeProps();
      render(<HomeScreen {...props} />);

      triggerFocus();
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(0);

      triggerFocus();
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(0);
    });
  });

  describe('empty to non-empty transition', () => {
    it('switches from empty state to module list when modules are added', () => {
      const { props } = makeHomeProps();
      const { getByText, rerender, queryByText, getByTestId } = render(
        <HomeScreen {...props} />,
      );
      expect(getByText('No modules yet')).toBeTruthy();

      // Add a module
      const modules = new Map();
      modules.set('mod-1', {
        spec: { moduleId: 'mod-1' },
        status: 'active',
        dataStatus: 'ok',
        updatedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      });
      useModuleStore.setState({ modules });

      // Re-render with updated store
      rerender(<HomeScreen {...props} />);
      expect(getByTestId('module-list')).toBeTruthy();
      expect(queryByText('No modules yet')).toBeNull();
    });
  });

  describe('highlightModuleId with empty store', () => {
    it('shows empty state even if highlightModuleId is set but no modules exist', () => {
      const { props } = makeHomeProps({ params: { highlightModuleId: 'nonexistent' } });
      const { getByText } = render(<HomeScreen {...props} />);
      expect(getByText('No modules yet')).toBeTruthy();
    });
  });
});
