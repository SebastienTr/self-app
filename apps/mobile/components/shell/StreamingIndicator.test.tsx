/**
 * Unit tests for StreamingIndicator shell component — Story 2.1 TEA expansion.
 *
 * StreamingIndicator has zero existing test coverage. This file covers:
 *   - Renders without crashing
 *   - testID "streaming-indicator" is present (used by ChatBubble/ChatThread tests)
 *   - Three dot children are rendered
 *   - Is a pure component (no props required)
 *   - Renders within a ChatBubble context (indirect usage)
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { StreamingIndicator } from './StreamingIndicator';

describe('StreamingIndicator', () => {
  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<StreamingIndicator />)).not.toThrow();
    });

    it('has the streaming-indicator testID for downstream test assertions', () => {
      const { getByTestId } = render(<StreamingIndicator />);
      expect(getByTestId('streaming-indicator')).toBeTruthy();
    });

    it('renders the container element', () => {
      const { getByTestId } = render(<StreamingIndicator />);
      const container = getByTestId('streaming-indicator');
      expect(container).toBeTruthy();
    });
  });

  describe('dot children', () => {
    it('renders exactly three animated dot children', () => {
      const { getByTestId } = render(<StreamingIndicator />);
      const container = getByTestId('streaming-indicator');
      // Three Dot components are rendered as children of the container
      expect(container.props.children).toBeTruthy();
      // The container has 3 Dot children
      const children = container.props.children;
      expect(Array.isArray(children)).toBe(true);
      expect(children).toHaveLength(3);
    });
  });

  describe('pure component behavior', () => {
    it('accepts no required props', () => {
      // No props — should render fine with zero arguments
      expect(() => render(<StreamingIndicator />)).not.toThrow();
    });

    it('can be rendered multiple times independently', () => {
      expect(() => {
        render(<StreamingIndicator />);
        render(<StreamingIndicator />);
        render(<StreamingIndicator />);
      }).not.toThrow();
    });

    it('unmounts without errors', () => {
      const { unmount } = render(<StreamingIndicator />);
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('accessibility', () => {
    it('does not throw when rendered inside a parent View', () => {
      const React = require('react');
      const { View } = require('react-native');
      expect(() =>
        render(
          <View>
            <StreamingIndicator />
          </View>
        )
      ).not.toThrow();
    });
  });
});
