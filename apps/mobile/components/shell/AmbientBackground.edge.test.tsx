/**
 * Edge case tests for AmbientBackground shell component (story 2-4).
 *
 * Tests animation cleanup, layer structure, pointerEvents passthrough,
 * and transitions between reduce-motion states.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { AmbientBackground } from './AmbientBackground';

describe('AmbientBackground edge cases', () => {
  beforeEach(() => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('does not block touch events (pointerEvents="none")', () => {
    const { toJSON } = render(<AmbientBackground />);
    const root = toJSON() as any;
    expect(root.props.pointerEvents).toBe('none');
  });

  it('contains two child layers (topLayer and amberLayer)', () => {
    const { toJSON } = render(<AmbientBackground />);
    const root = toJSON() as any;
    expect(root.children).toHaveLength(2);
  });

  it('top layer uses navy blue background color (#1A2844)', () => {
    const { toJSON } = render(<AmbientBackground />);
    const root = toJSON() as any;
    const topLayer = root.children[0];
    const style = Array.isArray(topLayer.props.style)
      ? Object.assign({}, ...topLayer.props.style.filter(Boolean))
      : topLayer.props.style;
    expect(style.backgroundColor).toBe('#1A2844');
  });

  it('amber layer uses faint amber background color', () => {
    const { toJSON } = render(<AmbientBackground />);
    const root = toJSON() as any;
    const amberLayer = root.children[1];
    const style = Array.isArray(amberLayer.props.style)
      ? Object.assign({}, ...amberLayer.props.style.filter(Boolean))
      : amberLayer.props.style;
    expect(style.backgroundColor).toBe('rgba(232,168,76,0.08)');
  });

  it('unmounting during animation does not throw', () => {
    const { unmount } = render(<AmbientBackground />);
    // Unmount while breathing animation is running
    expect(() => unmount()).not.toThrow();
  });

  it('renders static View (not Animated.View) when reduce motion is enabled', async () => {
    jest.restoreAllMocks();
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);

    const { toJSON } = render(<AmbientBackground />);

    await waitFor(() => {
      const root = toJSON() as any;
      // When reduce motion is enabled, the component renders a plain View
      // with a static opacity of 0.42, not an Animated.View
      const style = Array.isArray(root.props.style)
        ? Object.assign({}, ...root.props.style.filter(Boolean))
        : root.props.style;
      expect(style.opacity).toBe(0.42);
      // Verify pointerEvents is still set to none
      expect(root.props.pointerEvents).toBe('none');
    });
  });

  it('re-renders safely when reduce motion changes from false to true', async () => {
    // Start with reduce motion disabled
    const { toJSON, unmount } = render(<AmbientBackground />);
    const root1 = toJSON() as any;
    expect(root1.props.pointerEvents).toBe('none');

    // Unmount and re-render with reduce motion enabled
    unmount();

    jest.restoreAllMocks();
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);

    const { toJSON: toJSON2 } = render(<AmbientBackground />);

    await waitFor(() => {
      const root2 = toJSON2() as any;
      const style = Array.isArray(root2.props.style)
        ? Object.assign({}, ...root2.props.style.filter(Boolean))
        : root2.props.style;
      expect(style.opacity).toBe(0.42);
    });
  });

  it('covers full parent area with absolute positioning on all edges', () => {
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
});
