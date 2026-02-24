/**
 * Tests for ChatInput onInputFocus prop (story 2-5).
 *
 * Verifies:
 *   - onInputFocus callback is called when TextInput gains focus
 *   - Works without onInputFocus prop (optional)
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

import { ChatInput } from './ChatInput';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/hooks/useKeyboardVisible', () => ({
  useKeyboardVisible: () => ({ keyboardVisible: false }),
}));

describe('ChatInput onInputFocus', () => {
  it('calls onInputFocus when TextInput gains focus', () => {
    const onFocus = jest.fn();
    render(<ChatInput onSend={jest.fn()} onInputFocus={onFocus} />);

    const input = screen.getByLabelText('Message input');
    fireEvent(input, 'focus');

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('does not crash when onInputFocus is not provided', () => {
    render(<ChatInput onSend={jest.fn()} />);

    const input = screen.getByLabelText('Message input');
    expect(() => fireEvent(input, 'focus')).not.toThrow();
  });

  it('still renders and functions without onInputFocus', () => {
    const onSend = jest.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByLabelText('Message input');
    expect(input).toBeTruthy();
  });
});
