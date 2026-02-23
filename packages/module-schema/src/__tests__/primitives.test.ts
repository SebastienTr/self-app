/**
 * Unit tests for primitive-specific Zod schemas.
 *
 * Verifies: valid specs pass, invalid specs rejected with clear errors
 * for textPrimitiveSchema, metricPrimitiveSchema, layoutPrimitiveSchema.
 */

import {
  textPrimitiveSchema,
  metricPrimitiveSchema,
  layoutPrimitiveSchema,
  cardPrimitiveSchema,
  listPrimitiveSchema,
} from '../primitives';

describe('textPrimitiveSchema', () => {
  it('validates a valid text primitive spec', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'text',
      text: 'Hello world',
      variant: 'body',
    });
    expect(result.success).toBe(true);
  });

  it('accepts spec without variant (uses default)', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'text',
      text: 'Hello',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variant).toBe('body');
    }
  });

  it('accepts all valid variant values', () => {
    const variants = ['title', 'subtitle', 'body', 'caption'] as const;
    for (const variant of variants) {
      const result = textPrimitiveSchema.safeParse({
        type: 'text',
        text: 'Test',
        variant,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid variant', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'text',
      text: 'Test',
      variant: 'huge',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing text field', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'text',
    });
    expect(result.success).toBe(false);
  });

  it('rejects wrong type field', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'metric',
      text: 'Hello',
    });
    expect(result.success).toBe(false);
  });

  it('accepts accessibleLabel and accessibleRole', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'text',
      text: 'Accessible text',
      accessibleLabel: 'Custom label',
      accessibleRole: 'header',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accessibleLabel).toBe('Custom label');
      expect(result.data.accessibleRole).toBe('header');
    }
  });
});

describe('metricPrimitiveSchema', () => {
  it('validates a valid metric primitive spec', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: '42',
      label: 'Score',
    });
    expect(result.success).toBe(true);
  });

  it('accepts numeric value', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: 99,
      label: 'Count',
    });
    expect(result.success).toBe(true);
  });

  it('accepts string value', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: '$1,234',
      label: 'Revenue',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional unit field', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: '72',
      label: 'Temperature',
      unit: 'F',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unit).toBe('F');
    }
  });

  it('accepts optional trend field with valid values', () => {
    const trends = ['up', 'down', 'flat'] as const;
    for (const trend of trends) {
      const result = metricPrimitiveSchema.safeParse({
        type: 'metric',
        value: '42',
        label: 'Score',
        trend,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid trend value', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: '42',
      label: 'Score',
      trend: 'sideways',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing value', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      label: 'Score',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing label', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: '42',
    });
    expect(result.success).toBe(false);
  });

  it('rejects wrong type field', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'text',
      value: '42',
      label: 'Score',
    });
    expect(result.success).toBe(false);
  });

  it('accepts accessibleLabel and accessibleRole', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: '42',
      label: 'Score',
      accessibleLabel: 'Score is 42',
      accessibleRole: 'text',
    });
    expect(result.success).toBe(true);
  });
});

describe('layoutPrimitiveSchema', () => {
  it('validates a valid layout primitive spec', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
    });
    expect(result.success).toBe(true);
  });

  it('accepts direction field', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      direction: 'horizontal',
    });
    expect(result.success).toBe(true);
  });

  it('defaults direction to vertical', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.direction).toBe('vertical');
    }
  });

  it('rejects invalid direction', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      direction: 'diagonal',
    });
    expect(result.success).toBe(false);
  });

  it('accepts columns field', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      columns: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.columns).toBe(2);
    }
  });

  it('rejects non-positive columns', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      columns: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer columns', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      columns: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts gap field', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      gap: 8,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative gap', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      gap: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects wrong type field', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'text',
      direction: 'vertical',
    });
    expect(result.success).toBe(false);
  });

  it('accepts accessibleLabel and accessibleRole', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      accessibleLabel: 'Metrics grid',
      accessibleRole: 'list',
    });
    expect(result.success).toBe(true);
  });
});

// --- Edge case tests for Zod schemas ---

