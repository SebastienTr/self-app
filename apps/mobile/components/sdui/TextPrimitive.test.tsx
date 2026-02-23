/**
 * Unit tests for TextPrimitive — text display SDUI primitive.
 *
 * Verifies: renders text, variant styles, default body variant,
 * empty text handling, RTL support, Dynamic Type, accessibility.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import { TextPrimitive } from './TextPrimitive';
import { tokens } from '@/constants/tokens';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('TextPrimitive', () => {
  it('renders text content', () => {
    const { getByText } = render(<TextPrimitive text="Hello world" />);

    expect(getByText('Hello world')).toBeTruthy();
  });

  it('applies title variant styles', () => {
    const { getByText } = render(
      <TextPrimitive text="Title text" variant="title" />,
    );

    const element = getByText('Title text');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.fontSize).toBe(tokens.typography.title.fontSize);
    expect(flatStyle.fontWeight).toBe(tokens.typography.title.fontWeight);
  });

  it('applies subtitle variant styles', () => {
    const { getByText } = render(
      <TextPrimitive text="Subtitle text" variant="subtitle" />,
    );

    const element = getByText('Subtitle text');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.fontSize).toBe(tokens.typography.subtitle.fontSize);
  });

  it('applies body variant styles by default', () => {
    const { getByText } = render(<TextPrimitive text="Body text" />);

    const element = getByText('Body text');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.fontSize).toBe(tokens.typography.body.fontSize);
  });

  it('applies caption variant with secondary text color', () => {
    const { getByText } = render(
      <TextPrimitive text="Caption text" variant="caption" />,
    );

    const element = getByText('Caption text');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.fontSize).toBe(tokens.typography.caption.fontSize);
    expect(flatStyle.color).toBe(tokens.colors.textSecondary);
  });

  it('uses primary text color for non-caption variants', () => {
    const { getByText } = render(
      <TextPrimitive text="Primary text" variant="title" />,
    );

    const element = getByText('Primary text');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.color).toBe(tokens.colors.text);
  });

  it('handles empty text gracefully', () => {
    const { toJSON } = render(<TextPrimitive text="" />);

    // Should render without crashing
    expect(toJSON()).toBeTruthy();
  });

  it('handles undefined text gracefully', () => {
    const { toJSON } = render(<TextPrimitive text={undefined as any} />);

    // Should render without crashing
    expect(toJSON()).toBeTruthy();
  });

  it('supports RTL text with writingDirection auto', () => {
    const { getByText } = render(<TextPrimitive text="مرحبا" />);

    const element = getByText('مرحبا');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.writingDirection).toBe('auto');
  });

  it('does not disable font scaling (Dynamic Type)', () => {
    const { getByText } = render(<TextPrimitive text="Scalable" />);

    const element = getByText('Scalable');
    // allowFontScaling defaults to true in RN; should NOT be explicitly false
    expect(element.props.allowFontScaling).not.toBe(false);
  });

  it('applies accessibilityLabel from prop', () => {
    const { getByLabelText } = render(
      <TextPrimitive text="Some text" accessibleLabel="Custom label" />,
    );

    expect(getByLabelText('Custom label')).toBeTruthy();
  });

  it('falls back to text content as accessibilityLabel', () => {
    const { getByLabelText } = render(
      <TextPrimitive text="Accessible text" />,
    );

    expect(getByLabelText('Accessible text')).toBeTruthy();
  });

  it('applies accessibleRole when provided', () => {
    const { getByLabelText } = render(
      <TextPrimitive
        text="Header"
        accessibleLabel="Header"
        accessibleRole="header"
      />,
    );

    const element = getByLabelText('Header');
    expect(element.props.accessibilityRole).toBe('header');
  });

  it('defaults variant to body when invalid variant is provided', () => {
    const { getByText } = render(
      <TextPrimitive text="Fallback" variant={'invalid' as any} />,
    );

    const element = getByText('Fallback');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.fontSize).toBe(tokens.typography.body.fontSize);
  });

  // --- Edge case tests ---

  describe('Unicode and special characters', () => {
    it('renders emoji text correctly', () => {
      const { getByText } = render(<TextPrimitive text="Hello 🌍🔥💯" />);
      expect(getByText('Hello 🌍🔥💯')).toBeTruthy();
    });

    it('renders Chinese characters', () => {
      const { getByText } = render(<TextPrimitive text="你好世界" />);
      expect(getByText('你好世界')).toBeTruthy();
    });

    it('renders Japanese characters', () => {
      const { getByText } = render(<TextPrimitive text="こんにちは世界" />);
      expect(getByText('こんにちは世界')).toBeTruthy();
    });

    it('renders Hebrew RTL text with writingDirection auto', () => {
      const { getByText } = render(<TextPrimitive text="שלום עולם" />);
      const element = getByText('שלום עולם');
      const flatStyle = Array.isArray(element.props.style)
        ? Object.assign({}, ...element.props.style)
        : element.props.style;
      expect(flatStyle.writingDirection).toBe('auto');
    });

    it('renders mixed LTR and RTL text', () => {
      const { getByText } = render(
        <TextPrimitive text="Hello مرحبا World" />,
      );
      expect(getByText('Hello مرحبا World')).toBeTruthy();
    });

    it('renders text with special characters', () => {
      const { getByText } = render(
        <TextPrimitive text="<script>alert('xss')</script>" />,
      );
      expect(getByText("<script>alert('xss')</script>")).toBeTruthy();
    });

    it('renders text with newlines', () => {
      const { getByText } = render(
        <TextPrimitive text={'Line 1\nLine 2\nLine 3'} />,
      );
      expect(getByText(/Line 1/)).toBeTruthy();
    });
  });

  describe('extreme string lengths', () => {
    it('renders a very long string without crashing', () => {
      const longText = 'A'.repeat(10000);
      const { toJSON } = render(<TextPrimitive text={longText} />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders a single character', () => {
      const { getByText } = render(<TextPrimitive text="X" />);
      expect(getByText('X')).toBeTruthy();
    });

    it('renders whitespace-only text', () => {
      const { toJSON } = render(<TextPrimitive text="   " />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('null and malformed props', () => {
    it('handles null text gracefully', () => {
      const { toJSON } = render(<TextPrimitive text={null as any} />);
      expect(toJSON()).toBeTruthy();
    });

    it('handles numeric text gracefully', () => {
      const { toJSON } = render(<TextPrimitive text={42 as any} />);
      expect(toJSON()).toBeTruthy();
    });

    it('handles null variant gracefully', () => {
      const { getByText } = render(
        <TextPrimitive text="Test" variant={null as any} />,
      );
      const element = getByText('Test');
      const flatStyle = Array.isArray(element.props.style)
        ? Object.assign({}, ...element.props.style)
        : element.props.style;
      expect(flatStyle.fontSize).toBe(tokens.typography.body.fontSize);
    });

    it('handles empty string variant gracefully', () => {
      const { getByText } = render(
        <TextPrimitive text="Test" variant={'' as any} />,
      );
      const element = getByText('Test');
      const flatStyle = Array.isArray(element.props.style)
        ? Object.assign({}, ...element.props.style)
        : element.props.style;
      // Empty string is not in VALID_VARIANTS so should default to body
      expect(flatStyle.fontSize).toBe(tokens.typography.body.fontSize);
    });
  });

  describe('accessibility edge cases', () => {
    it('handles empty string accessibleLabel', () => {
      const { toJSON } = render(
        <TextPrimitive text="Content" accessibleLabel="" />,
      );
      // Should fall back to text content when accessibleLabel is empty string
      expect(toJSON()).toBeTruthy();
    });

    it('handles undefined accessibleRole without crashing', () => {
      const { getByText } = render(
        <TextPrimitive text="Content" accessibleRole={undefined} />,
      );
      const element = getByText('Content');
      expect(element.props.accessibilityRole).toBeUndefined();
    });

    it('generates accessibilityLabel for emoji-only text', () => {
      const { getByLabelText } = render(
        <TextPrimitive text="🔥" />,
      );
      expect(getByLabelText('🔥')).toBeTruthy();
    });
  });

  describe('all variants apply correct color', () => {
    it.each(['title', 'subtitle', 'body'] as const)(
      'applies primary text color for %s variant',
      (variant) => {
        const { getByText } = render(
          <TextPrimitive text={`${variant} text`} variant={variant} />,
        );
        const element = getByText(`${variant} text`);
        const flatStyle = Array.isArray(element.props.style)
          ? Object.assign({}, ...element.props.style)
          : element.props.style;
        expect(flatStyle.color).toBe(tokens.colors.text);
      },
    );

    it('applies secondary text color only for caption variant', () => {
      const { getByText } = render(
        <TextPrimitive text="caption text" variant="caption" />,
      );
      const element = getByText('caption text');
      const flatStyle = Array.isArray(element.props.style)
        ? Object.assign({}, ...element.props.style)
        : element.props.style;
      expect(flatStyle.color).toBe(tokens.colors.textSecondary);
    });
  });
});
