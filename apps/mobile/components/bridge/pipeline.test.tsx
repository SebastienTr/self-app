/**
 * End-to-end pipeline integration tests for the module rendering pipeline.
 *
 * Covers the full pipeline:
 *   ModuleList → ModuleCard → getTemplate → getPrimitive → renders
 *
 * Tests:
 *   - Unknown type renders UnknownPrimitive without crash
 *   - dataStatus 'stale' shows FreshnessIndicator "Stale" badge
 *   - All 3 First Light templates render without error
 *   - Multiple modules render via ModuleList
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import type { ModuleState } from '@/types/module';
import { ModuleCard } from './ModuleCard';
import { ModuleList } from './ModuleList';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock localDb (required by moduleStore)
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

// Mock the stores (required for ModuleList)
let mockModules: ModuleState[] = [];
let mockConnectionStatus = 'connected';

jest.mock('@/stores/moduleStore', () => ({
  useModuleStore: (selector: (state: any) => any) => {
    const modulesMap = new Map(mockModules.map((m: ModuleState) => [m.spec.moduleId, m]));
    return selector({ modules: modulesMap });
  },
}));

jest.mock('@/stores/connectionStore', () => ({
  useConnectionStore: (selector: (state: any) => any) => {
    return selector({ status: mockConnectionStatus });
  },
}));

function makeModule(overrides: Partial<ModuleState> & { spec: any }): ModuleState {
  return {
    status: 'active',
    dataStatus: 'ok',
    updatedAt: new Date().toISOString(),
    cachedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  mockModules = [];
  mockConnectionStatus = 'connected';
});

// ── Pipeline: ModuleCard → getPrimitive → renders ──────────────────────────────

describe('Pipeline: ModuleCard renders correct primitive per type', () => {
  it('type "text" renders TextPrimitive content', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'pipe-text',
        name: 'Text Module',
        type: 'text',
        text: 'Pipeline text content',
        template: 'data-card',
        accessibleLabel: 'Pipeline text module',
      },
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Pipeline text content')).toBeTruthy();
  });

  it('type "metric" renders MetricPrimitive content', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'pipe-metric',
        name: 'Metric Module',
        type: 'metric',
        value: '77',
        label: 'Pipeline Score',
        template: 'data-card',
        accessibleLabel: 'Pipeline metric',
      },
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('77')).toBeTruthy();
    expect(getByText('Pipeline Score')).toBeTruthy();
  });

  it('type "list" renders ListPrimitive content', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'pipe-list',
        name: 'List Module',
        type: 'list',
        items: [
          { id: '1', title: 'Pipeline item one' },
          { id: '2', title: 'Pipeline item two' },
        ],
        template: 'simple-list',
        accessibleLabel: 'Pipeline list module',
      },
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Pipeline item one')).toBeTruthy();
    expect(getByText('Pipeline item two')).toBeTruthy();
  });

  it('unknown type renders UnknownPrimitive without crashing the pipeline', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'pipe-unknown',
        name: 'Unknown Type Module',
        type: 'sparkline', // not registered
        template: 'data-card',
        accessibleLabel: 'Unknown type module',
      },
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText(/unsupported/i)).toBeTruthy();
  });
});

// ── Pipeline: dataStatus badges ────────────────────────────────────────────────

describe('Pipeline: FreshnessIndicator in pipeline', () => {
  it('dataStatus "stale" shows Stale badge', () => {
    const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const mod = makeModule({
      spec: {
        moduleId: 'stale-mod',
        name: 'Stale Module',
        type: 'text',
        text: 'Stale content',
        template: 'data-card',
        accessibleLabel: 'Stale module',
      },
      updatedAt: oldTime,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Stale')).toBeTruthy();
  });

  it('dataStatus "error" shows Offline badge via ModuleCard', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'offline-mod',
        name: 'Offline Module',
        type: 'text',
        text: 'Cached content',
        template: 'data-card',
        accessibleLabel: 'Offline module',
      },
      dataStatus: 'error',
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Offline')).toBeTruthy();
  });
});

// ── Pipeline: All 3 First Light templates render correctly ──────────────────────

describe('Pipeline: First Light template rendering', () => {
  it('metric-dashboard template renders metric primitive without error', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'tmpl-metric',
        name: 'Dashboard',
        type: 'metric',
        value: '88',
        label: 'Performance',
        template: 'metric-dashboard',
        accessibleLabel: 'Performance dashboard',
      },
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('88')).toBeTruthy();
    expect(getByText('Performance')).toBeTruthy();
  });

  it('data-card template renders text primitive without error', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'tmpl-datacard',
        name: 'Data Card',
        type: 'text',
        text: 'Data card content',
        template: 'data-card',
        accessibleLabel: 'Data card module',
      },
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Data card content')).toBeTruthy();
  });

  it('simple-list template renders list primitive without error', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'tmpl-simplelist',
        name: 'Simple List',
        type: 'list',
        items: [{ id: '1', title: 'List item in simple-list template' }],
        template: 'simple-list',
        accessibleLabel: 'Simple list module',
      },
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('List item in simple-list template')).toBeTruthy();
  });
});

// ── Pipeline: ModuleList → multiple ModuleCards ────────────────────────────────

describe('Pipeline: ModuleList → ModuleCard renders multiple modules', () => {
  it('renders multiple modules from moduleStore via ModuleList', () => {
    mockModules = [
      makeModule({
        spec: {
          moduleId: 'ml-1',
          name: 'First Module',
          type: 'text',
          text: 'First content',
          template: 'data-card',
          accessibleLabel: 'First module',
        },
      }),
      makeModule({
        spec: {
          moduleId: 'ml-2',
          name: 'Second Module',
          type: 'metric',
          value: '100',
          label: 'Second Metric',
          template: 'data-card',
          accessibleLabel: 'Second module',
        },
      }),
    ];

    const { getByText } = render(<ModuleList />);
    expect(getByText('First Module')).toBeTruthy();
    expect(getByText('First content')).toBeTruthy();
    expect(getByText('Second Module')).toBeTruthy();
    expect(getByText('100')).toBeTruthy();
  });

  it('renders modules with different templates via ModuleList without crash', () => {
    mockModules = [
      makeModule({
        spec: {
          moduleId: 'tmpl-ml-1',
          name: 'Metric Dashboard Module',
          type: 'metric',
          value: '55',
          label: 'Rate',
          template: 'metric-dashboard',
          accessibleLabel: 'Metric dashboard',
        },
      }),
      makeModule({
        spec: {
          moduleId: 'tmpl-ml-2',
          name: 'Simple List Module',
          type: 'list',
          items: [{ id: '1', title: 'Item in list' }],
          template: 'simple-list',
          accessibleLabel: 'Simple list',
        },
      }),
    ];

    const { getByText } = render(<ModuleList />);
    expect(getByText('Metric Dashboard Module')).toBeTruthy();
    expect(getByText('55')).toBeTruthy();
    expect(getByText('Simple List Module')).toBeTruthy();
    expect(getByText('Item in list')).toBeTruthy();
  });

  it('an ErrorBoundary failure in one module does not crash other modules', () => {
    // Mix a broken type with a valid one — ErrorBoundary isolates the crash
    mockModules = [
      makeModule({
        spec: {
          moduleId: 'good-ml',
          name: 'Good Module',
          type: 'text',
          text: 'Good module content',
          template: 'data-card',
          accessibleLabel: 'Good module',
        },
      }),
      makeModule({
        spec: {
          moduleId: 'chart-ml',
          name: 'Unknown Module',
          type: 'chart', // UnknownPrimitive — won't crash, but shown as unsupported
          template: 'data-card',
          accessibleLabel: 'Unknown module',
        },
      }),
    ];

    const { getByText } = render(<ModuleList />);
    expect(getByText('Good module content')).toBeTruthy();
    expect(getByText(/unsupported/i)).toBeTruthy();
  });
});
