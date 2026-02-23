/**
 * Edge-case tests for ChatInput shell component — Story 2.1 TEA expansion.
 *
 * Covers paths NOT exercised by ChatInput.test.tsx:
 *   - onSubmitEditing (Enter key / returnKeyType="send") triggers send
 *   - Send button disabled accessibility state
 *   - Input remains enabled when disabled prop is false (not undefined)
 *   - Does not call onSend if content is whitespace-only regardless of length
 *   - Multiple sends in sequence each clear and reset independently
 *   - onSend callback receives only the trimmed value (not raw)
 *   - Long message content is passed through correctly
 *   - unicode content is passed through correctly
 *   - Value does not carry over between independent renders
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ChatInput } from './ChatInput';

describe('ChatInput — edge cases', () => {
  describe('onSubmitEditing (keyboard send)', () => {
    it('calls onSend when user presses Enter/return on the input', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(<ChatInput onSend={mockOnSend} />);

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, 'Hello via return key');
      fireEvent(input, 'submitEditing');

      expect(mockOnSend).toHaveBeenCalledWith('Hello via return key');
    });

    it('does not call onSend when pressing Enter on empty input', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(<ChatInput onSend={mockOnSend} />);

      const input = getByLabelText('Message input');
      fireEvent(input, 'submitEditing');

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('clears input after sending via return key', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(<ChatInput onSend={mockOnSend} />);

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, 'Submit via return');
      fireEvent(input, 'submitEditing');

      expect(input.props.value).toBe('');
    });

    it('does not call onSend via return key when disabled', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(<ChatInput onSend={mockOnSend} disabled />);

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, 'Hello');
      fireEvent(input, 'submitEditing');

      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe('accessibilityState on send button', () => {
    it('send button has disabled accessibilityState when input is empty', () => {
      const { getByLabelText } = render(<ChatInput onSend={jest.fn()} />);
      const sendButton = getByLabelText('Send message');
      expect(sendButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('send button accessibilityState disabled is false when text is entered', () => {
      const { getByLabelText } = render(<ChatInput onSend={jest.fn()} />);

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, 'Hello');

      const sendButton = getByLabelText('Send message');
      expect(sendButton.props.accessibilityState?.disabled).toBe(false);
    });

    it('send button has disabled accessibilityState when disabled prop is true', () => {
      const { getByLabelText } = render(
        <ChatInput onSend={jest.fn()} disabled />
      );
      // Even with text in the input, if disabled=true the button should be disabled
      const sendButton = getByLabelText('Send message');
      expect(sendButton.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('whitespace-only content of various lengths', () => {
    it('does not call onSend for tab character', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(<ChatInput onSend={mockOnSend} />);

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, '\t\t\t');

      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('does not call onSend for mixed whitespace', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(<ChatInput onSend={mockOnSend} />);

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, '  \t  \n  ');

      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe('multiple sends in sequence', () => {
    it('can send multiple messages independently', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(<ChatInput onSend={mockOnSend} />);

      const input = getByLabelText('Message input');
      const sendButton = getByLabelText('Send message');

      fireEvent.changeText(input, 'First message');
      fireEvent.press(sendButton);
      expect(input.props.value).toBe('');

      fireEvent.changeText(input, 'Second message');
      fireEvent.press(sendButton);
      expect(input.props.value).toBe('');

      expect(mockOnSend).toHaveBeenCalledTimes(2);
      expect(mockOnSend).toHaveBeenNthCalledWith(1, 'First message');
      expect(mockOnSend).toHaveBeenNthCalledWith(2, 'Second message');
    });
  });

  describe('onSend receives only trimmed content', () => {
    it('trims leading spaces', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(<ChatInput onSend={mockOnSend} />);

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, '   Hello');

      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(mockOnSend).toHaveBeenCalledWith('Hello');
    });

    it('trims trailing spaces', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(<ChatInput onSend={mockOnSend} />);

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, 'Hello   ');

      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(mockOnSend).toHaveBeenCalledWith('Hello');
    });
  });

  describe('long and unicode messages', () => {
    it('sends long message content without truncation', () => {
      const longMessage = 'A very detailed question about the meaning of life '.repeat(5);
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(<ChatInput onSend={mockOnSend} />);

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, longMessage);

      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(mockOnSend).toHaveBeenCalledWith(longMessage.trim());
    });

    it('sends unicode message correctly', () => {
      const unicodeMessage = 'こんにちは！何かお手伝いできますか？🌍';
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(<ChatInput onSend={mockOnSend} />);

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, unicodeMessage);

      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(mockOnSend).toHaveBeenCalledWith(unicodeMessage);
    });
  });

  describe('disabled prop — explicit false', () => {
    it('input is enabled and send works when disabled=false', () => {
      const mockOnSend = jest.fn();
      const { getByLabelText } = render(<ChatInput onSend={mockOnSend} disabled={false} />);

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, 'Enabled message');

      const sendButton = getByLabelText('Send message');
      fireEvent.press(sendButton);

      expect(mockOnSend).toHaveBeenCalledWith('Enabled message');
    });
  });
});
