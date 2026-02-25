/**
 * Keyboard-aware margin tests for ChatInput shell component.
 *
 * ChatInput uses a fixed bottom margin (spacing.sm = 8) since the tab bar
 * handles safe area insets. No dynamic margin based on keyboard state.
 */

import React from 'react';
import { Keyboard, Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import { ChatInput } from './ChatInput';

// Capture keyboard event listeners
type ListenerCallback = () => void;
const keyboardListeners: Record<string, ListenerCallback> = {};

jest.spyOn(Keyboard, 'addListener').mockImplementation((event: string, callback: any) => {
  keyboardListeners[event] = callback;
  return { remove: jest.fn() } as any;
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

/** Helper: extract the flattened marginBottom from the container View. */
function getContainerMarginBottom(getByLabelText: any): number | undefined {
  const containerView = getByLabelText('Message input').parent?.parent;
  expect(containerView).toBeTruthy();
  const flatStyle = containerView?.props?.style;
  const styles = Array.isArray(flatStyle) ? Object.assign({}, ...flatStyle) : flatStyle;
  return styles?.marginBottom;
}

describe('ChatInput — fixed margin (tab bar handles safe area)', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Object.keys(keyboardListeners).forEach((k) => delete keyboardListeners[k]);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('uses spacing.sm (8) as fixed margin', () => {
    const { getByLabelText } = render(<ChatInput onSend={jest.fn()} />);
    expect(getContainerMarginBottom(getByLabelText)).toBe(8);
  });

  it('margin stays at spacing.sm regardless of insets.bottom', () => {
    // insets.bottom is 34 from mock, but margin should still be 8
    const { getByLabelText } = render(<ChatInput onSend={jest.fn()} />);
    expect(getContainerMarginBottom(getByLabelText)).toBe(8);
  });

  describe('[P2] platform-specific keyboard events', () => {
    it('subscribes to keyboardWillShow/keyboardWillHide on iOS', () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios' });
      render(<ChatInput onSend={jest.fn()} />);
      expect(keyboardListeners).toHaveProperty('keyboardWillShow');
      expect(keyboardListeners).toHaveProperty('keyboardWillHide');
    });

    it('subscribes to keyboardDidShow/keyboardDidHide on Android', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android' });
      render(<ChatInput onSend={jest.fn()} />);
      expect(keyboardListeners).toHaveProperty('keyboardDidShow');
      expect(keyboardListeners).toHaveProperty('keyboardDidHide');
    });
  });
});
