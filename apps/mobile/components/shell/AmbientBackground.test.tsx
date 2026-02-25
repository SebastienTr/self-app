/**
 * Unit tests for AmbientBackground shell component (story 2-4).
 *
 * Tests rendering, absolute positioning, and reduce motion support.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { AmbientBackground } from './AmbientBackground';

describe('AmbientBackground', () => {
  beforeEach(() => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<AmbientBackground />)).not.toThrow();
  });

  it('uses absolute positioning to fill parent', () => {
    const { toJSON } = render(<AmbientBackground />);
    const root = toJSON() as any;
    const style = Array.isArray(root.props.style)
      ? Object.assign({}, ...root.props.style.filter(Boolean))
      : root.props.style;
    expect(style.position).toBe('absolute');
    expect(style.top).toBe(0);
    expect(style.left).toBe(0);
    expect(style.right).toBe(0);
    expect(style.bottom).toBe(0);
  });

  it('respects reduce motion (static opacity when enabled)', async () => {
    jest.restoreAllMocks();
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);

    const { toJSON } = render(<AmbientBackground />);

    await waitFor(() => {
      const root = toJSON() as any;
      // When reduce motion is enabled, opacity should be static 0.42
      const style = Array.isArray(root.props.style)
        ? Object.assign({}, ...root.props.style.filter(Boolean))
        : root.props.style;
      expect(style.opacity).toBe(0.42);
    });
  });
});
