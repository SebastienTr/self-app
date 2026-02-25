/**
 * Unit tests for HomeScreen (story 2-5b).
 *
 * Tests empty state, module list rendering, badge reset on focus,
 * highlightModuleId param handling, and navigation to Chat.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock localDb to prevent expo-sqlite crash
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

// Mock Orb component (animated component that needs mocking)
jest.mock('@/components/shell/Orb', () => ({
  Orb: ({ size }: { size?: number }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'orb', style: { width: size, height: size } });
  },
}));

// Mock ModuleList (bridge component, tested separately)
jest.mock('@/components/bridge/ModuleList', () => ({
  ModuleList: ({ highlightModuleId }: { highlightModuleId?: string }) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return React.createElement(View, { testID: 'module-list' },
      highlightModuleId
        ? React.createElement(Text, { testID: 'highlight-id' }, highlightModuleId)
        : null,
    );
  },
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { useModuleStore } from '@/stores/moduleStore';
import { HomeScreen } from './HomeScreen';

/** Build minimal navigation/route props for HomeScreen. */
function makeHomeProps(overrides: {
  params?: { highlightModuleId?: string };
  navigate?: jest.Mock;
  addListener?: jest.Mock;
  setParams?: jest.Mock;
} = {}) {
  const focusListeners: Array<() => void> = [];
  const mockAddListener = overrides.addListener ?? jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') focusListeners.push(cb);
    return () => {
      const idx = focusListeners.indexOf(cb);
      if (idx >= 0) focusListeners.splice(idx, 1);
    };
  });

  return {
    props: {
      navigation: {
        navigate: overrides.navigate ?? jest.fn(),
        addListener: mockAddListener,
        setParams: overrides.setParams ?? jest.fn(),
      } as any,
      route: {
        key: 'Home-key',
        name: 'Home' as const,
        params: overrides.params,
      } as any,
    },
    triggerFocus: () => {
      for (const cb of focusListeners) cb();
    },
  };
}

describe('HomeScreen', () => {
  beforeEach(() => {
    useModuleStore.setState({
      modules: new Map(),
      newModulesSinceLastHomeVisit: 0,
    });
  });

  describe('empty state', () => {
    it('shows empty state when no modules exist', () => {
      const { props } = makeHomeProps();
      const { getByText } = render(<HomeScreen {...props} />);
      expect(getByText('No modules yet')).toBeTruthy();
    });

    it('shows Orb in empty state', () => {
      const { props } = makeHomeProps();
      const { getByTestId } = render(<HomeScreen {...props} />);
      expect(getByTestId('orb')).toBeTruthy();
    });

    it('shows "Ask Self to create one" link in empty state', () => {
      const { props } = makeHomeProps();
      const { getByText } = render(<HomeScreen {...props} />);
      expect(getByText(/Ask Self to create one/)).toBeTruthy();
    });

    it('navigates to Chat when empty state link is tapped', () => {
      const navigate = jest.fn();
      const { props } = makeHomeProps({ navigate });
      const { getByText } = render(<HomeScreen {...props} />);

      fireEvent.press(getByText(/Ask Self to create one/));
      expect(navigate).toHaveBeenCalledWith('Chat');
    });

    it('empty state link has "link" accessibility role', () => {
      const { props } = makeHomeProps();
      const { getByRole } = render(<HomeScreen {...props} />);
      expect(getByRole('link')).toBeTruthy();
    });
  });

  describe('module list rendering', () => {
    it('renders ModuleList when modules exist', () => {
      const modules = new Map();
      modules.set('mod-1', {
        spec: { moduleId: 'mod-1' },
        status: 'active',
        dataStatus: 'ok',
        updatedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      });
      useModuleStore.setState({ modules });

      const { props } = makeHomeProps();
      const { getByTestId, queryByText } = render(<HomeScreen {...props} />);
      expect(getByTestId('module-list')).toBeTruthy();
      expect(queryByText('No modules yet')).toBeNull();
    });

    it('passes highlightModuleId to ModuleList', () => {
      const modules = new Map();
      modules.set('mod-42', {
        spec: { moduleId: 'mod-42' },
        status: 'active',
        dataStatus: 'ok',
        updatedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      });
      useModuleStore.setState({ modules });

      const { props } = makeHomeProps({ params: { highlightModuleId: 'mod-42' } });
      const { getByTestId } = render(<HomeScreen {...props} />);
      expect(getByTestId('highlight-id').props.children).toBe('mod-42');
    });
  });

  describe('badge reset on focus', () => {
    it('resets newModulesSinceLastHomeVisit when focus event fires', () => {
      useModuleStore.setState({ newModulesSinceLastHomeVisit: 5 });

      const { props, triggerFocus } = makeHomeProps();
      render(<HomeScreen {...props} />);

      triggerFocus();
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(0);
    });

    it('registers focus listener on mount', () => {
      const addListener = jest.fn(() => jest.fn());
      const { props } = makeHomeProps({ addListener });
      render(<HomeScreen {...props} />);

      expect(addListener).toHaveBeenCalledWith('focus', expect.any(Function));
    });
  });

  describe('highlightModuleId param clearing', () => {
    it('clears highlightModuleId param after reading it', () => {
      const modules = new Map();
      modules.set('mod-1', {
        spec: { moduleId: 'mod-1' },
        status: 'active',
        dataStatus: 'ok',
        updatedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      });
      useModuleStore.setState({ modules });

      const setParams = jest.fn();
      const { props } = makeHomeProps({
        params: { highlightModuleId: 'mod-1' },
        setParams,
      });
      render(<HomeScreen {...props} />);

      expect(setParams).toHaveBeenCalledWith({ highlightModuleId: undefined });
    });

    it('does not call setParams when highlightModuleId is not set', () => {
      const setParams = jest.fn();
      const { props } = makeHomeProps({ setParams });
      render(<HomeScreen {...props} />);

      expect(setParams).not.toHaveBeenCalled();
    });
  });
});