describe('textPrimitiveSchema edge cases', () => {
  it('accepts empty string text', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'text',
      text: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts very long text string', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'text',
      text: 'A'.repeat(100000),
    });
    expect(result.success).toBe(true);
  });

  it('accepts text with emoji and Unicode', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'text',
      text: '🌍 مرحبا 你好 こんにちは',
    });
    expect(result.success).toBe(true);
  });

  it('rejects numeric text value', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'text',
      text: 42,
    });
    expect(result.success).toBe(false);
  });

  it('rejects null text value', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'text',
      text: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects boolean text value', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'text',
      text: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects array text value', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'text',
      text: ['hello'],
    });
    expect(result.success).toBe(false);
  });

  it('strips extra unrecognized fields', () => {
    const result = textPrimitiveSchema.safeParse({
      type: 'text',
      text: 'Hello',
      extraField: 'should be stripped',
      anotherOne: 123,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).extraField).toBeUndefined();
    }
  });

  it('rejects empty object', () => {
    const result = textPrimitiveSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects null input', () => {
    const result = textPrimitiveSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('rejects undefined input', () => {
    const result = textPrimitiveSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it('rejects when type is missing entirely', () => {
    const result = textPrimitiveSchema.safeParse({
      text: 'Hello',
      variant: 'body',
    });
    expect(result.success).toBe(false);
  });
});

describe('metricPrimitiveSchema edge cases', () => {
  it('accepts zero numeric value', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: 0,
      label: 'Count',
    });
    expect(result.success).toBe(true);
  });

  it('accepts negative numeric value', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: -42.5,
      label: 'Balance',
    });
    expect(result.success).toBe(true);
  });

  it('accepts very large numeric value', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: Number.MAX_SAFE_INTEGER,
      label: 'Big',
    });
    expect(result.success).toBe(true);
  });

  it('rejects boolean value', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: true,
      label: 'Flag',
    });
    expect(result.success).toBe(false);
  });

  it('rejects null value', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: null,
      label: 'Score',
    });
    expect(result.success).toBe(false);
  });

  it('rejects array value', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: [1, 2, 3],
      label: 'Values',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty string label', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: '42',
      label: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects null label', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: '42',
      label: null,
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty string unit', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: '42',
      label: 'Score',
      unit: '',
    });
    expect(result.success).toBe(true);
  });

  it('strips extra unrecognized fields', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: '42',
      label: 'Score',
      color: 'red',
      icon: 'star',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).color).toBeUndefined();
      expect((result.data as any).icon).toBeUndefined();
    }
  });

  it('rejects empty object', () => {
    const result = metricPrimitiveSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty string trend', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: '42',
      label: 'Score',
      trend: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts string value with special characters', () => {
    const result = metricPrimitiveSchema.safeParse({
      type: 'metric',
      value: '$1,234.56',
      label: 'Revenue',
    });
    expect(result.success).toBe(true);
  });
});

describe('layoutPrimitiveSchema edge cases', () => {
  it('accepts gap=0 (zero gap is valid)', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      gap: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gap).toBe(0);
    }
  });

  it('accepts very large gap value', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      gap: 10000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects float columns', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      columns: 2.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative columns', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      columns: -1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts very large columns value', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      columns: 100,
    });
    expect(result.success).toBe(true);
  });

  it('rejects gap as string', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      gap: '16',
    });
    expect(result.success).toBe(false);
  });

  it('rejects columns as string', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      columns: '2',
    });
    expect(result.success).toBe(false);
  });

  it('strips extra unrecognized fields', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      direction: 'vertical',
      padding: 16,
      margin: 8,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).padding).toBeUndefined();
      expect((result.data as any).margin).toBeUndefined();
    }
  });

  it('rejects empty string direction', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      direction: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects null direction', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      direction: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects boolean columns', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      columns: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty object as type field', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: {},
    });
    expect(result.success).toBe(false);
  });

  it('accepts layout with all optional fields provided', () => {
    const result = layoutPrimitiveSchema.safeParse({
      type: 'layout',
      direction: 'horizontal',
      columns: 3,
      gap: 24,
      accessibleLabel: 'Grid layout',
      accessibleRole: 'list',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.direction).toBe('horizontal');
      expect(result.data.columns).toBe(3);
      expect(result.data.gap).toBe(24);
      expect(result.data.accessibleLabel).toBe('Grid layout');
      expect(result.data.accessibleRole).toBe('list');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Card Primitive Schema
// ═══════════════════════════════════════════════════════════════

describe('cardPrimitiveSchema', () => {
  it('validates a valid card spec with title and children', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      title: 'Weather',
      children: [{ type: 'text', text: 'Hello' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts card without title', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      children: [{ type: 'metric', value: '42', label: 'Score' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts card without children', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      title: 'Empty Card',
    });
    expect(result.success).toBe(true);
  });

  it('accepts card with empty children array', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      title: 'Empty',
      children: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.children).toEqual([]);
    }
  });

  it('accepts card with minimal spec (just type)', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
    });
    expect(result.success).toBe(true);
  });

  it('rejects wrong type field', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'list',
      title: 'Wrong type',
    });
    expect(result.success).toBe(false);
  });

  it('accepts children with extra fields (passthrough)', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      children: [{ type: 'metric', value: '42', label: 'Score', trend: 'up' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data.children![0] as any).value).toBe('42');
    }
  });

  it('rejects children item without type field', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      children: [{ text: 'no type' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts accessibleLabel and accessibleRole', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      title: 'Weather',
      accessibleLabel: 'Weather card',
      accessibleRole: 'summary',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accessibleLabel).toBe('Weather card');
      expect(result.data.accessibleRole).toBe('summary');
    }
  });

  it('rejects null input', () => {
    const result = cardPrimitiveSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('rejects empty object', () => {
    const result = cardPrimitiveSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('strips extra unrecognized fields', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      title: 'Test',
      unknownField: 'should be stripped',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).unknownField).toBeUndefined();
    }
  });
});

