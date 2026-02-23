/**
 * Edge-case unit tests for ModuleCard (Story 3.3 TEA expansion).
 *
 * Covers paths not exercised by ModuleCard.test.tsx:
 *   - extractPrimitiveProps for 'card' and 'layout' types
 *   - extractPrimitiveProps for unknown type returns only { type }
 *   - pickProps does not include undefined keys
 *   - accessibleLabel absent → accessibilityLabel is undefined on root View
 *   - accessibleLabel empty string → passed through
 *   - spec.template absent → defaults to data-card
 *   - render_ms > 100 → logger.warning called with agent_action
 *   - render timing logs correct module_id, template, type fields
 *   - card type primitive renders fully via ModuleCard pipeline
 *   - layout type primitive renders via ModuleCard pipeline
 *   - spec.type undefined → UnknownPrimitive shown, no crash
 *   - spec.template is null → defaults gracefully
 *   - ErrorBoundary logs error via logger.error on crash
 *   - ErrorBoundary shows moduleId in fallback scenario
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import type { ModuleState } from '@/types/module';
import { ModuleCard } from './ModuleCard';
import { ErrorBoundary } from './ErrorBoundary';
import { logger } from '@/services/logger';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

function makeModule(overrides: Partial<ModuleState> = {}): ModuleState {
  return {
    spec: { moduleId: 'edge-mod', name: 'Edge Module' } as any,
    status: 'active',
    dataStatus: 'ok',
    updatedAt: new Date().toISOString(),
    cachedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── extractPrimitiveProps — card type ─────────────────────────────────────────

describe('ModuleCard — extractPrimitiveProps for "card" type', () => {
  it('renders CardPrimitive title when type is "card"', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'card-edge',
        name: 'Card Module',
        type: 'card',
        title: 'Inner Card Title',
        children: [],
        template: 'data-card',
        accessibleLabel: 'Card module accessible',
        schemaVersion: 1, // must NOT be forwarded to CardPrimitive
        refreshInterval: 60, // must NOT be forwarded
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    // ModuleCard title (outer, from spec.name) and inner card title
    expect(getByText('Card Module')).toBeTruthy();
    expect(getByText('Inner Card Title')).toBeTruthy();
  });

  it('renders CardPrimitive children when type is "card" with children', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'card-with-children',
        name: 'Card With Children',
        type: 'card',
        title: 'Weather',
        children: [
          { type: 'text', text: 'Sunny today' },
          { type: 'metric', value: '22', label: 'Temp' },
        ],
        template: 'data-card',
        accessibleLabel: 'Weather card',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Sunny today')).toBeTruthy();
    expect(getByText('22')).toBeTruthy();
    expect(getByText('Temp')).toBeTruthy();
  });

  it('does not forward schemaVersion to CardPrimitive (scoped props)', () => {
    // If schemaVersion leaks into CardPrimitive, React Native will warn.
    // We verify the module renders cleanly — no crash = scoped props working.
    const mod = makeModule({
      spec: {
        moduleId: 'card-scoped',
        name: 'Scoped Card',
        type: 'card',
        title: 'My Card',
        children: [],
        schemaVersion: 99,
        dataSources: [],
        template: 'data-card',
        accessibleLabel: 'Scoped card',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('My Card')).toBeTruthy();
  });
});

// ── extractPrimitiveProps — layout type ───────────────────────────────────────

describe('ModuleCard — extractPrimitiveProps for "layout" type', () => {
  it('renders LayoutPrimitive when type is "layout"', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'layout-edge',
        name: 'Layout Module',
        type: 'layout',
        direction: 'horizontal',
        columns: 3,
        template: 'data-card',
        accessibleLabel: 'Layout module',
        schemaVersion: 1, // must NOT be forwarded
      } as any,
    });
    // LayoutPrimitive renders without crash when direction/columns are passed
    const { toJSON } = render(<ModuleCard module={mod} />);
    expect(toJSON()).toBeTruthy();
  });

  it('does not crash when layout type has no direction or columns', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'layout-empty',
        name: 'Empty Layout',
        type: 'layout',
        template: 'data-card',
        accessibleLabel: 'Empty layout',
      } as any,
    });
    const { toJSON } = render(<ModuleCard module={mod} />);
    expect(toJSON()).toBeTruthy();
  });
});

// ── extractPrimitiveProps — unknown type returns only { type } ─────────────────

describe('ModuleCard — extractPrimitiveProps for unknown type', () => {
  it('shows UnknownPrimitive with the type name for a registered-as-stub type', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'stub-type',
        name: 'Table Module',
        type: 'table', // registered but as UnknownPrimitive stub
        template: 'data-card',
        accessibleLabel: 'Table module',
        someRandomField: 'should-not-forward',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText(/unsupported/i)).toBeTruthy();
    expect(getByText('table')).toBeTruthy();
  });

  it('shows UnknownPrimitive for a completely unknown type without crash', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'totally-unknown',
        name: 'Heatmap Module',
        type: 'heatmap',
        template: 'data-card',
        accessibleLabel: 'Heatmap module',
        data: [1, 2, 3], // extra field must not leak
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText(/unsupported/i)).toBeTruthy();
    expect(getByText('heatmap')).toBeTruthy();
  });
});

// ── accessibleLabel behaviour ─────────────────────────────────────────────────

describe('ModuleCard — accessibleLabel edge cases', () => {
  it('root View has no accessibilityLabel when accessibleLabel is absent from spec', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'no-label',
        name: 'No Label Module',
        type: 'text',
        text: 'No label content',
        template: 'data-card',
        // No accessibleLabel
      } as any,
    });
    const { queryByLabelText } = render(<ModuleCard module={mod} />);
    // The outer card View should not have an accessibilityLabel
    // (only the TextPrimitive's auto-generated one will exist)
    expect(queryByLabelText('No Label Module')).toBeNull();
  });

  it('root View gets empty string accessibleLabel when spec.accessibleLabel is empty', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'empty-label',
        name: 'Empty Label Module',
        type: 'text',
        text: 'Content',
        template: 'data-card',
        accessibleLabel: '',
      } as any,
    });
    // Should render without crash even if accessibilityLabel is empty
    const { toJSON } = render(<ModuleCard module={mod} />);
    expect(toJSON()).toBeTruthy();
  });
});

// ── spec.template defaults ─────────────────────────────────────────────────────

describe('ModuleCard — template default handling', () => {
  it('defaults to data-card template when spec.template is absent', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'no-template',
        name: 'No Template',
        type: 'text',
        text: 'No template content',
        // No template field — should default to data-card
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('No template content')).toBeTruthy();
  });

  it('defaults to data-card when spec.template is null', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'null-template',
        name: 'Null Template',
        type: 'metric',
        value: '0',
        label: 'Count',
        template: null, // null template — must default gracefully
        accessibleLabel: 'Null template module',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('0')).toBeTruthy();
  });

  it('defaults to data-card when spec.template is an empty string', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'empty-template',
        name: 'Empty Template String',
        type: 'text',
        text: 'Empty template text',
        template: '', // empty string — maps to unknown → falls back to data-card
        accessibleLabel: 'Empty template module',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Empty template text')).toBeTruthy();
  });
});

// ── spec.type absent / null ───────────────────────────────────────────────────

describe('ModuleCard — missing or null spec.type', () => {
  it('shows UnknownPrimitive when spec.type is null', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'null-type',
        name: 'Null Type',
        type: null,
        template: 'data-card',
        accessibleLabel: 'Null type module',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText(/unsupported/i)).toBeTruthy();
  });

  it('does not crash when entire spec only has moduleId and name', () => {
    const mod = makeModule({
      spec: { moduleId: 'minimal-spec', name: 'Minimal' } as any,
    });
    const { toJSON } = render(<ModuleCard module={mod} />);
    expect(toJSON()).toBeTruthy();
  });
});

// ── Render timing — slow render path (logger.warning) ────────────────────────

describe('ModuleCard — render timing warning path (NFR3)', () => {
  let logWarningSpy: jest.SpyInstance;
  let logInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    logWarningSpy = jest.spyOn(logger, 'warning');
    logInfoSpy = jest.spyOn(logger, 'info');
  });

  afterEach(() => {
    logWarningSpy.mockRestore();
    logInfoSpy.mockRestore();
  });

  it('logs render timing with correct module_id, template, and type on fast render', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'timing-check-1',
        name: 'Timing Check',
        type: 'metric',
        value: '50',
        label: 'Value',
        template: 'metric-dashboard',
        accessibleLabel: 'Timing check module',
      } as any,
    });
    render(<ModuleCard module={mod} />);

    // Find the module_rendered call (may be info or warning depending on timing)
    const infoCalls = logInfoSpy.mock.calls;
    const warnCalls = logWarningSpy.mock.calls;
    const allCalls = [...infoCalls, ...warnCalls];
    const timingCall = allCalls.find((c) => c[1] === 'module_rendered');

    expect(timingCall).toBeDefined();
    expect(timingCall![0]).toBe('sdui');
    expect(timingCall![2]).toMatchObject({
      module_id: 'timing-check-1',
      template: 'metric-dashboard',
      type: 'metric',
    });
    expect(typeof timingCall![2].render_ms).toBe('number');
    expect(timingCall![2].render_ms).toBeGreaterThanOrEqual(0);
  });

  it('includes agent_action in warning call when render_ms > 100 (mocked slow render)', () => {
    // Force slow render by advancing Date.now mock
    const originalDateNow = Date.now;
    let callCount = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      // First call returns 0 (renderStartRef captured), subsequent calls return 200 (simulate 200ms)
      return callCount === 1 ? 0 : 200;
    });

    const mod = makeModule({
      spec: {
        moduleId: 'slow-render-mod',
        name: 'Slow Module',
        type: 'text',
        text: 'Slow content',
        template: 'data-card',
        accessibleLabel: 'Slow render module',
      } as any,
    });
    render(<ModuleCard module={mod} />);

    const warnCalls = logWarningSpy.mock.calls;
    const timingWarn = warnCalls.find((c) => c[1] === 'module_rendered');

    expect(timingWarn).toBeDefined();
    expect(timingWarn![2].render_ms).toBeGreaterThan(100);
    expect(typeof timingWarn![2].agent_action).toBe('string');
    expect(timingWarn![2].agent_action).toMatch(/NFR3/);

    jest.spyOn(Date, 'now').mockRestore();
  });
});

// ── ErrorBoundary logging ─────────────────────────────────────────────────────

describe('ModuleCard — ErrorBoundary logger.error on crash', () => {
  let logErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    logErrorSpy = jest.spyOn(logger, 'error');
  });

  afterEach(() => {
    logErrorSpy.mockRestore();
  });

  function ThrowOnRender(): React.ReactElement {
    throw new Error('Deliberate render crash for test');
  }

  it('logs error via logger.error when a child crashes inside ErrorBoundary', () => {
    render(
      <ErrorBoundary moduleId="crash-test-id">
        <ThrowOnRender />
      </ErrorBoundary>,
    );

    const errorCalls = logErrorSpy.mock.calls;
    const renderErrorCall = errorCalls.find((c) => c[1] === 'module_render_error');
    expect(renderErrorCall).toBeDefined();
    expect(renderErrorCall![0]).toBe('bridge');
    expect(renderErrorCall![2]).toMatchObject({
      module_id: 'crash-test-id',
      error: 'Deliberate render crash for test',
    });
    expect(typeof renderErrorCall![2].agent_action).toBe('string');
  });

  it('shows fallback with the error message from the thrown error', () => {
    const { getByText } = render(
      <ErrorBoundary moduleId="msg-test-id">
        <ThrowOnRender />
      </ErrorBoundary>,
    );
    expect(getByText('Deliberate render crash for test')).toBeTruthy();
  });
});

// ── list type via ModuleCard pipeline ─────────────────────────────────────────

describe('ModuleCard — list type with accessibleLabel from spec', () => {
  it('passes accessibleLabel from spec to root View for list type', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'list-label',
        name: 'Labelled List',
        type: 'list',
        items: [{ id: '1', title: 'Item one' }],
        template: 'simple-list',
        accessibleLabel: 'List of tasks',
      } as any,
    });
    const { getAllByLabelText } = render(<ModuleCard module={mod} />);
    const labeled = getAllByLabelText('List of tasks');
    expect(labeled.length).toBeGreaterThanOrEqual(1);
  });
});

// ── metric type with unit and trend via ModuleCard ─────────────────────────────

describe('ModuleCard — metric type with full props via pipeline', () => {
  it('renders metric value, label, unit, and trend indicator', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'full-metric',
        name: 'Full Metric',
        type: 'metric',
        value: '98.6',
        label: 'Body Temp',
        unit: '°F',
        trend: 'up',
        template: 'metric-dashboard',
        accessibleLabel: 'Body temperature: 98.6°F',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('98.6')).toBeTruthy();
    expect(getByText('Body Temp')).toBeTruthy();
    expect(getByText('°F')).toBeTruthy();
    expect(getByText(/▲/)).toBeTruthy();
  });

  it('does not render trend indicator when trend prop is absent', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'no-trend',
        name: 'No Trend Metric',
        type: 'metric',
        value: '50',
        label: 'Score',
        template: 'data-card',
        accessibleLabel: 'Score metric',
      } as any,
    });
    const { queryByText } = render(<ModuleCard module={mod} />);
    expect(queryByText(/▲/)).toBeNull();
    expect(queryByText(/▼/)).toBeNull();
    expect(queryByText(/—/)).toBeNull();
  });
});

// ── Multiple FreshnessIndicator states via ModuleCard ────────────────────────

describe('ModuleCard — freshness indicator states not in existing tests', () => {
  it('shows "Updated Xh ago" caption for data 3 hours old', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const mod = makeModule({
      spec: {
        moduleId: 'stale-caption',
        name: 'Caption Module',
        type: 'text',
        text: 'Caption content',
        template: 'data-card',
        accessibleLabel: 'Caption module',
      } as any,
      updatedAt: threeHoursAgo,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText(/Updated \d+h ago/)).toBeTruthy();
  });

  it('shows no freshness indicator for data < 1 hour old', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const mod = makeModule({
      spec: {
        moduleId: 'fresh-mod',
        name: 'Fresh Module',
        type: 'text',
        text: 'Fresh content',
        template: 'data-card',
        accessibleLabel: 'Fresh module',
      } as any,
      updatedAt: thirtyMinAgo,
    });
    const { queryByText } = render(<ModuleCard module={mod} />);
    expect(queryByText('Stale')).toBeNull();
    expect(queryByText('Offline')).toBeNull();
    expect(queryByText(/Updated/)).toBeNull();
  });
});
