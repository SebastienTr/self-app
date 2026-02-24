/**
 * Unit tests for ChatInput shell component.
 *
 * Tests send behavior, disabled state, and accessibility.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ChatInput } from './ChatInput';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('ChatInput', () => {
  describe('rendering', () => {
    it('renders text input', () => {
      const { getByLabelText } = render(
        <ChatInput onSend={jest.fn()} />
      );
      expect(getByLabelText('Message input')).toBeTruthy();
    });

    it('renders send button', () => {
      const { getByLabelText } = render(
        <ChatInput onSend={jest.fn()} />
      );
      expect(getByLabelText('Send message')).toBeTruthy();
    });
  });

  describe('send behavior', () => {
    it('calls onSend with trimmed message when send is pressed', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(
        <ChatInput onSend={mockOnSend} />
      );

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, 'Hello world');

      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(mockOnSend).toHaveBeenCalledWith('Hello world');
    });

    it('trims whitespace before calling onSend', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(
        <ChatInput onSend={mockOnSend} />
      );

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, '  Hello  ');

      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(mockOnSend).toHaveBeenCalledWith('Hello');
    });

    it('clears the input after sending', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(
        <ChatInput onSend={mockOnSend} />
      );

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, 'Hello');

      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(input.props.value).toBe('');
    });

    it('does not call onSend when input is empty', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(
        <ChatInput onSend={mockOnSend} />
      );

      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('does not call onSend when input is only whitespace', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(
        <ChatInput onSend={mockOnSend} />
      );

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, '   ');

      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('does not call onSend when disabled prop is true', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(
        <ChatInput onSend={mockOnSend} disabled />
      );

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, 'Hello');

      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('input has correct accessibilityLabel', () => {
      const { getByLabelText } = render(
        <ChatInput onSend={jest.fn()} />
      );
      expect(getByLabelText('Message input')).toBeTruthy();
    });

    it('send button has correct accessibilityLabel', () => {
      const { getByLabelText } = render(
        <ChatInput onSend={jest.fn()} />
      );
      expect(getByLabelText('Send message')).toBeTruthy();
    });
  });

  describe('keyboard avoidance', () => {
    it('wraps content in KeyboardAvoidingView', () => {
      const { UNSAFE_getByType } = render(
        <ChatInput onSend={jest.fn()} />
      );
      const { KeyboardAvoidingView } = require('react-native');
      expect(UNSAFE_getByType(KeyboardAvoidingView)).toBeTruthy();
    });

    it('KeyboardAvoidingView has a behavior prop set', () => {
      const { UNSAFE_getByType } = render(
        <ChatInput onSend={jest.fn()} />
      );
      const { KeyboardAvoidingView } = require('react-native');
      const kav = UNSAFE_getByType(KeyboardAvoidingView);
      // behavior should be 'padding' (iOS) or 'height' (Android) — never undefined
      expect(['padding', 'height']).toContain(kav.props.behavior);
    });
  });

  describe('pure component behavior', () => {
    it('renders without crashing', () => {
      expect(() =>
        render(<ChatInput onSend={jest.fn()} />)
      ).not.toThrow();
    });
  });
});