describe('cardPrimitiveSchema edge cases', () => {
  it('accepts card with many children', () => {
    const children = Array.from({ length: 100 }, (_, i) => ({
      type: 'text',
      text: `Item ${i}`,
    }));
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      children,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.children!.length).toBe(100);
    }
  });

  it('rejects children as non-array', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      children: 'not an array',
    });
    expect(result.success).toBe(false);
  });

  it('rejects title as number', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      title: 42,
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// List Primitive Schema
// ═══════════════════════════════════════════════════════════════

describe('listPrimitiveSchema', () => {
  it('validates a valid list spec with items', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [{ id: '1', title: 'First' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts list with title', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      title: 'My Tasks',
      items: [{ id: '1', title: 'Do laundry' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('My Tasks');
    }
  });

  it('accepts empty items array', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toEqual([]);
    }
  });

  it('accepts items with all fields', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [{ id: '1', title: 'Revenue', subtitle: 'Monthly', trailing: '$5K' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const item = result.data.items[0];
      expect(item.id).toBe('1');
      expect(item.title).toBe('Revenue');
      expect(item.subtitle).toBe('Monthly');
      expect(item.trailing).toBe('$5K');
    }
  });

  it('accepts items with only optional fields', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [{}],
    });
    expect(result.success).toBe(true);
  });

  it('rejects wrong type field', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'card',
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing items field', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
    });
    expect(result.success).toBe(false);
  });

  it('accepts accessibleLabel and accessibleRole', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [],
      accessibleLabel: 'Tasks list',
      accessibleRole: 'list',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accessibleLabel).toBe('Tasks list');
      expect(result.data.accessibleRole).toBe('list');
    }
  });

  it('rejects null input', () => {
    const result = listPrimitiveSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('rejects empty object', () => {
    const result = listPrimitiveSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('strips extra unrecognized fields', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [],
      unknownField: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).unknownField).toBeUndefined();
    }
  });
});

