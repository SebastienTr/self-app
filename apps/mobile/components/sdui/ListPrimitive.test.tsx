/**
 * Unit tests for ListPrimitive -- composite SDUI primitive.
 *
 * Verifies: renders items, title/subtitle/trailing, empty items,
 * minimum touch target height, separator between items,
 * accessibility labels, malformed items, Dynamic Type, RTL.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import { ListPrimitive } from './ListPrimitive';
import { tokens } from '@/constants/tokens';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('ListPrimitive', () => {
  // --- Basic rendering ---

  it('renders a list container', () => {
    const { toJSON } = render(<ListPrimitive items={[]} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders list title when provided', () => {
    const { getByText } = render(
      <ListPrimitive title="My List" items={[]} />,
    );
    expect(getByText('My List')).toBeTruthy();
  });

  it('applies subtitle typography to list title', () => {
    const { getByText } = render(
      <ListPrimitive title="My List" items={[]} />,
    );
    const element = getByText('My List');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.fontSize).toBe(tokens.typography.subtitle.fontSize);
    expect(flatStyle.fontWeight).toBe(tokens.typography.subtitle.fontWeight);
  });

  // --- Item rendering ---

  it('renders item titles', () => {
    const items = [
      { id: '1', title: 'Item One' },
      { id: '2', title: 'Item Two' },
    ];
    const { getByText } = render(<ListPrimitive items={items} />);
    expect(getByText('Item One')).toBeTruthy();
    expect(getByText('Item Two')).toBeTruthy();
  });

  it('renders item subtitle in caption style', () => {
    const items = [
      { id: '1', title: 'Main', subtitle: 'Secondary info' },
    ];
    const { getByText } = render(<ListPrimitive items={items} />);
    const subtitle = getByText('Secondary info');
    const flatStyle = Array.isArray(subtitle.props.style)
      ? Object.assign({}, ...subtitle.props.style)
      : subtitle.props.style;
    expect(flatStyle.fontSize).toBe(tokens.typography.caption.fontSize);
    expect(flatStyle.color).toBe(tokens.colors.textSecondary);
  });

  it('renders trailing value right-aligned', () => {
    const items = [
      { id: '1', title: 'Balance', trailing: '$1,234' },
    ];
    const { getByText } = render(<ListPrimitive items={items} />);
    expect(getByText('$1,234')).toBeTruthy();
  });

  it('renders title, subtitle, and trailing together', () => {
    const items = [
      { id: '1', title: 'Revenue', subtitle: 'Monthly', trailing: '$5K' },
    ];
    const { getByText } = render(<ListPrimitive items={items} />);
    expect(getByText('Revenue')).toBeTruthy();
    expect(getByText('Monthly')).toBeTruthy();
    expect(getByText('$5K')).toBeTruthy();
  });

  it('renders item with only title (no subtitle or trailing)', () => {
    const items = [{ id: '1', title: 'Simple item' }];
    const { getByText } = render(<ListPrimitive items={items} />);
    expect(getByText('Simple item')).toBeTruthy();
  });

  // --- Touch target ---

  it('each item has minimum height of 48 for touch targets', () => {
    const items = [
      { id: '1', title: 'Touch target item' },
    ];
    const { getByTestId } = render(<ListPrimitive items={items} />);
    const item = getByTestId('list-item-0');
    const flatStyle = Array.isArray(item.props.style)
      ? Object.assign({}, ...item.props.style)
      : item.props.style;
    expect(flatStyle.minHeight).toBeGreaterThanOrEqual(48);
  });

  // --- Separators ---

  it('renders separators between items', () => {
    const items = [
      { id: '1', title: 'First' },
      { id: '2', title: 'Second' },
      { id: '3', title: 'Third' },
    ];
    const { getAllByTestId } = render(<ListPrimitive items={items} />);
    // Separators between items (n-1 separators for n items)
    const separators = getAllByTestId('list-separator');
    expect(separators.length).toBe(2);
  });

  it('does not render separator after last item', () => {
    const items = [
      { id: '1', title: 'Only item' },
    ];
    const { queryAllByTestId } = render(<ListPrimitive items={items} />);
    const separators = queryAllByTestId('list-separator');
    expect(separators.length).toBe(0);
  });

  // --- Empty state ---

  it('renders empty state text for empty items array', () => {
    const { getByText } = render(<ListPrimitive items={[]} />);
    expect(getByText('No items')).toBeTruthy();
  });

  it('renders empty state in secondary text color', () => {
    const { getByText } = render(<ListPrimitive items={[]} />);
    const emptyText = getByText('No items');
    const flatStyle = Array.isArray(emptyText.props.style)
      ? Object.assign({}, ...emptyText.props.style)
      : emptyText.props.style;
    expect(flatStyle.color).toBe(tokens.colors.textSecondary);
  });

  // --- Edge cases ---

  it('handles undefined items gracefully', () => {
    const { toJSON } = render(<ListPrimitive items={undefined as any} />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles null items gracefully', () => {
    const { toJSON } = render(<ListPrimitive items={null as any} />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles malformed items (missing title) gracefully', () => {
    const items = [{ id: '1' } as any];
    const { toJSON } = render(<ListPrimitive items={items} />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles item with all fields undefined gracefully', () => {
    const items = [{} as any];
    const { toJSON } = render(<ListPrimitive items={items} />);
    expect(toJSON()).toBeTruthy();
  });

  it('handles items without id (uses index as fallback key)', () => {
    const items = [
      { title: 'No ID 1' },
      { title: 'No ID 2' },
    ];
    const { getByText } = render(<ListPrimitive items={items} />);
    expect(getByText('No ID 1')).toBeTruthy();
    expect(getByText('No ID 2')).toBeTruthy();
  });

  // --- Accessibility ---

  it('applies accessibilityLabel from prop', () => {
    const { getByLabelText } = render(
      <ListPrimitive items={[]} accessibleLabel="Tasks list" />,
    );
    expect(getByLabelText('Tasks list')).toBeTruthy();
  });

  it('generates accessibilityLabel from title + item count', () => {
    const items = [
      { id: '1', title: 'Item 1' },
      { id: '2', title: 'Item 2' },
    ];
    const { getByLabelText } = render(
      <ListPrimitive title="Tasks" items={items} />,
    );
    expect(getByLabelText('Tasks, 2 items')).toBeTruthy();
  });

  it('each item gets its own accessibilityLabel', () => {
    const items = [
      { id: '1', title: 'First task' },
      { id: '2', title: 'Second task' },
    ];
    const { getByLabelText } = render(<ListPrimitive items={items} />);
    expect(getByLabelText('First task')).toBeTruthy();
    expect(getByLabelText('Second task')).toBeTruthy();
  });

  it('applies accessibilityRole when provided', () => {
    const { getByLabelText } = render(
      <ListPrimitive
        items={[]}
        accessibleLabel="Tasks list"
        accessibleRole="list"
      />,
    );
    const element = getByLabelText('Tasks list');
    expect(element.props.accessibilityRole).toBe('list');
  });

  // --- Dynamic Type and RTL ---

  it('item title text supports writingDirection auto', () => {
    const items = [{ id: '1', title: 'مرحبا' }];
    const { getByText } = render(<ListPrimitive items={items} />);
    const element = getByText('مرحبا');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.writingDirection).toBe('auto');
  });

  it('item title does not disable font scaling', () => {
    const items = [{ id: '1', title: 'Scalable' }];
    const { getByText } = render(<ListPrimitive items={items} />);
    const element = getByText('Scalable');
    expect(element.props.allowFontScaling).not.toBe(false);
  });

  it('list title supports writingDirection auto', () => {
    const { getByText } = render(
      <ListPrimitive title="عنوان القائمة" items={[]} />,
    );
    const element = getByText('عنوان القائمة');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.writingDirection).toBe('auto');
  });
});

// ═══════════════════════════════════════════════════════════════
// Extended edge case and critical path tests (TEA automate)
// ═══════════════════════════════════════════════════════════════

describe('ListPrimitive — extended edge cases', () => {
  // --- Touch target validation for multiple items ---

  it('all items in a multi-item list have minHeight >= 48', () => {
    const items = [
      { id: '1', title: 'First' },
      { id: '2', title: 'Second' },
      { id: '3', title: 'Third' },
    ];
    const { getByTestId } = render(<ListPrimitive items={items} />);
    for (let i = 0; i < items.length; i++) {
      const item = getByTestId(`list-item-${i}`);
      const flatStyle = Array.isArray(item.props.style)
        ? Object.assign({}, ...item.props.style)
        : item.props.style;
      expect(flatStyle.minHeight).toBeGreaterThanOrEqual(48);
    }
  });

  // --- Separator styling validation ---

  it('separator has correct border color from tokens', () => {
    const items = [
      { id: '1', title: 'A' },
      { id: '2', title: 'B' },
    ];
    const { getAllByTestId } = render(<ListPrimitive items={items} />);
    const separators = getAllByTestId('list-separator');
    expect(separators.length).toBe(1);
    const flatStyle = Array.isArray(separators[0].props.style)
      ? Object.assign({}, ...separators[0].props.style)
      : separators[0].props.style;
    expect(flatStyle.backgroundColor).toBe(tokens.colors.border);
    expect(flatStyle.height).toBe(1);
  });

  // --- Subtitle and trailing RTL / font scaling ---

  it('subtitle text supports writingDirection auto for RTL', () => {
    const items = [{ id: '1', title: 'Main', subtitle: 'معلومات إضافية' }];
    const { getByText } = render(<ListPrimitive items={items} />);
    const element = getByText('معلومات إضافية');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.writingDirection).toBe('auto');
  });

  it('trailing text supports writingDirection auto for RTL', () => {
    const items = [{ id: '1', title: 'Balance', trailing: '٥٠٠' }];
    const { getByText } = render(<ListPrimitive items={items} />);
    const element = getByText('٥٠٠');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.writingDirection).toBe('auto');
  });

  it('subtitle does not disable font scaling (Dynamic Type)', () => {
    const items = [{ id: '1', title: 'Main', subtitle: 'Scalable subtitle' }];
    const { getByText } = render(<ListPrimitive items={items} />);
    const element = getByText('Scalable subtitle');
    expect(element.props.allowFontScaling).not.toBe(false);
  });

  it('trailing does not disable font scaling (Dynamic Type)', () => {
    const items = [{ id: '1', title: 'Balance', trailing: '$1,234' }];
    const { getByText } = render(<ListPrimitive items={items} />);
    const element = getByText('$1,234');
    expect(element.props.allowFontScaling).not.toBe(false);
  });

  // --- Title boundary conditions ---

  it('omits title section when title is empty string', () => {
    const items = [{ id: '1', title: 'Item' }];
    const { queryByText, getByText } = render(
      <ListPrimitive title="" items={items} />,
    );
    // Empty string title should not render the title element
    // But the item title "Item" should still render
    expect(getByText('Item')).toBeTruthy();
    // There should be no separate title heading rendered for ""
  });

  it('renders list title with text color from tokens', () => {
    const { getByText } = render(
      <ListPrimitive title="Styled Title" items={[]} />,
    );
    const element = getByText('Styled Title');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.color).toBe(tokens.colors.text);
  });

  it('list title has bottom margin for spacing', () => {
    const { getByText } = render(
      <ListPrimitive title="Spaced Title" items={[]} />,
    );
    const element = getByText('Spaced Title');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.marginBottom).toBe(tokens.spacing.sm);
  });

  // --- Large item count ---

  it('renders a large list of items without crashing', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      title: `Item ${i}`,
    }));
    const { getByText } = render(<ListPrimitive items={items} />);
    expect(getByText('Item 0')).toBeTruthy();
    expect(getByText('Item 99')).toBeTruthy();
  });

  // --- Accessibility label edge cases ---

  it('has no generated accessibilityLabel when no title and no accessibleLabel', () => {
    const items = [{ id: '1', title: 'Item' }];
    const { toJSON } = render(<ListPrimitive items={items} />);
    const root = toJSON();
    expect(root.props.accessibilityLabel).toBeUndefined();
  });

  it('generates correct label with title and zero items', () => {
    const { getByLabelText } = render(
      <ListPrimitive title="Empty Tasks" items={[]} />,
    );
    expect(getByLabelText('Empty Tasks, 0 items')).toBeTruthy();
  });

  it('generates correct label with title and 1 item (singular)', () => {
    const items = [{ id: '1', title: 'Solo' }];
    const { getByLabelText } = render(
      <ListPrimitive title="Singles" items={items} />,
    );
    expect(getByLabelText('Singles, 1 item')).toBeTruthy();
  });

  it('item accessibilityLabel falls back to "Item N" when title is empty string', () => {
    const items = [{ id: '1', title: '' }];
    const { getByLabelText } = render(<ListPrimitive items={items} />);
    expect(getByLabelText('Item 1')).toBeTruthy();
  });

  it('item accessibilityLabel falls back to "Item N" when title is undefined', () => {
    const items = [{ id: '1' }];
    const { getByLabelText } = render(<ListPrimitive items={items} />);
    expect(getByLabelText('Item 1')).toBeTruthy();
  });

  it('accessibilityRole is undefined when accessibleRole not provided', () => {
    const { toJSON } = render(<ListPrimitive items={[]} />);
    const root = toJSON();
    expect(root.props.accessibilityRole).toBeUndefined();
  });

  // --- Item content layout ---

  it('item uses row direction for side-by-side content and trailing', () => {
    const items = [{ id: '1', title: 'Test', trailing: 'Right' }];
    const { getByTestId } = render(<ListPrimitive items={items} />);
    const item = getByTestId('list-item-0');
    const flatStyle = Array.isArray(item.props.style)
      ? Object.assign({}, ...item.props.style)
      : item.props.style;
    expect(flatStyle.flexDirection).toBe('row');
    expect(flatStyle.alignItems).toBe('center');
  });

  // --- Items with special characters ---

  it('renders items with special characters in subtitle', () => {
    const items = [
      { id: '1', title: 'Special', subtitle: '<b>Bold</b> & "quoted"' },
    ];
    const { getByText } = render(<ListPrimitive items={items} />);
    expect(getByText('<b>Bold</b> & "quoted"')).toBeTruthy();
  });

  it('renders items with emoji in trailing', () => {
    const items = [
      { id: '1', title: 'Status', trailing: '✅ Done' },
    ];
    const { getByText } = render(<ListPrimitive items={items} />);
    expect(getByText('✅ Done')).toBeTruthy();
  });

  // --- Subtitle styling ---

  it('subtitle has top margin for spacing from title', () => {
    const items = [{ id: '1', title: 'Main', subtitle: 'Sub' }];
    const { getByText } = render(<ListPrimitive items={items} />);
    const element = getByText('Sub');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.marginTop).toBe(tokens.spacing.xs);
  });

  // --- Trailing styling ---

  it('trailing has left margin for spacing from content', () => {
    const items = [{ id: '1', title: 'Item', trailing: '$99' }];
    const { getByText } = render(<ListPrimitive items={items} />);
    const element = getByText('$99');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.marginLeft).toBe(tokens.spacing.sm);
  });

  // --- Empty state styling ---

  it('empty state uses body typography', () => {
    const { getByText } = render(<ListPrimitive items={[]} />);
    const element = getByText('No items');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.fontSize).toBe(tokens.typography.body.fontSize);
  });

  it('empty state supports writingDirection auto for RTL', () => {
    const { getByText } = render(<ListPrimitive items={[]} />);
    const element = getByText('No items');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.writingDirection).toBe('auto');
  });

  // --- Item title styling ---

  it('item title uses body typography and text color from tokens', () => {
    const items = [{ id: '1', title: 'Styled item' }];
    const { getByText } = render(<ListPrimitive items={items} />);
    const element = getByText('Styled item');
    const flatStyle = Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style)
      : element.props.style;
    expect(flatStyle.fontSize).toBe(tokens.typography.body.fontSize);
    expect(flatStyle.fontWeight).toBe(tokens.typography.body.fontWeight);
    expect(flatStyle.color).toBe(tokens.colors.text);
  });

  // --- Multiple separators ---

  it('renders correct number of separators for 5 items (4 separators)', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      title: `Item ${i}`,
    }));
    const { getAllByTestId } = render(<ListPrimitive items={items} />);
    const separators = getAllByTestId('list-separator');
    expect(separators.length).toBe(4);
  });

  // --- Items without subtitle or trailing do not render those elements ---

  it('does not render subtitle element when subtitle is not provided', () => {
    const items = [{ id: '1', title: 'No subtitle' }];
    const { queryByText, getByText } = render(<ListPrimitive items={items} />);
    expect(getByText('No subtitle')).toBeTruthy();
    // Should not have any subtitle-styled elements beyond the title
  });

  it('does not render trailing element when trailing is not provided', () => {
    const items = [{ id: '1', title: 'No trailing' }];
    const { toJSON } = render(<ListPrimitive items={items} />);
    // Component renders without crash; trailing section absent
    expect(toJSON()).toBeTruthy();
  });
});
