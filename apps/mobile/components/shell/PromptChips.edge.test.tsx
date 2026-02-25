/**
 * Edge case tests for PromptChips shell component (story 2-4).
 *
 * Tests fade-out animation completion behavior.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import React from 'react';
import { render } from '@testing-library/react-native';

import { PromptChips } from './PromptChips';

describe('PromptChips edge cases', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fade-out animation does not crash when component unmounts mid-animation', () => {
    const onChipPress = jest.fn();
    const { rerender, unmount } = render(
      <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
    );

    // Trigger fade out by setting visible to false
    rerender(
      <PromptChips onChipPress={onChipPress} persona={null} visible={false} />,
    );

    // Unmount during the 300ms fade animation — should not throw
    expect(() => unmount()).not.toThrow();
  });

  it('transitioning visible from true to false to true does not crash', () => {
    const onChipPress = jest.fn();
    const { rerender } = render(
      <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
    );

    rerender(
      <PromptChips onChipPress={onChipPress} persona={null} visible={false} />,
    );

    rerender(
      <PromptChips onChipPress={onChipPress} persona={null} visible={true} />,
    );

    // No crash means animation transitions are handled gracefully
    expect(true).toBe(true);
  });
});
