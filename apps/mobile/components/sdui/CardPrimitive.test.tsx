/**
 * Unit tests for CardPrimitive -- composite SDUI primitive.
 *
 * Verifies: renders title, renders children via getPrimitive(),
 * handles empty children, missing title, malformed children,
 * accessibility props, Dynamic Type, RTL support.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import { CardPrimitive } from './CardPrimitive';
import { tokens } from '@/constants/tokens';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('CardPrimitive', () => {
  // --- Basic rendering ---

  it('renders a card container', () => {
    const { toJSON } = render(<CardPrimitive />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders title when provided', () => {
    const { getByText } = render(<CardPrimitive title="Weather" />);
    expect(getByText('Weather')).toBeTruthy();
  });

  it('applies subtitle typography to title', () => {
    const { getByText } = render(<CardPrimitive title="Weather" />);
    const element = getByText('Weather');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.fontSize).toBe(tokens.typography.subtitle.fontSize);
    expect(flatStyle.fontWeight).toBe(tokens.typography.subtitle.fontWeight);
  });

  it('applies text color to title', () => {
    const { getByText } = render(<CardPrimitive title="Weather" />);
    const element = getByText('Weather');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.color).toBe(tokens.colors.text);
  });

  it('omits title section when title is not provided', () => {
    const { queryByTestId } = render(<CardPrimitive />);
    expect(queryByTestId('card-title')).toBeNull();
  });

  // --- Twilight card styling ---

  it('applies surface background color', () => {
    const { toJSON } = render(<CardPrimitive title="Test" />);
    const root = toJSON();
    const flatStyle = Array.isArray(root.props.style)
      ? Object.assign({}, ...root.props.style)
      : root.props.style;
    expect(flatStyle.backgroundColor).toBe(tokens.colors.surface);
  });

  it('applies border color and width', () => {
    const { toJSON } = render(<CardPrimitive title="Test" />);
    const root = toJSON();
    const flatStyle = Array.isArray(root.props.style)
      ? Object.assign({}, ...root.props.style)
      : root.props.style;
    expect(flatStyle.borderColor).toBe(tokens.colors.border);
    expect(flatStyle.borderWidth).toBe(1);
  });

  it('applies lg border radius', () => {
    const { toJSON } = render(<CardPrimitive title="Test" />);
    const root = toJSON();
    const flatStyle = Array.isArray(root.props.style)
      ? Object.assign({}, ...root.props.style)
      : root.props.style;
    expect(flatStyle.borderRadius).toBe(tokens.radii.lg);
  });

  it('applies md padding', () => {
    const { toJSON } = render(<CardPrimitive title="Test" />);
    const root = toJSON();
    const flatStyle = Array.isArray(root.props.style)
      ? Object.assign({}, ...root.props.style)
      : root.props.style;
    expect(flatStyle.padding).toBe(tokens.spacing.md);
  });

  // --- Children composition ---

  it('renders children primitives via getPrimitive()', () => {
    const children = [
      { type: 'text', text: 'Hello from card' },
    ];
    const { getByText } = render(<CardPrimitive children={children} />);
    expect(getByText('Hello from card')).toBeTruthy();
  });

  it('renders multiple children primitives', () => {
    const children = [
      { type: 'text', text: 'First child' },
      { type: 'metric', value: '42', label: 'Score' },
    ];
    const { getByText } = render(<CardPrimitive children={children} />);
    expect(getByText('First child')).toBeTruthy();
    expect(getByText('42')).toBeTruthy();
    expect(getByText('Score')).toBeTruthy();
  });

  it('renders title and children together', () => {
    const children = [
      { type: 'text', text: 'Card content' },
    ];
    const { getByText } = render(
      <CardPrimitive title="My Card" children={children} />,
    );
    expect(getByText('My Card')).toBeTruthy();
    expect(getByText('Card content')).toBeTruthy();
  });

  // --- Edge cases ---

  it('handles empty children array gracefully', () => {
    const { toJSON } = render(<CardPrimitive title="Empty" children={[]} />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles undefined children gracefully', () => {
    const { toJSON } = render(<CardPrimitive title="No children" />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles missing title gracefully (no crash)', () => {
    const { toJSON } = render(<CardPrimitive />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders unknown child type as UnknownPrimitive (fallback)', () => {
    const children = [
      { type: 'nonexistent_widget', data: 'whatever' },
    ];
    const { getByText } = render(<CardPrimitive children={children} />);
    expect(getByText(/unsupported/i)).toBeTruthy();
  });

  it('handles malformed child (missing type) gracefully', () => {
    const children = [
      { noType: true } as any,
    ];
    const { toJSON } = render(<CardPrimitive children={children} />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles null children gracefully', () => {
    const { toJSON } = render(<CardPrimitive children={null as any} />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles child with empty type string', () => {
    const children = [
      { type: '', text: 'empty type' },
    ];
    const { toJSON } = render(<CardPrimitive children={children} />);
    // Should fall back to UnknownPrimitive or handle gracefully
    expect(toJSON()).toBeTruthy();
  });

  // --- Accessibility ---

  it('applies accessibilityLabel from prop', () => {
    const { getByLabelText } = render(
      <CardPrimitive title="Weather" accessibleLabel="Weather card" />,
    );
    expect(getByLabelText('Weather card')).toBeTruthy();
  });

  it('generates accessibilityLabel from title when accessibleLabel not provided', () => {
    const { getByLabelText } = render(
      <CardPrimitive title="Weather" />,
    );
    expect(getByLabelText('Weather')).toBeTruthy();
  });

  it('applies accessibilityRole when provided', () => {
    const { getByLabelText } = render(
      <CardPrimitive
        title="Weather"
        accessibleLabel="Weather card"
        accessibleRole="summary"
      />,
    );
    const element = getByLabelText('Weather card');
    expect(element.props.accessibilityRole).toBe('summary');
  });

  // --- Dynamic Type and RTL ---

  it('title text supports writingDirection auto for RTL', () => {
    const { getByText } = render(<CardPrimitive title="مرحبا" />);
    const element = getByText('مرحبا');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.writingDirection).toBe('auto');
  });

  it('title text does not disable font scaling (Dynamic Type)', () => {
    const { getByText } = render(<CardPrimitive title="Scalable" />);
    const element = getByText('Scalable');
    expect(element.props.allowFontScaling).not.toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Extended edge case and critical path tests (TEA automate)
// ═══════════════════════════════════════════════════════════════

describe('CardPrimitive — extended edge cases', () => {
  // --- Prototype pollution safety ---

  it('handles child type "__proto__" gracefully via UnknownPrimitive', () => {
    const children = [{ type: '__proto__' }];
    const { getByText } = render(<CardPrimitive children={children} />);
    expect(getByText(/unsupported/i)).toBeTruthy();
  });

  it('handles child type "constructor" gracefully via UnknownPrimitive', () => {
    const children = [{ type: 'constructor' }];
    const { getByText } = render(<CardPrimitive children={children} />);
    expect(getByText(/unsupported/i)).toBeTruthy();
  });

  it('handles child type "toString" gracefully via UnknownPrimitive', () => {
    const children = [{ type: 'toString' }];
    const { getByText } = render(<CardPrimitive children={children} />);
    expect(getByText(/unsupported/i)).toBeTruthy();
  });

  // --- Children with extra props (tolerance of ModuleCard extractPrimitiveProps extras) ---

  it('children tolerate extra props like name and schemaVersion', () => {
    const children = [
      { type: 'text', text: 'Extra props child', name: 'test-module', schemaVersion: 1 },
    ];
    const { getByText } = render(<CardPrimitive children={children} />);
    expect(getByText('Extra props child')).toBeTruthy();
  });

  // --- Large children arrays ---

  it('renders a large number of children without crashing', () => {
    const children = Array.from({ length: 50 }, (_, i) => ({
      type: 'text',
      text: `Child ${i}`,
    }));
    const { getByText } = render(<CardPrimitive children={children} />);
    expect(getByText('Child 0')).toBeTruthy();
    expect(getByText('Child 49')).toBeTruthy();
  });

  // --- Title boundary conditions ---

  it('omits title section when title is empty string', () => {
    const { queryByTestId } = render(<CardPrimitive title="" />);
    expect(queryByTestId('card-title')).toBeNull();
  });

  it('renders title with special characters (HTML entities, quotes)', () => {
    const { getByText } = render(
      <CardPrimitive title={'<script>alert("xss")</script>'} />,
    );
    expect(getByText('<script>alert("xss")</script>')).toBeTruthy();
  });

  it('renders very long title without crashing', () => {
    const longTitle = 'A'.repeat(1000);
    const { getByText } = render(<CardPrimitive title={longTitle} />);
    expect(getByText(longTitle)).toBeTruthy();
  });

  it('renders title with emoji and Unicode', () => {
    const { getByText } = render(
      <CardPrimitive title="🌡️ Weather 天気 مرحبا" />,
    );
    expect(getByText('🌡️ Weather 天気 مرحبا')).toBeTruthy();
  });

  // --- Card-in-card nesting ---

  it('renders nested card child (card-in-card composition)', () => {
    const children = [
      {
        type: 'card',
        title: 'Inner Card',
        children: [{ type: 'text', text: 'Deeply nested text' }],
      },
    ];
    const { getByText } = render(
      <CardPrimitive title="Outer Card" children={children} />,
    );
    expect(getByText('Outer Card')).toBeTruthy();
    expect(getByText('Inner Card')).toBeTruthy();
    expect(getByText('Deeply nested text')).toBeTruthy();
  });

  // --- Mixed valid and invalid children ---

  it('renders valid children alongside invalid ones without crashing', () => {
    const children = [
      { type: 'text', text: 'Valid child' },
      { type: 'nonexistent_type' },
      { type: 'metric', value: '99', label: 'Score' },
    ];
    const { getByText } = render(<CardPrimitive children={children} />);
    expect(getByText('Valid child')).toBeTruthy();
    expect(getByText(/unsupported/i)).toBeTruthy();
    expect(getByText('99')).toBeTruthy();
    expect(getByText('Score')).toBeTruthy();
  });

  // --- Children with null/undefined entries ---

  it('handles null child in children array gracefully', () => {
    const children = [null, { type: 'text', text: 'After null' }] as any;
    const { toJSON } = render(<CardPrimitive children={children} />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles undefined child in children array gracefully', () => {
    const children = [undefined, { type: 'text', text: 'After undefined' }] as any;
    const { toJSON } = render(<CardPrimitive children={children} />);
    expect(toJSON()).toBeTruthy();
  });

  // --- Accessibility edge cases ---

  it('has no accessibilityLabel when neither title nor accessibleLabel provided', () => {
    const { toJSON } = render(<CardPrimitive />);
    const root = toJSON();
    expect(root.props.accessibilityLabel).toBeUndefined();
  });

  it('accessibleLabel takes priority over title for accessibilityLabel', () => {
    const { getByLabelText, queryByLabelText } = render(
      <CardPrimitive title="Title" accessibleLabel="Custom Label" />,
    );
    expect(getByLabelText('Custom Label')).toBeTruthy();
    // Title should not be the label
    expect(queryByLabelText('Title')).toBeNull();
  });

  it('accessibilityRole is undefined when accessibleRole not provided', () => {
    const { toJSON } = render(<CardPrimitive title="Test" />);
    const root = toJSON();
    expect(root.props.accessibilityRole).toBeUndefined();
  });

  // --- Title spacing ---

  it('title has bottom margin for spacing before children', () => {
    const { getByText } = render(<CardPrimitive title="Spaced" />);
    const element = getByText('Spaced');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.marginBottom).toBe(tokens.spacing.sm);
  });

  // --- All primitive types as children ---

  it('renders all registered primitive types as children simultaneously', () => {
    const children = [
      { type: 'text', text: 'Text child' },
      { type: 'metric', value: '100', label: 'CPU' },
      { type: 'layout' },
      { type: 'status' },
      { type: 'table' },
    ];
    const { getByText, toJSON } = render(
      <CardPrimitive title="All types" children={children} />,
    );
    expect(getByText('Text child')).toBeTruthy();
    expect(getByText('100')).toBeTruthy();
    expect(toJSON()).toBeTruthy();
  });
});