describe('listPrimitiveSchema edge cases', () => {
  it('accepts list with many items', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({
      id: String(i),
      title: `Item ${i}`,
    }));
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items.length).toBe(200);
    }
  });

  it('rejects items as non-array', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: 'not an array',
    });
    expect(result.success).toBe(false);
  });

  it('rejects items as object', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: { id: '1', title: 'Not an array' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects title as number', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [],
      title: 42,
    });
    expect(result.success).toBe(false);
  });

  it('rejects item id as number', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [{ id: 42, title: 'Bad id type' }],
    });
    expect(result.success).toBe(false);
  });

  it('strips extra fields from list items', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [{ id: '1', title: 'Test', extraField: 'stripped' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data.items[0] as any).extraField).toBeUndefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Extended schema edge cases (TEA automate)
// ═══════════════════════════════════════════════════════════════

describe('listItemSchema isolation tests', () => {
  it('validates a complete list item', () => {
    const { listItemSchema } = require('../primitives');
    const result = listItemSchema.safeParse({
      id: 'item-1',
      title: 'Buy groceries',
      subtitle: 'Milk, eggs',
      trailing: '$50',
    });
    expect(result.success).toBe(true);
  });

  it('validates an empty list item (all fields optional)', () => {
    const { listItemSchema } = require('../primitives');
    const result = listItemSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects list item with boolean title', () => {
    const { listItemSchema } = require('../primitives');
    const result = listItemSchema.safeParse({
      id: '1',
      title: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects list item with numeric subtitle', () => {
    const { listItemSchema } = require('../primitives');
    const result = listItemSchema.safeParse({
      id: '1',
      title: 'Test',
      subtitle: 42,
    });
    expect(result.success).toBe(false);
  });

  it('rejects list item with numeric trailing', () => {
    const { listItemSchema } = require('../primitives');
    const result = listItemSchema.safeParse({
      id: '1',
      title: 'Test',
      trailing: 99,
    });
    expect(result.success).toBe(false);
  });

  it('rejects list item with array id', () => {
    const { listItemSchema } = require('../primitives');
    const result = listItemSchema.safeParse({
      id: ['1', '2'],
      title: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('accepts list item with empty string values', () => {
    const { listItemSchema } = require('../primitives');
    const result = listItemSchema.safeParse({
      id: '',
      title: '',
      subtitle: '',
      trailing: '',
    });
    expect(result.success).toBe(true);
  });

  it('strips unrecognized fields from list item', () => {
    const { listItemSchema } = require('../primitives');
    const result = listItemSchema.safeParse({
      id: '1',
      title: 'Test',
      onPress: () => {},
      icon: 'star',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).onPress).toBeUndefined();
      expect((result.data as any).icon).toBeUndefined();
    }
  });

  it('rejects null input', () => {
    const { listItemSchema } = require('../primitives');
    const result = listItemSchema.safeParse(null);
    expect(result.success).toBe(false);
  });
});

describe('cardPrimitiveSchema — additional edge cases', () => {
  it('rejects card children with numeric type field', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      children: [{ type: 42 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects card children with boolean type field', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      children: [{ type: true }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects card children with null type field', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      children: [{ type: null }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts card with null title (treated as missing/undefined)', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      title: null,
    });
    // null is not a string, so it should fail
    expect(result.success).toBe(false);
  });

  it('accepts card with empty string title', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      title: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('');
    }
  });

  it('accepts card children with passthrough preserving nested data', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      children: [
        {
          type: 'metric',
          value: '42',
          label: 'Score',
          trend: 'up',
          unit: '%',
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const child = result.data.children![0] as any;
      expect(child.type).toBe('metric');
      expect(child.value).toBe('42');
      expect(child.label).toBe('Score');
      expect(child.trend).toBe('up');
      expect(child.unit).toBe('%');
    }
  });

  it('accepts card children with deeply nested objects via passthrough', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      children: [
        {
          type: 'card',
          title: 'Nested',
          children: [{ type: 'text', text: 'Deep' }],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const child = result.data.children![0] as any;
      expect(child.title).toBe('Nested');
      expect(child.children).toEqual([{ type: 'text', text: 'Deep' }]);
    }
  });

  it('rejects card with children containing non-object entries', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      children: ['not-an-object', 42, true],
    });
    expect(result.success).toBe(false);
  });

  it('accepts card with accessibleLabel as empty string', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      accessibleLabel: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects card with accessibleLabel as number', () => {
    const result = cardPrimitiveSchema.safeParse({
      type: 'card',
      accessibleLabel: 42,
    });
    expect(result.success).toBe(false);
  });
});

describe('listPrimitiveSchema — additional edge cases', () => {
  it('rejects list with null items', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects list items containing non-object entries', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: ['string-item', 42],
    });
    expect(result.success).toBe(false);
  });

  it('accepts list with items containing only id', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [{ id: 'only-id' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].id).toBe('only-id');
      expect(result.data.items[0].title).toBeUndefined();
    }
  });

  it('accepts list with title containing Unicode', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      title: '任务列表 🌍',
      items: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('任务列表 🌍');
    }
  });

  it('rejects list with accessibleRole as number', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [],
      accessibleRole: 123,
    });
    expect(result.success).toBe(false);
  });

  it('accepts list with accessibleLabel as empty string', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [],
      accessibleLabel: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects list item with null title', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [{ id: '1', title: null }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects list item with boolean subtitle', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [{ id: '1', subtitle: false }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects list item with object trailing', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [{ id: '1', trailing: { value: 42 } }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts mixed valid items in list', () => {
    const result = listPrimitiveSchema.safeParse({
      type: 'list',
      items: [
        { id: '1', title: 'Full', subtitle: 'Sub', trailing: '$99' },
        { id: '2', title: 'Title only' },
        { id: '3' },
        {},
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items.length).toBe(4);
    }
  });
});
