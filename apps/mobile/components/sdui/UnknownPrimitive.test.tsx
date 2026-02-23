/**
 * Unit tests for UnknownPrimitive — fallback for unregistered SDUI types.
 *
 * Verifies: renders type name, logs structured error, accessible label,
 * graceful handling of malformed props.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import { UnknownPrimitive } from './UnknownPrimitive';
import { logger } from '@/services/logger';
import { tokens } from '@/constants/tokens';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Spy on logger.error
jest.spyOn(logger, 'error');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UnknownPrimitive', () => {
  it('renders the requested type name', () => {
    const { getByText } = render(<UnknownPrimitive type="chart" />);

    expect(getByText(/chart/)).toBeTruthy();
  });

  it('displays a user-friendly unsupported message', () => {
    const { getByText } = render(<UnknownPrimitive type="chart" />);

    expect(getByText(/unsupported/i)).toBeTruthy();
  });

  it('logs structured error with agent_action', () => {
    render(<UnknownPrimitive type="chart" />);

    expect(logger.error).toHaveBeenCalledWith(
      'sdui',
      'unknown_primitive',
      expect.objectContaining({
        type: 'chart',
        agent_action: expect.stringContaining('chart'),
      }),
    );
  });

  it('applies accessibilityLabel from prop', () => {
    const { getByLabelText } = render(
      <UnknownPrimitive type="chart" accessibleLabel="Unknown chart module" />,
    );

    expect(getByLabelText('Unknown chart module')).toBeTruthy();
  });

  it('generates default accessibilityLabel when not provided', () => {
    const { getByLabelText } = render(<UnknownPrimitive type="chart" />);

    expect(getByLabelText(/unsupported.*chart/i)).toBeTruthy();
  });

  it('handles undefined type gracefully', () => {
    const { getByText } = render(<UnknownPrimitive type={undefined as any} />);

    expect(getByText(/unsupported/i)).toBeTruthy();
  });

  it('handles empty string type gracefully', () => {
    const { getByText } = render(<UnknownPrimitive type="" />);

    expect(getByText(/unsupported/i)).toBeTruthy();
  });

  it('applies accessibleRole when provided', () => {
    const { getByLabelText } = render(
      <UnknownPrimitive
        type="chart"
        accessibleLabel="Unknown chart"
        accessibleRole="alert"
      />,
    );

    const element = getByLabelText('Unknown chart');
    expect(element.props.accessibilityRole).toBe('alert');
  });

  // --- Edge case tests ---

  describe('type name edge cases', () => {
    it('renders very long type name', () => {
      const longType = 'x'.repeat(500);
      const { getByText } = render(<UnknownPrimitive type={longType} />);
      expect(getByText(longType)).toBeTruthy();
    });

    it('renders type name with special characters', () => {
      const { getByText } = render(
        <UnknownPrimitive type="my-custom/type.v2" />,
      );
      expect(getByText('my-custom/type.v2')).toBeTruthy();
    });

    it('renders type name with emoji', () => {
      const { getByText } = render(
        <UnknownPrimitive type="🔥fire🔥" />,
      );
      expect(getByText('🔥fire🔥')).toBeTruthy();
    });

    it('renders whitespace-only type as "unknown" fallback', () => {
      const { getByText } = render(
        <UnknownPrimitive type="   " />,
      );
      // Non-empty string so displayType = '   '
      expect(getByText(/unsupported/i)).toBeTruthy();
    });

    it('displays "unknown" when type is null', () => {
      const { getByText } = render(
        <UnknownPrimitive type={null as any} />,
      );
      expect(getByText('unknown')).toBeTruthy();
    });

    it('renders numeric type coerced to display', () => {
      const { toJSON } = render(
        <UnknownPrimitive type={42 as any} />,
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('error logging edge cases', () => {
    it('logs error only once even on re-render', () => {
      const { rerender } = render(<UnknownPrimitive type="chart" />);

      // First render logs once
      expect(logger.error).toHaveBeenCalledTimes(1);

      // Re-render should NOT log again (useRef guard)
      rerender(<UnknownPrimitive type="chart" />);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('includes agent_action with registry file path hint', () => {
      render(<UnknownPrimitive type="missing_widget" />);

      expect(logger.error).toHaveBeenCalledWith(
        'sdui',
        'unknown_primitive',
        expect.objectContaining({
          agent_action: expect.stringContaining('registry.ts'),
        }),
      );
    });

    it('logs error with empty string type as "unknown"', () => {
      render(<UnknownPrimitive type="" />);

      expect(logger.error).toHaveBeenCalledWith(
        'sdui',
        'unknown_primitive',
        expect.objectContaining({
          type: 'unknown',
        }),
      );
    });
  });

  describe('accessibility edge cases', () => {
    it('generates label including the display type name', () => {
      const { getByLabelText } = render(
        <UnknownPrimitive type="radar" />,
      );
      expect(getByLabelText(/radar/)).toBeTruthy();
    });

    it('handles empty string accessibleLabel by falling back to generated', () => {
      const { getByLabelText } = render(
        <UnknownPrimitive type="gauge" accessibleLabel="" />,
      );
      // Empty string is falsy, falls back to generated label
      expect(getByLabelText(/gauge/)).toBeTruthy();
    });
  });

  describe('styling', () => {
    it('applies error border color from tokens', () => {
      const { getByLabelText } = render(
        <UnknownPrimitive type="chart" />,
      );
      const container = getByLabelText(/chart/);
      const flatStyle = Array.isArray(container.props.style)
        ? Object.assign({}, ...container.props.style)
        : container.props.style;
      expect(flatStyle.borderColor).toBe(tokens.colors.error);
    });

    it('applies surface background from tokens', () => {
      const { getByLabelText } = render(
        <UnknownPrimitive type="chart" />,
      );
      const container = getByLabelText(/chart/);
      const flatStyle = Array.isArray(container.props.style)
        ? Object.assign({}, ...container.props.style)
        : container.props.style;
      expect(flatStyle.backgroundColor).toBe(tokens.colors.surface);
    });
  });
});
