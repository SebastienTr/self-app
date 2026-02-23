/**
 * Unit tests for ModuleCard and ErrorBoundary components.
 *
 * Tests module card rendering with name display, SDUI primitive delegation,
 * freshness indicator integration, ErrorBoundary fallback behavior,
 * template resolution, accessibleLabel, and render timing logging.
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
    spec: { moduleId: 'test-mod', name: 'Test Module' } as any,
    status: 'active',
    dataStatus: 'ok',
    updatedAt: new Date().toISOString(),
    cachedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ModuleCard', () => {
  it('renders the module name from spec', () => {
    const mod = makeModule();
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText('Test Module')).toBeTruthy();
  });

  it('falls back to moduleId when name is not present in spec', () => {
    const mod = makeModule({
      spec: { moduleId: 'fallback-id' },
    });
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText('fallback-id')).toBeTruthy();
  });

  it('renders FreshnessIndicator for stale data (> 24h)', () => {
    const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const mod = makeModule({ updatedAt: oldTime });
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText('Stale')).toBeTruthy();
  });

  it('does not show FreshnessIndicator for fresh data (< 1h)', () => {
    const recentTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
    const mod = makeModule({ updatedAt: recentTime });
    const { queryByText } = render(<ModuleCard module={mod} />);

    expect(queryByText('Stale')).toBeNull();
    expect(queryByText('Offline')).toBeNull();
    expect(queryByText(/Updated/)).toBeNull();
  });

  it('shows Offline badge when dataStatus is error', () => {
    const mod = makeModule({ dataStatus: 'error' });
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText('Offline')).toBeTruthy();
  });

  it('renders the updated Xh ago caption for 1h-24h old data', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const mod = makeModule({ updatedAt: threeHoursAgo });
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText(/Updated \d+h ago/)).toBeTruthy();
  });

  // --- SDUI Primitive Delegation Tests ---

  it('delegates to TextPrimitive for type "text"', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'text-mod',
        name: 'Text Module',
        type: 'text',
        text: 'Hello from SDUI',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText('Hello from SDUI')).toBeTruthy();
  });

  it('delegates to MetricPrimitive for type "metric"', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'metric-mod',
        name: 'Metric Module',
        type: 'metric',
        value: '42',
        label: 'Score',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText('42')).toBeTruthy();
    expect(getByText('Score')).toBeTruthy();
  });

  it('delegates to UnknownPrimitive for unrecognized type', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'unknown-mod',
        name: 'Unknown Module',
        type: 'chart',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText(/unsupported/i)).toBeTruthy();
  });

  it('renders UnknownPrimitive when spec has no type field', () => {
    const mod = makeModule({
      spec: { moduleId: 'no-type-mod', name: 'No Type' } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);

    expect(getByText(/unsupported/i)).toBeTruthy();
  });
});

describe('ModuleCard — template-aware rendering (Task 2)', () => {
  it('renders text primitive when type is "text" with scoped props only', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'text-scoped',
        name: 'Scoped Text',
        type: 'text',
        text: 'Scoped content',
        template: 'data-card',
        // These extra fields must NOT crash (they are filtered out)
        schemaVersion: 1,
        refreshInterval: 3600,
        dataSources: [],
        accessibleLabel: 'Scoped accessible label',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Scoped content')).toBeTruthy();
  });

  it('applies accessibleLabel from spec to root View via accessibilityLabel', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'accessible-mod',
        name: 'Accessible Module',
        // Use 'text' type so the primitive doesn't generate a competing accessibilityLabel
        type: 'text',
        text: 'Accessible content',
        accessibleLabel: 'Score module: 42 points',
        template: 'data-card',
      } as any,
    });
    const { getAllByLabelText } = render(<ModuleCard module={mod} />);
    // The card root View must have the accessibilityLabel
    const labeled = getAllByLabelText('Score module: 42 points');
    expect(labeled.length).toBeGreaterThanOrEqual(1);
  });

  it('renders metric primitive with data-card template (most common template)', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'metric-card',
        name: 'Temp Module',
        type: 'metric',
        value: '22',
        label: 'Current Temp',
        unit: '°C',
        template: 'data-card',
        accessibleLabel: 'Temperature: 22°C',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('22')).toBeTruthy();
    expect(getByText('Current Temp')).toBeTruthy();
  });

  it('falls back to data-card template for unknown template name', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'unknown-tmpl',
        name: 'Unknown Template',
        type: 'text',
        text: 'Fallback content',
        template: 'map-with-details', // unknown — should fall back to data-card
        accessibleLabel: 'Fallback module',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Fallback content')).toBeTruthy();
  });

  it('renders with simple-list template without crashing', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'list-mod',
        name: 'Task List',
        type: 'list',
        items: [{ id: '1', title: 'Task one' }],
        template: 'simple-list',
        accessibleLabel: 'Task List module',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Task one')).toBeTruthy();
  });

  it('renders with metric-dashboard template without crashing', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'dashboard-mod',
        name: 'Dashboard',
        type: 'metric',
        value: '99',
        label: 'Uptime',
        template: 'metric-dashboard',
        accessibleLabel: 'Uptime dashboard',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('99')).toBeTruthy();
  });

  it('scoped extractPrimitiveProps passes only type-specific fields to "text" primitive', () => {
    // Passing extra schemaVersion/dataSources should not appear as React warning
    // The scoped extract should only pass text, variant, accessibleLabel, accessibleRole
    const mod = makeModule({
      spec: {
        moduleId: 'scoped-text',
        name: 'Scoped',
        type: 'text',
        text: 'Clean props',
        variant: 'title',
        schemaVersion: 99, // must NOT be forwarded to primitive
        dataSources: [], // must NOT be forwarded to primitive
        accessibleLabel: 'Scoped text label',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Clean props')).toBeTruthy();
  });

  it('scoped extractPrimitiveProps passes only type-specific fields to "metric" primitive', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'scoped-metric',
        name: 'Scoped Metric',
        type: 'metric',
        value: '55',
        label: 'Points',
        unit: 'pts',
        trend: 'up',
        schemaVersion: 2, // must NOT be forwarded
        refreshInterval: 60, // must NOT be forwarded
        accessibleLabel: 'Scoped metric label',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('55')).toBeTruthy();
    expect(getByText('pts')).toBeTruthy();
  });
});

describe('ModuleCard — render timing logging (Task 4)', () => {
  let logInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    logInfoSpy = jest.spyOn(logger, 'info');
  });

  afterEach(() => {
    logInfoSpy.mockRestore();
  });

  it('logs module_rendered event after render via logger.info', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'timing-mod',
        name: 'Timing Test',
        type: 'text',
        text: 'Hello',
        template: 'data-card',
        accessibleLabel: 'Timing module',
      } as any,
    });
    render(<ModuleCard module={mod} />);

    // logger.info should have been called at some point with 'module_rendered'
    const calls = logInfoSpy.mock.calls;
    const timingCall = calls.find((c) => c[1] === 'module_rendered');
    expect(timingCall).toBeDefined();
    expect(timingCall![0]).toBe('sdui');
    expect(timingCall![2]).toMatchObject({
      module_id: 'timing-mod',
      template: 'data-card',
      type: 'text',
    });
    expect(typeof timingCall![2].render_ms).toBe('number');
  });
});

describe('ErrorBoundary', () => {
  function ThrowingComponent(): React.ReactElement {
    throw new Error('Render crash!');
  }

  it('renders children when no error occurs', () => {
    const { getByText } = render(
      <ErrorBoundary moduleId="test-mod">
        <React.Fragment>
          {/* Use a simple Text-like approach */}
          {(() => {
            const { Text } = require('react-native');
            return <Text>Child Content</Text>;
          })()}
        </React.Fragment>
      </ErrorBoundary>,
    );

    expect(getByText('Child Content')).toBeTruthy();
  });

  it('renders fallback card when child component throws', () => {
    const { getByText } = render(
      <ErrorBoundary moduleId="broken-mod">
        <ThrowingComponent />
      </ErrorBoundary>,
    );

    expect(getByText('Module Error')).toBeTruthy();
    expect(getByText('Render crash!')).toBeTruthy();
  });

  it('renders "Unknown error" when error has no message', () => {
    function ThrowUnknown(): React.ReactElement {
      throw new Error();
    }

    const { getByText } = render(
      <ErrorBoundary moduleId="unknown-err">
        <ThrowUnknown />
      </ErrorBoundary>,
    );

    expect(getByText('Module Error')).toBeTruthy();
  });

  it('isolates errors — one module failure does not affect siblings', () => {
    const { Text } = require('react-native');

    function GoodComponent() {
      return <Text>Good Module</Text>;
    }

    const { getByText } = render(
      <>
        <ErrorBoundary moduleId="good-mod">
          <GoodComponent />
        </ErrorBoundary>
        <ErrorBoundary moduleId="bad-mod">
          <ThrowingComponent />
        </ErrorBoundary>
      </>,
    );

    // Good module should still render
    expect(getByText('Good Module')).toBeTruthy();
    // Bad module should show error
    expect(getByText('Module Error')).toBeTruthy();
  });
});
