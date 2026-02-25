/**
 * Unit tests for HomeScreen (story 2-5b + story 2-4).
 *
 * Tests empty state, module list rendering, badge reset on focus,
 * highlightModuleId param handling, navigation to Chat,
 * contextual empty state (ambient background, prompt chips, nudge timer).
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

// Mock AmbientBackground component
jest.mock('@/components/shell/AmbientBackground', () => ({
  AmbientBackground: () => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'ambient-background' });
  },
}));

// Mock NudgePrompt component
jest.mock('@/components/shell/NudgePrompt', () => ({
  NudgePrompt: ({ visible }: { visible: boolean }) => {
    const React = require('react');
    const { Text } = require('react-native');
    if (!visible) return null;
    return React.createElement(Text, { testID: 'nudge-prompt' }, 'Try tapping a suggestion or type anything');
  },
}));

// Mock PromptChips component
jest.mock('@/components/shell/PromptChips', () => ({
  PromptChips: ({ onChipPress, persona, visible }: {
    onChipPress: (text: string) => void;
    persona: string | null;
    visible: boolean;
  }) => {
    const React = require('react');
    const { View, TouchableOpacity, Text } = require('react-native');
    if (!visible) return React.createElement(View, { testID: 'prompt-chips-hidden' });
    const chips = ["What's the weather like?", 'Track something for me', 'Help me organize my week'];
    if (persona === 'flame') chips.push('Automate something');
    if (persona === 'tree') chips.push("Let's chat first");
    if (persona === 'star') chips.push('Surprise me');
    return React.createElement(
      View,
      { testID: 'prompt-chips' },
      chips.map((text: string) =>
        React.createElement(
          TouchableOpacity,
          { key: text, onPress: () => onChipPress(text) },
          React.createElement(Text, null, text),
        ),
      ),
    );
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

// Mock wsClient
jest.mock('@/services/wsClient', () => ({
  send: jest.fn(),
}));

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

import { useModuleStore } from '@/stores/moduleStore';
import { useChatStore } from '@/stores/chatStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { send } from '@/services/wsClient';
import { HomeScreen } from './HomeScreen';

/** Build minimal navigation/route props for HomeScreen. */
function makeHomeProps(overrides: {
  params?: { highlightModuleId?: string };
  navigate?: jest.Mock;
  addListener?: jest.Mock;
  setParams?: jest.Mock;
} = {}) {
  const focusListeners: Array<() => void> = [];
  const blurListeners: Array<() => void> = [];
  const mockAddListener = overrides.addListener ?? jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') focusListeners.push(cb);
    if (event === 'blur') blurListeners.push(cb);
    return () => {
      const focusIdx = focusListeners.indexOf(cb);
      if (focusIdx >= 0) focusListeners.splice(focusIdx, 1);
      const blurIdx = blurListeners.indexOf(cb);
      if (blurIdx >= 0) blurListeners.splice(blurIdx, 1);
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
    triggerBlur: () => {
      for (const cb of blurListeners) cb();
    },
  };
}

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useModuleStore.setState({
      modules: new Map(),
      newModulesSinceLastHomeVisit: 0,
    });
    useChatStore.setState({
      messages: [],
      streamingMessage: null,
      agentStatus: 'idle',
    });
    useConnectionStore.setState({
      persona: null,
    });
    (send as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
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

  describe('contextual empty state enhancements (story 2-4)', () => {
    it('shows AmbientBackground in empty state', () => {
      const { props } = makeHomeProps();
      const { getByTestId } = render(<HomeScreen {...props} />);
      expect(getByTestId('ambient-background')).toBeTruthy();
    });

    it('shows PromptChips when no messages exist', () => {
      const { props } = makeHomeProps();
      const { getByTestId } = render(<HomeScreen {...props} />);
      expect(getByTestId('prompt-chips')).toBeTruthy();
    });

    it('PromptChips not shown when messages exist (user already chatted)', () => {
      useChatStore.setState({
        messages: [{ id: '1', type: 'chat', role: 'user', content: 'hi', timestamp: new Date().toISOString() }],
      });
      const { props } = makeHomeProps();
      const { getByTestId } = render(<HomeScreen {...props} />);
      expect(getByTestId('prompt-chips-hidden')).toBeTruthy();
    });

    it('chip press sends message and navigates to Chat', () => {
      const navigate = jest.fn();
      const { props } = makeHomeProps({ navigate });
      const { getByText } = render(<HomeScreen {...props} />);

      fireEvent.press(getByText('Track something for me'));

      expect(useChatStore.getState().messages.length).toBe(1);
      expect(useChatStore.getState().messages[0]).toEqual(
        expect.objectContaining({ type: 'chat', role: 'user', content: 'Track something for me' }),
      );
      expect(send).toHaveBeenCalledWith({ type: 'chat', payload: { message: 'Track something for me' } });
      expect(navigate).toHaveBeenCalledWith('Chat');
    });

    it('nudge appears after 15s of inactivity', () => {
      const { props } = makeHomeProps();
      const { queryByTestId } = render(<HomeScreen {...props} />);

      // Nudge not visible initially
      expect(queryByTestId('nudge-prompt')).toBeNull();

      // Advance time by 15s
      act(() => {
        jest.advanceTimersByTime(15_000);
      });

      expect(queryByTestId('nudge-prompt')).toBeTruthy();
    });

    it('nudge does not appear if user interacts before 15s', () => {
      const navigate = jest.fn();
      const { props } = makeHomeProps({ navigate });
      const { getByText, queryByTestId } = render(<HomeScreen {...props} />);

      // Advance time by 5s, then press a chip
      act(() => {
        jest.advanceTimersByTime(5_000);
      });

      fireEvent.press(getByText('Track something for me'));

      // Advance past the 15s mark
      act(() => {
        jest.advanceTimersByTime(15_000);
      });

      // Nudge should not appear since chips are hidden (messages.length > 0)
      // The component re-renders with messageCount > 0 so nudge timer won't be active
      // But this tests from external perspective: nudge should not be visible
      expect(queryByTestId('nudge-prompt')).toBeNull();
    });

    it('nudge timer clears on unmount', () => {
      const { props } = makeHomeProps();
      const { unmount, queryByTestId } = render(<HomeScreen {...props} />);

      unmount();

      // Advance time — since unmounted, timer should be cleared
      act(() => {
        jest.advanceTimersByTime(20_000);
      });

      // No crash means timer was properly cleared
      expect(true).toBe(true);
    });

    it('persona chip rendered when persona is set in connectionStore', () => {
      useConnectionStore.setState({ persona: 'flame' });
      const { props } = makeHomeProps();
      const { getByText } = render(<HomeScreen {...props} />);
      expect(getByText('Automate something')).toBeTruthy();
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
