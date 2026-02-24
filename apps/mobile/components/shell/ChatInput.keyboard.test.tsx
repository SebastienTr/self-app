/**
 * Keyboard avoidance tests for ChatInput shell component — TEA prep-1 expansion.
 *
 * Covers KeyboardAvoidingView integration paths NOT exercised by existing tests:
 *   - [P0] Platform-specific behavior prop (iOS='padding', Android='height')
 *   - [P1] KAV wraps the input container (structural relationship)
 *   - [P1] Safe area insets margin calculation with non-zero bottom inset
 *   - [P2] KAV does not break accessibility labels
 *   - [P2] KAV is present even when component is disabled
 *   - [P2] Safe area insets edge: zero bottom inset uses spacing.sm fallback
 *   - [P2] Safe area insets edge: large bottom inset used over spacing.sm
 */

import React from 'react';
import { Platform } from 'react-native';
import { render, within } from '@testing-library/react-native';
import { ChatInput } from './ChatInput';

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

describe('ChatInput — keyboard avoidance', () => {
  beforeEach(() => {
    mockUseSafeAreaInsets.mockReturnValue({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  describe('[P0] platform-specific behavior prop', () => {
    const originalOS = Platform.OS;

    afterEach(() => {
      // Restore original Platform.OS after each test
      Object.defineProperty(Platform, 'OS', { value: originalOS });
    });

    it('uses behavior="padding" on iOS', () => {
      // Given: platform is iOS
      Object.defineProperty(Platform, 'OS', { value: 'ios' });

      // When: ChatInput renders
      const { UNSAFE_getByType } = render(<ChatInput onSend={jest.fn()} />);
      const { KeyboardAvoidingView } = require('react-native');
      const kav = UNSAFE_getByType(KeyboardAvoidingView);

      // Then: behavior is 'padding' for iOS keyboard handling
      expect(kav.props.behavior).toBe('padding');
    });

    it('uses behavior="height" on Android', () => {
      // Given: platform is Android
      Object.defineProperty(Platform, 'OS', { value: 'android' });

      // When: ChatInput renders
      const { UNSAFE_getByType } = render(<ChatInput onSend={jest.fn()} />);
      const { KeyboardAvoidingView } = require('react-native');
      const kav = UNSAFE_getByType(KeyboardAvoidingView);

      // Then: behavior is 'height' for Android edge-to-edge keyboard handling
      expect(kav.props.behavior).toBe('height');
    });
  });

  describe('[P1] KAV wraps the input container', () => {
    it('KeyboardAvoidingView is the outermost rendered element', () => {
      // Given: ChatInput renders
      const { UNSAFE_getByType } = render(<ChatInput onSend={jest.fn()} />);
      const { KeyboardAvoidingView } = require('react-native');
      const kav = UNSAFE_getByType(KeyboardAvoidingView);

      // Then: the KAV contains the message input (structural verification)
      const inputInKav = within(kav).getByLabelText('Message input');
      expect(inputInKav).toBeTruthy();
    });

    it('KeyboardAvoidingView wraps the send button', () => {
      // Given: ChatInput renders
      const { UNSAFE_getByType } = render(<ChatInput onSend={jest.fn()} />);
      const { KeyboardAvoidingView } = require('react-native');
      const kav = UNSAFE_getByType(KeyboardAvoidingView);

      // Then: the KAV contains the send button
      const sendButtonInKav = within(kav).getByLabelText('Send message');
      expect(sendButtonInKav).toBeTruthy();
    });
  });

  describe('[P1] safe area insets margin calculation', () => {
    it('uses bottom inset when larger than spacing.sm (8)', () => {
      // Given: device has a large bottom safe area (e.g., iPhone notch = 34)
      mockUseSafeAreaInsets.mockReturnValue({
        top: 47,
        bottom: 34,
        left: 0,
        right: 0,
      });

      // When: ChatInput renders
      const { UNSAFE_getByType } = render(<ChatInput onSend={jest.fn()} />);
      const { View } = require('react-native');

      // Then: the container View uses the larger inset as marginBottom
      // Math.max(34, 8) = 34
      const { KeyboardAvoidingView } = require('react-native');
      const kav = UNSAFE_getByType(KeyboardAvoidingView);
      const containerView = within(kav).getByLabelText('Message input').parent?.parent;

      // Find the View with marginBottom style — traverse up from input
      expect(containerView).toBeTruthy();
      const flatStyle = containerView?.props?.style;
      // Style may be an array; flatten to find marginBottom
      const styles = Array.isArray(flatStyle) ? Object.assign({}, ...flatStyle) : flatStyle;
      expect(styles?.marginBottom).toBe(34);
    });

    it('uses spacing.sm (8) when bottom inset is zero', () => {
      // Given: device has no bottom safe area (e.g., standard Android phone)
      mockUseSafeAreaInsets.mockReturnValue({
        top: 24,
        bottom: 0,
        left: 0,
        right: 0,
      });

      // When: ChatInput renders
      const { UNSAFE_getByType } = render(<ChatInput onSend={jest.fn()} />);
      const { KeyboardAvoidingView } = require('react-native');
      const kav = UNSAFE_getByType(KeyboardAvoidingView);
      const containerView = within(kav).getByLabelText('Message input').parent?.parent;

      // Then: Math.max(0, 8) = 8
      expect(containerView).toBeTruthy();
      const flatStyle = containerView?.props?.style;
      const styles = Array.isArray(flatStyle) ? Object.assign({}, ...flatStyle) : flatStyle;
      expect(styles?.marginBottom).toBe(8);
    });
  });

  describe('[P2] accessibility through KAV wrapper', () => {
    it('Message input label is accessible through KAV', () => {
      // Given: ChatInput wrapped in KAV
      // When: rendered
      const { getByLabelText } = render(<ChatInput onSend={jest.fn()} />);

      // Then: accessibility labels are reachable (KAV does not break a11y tree)
      expect(getByLabelText('Message input')).toBeTruthy();
    });

    it('Send message label is accessible through KAV', () => {
      // Given: ChatInput wrapped in KAV
      // When: rendered
      const { getByLabelText } = render(<ChatInput onSend={jest.fn()} />);

      // Then: send button label is reachable through KAV wrapper
      expect(getByLabelText('Send message')).toBeTruthy();
    });
  });

  describe('[P2] KAV presence in disabled state', () => {
    it('KeyboardAvoidingView is present when disabled=true', () => {
      // Given: ChatInput is disabled
      // When: rendered
      const { UNSAFE_getByType } = render(
        <ChatInput onSend={jest.fn()} disabled />
      );
      const { KeyboardAvoidingView } = require('react-native');

      // Then: KAV is still in the tree (keyboard avoidance should work regardless of disabled state)
      expect(UNSAFE_getByType(KeyboardAvoidingView)).toBeTruthy();
    });

    it('KAV behavior prop is unchanged when disabled', () => {
      // Given: ChatInput is disabled
      // When: rendered
      const { UNSAFE_getByType } = render(
        <ChatInput onSend={jest.fn()} disabled />
      );
      const { KeyboardAvoidingView } = require('react-native');
      const kav = UNSAFE_getByType(KeyboardAvoidingView);

      // Then: behavior prop is still set correctly
      expect(['padding', 'height']).toContain(kav.props.behavior);
    });
  });
});
