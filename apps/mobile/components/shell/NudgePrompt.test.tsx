/**
 * Unit tests for NudgePrompt shell component (story 2-4).
 *
 * Tests rendering when visible/hidden and text content.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import React from 'react';
import { render } from '@testing-library/react-native';

import { NudgePrompt } from './NudgePrompt';

describe('NudgePrompt', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders nudge text when visible is true', () => {
    const { getByText } = render(<NudgePrompt visible={true} />);
    expect(getByText('Try tapping a suggestion or type anything')).toBeTruthy();
  });

  it('does not render content when visible is false', () => {
    const { queryByText } = render(<NudgePrompt visible={false} />);
    expect(queryByText('Try tapping a suggestion or type anything')).toBeNull();
  });

  it('text content matches expected nudge message', () => {
    const { getByText } = render(<NudgePrompt visible={true} />);
    const text = getByText('Try tapping a suggestion or type anything');
    expect(text).toBeTruthy();
  });
});
