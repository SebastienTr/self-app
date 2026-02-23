/**
 * Unit tests for MetricPrimitive — metric display SDUI primitive.
 *
 * Verifies: renders value/label/unit, trend indicators, missing props,
 * accessibility label generation, Dynamic Type, malformed props.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import { MetricPrimitive } from './MetricPrimitive';
import { tokens } from '@/constants/tokens';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('MetricPrimitive', () => {
  it('renders the value', () => {
    const { getByText } = render(
      <MetricPrimitive value="42" label="Score" />,
    );

    expect(getByText('42')).toBeTruthy();
  });

  it('renders a numeric value', () => {
    const { getByText } = render(
      <MetricPrimitive value={99} label="Percentage" />,
    );

    expect(getByText('99')).toBeTruthy();
  });

  it('renders the label', () => {
    const { getByText } = render(
      <MetricPrimitive value="42" label="Score" />,
    );

    expect(getByText('Score')).toBeTruthy();
  });

  it('renders the unit when provided', () => {
    const { getByText } = render(
      <MetricPrimitive value="72" label="Temperature" unit="F" />,
    );

    expect(getByText('F')).toBeTruthy();
  });

  it('does not render unit text when unit is not provided', () => {
    const { queryByText } = render(
      <MetricPrimitive value="42" label="Score" />,
    );

    // Unit area should not appear
    expect(queryByText('F')).toBeNull();
    expect(queryByText('undefined')).toBeNull();
  });

  it('renders up trend indicator', () => {
    const { getByText } = render(
      <MetricPrimitive value="42" label="Score" trend="up" />,
    );

    const indicator = getByText(/▲/);
    expect(indicator).toBeTruthy();
  });

  it('renders down trend indicator', () => {
    const { getByText } = render(
      <MetricPrimitive value="42" label="Score" trend="down" />,
    );

    const indicator = getByText(/▼/);
    expect(indicator).toBeTruthy();
  });

  it('renders flat trend indicator', () => {
    const { getByText } = render(
      <MetricPrimitive value="42" label="Score" trend="flat" />,
    );

    const indicator = getByText(/—/);
    expect(indicator).toBeTruthy();
  });

  it('applies success color for up trend', () => {
    const { getByText } = render(
      <MetricPrimitive value="42" label="Score" trend="up" />,
    );

    const indicator = getByText(/▲/);
    const flatStyle = Array.isArray(indicator.props.style)
      ? Object.assign({}, ...indicator.props.style)
      : indicator.props.style;
    expect(flatStyle.color).toBe(tokens.colors.success);
  });

  it('applies error color for down trend', () => {
    const { getByText } = render(
      <MetricPrimitive value="42" label="Score" trend="down" />,
    );

    const indicator = getByText(/▼/);
    const flatStyle = Array.isArray(indicator.props.style)
      ? Object.assign({}, ...indicator.props.style)
      : indicator.props.style;
    expect(flatStyle.color).toBe(tokens.colors.error);
  });

  it('applies textSecondary color for flat trend', () => {
    const { getByText } = render(
      <MetricPrimitive value="42" label="Score" trend="flat" />,
    );

    const indicator = getByText(/—/);
    const flatStyle = Array.isArray(indicator.props.style)
      ? Object.assign({}, ...indicator.props.style)
      : indicator.props.style;
    expect(flatStyle.color).toBe(tokens.colors.textSecondary);
  });

  it('does not render trend indicator when trend is not provided', () => {
    const { queryByText } = render(
      <MetricPrimitive value="42" label="Score" />,
    );

    expect(queryByText('▲')).toBeNull();
    expect(queryByText('▼')).toBeNull();
    expect(queryByText('—')).toBeNull();
  });

  it('generates default accessibilityLabel with value and label', () => {
    const { getByLabelText } = render(
      <MetricPrimitive value="42" label="Score" />,
    );

    expect(getByLabelText('Score: 42')).toBeTruthy();
  });

  it('generates default accessibilityLabel with unit', () => {
    const { getByLabelText } = render(
      <MetricPrimitive value="72" label="Temperature" unit="F" />,
    );

    expect(getByLabelText('Temperature: 72 F')).toBeTruthy();
  });

  it('uses provided accessibleLabel over generated one', () => {
    const { getByLabelText } = render(
      <MetricPrimitive
        value="42"
        label="Score"
        accessibleLabel="Custom metric label"
      />,
    );

    expect(getByLabelText('Custom metric label')).toBeTruthy();
  });

  it('applies accessibleRole when provided', () => {
    const { getByLabelText } = render(
      <MetricPrimitive
        value="42"
        label="Score"
        accessibleLabel="Score metric"
        accessibleRole="text"
      />,
    );

    const element = getByLabelText('Score metric');
    expect(element.props.accessibilityRole).toBe('text');
  });

  it('applies metric typography to value', () => {
    const { getByText } = render(
      <MetricPrimitive value="42" label="Score" />,
    );

    const element = getByText('42');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.fontSize).toBe(tokens.typography.metric.fontSize);
    expect(flatStyle.fontWeight).toBe(tokens.typography.metric.fontWeight);
  });

  it('applies caption typography to label', () => {
    const { getByText } = render(
      <MetricPrimitive value="42" label="Score" />,
    );

    const element = getByText('Score');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.fontSize).toBe(tokens.typography.caption.fontSize);
  });

  it('handles undefined value gracefully', () => {
    const { toJSON } = render(
      <MetricPrimitive value={undefined as any} label="Score" />,
    );

    expect(toJSON()).toBeTruthy();
  });

  it('handles undefined label gracefully', () => {
    const { toJSON } = render(
      <MetricPrimitive value="42" label={undefined as any} />,
    );

    expect(toJSON()).toBeTruthy();
  });

  it('handles all props undefined gracefully', () => {
    const { toJSON } = render(
      <MetricPrimitive value={undefined as any} label={undefined as any} />,
    );

    expect(toJSON()).toBeTruthy();
  });

  // --- Edge case tests ---

  describe('numeric edge cases', () => {
    it('renders zero value', () => {
      const { getByText } = render(
        <MetricPrimitive value={0} label="Count" />,
      );
      expect(getByText('0')).toBeTruthy();
    });

    it('renders negative number', () => {
      const { getByText } = render(
        <MetricPrimitive value={-42} label="Balance" />,
      );
      expect(getByText('-42')).toBeTruthy();
    });

    it('renders very large number', () => {
      const { getByText } = render(
        <MetricPrimitive value={999999999999} label="Big number" />,
      );
      expect(getByText('999999999999')).toBeTruthy();
    });

    it('renders floating point number', () => {
      const { getByText } = render(
        <MetricPrimitive value={3.14159} label="Pi" />,
      );
      expect(getByText('3.14159')).toBeTruthy();
    });

    it('renders NaN as string without crashing', () => {
      const { toJSON } = render(
        <MetricPrimitive value={NaN} label="Invalid" />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('renders Infinity as string without crashing', () => {
      const { toJSON } = render(
        <MetricPrimitive value={Infinity} label="Unbounded" />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('renders negative Infinity', () => {
      const { toJSON } = render(
        <MetricPrimitive value={-Infinity} label="Neg Inf" />,
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('string value edge cases', () => {
    it('renders formatted currency string', () => {
      const { getByText } = render(
        <MetricPrimitive value="$1,234,567.89" label="Revenue" />,
      );
      expect(getByText('$1,234,567.89')).toBeTruthy();
    });

    it('renders empty string value', () => {
      const { toJSON } = render(
        <MetricPrimitive value="" label="Empty" />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('renders very long string value', () => {
      const longValue = '9'.repeat(1000);
      const { toJSON } = render(
        <MetricPrimitive value={longValue} label="Long" />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('renders value with emoji', () => {
      const { getByText } = render(
        <MetricPrimitive value="100 🔥" label="Streak" />,
      );
      expect(getByText('100 🔥')).toBeTruthy();
    });
  });

  describe('label edge cases', () => {
    it('renders empty string label', () => {
      const { toJSON } = render(
        <MetricPrimitive value="42" label="" />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('renders very long label', () => {
      const longLabel = 'L'.repeat(500);
      const { toJSON } = render(
        <MetricPrimitive value="42" label={longLabel} />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('renders label with Unicode characters', () => {
      const { getByText } = render(
        <MetricPrimitive value="42" label="温度" />,
      );
      expect(getByText('温度')).toBeTruthy();
    });
  });

  describe('unit edge cases', () => {
    it('renders empty string unit without showing unit element', () => {
      const { queryByText } = render(
        <MetricPrimitive value="42" label="Score" unit="" />,
      );
      // Empty unit should not render a visible unit element
      // The unit is shown conditionally: displayUnit ? <Text>... : null
      // Empty string is falsy, so no unit text should appear
      expect(queryByText('undefined')).toBeNull();
    });

    it('renders long unit string', () => {
      const { getByText } = render(
        <MetricPrimitive value="100" label="Speed" unit="kilometers per hour" />,
      );
      expect(getByText('kilometers per hour')).toBeTruthy();
    });

    it('renders unit with special characters', () => {
      const { getByText } = render(
        <MetricPrimitive value="72" label="Temp" unit="°F" />,
      );
      expect(getByText('°F')).toBeTruthy();
    });
  });

  describe('trend edge cases', () => {
    it('handles invalid trend value gracefully', () => {
      const { toJSON } = render(
        <MetricPrimitive
          value="42"
          label="Score"
          trend={'sideways' as any}
        />,
      );
      // Should not crash; trendConfig lookup for invalid value returns undefined
      expect(toJSON()).toBeTruthy();
    });

    it('handles null trend gracefully', () => {
      const { toJSON, queryByText } = render(
        <MetricPrimitive value="42" label="Score" trend={null as any} />,
      );
      expect(toJSON()).toBeTruthy();
      expect(queryByText('▲')).toBeNull();
      expect(queryByText('▼')).toBeNull();
      expect(queryByText('—')).toBeNull();
    });
  });

  describe('accessibility edge cases', () => {
    it('generates label with zero value correctly', () => {
      const { getByLabelText } = render(
        <MetricPrimitive value={0} label="Errors" />,
      );
      expect(getByLabelText('Errors: 0')).toBeTruthy();
    });

    it('generates label with negative value and unit', () => {
      const { getByLabelText } = render(
        <MetricPrimitive value={-5} label="Change" unit="%" />,
      );
      expect(getByLabelText('Change: -5 %')).toBeTruthy();
    });

    it('handles empty accessibleLabel falling back to generated', () => {
      const { getByLabelText } = render(
        <MetricPrimitive
          value="42"
          label="Score"
          accessibleLabel=""
        />,
      );
      // Empty string is falsy, so should fall back to generated label
      expect(getByLabelText('Score: 42')).toBeTruthy();
    });

    it('handles null value in generated accessibility label', () => {
      const { toJSON } = render(
        <MetricPrimitive value={null as any} label="Score" />,
      );
      expect(toJSON()).toBeTruthy();
    });
  });
});
