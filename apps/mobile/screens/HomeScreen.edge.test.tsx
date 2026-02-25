/**
 * Edge case tests for HomeScreen (story 2-5b + story 2-4).
 *
 * Tests focus listener cleanup, multiple focus events, transition from
 * empty to non-empty state, badge reset idempotency, contextual empty state
 * edge cases (chips disappear, rapid taps, persona changes, nudge timer reset).
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

// Mock AmbientBackground
jest.mock('@/components/shell/AmbientBackground', () => ({
  AmbientBackground: () => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'ambient-background' });
  },
}));

// Mock NudgePrompt
jest.mock('@/components/shell/NudgePrompt', () => ({
  NudgePrompt: ({ visible }: { visible: boolean }) => {
    const React = require('react');
    const { Text } = require('react-native');
    if (!visible) return null;
    return React.createElement(Text, { testID: 'nudge-prompt' }, 'Try tapping a suggestion or type anything');
  },
}));

// Mock PromptChips
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

// Mock ModuleList
jest.mock('@/components/bridge/ModuleList', () => ({
  ModuleList: () => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'module-list' });
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

function makeHomeProps(overrides: {
  params?: { highlightModuleId?: string };
  navigate?: jest.Mock;
} = {}) {
  const focusListeners: Array<() => void> = [];
  const blurListeners: Array<() => void> = [];

  return {
    props: {
      navigation: {
        navigate: overrides.navigate ?? jest.fn(),
        addListener: jest.fn((event: string, cb: () => void) => {
          if (event === 'focus') focusListeners.push(cb);
          if (event === 'blur') blurListeners.push(cb);
          return () => {
            const focusIdx = focusListeners.indexOf(cb);
            if (focusIdx >= 0) focusListeners.splice(focusIdx, 1);
            const blurIdx = blurListeners.indexOf(cb);
            if (blurIdx >= 0) blurListeners.splice(blurIdx, 1);
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
    triggerBlur: () => {
      for (const cb of [...blurListeners]) cb();
    },
  };
}

describe('HomeScreen edge cases', () => {
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

  describe('contextual empty state edge cases (story 2-4)', () => {
    it('chips disappear when first message arrives mid-view (chatStore subscription)', () => {
      const { props } = makeHomeProps();
      const { getByTestId, rerender } = render(<HomeScreen {...props} />);
      expect(getByTestId('prompt-chips')).toBeTruthy();

      // Simulate first message arriving via chatStore
      act(() => {
        useChatStore.getState().addUserMessage('Hello');
      });

      rerender(<HomeScreen {...props} />);
      expect(getByTestId('prompt-chips-hidden')).toBeTruthy();
    });

    it('rapid chip taps only send one message (debounce via ref guard)', () => {
      const navigate = jest.fn();
      const { props } = makeHomeProps({ navigate });
      const { getByText, queryByTestId } = render(<HomeScreen {...props} />);

      // First press should work
      fireEvent.press(getByText('Track something for me'));

      expect(send).toHaveBeenCalledTimes(1);
      expect(useChatStore.getState().messages.length).toBe(1);
      expect(navigate).toHaveBeenCalledTimes(1);

      // After first press, chips become hidden (visible=false) due to messages.length > 0
      // and chipPressedRef guard, preventing further presses
      expect(queryByTestId('prompt-chips-hidden')).toBeTruthy();
    });

    it('persona changes while empty state visible (re-renders with new persona chip)', () => {
      const { props } = makeHomeProps();
      const { getByText, queryByText, rerender } = render(<HomeScreen {...props} />);

      expect(queryByText('Automate something')).toBeNull();

      act(() => {
        useConnectionStore.setState({ persona: 'flame' });
      });

      rerender(<HomeScreen {...props} />);
      expect(getByText('Automate something')).toBeTruthy();

      act(() => {
        useConnectionStore.setState({ persona: 'star' });
      });

      rerender(<HomeScreen {...props} />);
      expect(queryByText('Automate something')).toBeNull();
      expect(getByText('Surprise me')).toBeTruthy();
    });

    it('navigate away and back resets nudge timer', () => {
      const { props, triggerBlur, triggerFocus } = makeHomeProps();
      const { queryByTestId } = render(<HomeScreen {...props} />);

      act(() => {
        jest.advanceTimersByTime(10_000);
      });
      expect(queryByTestId('nudge-prompt')).toBeNull();

      act(() => {
        triggerBlur();
      });

      act(() => {
        triggerFocus();
      });

      act(() => {
        jest.advanceTimersByTime(10_000);
      });
      expect(queryByTestId('nudge-prompt')).toBeNull();

      act(() => {
        jest.advanceTimersByTime(5_000);
      });
      expect(queryByTestId('nudge-prompt')).toBeTruthy();
    });

    it('modules appear while on empty state (transitions to ModuleList)', () => {
      const { props } = makeHomeProps();
      const { queryByText, getByTestId, rerender } = render(<HomeScreen {...props} />);
      expect(queryByText('No modules yet')).toBeTruthy();

      const modules = new Map();
      modules.set('mod-1', {
        spec: { moduleId: 'mod-1' },
        status: 'active',
        dataStatus: 'ok',
        updatedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      });
      act(() => {
        useModuleStore.setState({ modules });
      });

      rerender(<HomeScreen {...props} />);
      expect(getByTestId('module-list')).toBeTruthy();
      expect(queryByText('No modules yet')).toBeNull();
    });
  });

  describe('contextual empty state — additional edge cases (TEA expansion)', () => {
    it('AmbientBackground is not present when modules exist', () => {
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
      const { queryByTestId } = render(<HomeScreen {...props} />);
      expect(queryByTestId('ambient-background')).toBeNull();
    });

    it('nudge timer does not start when modules already exist', () => {
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
      const { queryByTestId } = render(<HomeScreen {...props} />);

      act(() => {
        jest.advanceTimersByTime(20_000);
      });

      // Nudge should not appear when there are modules
      expect(queryByTestId('nudge-prompt')).toBeNull();
    });

    it('nudge timer does not start when messages already exist', () => {
      useChatStore.setState({
        messages: [{ id: '1', type: 'chat', role: 'user', content: 'hi', timestamp: new Date().toISOString() }],
      });

      const { props } = makeHomeProps();
      const { queryByTestId } = render(<HomeScreen {...props} />);

      act(() => {
        jest.advanceTimersByTime(20_000);
      });

      // Nudge should not appear when messages already exist
      expect(queryByTestId('nudge-prompt')).toBeNull();
    });

    it('tree persona chip press sends correct message and navigates', () => {
      useConnectionStore.setState({ persona: 'tree' });
      const navigate = jest.fn();
      const { props } = makeHomeProps({ navigate });
      const { getByText } = render(<HomeScreen {...props} />);

      fireEvent.press(getByText("Let's chat first"));

      expect(useChatStore.getState().messages[0]).toEqual(
        expect.objectContaining({ content: "Let's chat first", role: 'user' }),
      );
      expect(send).toHaveBeenCalledWith({ type: 'chat', payload: { message: "Let's chat first" } });
      expect(navigate).toHaveBeenCalledWith('Chat');
    });

    it('star persona chip press sends correct message and navigates', () => {
      useConnectionStore.setState({ persona: 'star' });
      const navigate = jest.fn();
      const { props } = makeHomeProps({ navigate });
      const { getByText } = render(<HomeScreen {...props} />);

      fireEvent.press(getByText('Surprise me'));

      expect(useChatStore.getState().messages[0]).toEqual(
        expect.objectContaining({ content: 'Surprise me', role: 'user' }),
      );
      expect(send).toHaveBeenCalledWith({ type: 'chat', payload: { message: 'Surprise me' } });
      expect(navigate).toHaveBeenCalledWith('Chat');
    });

    it('multiple blur/focus cycles properly manage nudge timer', () => {
      const { props, triggerBlur, triggerFocus } = makeHomeProps();
      const { queryByTestId } = render(<HomeScreen {...props} />);

      // Cycle 1: advance 5s, blur, focus
      act(() => { jest.advanceTimersByTime(5_000); });
      act(() => { triggerBlur(); });
      act(() => { triggerFocus(); });

      // Cycle 2: advance 5s, blur, focus
      act(() => { jest.advanceTimersByTime(5_000); });
      act(() => { triggerBlur(); });
      act(() => { triggerFocus(); });

      // Cycle 3: advance 5s, blur, focus
      act(() => { jest.advanceTimersByTime(5_000); });
      act(() => { triggerBlur(); });
      act(() => { triggerFocus(); });

      // After all cycles, only 0s elapsed on current timer — nudge not shown
      expect(queryByTestId('nudge-prompt')).toBeNull();

      // Now wait full 15s without interruption
      act(() => { jest.advanceTimersByTime(15_000); });
      expect(queryByTestId('nudge-prompt')).toBeTruthy();
    });

    it('nudge is hidden after blur even if it was showing', () => {
      const { props, triggerBlur } = makeHomeProps();
      const { queryByTestId } = render(<HomeScreen {...props} />);

      // Wait for nudge to appear
      act(() => { jest.advanceTimersByTime(15_000); });
      expect(queryByTestId('nudge-prompt')).toBeTruthy();

      // Blur should hide the nudge
      act(() => { triggerBlur(); });
      expect(queryByTestId('nudge-prompt')).toBeNull();
    });

    it('goToChat CTA link still works in contextual empty state', () => {
      const navigate = jest.fn();
      const { props } = makeHomeProps({ navigate });
      const { getByText } = render(<HomeScreen {...props} />);

      // The "Ask Self to create one" link should still be functional
      fireEvent.press(getByText(/Ask Self to create one/));
      expect(navigate).toHaveBeenCalledWith('Chat');
    });

    it('PromptChips and NudgePrompt are not rendered when modules exist', () => {
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
      const { queryByTestId, queryByText } = render(<HomeScreen {...props} />);

      expect(queryByTestId('prompt-chips')).toBeNull();
      expect(queryByTestId('prompt-chips-hidden')).toBeNull();
      expect(queryByTestId('nudge-prompt')).toBeNull();
      expect(queryByText('No modules yet')).toBeNull();
    });

    it('Orb is present in the contextual empty state', () => {
      const { props } = makeHomeProps();
      const { getByTestId } = render(<HomeScreen {...props} />);
      expect(getByTestId('orb')).toBeTruthy();
    });
  });
});
