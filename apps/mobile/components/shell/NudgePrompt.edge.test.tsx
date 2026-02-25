/**
 * Edge case tests for NudgePrompt shell component (story 2-4).
 *
 * Tests animation behavior, rapid visibility toggling, text styling,
 * and safe unmount during fade-in animation.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import React from 'react';
import { render } from '@testing-library/react-native';

import { NudgePrompt } from './NudgePrompt';

describe('NudgePrompt edge cases', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('unmounting during fade-in animation does not throw', () => {
    const { unmount } = render(<NudgePrompt visible={true} />);
    // Unmount while 400ms fade-in is in progress
    expect(() => unmount()).not.toThrow();
  });

  it('toggling visible false -> true -> false -> true does not crash', () => {
    const { rerender } = render(<NudgePrompt visible={false} />);
    rerender(<NudgePrompt visible={true} />);
    rerender(<NudgePrompt visible={false} />);
    rerender(<NudgePrompt visible={true} />);
    // No crash means animation state is handled gracefully
    expect(true).toBe(true);
  });

  it('renders nothing (returns null) when visible is false', () => {
    const { toJSON } = render(<NudgePrompt visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it('text is centered via textAlign style', () => {
    const { getByText } = render(<NudgePrompt visible={true} />);
    const textElement = getByText('Try tapping a suggestion or type anything');
    const style = textElement.props.style;
    const flatStyle = Array.isArray(style)
      ? Object.assign({}, ...style.flat().filter(Boolean))
      : style;
    expect(flatStyle.textAlign).toBe('center');
  });

  it('container has center-aligned items for horizontal centering', () => {
    const { toJSON } = render(<NudgePrompt visible={true} />);
    const root = toJSON() as any;
    const style = Array.isArray(root.props.style)
      ? Object.assign({}, ...root.props.style.filter(Boolean))
      : root.props.style;
    expect(style.alignItems).toBe('center');
  });

  it('re-rendering with visible=true multiple times is stable', () => {
    const { rerender, getByText } = render(<NudgePrompt visible={true} />);
    expect(getByText('Try tapping a suggestion or type anything')).toBeTruthy();

    rerender(<NudgePrompt visible={true} />);
    expect(getByText('Try tapping a suggestion or type anything')).toBeTruthy();

    rerender(<NudgePrompt visible={true} />);
    expect(getByText('Try tapping a suggestion or type anything')).toBeTruthy();
  });
});
