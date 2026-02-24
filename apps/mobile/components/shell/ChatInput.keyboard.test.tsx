/**
 * Keyboard-aware margin tests for ChatInput shell component.
 *
 * ChatInput adjusts its bottom margin based on keyboard visibility:
 *   - Keyboard hidden: marginBottom = Math.max(insets.bottom, spacing.sm)
 *   - Keyboard visible: marginBottom = spacing.xs (4)
 *
 * KAV (KeyboardAvoidingView) lives at App.tsx level, not in ChatInput.
 * These tests verify the margin adaptation only.
 */

import React from 'react';
import { Keyboard, Platform } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { ChatInput } from './ChatInput';

// Capture keyboard event listeners so tests can trigger them
type ListenerCallback = () => void;
const keyboardListeners: Record<string, ListenerCallback> = {};

jest.spyOn(Keyboard, 'addListener').mockImplementation((event: string, callback: any) => {
  keyboardListeners[event] = callback;
  return { remove: jest.fn() } as any;
});

// Default insets mock — can be overridden per test
const mockUseSafeAreaInsets = jest.fn(() => ({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockUseSafeAreaInsets(),
}));

/** Helper: extract the flattened marginBottom from the container View. */
function getContainerMarginBottom(getByLabelText: any): number | undefined {
  const containerView = getByLabelText('Message input').parent?.parent;
  expect(containerView).toBeTruthy();
  const flatStyle = containerView?.props?.style;
  const styles = Array.isArray(flatStyle) ? Object.assign({}, ...flatStyle) : flatStyle;
  return styles?.marginBottom;
}

describe('ChatInput — keyboard-aware margin', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    mockUseSafeAreaInsets.mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 });
    // Clear captured listeners
    Object.keys(keyboardListeners).forEach((k) => delete keyboardListeners[k]);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  describe('[P0] margin when keyboard is hidden (default)', () => {
    it('uses insets.bottom when larger than spacing.sm (8)', () => {
      mockUseSafeAreaInsets.mockReturnValue({ top: 47, bottom: 34, left: 0, right: 0 });
      const { getByLabelText } = render(<ChatInput onSend={jest.fn()} />);
      // Math.max(34, 8) = 34
      expect(getContainerMarginBottom(getByLabelText)).toBe(34);
    });

    it('falls back to spacing.sm (8) when insets.bottom is zero', () => {
      mockUseSafeAreaInsets.mockReturnValue({ top: 24, bottom: 0, left: 0, right: 0 });
      const { getByLabelText } = render(<ChatInput onSend={jest.fn()} />);
      // Math.max(0, 8) = 8
      expect(getContainerMarginBottom(getByLabelText)).toBe(8);
    });
  });

  describe('[P0] margin when keyboard is visible', () => {
    it('uses spacing.xs (4) when keyboard shows on Android', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android' });
      mockUseSafeAreaInsets.mockReturnValue({ top: 0, bottom: 48, left: 0, right: 0 });
      const { getByLabelText } = render(<ChatInput onSend={jest.fn()} />);

      // Simulate keyboard show
      act(() => { keyboardListeners['keyboardDidShow']?.(); });

      expect(getContainerMarginBottom(getByLabelText)).toBe(4);
    });

    it('uses spacing.xs (4) when keyboard shows on iOS', () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios' });
      mockUseSafeAreaInsets.mockReturnValue({ top: 47, bottom: 34, left: 0, right: 0 });
      const { getByLabelText } = render(<ChatInput onSend={jest.fn()} />);

      // iOS uses keyboardWillShow for smoother animation
      act(() => { keyboardListeners['keyboardWillShow']?.(); });

      expect(getContainerMarginBottom(getByLabelText)).toBe(4);
    });
  });

  describe('[P1] margin reverts when keyboard hides', () => {
    it('restores insets.bottom margin after keyboard dismiss on Android', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android' });
      mockUseSafeAreaInsets.mockReturnValue({ top: 0, bottom: 48, left: 0, right: 0 });
      const { getByLabelText } = render(<ChatInput onSend={jest.fn()} />);

      // Open keyboard
      act(() => { keyboardListeners['keyboardDidShow']?.(); });
      expect(getContainerMarginBottom(getByLabelText)).toBe(4);

      // Close keyboard
      act(() => { keyboardListeners['keyboardDidHide']?.(); });
      expect(getContainerMarginBottom(getByLabelText)).toBe(48);
    });

    it('restores insets.bottom margin after keyboard dismiss on iOS', () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios' });
      mockUseSafeAreaInsets.mockReturnValue({ top: 47, bottom: 34, left: 0, right: 0 });
      const { getByLabelText } = render(<ChatInput onSend={jest.fn()} />);

      // Open keyboard
      act(() => { keyboardListeners['keyboardWillShow']?.(); });
      expect(getContainerMarginBottom(getByLabelText)).toBe(4);

      // Close keyboard
      act(() => { keyboardListeners['keyboardWillHide']?.(); });
      expect(getContainerMarginBottom(getByLabelText)).toBe(34);
    });
  });

  describe('[P1] open → close → reopen cycle', () => {
    it('margin is correct through full open/close/reopen cycle', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android' });
      mockUseSafeAreaInsets.mockReturnValue({ top: 0, bottom: 48, left: 0, right: 0 });
      const { getByLabelText } = render(<ChatInput onSend={jest.fn()} />);

      // Initial: keyboard hidden
      expect(getContainerMarginBottom(getByLabelText)).toBe(48);

      // Open
      act(() => { keyboardListeners['keyboardDidShow']?.(); });
      expect(getContainerMarginBottom(getByLabelText)).toBe(4);

      // Close
      act(() => { keyboardListeners['keyboardDidHide']?.(); });
      expect(getContainerMarginBottom(getByLabelText)).toBe(48);

      // Reopen
      act(() => { keyboardListeners['keyboardDidShow']?.(); });
      expect(getContainerMarginBottom(getByLabelText)).toBe(4);
    });
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
