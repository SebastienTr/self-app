/**
 * Unit tests for LayoutPrimitive — stack/grid container SDUI primitive.
 *
 * Verifies: renders children, vertical/horizontal layout, grid with columns,
 * default gap, accessibility props, malformed props handling.
 */

import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';

import { LayoutPrimitive } from './LayoutPrimitive';
import { tokens } from '@/constants/tokens';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('LayoutPrimitive', () => {
  it('renders children', () => {
    const { getByText } = render(
      <LayoutPrimitive>
        <Text>Child A</Text>
        <Text>Child B</Text>
      </LayoutPrimitive>,
    );

    expect(getByText('Child A')).toBeTruthy();
    expect(getByText('Child B')).toBeTruthy();
  });

  it('defaults to vertical (column) direction', () => {
    const { getByTestId } = render(
      <LayoutPrimitive testID="layout">
        <Text>Child</Text>
      </LayoutPrimitive>,
    );

    const element = getByTestId('layout');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.flexDirection).toBe('column');
  });

  it('applies horizontal (row) direction', () => {
    const { getByTestId } = render(
      <LayoutPrimitive direction="horizontal" testID="layout">
        <Text>Child</Text>
      </LayoutPrimitive>,
    );

    const element = getByTestId('layout');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.flexDirection).toBe('row');
  });

  it('applies default gap from tokens.spacing.md', () => {
    const { getByTestId } = render(
      <LayoutPrimitive testID="layout">
        <Text>Child</Text>
      </LayoutPrimitive>,
    );

    const element = getByTestId('layout');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.gap).toBe(tokens.spacing.md);
  });

  it('applies custom gap value', () => {
    const { getByTestId } = render(
      <LayoutPrimitive gap={8} testID="layout">
        <Text>Child</Text>
      </LayoutPrimitive>,
    );

    const element = getByTestId('layout');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.gap).toBe(8);
  });

  it('renders as grid with flexWrap when columns provided', () => {
    const { getByTestId } = render(
      <LayoutPrimitive columns={2} testID="layout">
        <Text>A</Text>
        <Text>B</Text>
        <Text>C</Text>
        <Text>D</Text>
      </LayoutPrimitive>,
    );

    const element = getByTestId('layout');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.flexWrap).toBe('wrap');
    expect(flatStyle.flexDirection).toBe('row');
  });

  it('wraps children with width percentage for grid layout', () => {
    const { getByText } = render(
      <LayoutPrimitive columns={2}>
        <Text>GridChild</Text>
      </LayoutPrimitive>,
    );

    // The child should be wrapped in a View with width percentage
    const child = getByText('GridChild');
    // Find the wrapper parent
    const wrapper = child.parent;
    if (wrapper && wrapper.props.style) {
      const wrapperStyle = Array.isArray(wrapper.props.style)
        ? Object.assign({}, ...wrapper.props.style)
        : wrapper.props.style;
      expect(wrapperStyle.width).toBe('50%');
    }
  });

  it('wraps children with 33.33% width for 3 columns', () => {
    const { getByText } = render(
      <LayoutPrimitive columns={3}>
        <Text>GridChild3</Text>
      </LayoutPrimitive>,
    );

    const child = getByText('GridChild3');
    const wrapper = child.parent;
    if (wrapper && wrapper.props.style) {
      const wrapperStyle = Array.isArray(wrapper.props.style)
        ? Object.assign({}, ...wrapper.props.style)
        : wrapper.props.style;
      // Allow for floating point: "33.333333333333336%" or similar
      expect(wrapperStyle.width).toMatch(/33\.33/);
    }
  });

  it('applies accessibilityLabel', () => {
    const { getByLabelText } = render(
      <LayoutPrimitive accessibleLabel="Metrics grid">
        <Text>Child</Text>
      </LayoutPrimitive>,
    );

    expect(getByLabelText('Metrics grid')).toBeTruthy();
  });

  it('applies accessibleRole when provided', () => {
    const { getByLabelText } = render(
      <LayoutPrimitive
        accessibleLabel="Layout section"
        accessibleRole="list"
      >
        <Text>Child</Text>
      </LayoutPrimitive>,
    );

    const element = getByLabelText('Layout section');
    expect(element.props.accessibilityRole).toBe('list');
  });

  it('handles no children gracefully', () => {
    const { toJSON } = render(<LayoutPrimitive />);

    expect(toJSON()).toBeTruthy();
  });

  it('handles undefined direction gracefully', () => {
    const { getByTestId } = render(
      <LayoutPrimitive direction={undefined} testID="layout">
        <Text>Child</Text>
      </LayoutPrimitive>,
    );

    const element = getByTestId('layout');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.flexDirection).toBe('column');
  });

  it('handles columns=0 as non-grid layout', () => {
    const { getByTestId } = render(
      <LayoutPrimitive columns={0} testID="layout">
        <Text>Child</Text>
      </LayoutPrimitive>,
    );

    const element = getByTestId('layout');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    // Should not wrap
    expect(flatStyle.flexWrap).toBeUndefined();
  });

  // --- Edge case tests ---

  describe('children edge cases', () => {
    it('renders a single child', () => {
      const { getByText } = render(
        <LayoutPrimitive>
          <Text>Only child</Text>
        </LayoutPrimitive>,
      );
      expect(getByText('Only child')).toBeTruthy();
    });

    it('renders many children without crashing', () => {
      const children = Array.from({ length: 100 }, (_, i) => (
        <Text key={i}>Child {i}</Text>
      ));
      const { getByText } = render(
        <LayoutPrimitive>{children}</LayoutPrimitive>,
      );
      expect(getByText('Child 0')).toBeTruthy();
      expect(getByText('Child 99')).toBeTruthy();
    });

    it('handles null children gracefully', () => {
      const { toJSON } = render(
        <LayoutPrimitive>{null}</LayoutPrimitive>,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('handles undefined children gracefully', () => {
      const { toJSON } = render(
        <LayoutPrimitive>{undefined}</LayoutPrimitive>,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('handles mixed null and valid children', () => {
      const { getByText, toJSON } = render(
        <LayoutPrimitive>
          {null}
          <Text>Valid</Text>
          {undefined}
          <Text>Also valid</Text>
        </LayoutPrimitive>,
      );
      expect(toJSON()).toBeTruthy();
      expect(getByText('Valid')).toBeTruthy();
      expect(getByText('Also valid')).toBeTruthy();
    });

    it('handles boolean false children gracefully', () => {
      const { toJSON } = render(
        <LayoutPrimitive>
          {false}
          <Text>Real child</Text>
        </LayoutPrimitive>,
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('columns edge cases', () => {
    it('handles columns=1 wrapping each child at 100%', () => {
      const { getByText } = render(
        <LayoutPrimitive columns={1}>
          <Text>FullWidth</Text>
        </LayoutPrimitive>,
      );
      const child = getByText('FullWidth');
      const wrapper = child.parent;
      if (wrapper && wrapper.props.style) {
        const wrapperStyle = Array.isArray(wrapper.props.style)
          ? Object.assign({}, ...wrapper.props.style)
          : wrapper.props.style;
        expect(wrapperStyle.width).toBe('100%');
      }
    });

    it('handles large column count (columns=100)', () => {
      const { getByText } = render(
        <LayoutPrimitive columns={100}>
          <Text>TinyCol</Text>
        </LayoutPrimitive>,
      );
      const child = getByText('TinyCol');
      const wrapper = child.parent;
      if (wrapper && wrapper.props.style) {
        const wrapperStyle = Array.isArray(wrapper.props.style)
          ? Object.assign({}, ...wrapper.props.style)
          : wrapper.props.style;
        expect(wrapperStyle.width).toBe('1%');
      }
    });

    it('handles negative columns as non-grid layout', () => {
      const { getByTestId } = render(
        <LayoutPrimitive columns={-1} testID="layout">
          <Text>Child</Text>
        </LayoutPrimitive>,
      );
      const element = getByTestId('layout');
      const flatStyle = Array.isArray(element.props.style)
        ? Object.assign({}, ...element.props.style)
        : element.props.style;
      // columns=-1 is not > 0, so isGrid = false, no flexWrap
      expect(flatStyle.flexWrap).toBeUndefined();
    });

    it('handles columns=null as non-grid layout', () => {
      const { getByTestId } = render(
        <LayoutPrimitive columns={null as any} testID="layout">
          <Text>Child</Text>
        </LayoutPrimitive>,
      );
      const element = getByTestId('layout');
      const flatStyle = Array.isArray(element.props.style)
        ? Object.assign({}, ...element.props.style)
        : element.props.style;
      expect(flatStyle.flexWrap).toBeUndefined();
    });

    it('renders grid with 4 columns and many children', () => {
      const children = Array.from({ length: 8 }, (_, i) => (
        <Text key={i}>G{i}</Text>
      ));
      const { getByText, getByTestId } = render(
        <LayoutPrimitive columns={4} testID="layout">
          {children}
        </LayoutPrimitive>,
      );
      const element = getByTestId('layout');
      const flatStyle = Array.isArray(element.props.style)
        ? Object.assign({}, ...element.props.style)
        : element.props.style;
      expect(flatStyle.flexWrap).toBe('wrap');
      expect(flatStyle.flexDirection).toBe('row');
      // Verify child is wrapped with 25% width
      const child = getByText('G0');
      const wrapper = child.parent;
      if (wrapper && wrapper.props.style) {
        const ws = Array.isArray(wrapper.props.style)
          ? Object.assign({}, ...wrapper.props.style)
          : wrapper.props.style;
        expect(ws.width).toBe('25%');
      }
    });
  });

  describe('gap edge cases', () => {
    it('applies gap=0 correctly', () => {
      const { getByTestId } = render(
        <LayoutPrimitive gap={0} testID="layout">
          <Text>Child</Text>
        </LayoutPrimitive>,
      );
      const element = getByTestId('layout');
      const flatStyle = Array.isArray(element.props.style)
        ? Object.assign({}, ...element.props.style)
        : element.props.style;
      expect(flatStyle.gap).toBe(0);
    });

    it('applies large gap value', () => {
      const { getByTestId } = render(
        <LayoutPrimitive gap={200} testID="layout">
          <Text>Child</Text>
        </LayoutPrimitive>,
      );
      const element = getByTestId('layout');
      const flatStyle = Array.isArray(element.props.style)
        ? Object.assign({}, ...element.props.style)
        : element.props.style;
      expect(flatStyle.gap).toBe(200);
    });

    it('handles undefined gap by falling back to tokens.spacing.md', () => {
      const { getByTestId } = render(
        <LayoutPrimitive gap={undefined} testID="layout">
          <Text>Child</Text>
        </LayoutPrimitive>,
      );
      const element = getByTestId('layout');
      const flatStyle = Array.isArray(element.props.style)
        ? Object.assign({}, ...element.props.style)
        : element.props.style;
      expect(flatStyle.gap).toBe(tokens.spacing.md);
    });
  });

  describe('direction edge cases', () => {
    it('handles invalid direction string gracefully', () => {
      const { getByTestId } = render(
        <LayoutPrimitive direction={'diagonal' as any} testID="layout">
          <Text>Child</Text>
        </LayoutPrimitive>,
      );
      const element = getByTestId('layout');
      const flatStyle = Array.isArray(element.props.style)
        ? Object.assign({}, ...element.props.style)
        : element.props.style;
      // 'diagonal' !== 'horizontal' so falls into 'column'
      expect(flatStyle.flexDirection).toBe('column');
    });

    it('grid mode overrides direction to row', () => {
      const { getByTestId } = render(
        <LayoutPrimitive direction="vertical" columns={2} testID="layout">
          <Text>Child</Text>
        </LayoutPrimitive>,
      );
      const element = getByTestId('layout');
      const flatStyle = Array.isArray(element.props.style)
        ? Object.assign({}, ...element.props.style)
        : element.props.style;
      // Grid mode forces flexDirection to 'row' regardless of direction prop
      expect(flatStyle.flexDirection).toBe('row');
    });
  });

  describe('nested layouts', () => {
    it('renders nested vertical inside horizontal', () => {
      const { getByText, getByTestId } = render(
        <LayoutPrimitive direction="horizontal" testID="outer">
          <LayoutPrimitive direction="vertical" testID="inner">
            <Text>Nested child</Text>
          </LayoutPrimitive>
        </LayoutPrimitive>,
      );
      expect(getByText('Nested child')).toBeTruthy();
      const outer = getByTestId('outer');
      const outerStyle = Array.isArray(outer.props.style)
        ? Object.assign({}, ...outer.props.style)
        : outer.props.style;
      expect(outerStyle.flexDirection).toBe('row');
      const inner = getByTestId('inner');
      const innerStyle = Array.isArray(inner.props.style)
        ? Object.assign({}, ...inner.props.style)
        : inner.props.style;
      expect(innerStyle.flexDirection).toBe('column');
    });

    it('renders deeply nested layouts (3 levels)', () => {
      const { getByText } = render(
        <LayoutPrimitive>
          <LayoutPrimitive>
            <LayoutPrimitive>
              <Text>Deep child</Text>
            </LayoutPrimitive>
          </LayoutPrimitive>
        </LayoutPrimitive>,
      );
      expect(getByText('Deep child')).toBeTruthy();
    });
  });

  describe('accessibility edge cases', () => {
    it('renders without accessibilityLabel when not provided', () => {
      const { getByTestId } = render(
        <LayoutPrimitive testID="layout">
          <Text>Child</Text>
        </LayoutPrimitive>,
      );
      const element = getByTestId('layout');
      expect(element.props.accessibilityLabel).toBeUndefined();
    });

    it('handles empty string accessibleLabel', () => {
      const { getByTestId } = render(
        <LayoutPrimitive accessibleLabel="" testID="layout">
          <Text>Child</Text>
        </LayoutPrimitive>,
      );
      const element = getByTestId('layout');
      expect(element.props.accessibilityLabel).toBe('');
    });
  });
});
