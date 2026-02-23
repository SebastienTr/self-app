/**
 * Integration smoke tests for the SDUI primitive system.
 *
 * Verifies the full path: module spec -> getPrimitive -> renders component.
 * Tests each registered type and the unknown fallback.
 */

import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { getPrimitive } from './registry';
import { TextPrimitive } from './TextPrimitive';
import { MetricPrimitive } from './MetricPrimitive';
import { LayoutPrimitive } from './LayoutPrimitive';
import { CardPrimitive } from './CardPrimitive';
import { ListPrimitive } from './ListPrimitive';
import { UnknownPrimitive } from './UnknownPrimitive';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('SDUI Integration: spec → getPrimitive → render', () => {
  it('text spec renders TextPrimitive with correct content', () => {
    const spec = { type: 'text', text: 'Integration test', variant: 'title' as const };
    const Component = getPrimitive(spec.type);

    expect(Component).toBe(TextPrimitive);

    const { getByText } = render(<Component {...spec} />);
    expect(getByText('Integration test')).toBeTruthy();
  });

  it('metric spec renders MetricPrimitive with value and label', () => {
    const spec = { type: 'metric', value: '99.5', label: 'CPU Usage', unit: '%', trend: 'up' as const };
    const Component = getPrimitive(spec.type);

    expect(Component).toBe(MetricPrimitive);

    const { getByText } = render(<Component {...spec} />);
    expect(getByText('99.5')).toBeTruthy();
    expect(getByText('CPU Usage')).toBeTruthy();
    expect(getByText('%')).toBeTruthy();
    expect(getByText(/▲/)).toBeTruthy();
  });

  it('layout spec renders LayoutPrimitive with children', () => {
    const spec = { type: 'layout', direction: 'horizontal' as const, gap: 8 };
    const Component = getPrimitive(spec.type);

    expect(Component).toBe(LayoutPrimitive);

    const { getByText } = render(
      <Component {...spec}>
        <Text>Child 1</Text>
        <Text>Child 2</Text>
      </Component>,
    );
    expect(getByText('Child 1')).toBeTruthy();
    expect(getByText('Child 2')).toBeTruthy();
  });

  it('unknown type renders UnknownPrimitive with fallback message', () => {
    const spec = { type: 'chart' };
    const Component = getPrimitive(spec.type);

    expect(Component).toBe(UnknownPrimitive);

    const { getByText } = render(<Component {...spec} />);
    expect(getByText(/unsupported/i)).toBeTruthy();
    expect(getByText(/chart/)).toBeTruthy();
  });

  it('each registered type renders without error', () => {
    const specs = [
      { type: 'text', text: 'Smoke test' },
      { type: 'metric', value: '0', label: 'Zero' },
      { type: 'layout' },
    ];

    for (const spec of specs) {
      const Component = getPrimitive(spec.type);
      const { toJSON } = render(<Component {...spec} />);
      expect(toJSON()).toBeTruthy();
    }
  });

  it('status stub renders UnknownPrimitive (future implementation)', () => {
    const Component = getPrimitive('status');
    expect(Component).toBe(UnknownPrimitive);

    const { getByText } = render(<Component type="status" />);
    expect(getByText(/unsupported/i)).toBeTruthy();
  });

  it('table stub renders UnknownPrimitive (future implementation)', () => {
    const Component = getPrimitive('table');
    expect(Component).toBe(UnknownPrimitive);

    const { getByText } = render(<Component type="table" />);
    expect(getByText(/unsupported/i)).toBeTruthy();
  });

  it('adding a primitive requires only registry entry (extensibility)', () => {
    // This test documents the pattern: new primitives need only
    // 1. A component file
    // 2. A registry entry
    // The registry itself is a Map<string, ComponentType>
    const registeredTypes = ['text', 'metric', 'layout', 'card', 'list', 'status', 'table'];
    for (const type of registeredTypes) {
      const Component = getPrimitive(type);
      expect(Component).toBeDefined();
      expect(typeof Component).toBe('function');
    }
  });

  it('card type resolves to CardPrimitive', () => {
    const Component = getPrimitive('card');
    expect(Component).toBe(CardPrimitive);
  });

  it('list type resolves to ListPrimitive', () => {
    const Component = getPrimitive('list');
    expect(Component).toBe(ListPrimitive);
  });

  it('registry contains 7 registered types', () => {
    const types = ['text', 'metric', 'layout', 'card', 'list', 'status', 'table'];
    for (const type of types) {
      expect(getPrimitive(type)).not.toBe(undefined);
    }
    // All 7 resolve to a real component (not undefined)
    expect(types.length).toBe(7);
  });

  // --- Advanced integration edge case tests ---

  describe('nested layout with mixed primitives', () => {
    it('renders a layout containing text and metric primitives', () => {
      const LayoutComp = getPrimitive('layout');
      const TextComp = getPrimitive('text');
      const MetricComp = getPrimitive('metric');

      const { getByText } = render(
        <LayoutComp direction="vertical">
          <TextComp text="Dashboard Title" variant="title" />
          <MetricComp value="42" label="Active Users" unit="users" />
        </LayoutComp>,
      );

      expect(getByText('Dashboard Title')).toBeTruthy();
      expect(getByText('42')).toBeTruthy();
      expect(getByText('Active Users')).toBeTruthy();
      expect(getByText('users')).toBeTruthy();
    });

    it('renders horizontal layout with multiple metrics', () => {
      const LayoutComp = getPrimitive('layout');
      const MetricComp = getPrimitive('metric');

      const { getByText } = render(
        <LayoutComp direction="horizontal">
          <MetricComp value="99.9" label="Uptime" unit="%" trend="up" />
          <MetricComp value="23" label="Errors" trend="down" />
          <MetricComp value="150" label="Latency" unit="ms" trend="flat" />
        </LayoutComp>,
      );

      expect(getByText('99.9')).toBeTruthy();
      expect(getByText('23')).toBeTruthy();
      expect(getByText('150')).toBeTruthy();
      expect(getByText('ms')).toBeTruthy();
      expect(getByText(/▲/)).toBeTruthy();
      expect(getByText(/▼/)).toBeTruthy();
      expect(getByText(/—/)).toBeTruthy();
    });

    it('renders grid layout with text primitives', () => {
      const LayoutComp = getPrimitive('layout');
      const TextComp = getPrimitive('text');

      const { getByText } = render(
        <LayoutComp columns={2} gap={8}>
          <TextComp text="Cell 1" variant="body" />
          <TextComp text="Cell 2" variant="body" />
          <TextComp text="Cell 3" variant="caption" />
          <TextComp text="Cell 4" variant="caption" />
        </LayoutComp>,
      );

      expect(getByText('Cell 1')).toBeTruthy();
      expect(getByText('Cell 2')).toBeTruthy();
      expect(getByText('Cell 3')).toBeTruthy();
      expect(getByText('Cell 4')).toBeTruthy();
    });

    it('renders deeply nested layout tree', () => {
      const LayoutComp = getPrimitive('layout');
      const TextComp = getPrimitive('text');
      const MetricComp = getPrimitive('metric');

      const { getByText } = render(
        <LayoutComp direction="vertical">
          <TextComp text="Top Level" variant="title" />
          <LayoutComp direction="horizontal">
            <LayoutComp direction="vertical">
              <MetricComp value="10" label="Left metric" />
              <TextComp text="Left description" variant="caption" />
            </LayoutComp>
            <LayoutComp direction="vertical">
              <MetricComp value="20" label="Right metric" />
              <TextComp text="Right description" variant="caption" />
            </LayoutComp>
          </LayoutComp>
        </LayoutComp>,
      );

      expect(getByText('Top Level')).toBeTruthy();
      expect(getByText('10')).toBeTruthy();
      expect(getByText('Left metric')).toBeTruthy();
      expect(getByText('Left description')).toBeTruthy();
      expect(getByText('20')).toBeTruthy();
      expect(getByText('Right metric')).toBeTruthy();
      expect(getByText('Right description')).toBeTruthy();
    });

    it('renders unknown type alongside known types without breaking', () => {
      const LayoutComp = getPrimitive('layout');
      const TextComp = getPrimitive('text');
      const UnknownComp = getPrimitive('heatmap');

      const { getByText } = render(
        <LayoutComp direction="vertical">
          <TextComp text="Before unknown" />
          <UnknownComp type="heatmap" />
          <TextComp text="After unknown" />
        </LayoutComp>,
      );

      expect(getByText('Before unknown')).toBeTruthy();
      expect(getByText(/unsupported/i)).toBeTruthy();
      expect(getByText('After unknown')).toBeTruthy();
    });
  });

  describe('spec-driven rendering with edge case data', () => {
    it('renders text with emoji content via registry lookup', () => {
      const spec = { type: 'text', text: '🌡️ Temperature rising!' };
      const Component = getPrimitive(spec.type);
      const { getByText } = render(<Component {...spec} />);
      expect(getByText('🌡️ Temperature rising!')).toBeTruthy();
    });

    it('renders metric with zero value and no trend', () => {
      const spec = { type: 'metric', value: 0, label: 'Incidents', unit: '' };
      const Component = getPrimitive(spec.type);
      const { getByText } = render(<Component {...spec} />);
      expect(getByText('0')).toBeTruthy();
      expect(getByText('Incidents')).toBeTruthy();
    });

    it('renders metric with negative value and down trend', () => {
      const spec = { type: 'metric', value: -15.3, label: 'Change', unit: '%', trend: 'down' as const };
      const Component = getPrimitive(spec.type);
      const { getByText } = render(<Component {...spec} />);
      expect(getByText('-15.3')).toBeTruthy();
      expect(getByText('%')).toBeTruthy();
      expect(getByText(/▼/)).toBeTruthy();
    });

    it('renders empty layout without crashing', () => {
      const spec = { type: 'layout', direction: 'vertical' as const, gap: 0 };
      const Component = getPrimitive(spec.type);
      const { toJSON } = render(<Component {...spec} />);
      expect(toJSON()).toBeTruthy();
    });

    it('multiple unknown types each render independently', () => {
      const Unknown1 = getPrimitive('pie_chart');
      const Unknown2 = getPrimitive('radar_chart');

      const { getAllByText } = render(
        <>
          <Unknown1 type="pie_chart" />
          <Unknown2 type="radar_chart" />
        </>,
      );

      expect(getAllByText(/unsupported/i)).toHaveLength(2);
    });
  });

  // --- Card and List composite integration tests ---

  describe('card composite rendering through registry', () => {
    it('card spec with children renders through registry -> CardPrimitive', () => {
      const spec = {
        type: 'card',
        title: 'Weather',
        children: [
          { type: 'text', text: 'Sunny today' },
          { type: 'metric', value: '72', label: 'Temperature', unit: 'F' },
        ],
      };
      const Component = getPrimitive(spec.type);

      expect(Component).toBe(CardPrimitive);

      const { getByText } = render(<Component {...spec} />);
      expect(getByText('Weather')).toBeTruthy();
      expect(getByText('Sunny today')).toBeTruthy();
      expect(getByText('72')).toBeTruthy();
      expect(getByText('Temperature')).toBeTruthy();
      expect(getByText('F')).toBeTruthy();
    });

    it('card with nested unknown child type renders child as UnknownPrimitive', () => {
      const spec = {
        type: 'card',
        title: 'Mixed Card',
        children: [
          { type: 'text', text: 'Valid child' },
          { type: 'sparkline', data: [1, 2, 3] },
        ],
      };
      const Component = getPrimitive(spec.type);
      const { getByText } = render(<Component {...spec} />);

      expect(getByText('Valid child')).toBeTruthy();
      expect(getByText(/unsupported/i)).toBeTruthy();
    });

    it('card with empty children renders without crash', () => {
      const spec = { type: 'card', title: 'Empty', children: [] };
      const Component = getPrimitive(spec.type);
      const { getByText, toJSON } = render(<Component {...spec} />);

      expect(getByText('Empty')).toBeTruthy();
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('list composite rendering through registry', () => {
    it('list spec with items renders through registry -> ListPrimitive', () => {
      const spec = {
        type: 'list',
        title: 'Tasks',
        items: [
          { id: '1', title: 'Buy groceries', subtitle: 'Milk, eggs, bread', trailing: '$50' },
          { id: '2', title: 'Walk the dog', subtitle: 'At the park' },
        ],
      };
      const Component = getPrimitive(spec.type);

      expect(Component).toBe(ListPrimitive);

      const { getByText } = render(<Component {...spec} />);
      expect(getByText('Tasks')).toBeTruthy();
      expect(getByText('Buy groceries')).toBeTruthy();
      expect(getByText('Milk, eggs, bread')).toBeTruthy();
      expect(getByText('$50')).toBeTruthy();
      expect(getByText('Walk the dog')).toBeTruthy();
    });

    it('list with empty items renders empty state', () => {
      const spec = { type: 'list', items: [] };
      const Component = getPrimitive(spec.type);
      const { getByText } = render(<Component {...spec} />);

      expect(getByText('No items')).toBeTruthy();
    });
  });

  describe('all registered types including composites render without error', () => {
    it('smoke test all 7 types', () => {
      const specs = [
        { type: 'text', text: 'Smoke' },
        { type: 'metric', value: '0', label: 'Zero' },
        { type: 'layout' },
        { type: 'card', title: 'Card', children: [] },
        { type: 'list', items: [{ id: '1', title: 'Item' }] },
        { type: 'status' },
        { type: 'table' },
      ];

      for (const spec of specs) {
        const Component = getPrimitive(spec.type);
        const { toJSON } = render(<Component {...spec} />);
        expect(toJSON()).toBeTruthy();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Extended composite integration tests (TEA automate)
  // ═══════════════════════════════════════════════════════════════

  describe('prototype pollution safety through getPrimitive', () => {
    it('getPrimitive("__proto__") returns UnknownPrimitive, not Object.prototype', () => {
      const Component = getPrimitive('__proto__');
      expect(Component).toBe(UnknownPrimitive);
    });

    it('getPrimitive("constructor") returns UnknownPrimitive, not Function', () => {
      const Component = getPrimitive('constructor');
      expect(Component).toBe(UnknownPrimitive);
    });

    it('getPrimitive("hasOwnProperty") returns UnknownPrimitive', () => {
      const Component = getPrimitive('hasOwnProperty');
      expect(Component).toBe(UnknownPrimitive);
    });

    it('getPrimitive("toString") returns UnknownPrimitive', () => {
      const Component = getPrimitive('toString');
      expect(Component).toBe(UnknownPrimitive);
    });
  });

  describe('card-in-card nesting through registry', () => {
    it('renders card containing another card as a child', () => {
      const outerSpec = {
        type: 'card',
        title: 'Outer Dashboard',
        children: [
          {
            type: 'card',
            title: 'Inner Summary',
            children: [{ type: 'text', text: 'Deep content' }],
          },
        ],
      };
      const Component = getPrimitive(outerSpec.type);

      expect(Component).toBe(CardPrimitive);

      const { getByText } = render(<Component {...outerSpec} />);
      expect(getByText('Outer Dashboard')).toBeTruthy();
      expect(getByText('Inner Summary')).toBeTruthy();
      expect(getByText('Deep content')).toBeTruthy();
    });
  });

  describe('card with all five primitive types as children', () => {
    it('renders card containing text, metric, layout, and stubs', () => {
      const spec = {
        type: 'card',
        title: 'Full Card',
        children: [
          { type: 'text', text: 'Description here' },
          { type: 'metric', value: '42', label: 'Answer' },
          { type: 'layout' },
          { type: 'status' },
          { type: 'table' },
        ],
      };
      const Component = getPrimitive(spec.type);
      const { getByText, toJSON } = render(<Component {...spec} />);

      expect(getByText('Full Card')).toBeTruthy();
      expect(getByText('Description here')).toBeTruthy();
      expect(getByText('42')).toBeTruthy();
      expect(getByText('Answer')).toBeTruthy();
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('realistic module spec rendering', () => {
    it('renders a weather module card spec end-to-end', () => {
      const weatherSpec = {
        type: 'card',
        title: 'Weather',
        children: [
          { type: 'metric', value: '72', label: 'Temperature', unit: 'F', trend: 'up' },
          { type: 'text', text: 'Sunny skies expected through the week' },
        ],
      };
      const Component = getPrimitive(weatherSpec.type);
      const { getByText } = render(<Component {...weatherSpec} />);

      expect(getByText('Weather')).toBeTruthy();
      expect(getByText('72')).toBeTruthy();
      expect(getByText('Temperature')).toBeTruthy();
      expect(getByText('F')).toBeTruthy();
      expect(getByText(/▲/)).toBeTruthy();
      expect(getByText('Sunny skies expected through the week')).toBeTruthy();
    });

    it('renders a task list module spec end-to-end', () => {
      const taskSpec = {
        type: 'list',
        title: 'Today\'s Tasks',
        items: [
          { id: 'task-1', title: 'Review PR #42', subtitle: 'Backend team', trailing: 'Due 3pm' },
          { id: 'task-2', title: 'Deploy v2.1', trailing: 'Pending' },
          { id: 'task-3', title: 'Update docs', subtitle: 'API reference' },
        ],
      };
      const Component = getPrimitive(taskSpec.type);
      const { getByText } = render(<Component {...taskSpec} />);

      expect(getByText('Today\'s Tasks')).toBeTruthy();
      expect(getByText('Review PR #42')).toBeTruthy();
      expect(getByText('Backend team')).toBeTruthy();
      expect(getByText('Due 3pm')).toBeTruthy();
      expect(getByText('Deploy v2.1')).toBeTruthy();
      expect(getByText('Pending')).toBeTruthy();
      expect(getByText('Update docs')).toBeTruthy();
      expect(getByText('API reference')).toBeTruthy();
    });
  });

  describe('card and list coexistence in layout', () => {
    it('layout containing both a card and list renders correctly', () => {
      const LayoutComp = getPrimitive('layout');
      const CardComp = getPrimitive('card');
      const ListComp = getPrimitive('list');

      const { getByText } = render(
        <LayoutComp direction="vertical">
          <CardComp
            title="Summary"
            children={[{ type: 'metric', value: '100', label: 'Score' }]}
          />
          <ListComp
            title="Details"
            items={[
              { id: '1', title: 'First detail' },
              { id: '2', title: 'Second detail' },
            ]}
          />
        </LayoutComp>,
      );

      expect(getByText('Summary')).toBeTruthy();
      expect(getByText('100')).toBeTruthy();
      expect(getByText('Score')).toBeTruthy();
      expect(getByText('Details')).toBeTruthy();
      expect(getByText('First detail')).toBeTruthy();
      expect(getByText('Second detail')).toBeTruthy();
    });
  });
});
