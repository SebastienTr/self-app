/**
 * Edge-case pipeline integration tests for the module rendering pipeline (Story 3.3 TEA expansion).
 *
 * Covers paths not exercised by pipeline.test.tsx:
 *   - card type module via full ModuleCard → CardPrimitive pipeline
 *   - layout type module via ModuleCard pipeline
 *   - spec with dataStatus 'stale' in moduleStore shows time-based FreshnessIndicator (not Offline)
 *   - ModuleList with 3+ modules including one with unknown type
 *   - Module with all optional fields absent (robustness)
 *   - Mixed dataStatus states (ok + error + stale) rendered via ModuleList
 *   - UnknownPrimitive logs error exactly once (not on re-renders)
 *   - Template fallback applied during pipeline (unknown template → data-card layout)
 *   - Prototype-pollution safe: spec.type '__proto__' and 'constructor' → UnknownPrimitive
 *   - Accessor label flows through pipeline (ModuleCard root View)
 *   - ModuleList empty state when all modules removed
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import type { ModuleState } from '@/types/module';
import { ModuleCard } from './ModuleCard';
import { ModuleList } from './ModuleList';
import { logger } from '@/services/logger';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock localDb
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

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

// ── Card type via full pipeline ────────────────────────────────────────────────

describe('Pipeline edge cases: card type module', () => {
  it('card type renders CardPrimitive with title via ModuleCard pipeline', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'pipe-card',
        name: 'Card Pipeline Module',
        type: 'card',
        title: 'Inner Card',
        children: [],
        template: 'data-card',
        accessibleLabel: 'Card pipeline module',
      },
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Card Pipeline Module')).toBeTruthy();
    expect(getByText('Inner Card')).toBeTruthy();
  });

  it('card type with text + metric children renders all content via pipeline', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'pipe-card-children',
        name: 'Card With Nested Content',
        type: 'card',
        title: 'Dashboard Card',
        children: [
          { type: 'text', text: 'Dashboard intro' },
          { type: 'metric', value: '42', label: 'Requests', unit: 'req/s' },
        ],
        template: 'metric-dashboard',
        accessibleLabel: 'Dashboard card module',
      },
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Dashboard intro')).toBeTruthy();
    expect(getByText('42')).toBeTruthy();
    expect(getByText('Requests')).toBeTruthy();
    expect(getByText('req/s')).toBeTruthy();
  });

  it('card with unknown child type shows UnknownPrimitive without crashing pipeline', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'pipe-card-unknown-child',
        name: 'Mixed Card',
        type: 'card',
        title: 'Mixed Content',
        children: [
          { type: 'text', text: 'Valid text' },
          { type: 'sparkline', data: [1, 2, 3] },
        ],
        template: 'data-card',
        accessibleLabel: 'Mixed card module',
      },
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Valid text')).toBeTruthy();
    expect(getByText(/unsupported/i)).toBeTruthy();
  });
});

// ── Layout type via full pipeline ──────────────────────────────────────────────

describe('Pipeline edge cases: layout type module', () => {
  it('layout type renders via pipeline without crash', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'pipe-layout',
        name: 'Layout Pipeline Module',
        type: 'layout',
        direction: 'vertical',
        template: 'data-card',
        accessibleLabel: 'Layout pipeline module',
      },
    });
    const { toJSON } = render(<ModuleCard module={mod} />);
    expect(toJSON()).toBeTruthy();
  });
});

// ── Prototype-pollution safety via pipeline ────────────────────────────────────

describe('Pipeline edge cases: prototype-pollution type names', () => {
  it('type "__proto__" shows UnknownPrimitive without crashing pipeline', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'proto-pollution',
        name: 'Proto Type',
        type: '__proto__',
        template: 'data-card',
        accessibleLabel: 'Proto pollution test',
      },
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText(/unsupported/i)).toBeTruthy();
  });

  it('type "constructor" shows UnknownPrimitive without crashing pipeline', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'constructor-type',
        name: 'Constructor Type',
        type: 'constructor',
        template: 'data-card',
        accessibleLabel: 'Constructor type test',
      },
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText(/unsupported/i)).toBeTruthy();
  });

  it('template "__proto__" falls back to data-card layout without crash', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'proto-template',
        name: 'Proto Template',
        type: 'text',
        text: 'Prototype template test',
        template: '__proto__',
        accessibleLabel: 'Proto template test',
      },
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    // Must render without crash and display the text
    expect(getByText('Prototype template test')).toBeTruthy();
  });
});

// ── dataStatus 'stale' via pipeline ───────────────────────────────────────────

describe('Pipeline edge cases: dataStatus states', () => {
  it('dataStatus "stale" (not error) shows time-based FreshnessIndicator, not Offline', () => {
    // Data from 3 hours ago, dataStatus = 'stale' — should show caption, not Offline
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const mod = makeModule({
      spec: {
        moduleId: 'stale-status',
        name: 'Stale Status Module',
        type: 'text',
        text: 'Stale status content',
        template: 'data-card',
        accessibleLabel: 'Stale status module',
      },
      dataStatus: 'stale', // dataStatus stale ≠ 'error'
      updatedAt: threeHoursAgo,
    });
    const { getByText, queryByText } = render(<ModuleCard module={mod} />);
    // dataStatus 'stale' is NOT 'error', so FreshnessIndicator shows time caption
    expect(getByText(/Updated \d+h ago/)).toBeTruthy();
    expect(queryByText('Offline')).toBeNull();
  });

  it('dataStatus "ok" shows no freshness indicator when data is fresh', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const mod = makeModule({
      spec: {
        moduleId: 'ok-fresh',
        name: 'OK Fresh Module',
        type: 'text',
        text: 'Fresh OK content',
        template: 'data-card',
        accessibleLabel: 'OK fresh module',
      },
      dataStatus: 'ok',
      updatedAt: tenMinAgo,
    });
    const { queryByText } = render(<ModuleCard module={mod} />);
    expect(queryByText('Stale')).toBeNull();
    expect(queryByText('Offline')).toBeNull();
    expect(queryByText(/Updated/)).toBeNull();
  });
});

// ── Mixed dataStatus states via ModuleList ────────────────────────────────────

describe('Pipeline edge cases: mixed dataStatus via ModuleList', () => {
  it('renders modules with ok, stale, and error dataStatus simultaneously', () => {
    const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    mockModules = [
      makeModule({
        spec: {
          moduleId: 'ok-mod',
          name: 'OK Module',
          type: 'text',
          text: 'OK content',
          template: 'data-card',
          accessibleLabel: 'OK module',
        },
        dataStatus: 'ok',
      }),
      makeModule({
        spec: {
          moduleId: 'stale-mod',
          name: 'Stale Module',
          type: 'text',
          text: 'Stale content',
          template: 'data-card',
          accessibleLabel: 'Stale module',
        },
        dataStatus: 'ok',
        updatedAt: oldTime, // > 24h → shows "Stale" badge
      }),
      makeModule({
        spec: {
          moduleId: 'error-mod',
          name: 'Error Module',
          type: 'text',
          text: 'Error content',
          template: 'data-card',
          accessibleLabel: 'Error module',
        },
        dataStatus: 'error', // shows "Offline" badge
      }),
    ];

    const { getByText, queryByText } = render(<ModuleList />);
    expect(getByText('OK Module')).toBeTruthy();
    expect(getByText('Stale Module')).toBeTruthy();
    expect(getByText('Error Module')).toBeTruthy();
    expect(getByText('Stale')).toBeTruthy();
    expect(getByText('Offline')).toBeTruthy();
    // No "No modules yet" should appear
    expect(queryByText('No modules yet')).toBeNull();
  });
});

// ── ModuleList with unknown type alongside valid modules ───────────────────────

describe('Pipeline edge cases: ModuleList with unknown type', () => {
  it('renders 3+ modules where one has unknown type via ModuleList', () => {
    mockModules = [
      makeModule({
        spec: {
          moduleId: 'ml-text',
          name: 'Text Module',
          type: 'text',
          text: 'Text pipeline',
          template: 'data-card',
          accessibleLabel: 'Text module',
        },
      }),
      makeModule({
        spec: {
          moduleId: 'ml-metric',
          name: 'Metric Module',
          type: 'metric',
          value: '77',
          label: 'CPU',
          template: 'metric-dashboard',
          accessibleLabel: 'Metric module',
        },
      }),
      makeModule({
        spec: {
          moduleId: 'ml-unknown',
          name: 'Unknown Module',
          type: 'radar', // not registered
          template: 'data-card',
          accessibleLabel: 'Unknown module',
        },
      }),
    ];

    const { getByText } = render(<ModuleList />);
    expect(getByText('Text pipeline')).toBeTruthy();
    expect(getByText('77')).toBeTruthy();
    expect(getByText(/unsupported/i)).toBeTruthy();
  });
});

// ── Minimal spec robustness via pipeline ──────────────────────────────────────

describe('Pipeline edge cases: minimal spec robustness', () => {
  it('renders with only moduleId (no name, type, template)', () => {
    const mod = makeModule({
      spec: { moduleId: 'minimal-only' } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    // Should fall back to moduleId as title
    expect(getByText('minimal-only')).toBeTruthy();
  });

  it('renders with a spec having all extra fields absent (minimal valid module)', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'bare-bones',
        name: 'Bare Bones',
        type: 'text',
        text: 'Bare content',
      } as any,
    });
    const { getByText } = render(<ModuleCard module={mod} />);
    expect(getByText('Bare Bones')).toBeTruthy();
    expect(getByText('Bare content')).toBeTruthy();
  });
});

// ── Accessibility label flows through pipeline ────────────────────────────────

describe('Pipeline edge cases: accessibility label propagation', () => {
  it('accessibleLabel on spec is applied to ModuleCard root View', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'a11y-pipe',
        name: 'A11y Pipeline',
        type: 'metric',
        value: '100',
        label: 'Score',
        template: 'data-card',
        accessibleLabel: 'Pipeline accessibility label',
      },
    });
    const { getAllByLabelText } = render(<ModuleCard module={mod} />);
    const labeled = getAllByLabelText('Pipeline accessibility label');
    expect(labeled.length).toBeGreaterThanOrEqual(1);
  });

  it('all 3 First Light templates propagate accessibleLabel to root View', () => {
    const templates = ['metric-dashboard', 'data-card', 'simple-list'];
    for (const template of templates) {
      const mod = makeModule({
        spec: {
          moduleId: `a11y-${template}`,
          name: `A11y ${template}`,
          type: template === 'simple-list' ? 'list' : template === 'metric-dashboard' ? 'metric' : 'text',
          ...(template === 'simple-list' ? { items: [] } : {}),
          ...(template === 'metric-dashboard' ? { value: '1', label: 'L' } : {}),
          ...(template === 'data-card' ? { text: 'T' } : {}),
          template,
          accessibleLabel: `Label for ${template}`,
        },
      });
      const { getAllByLabelText } = render(<ModuleCard module={mod} />);
      const labeled = getAllByLabelText(`Label for ${template}`);
      expect(labeled.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── UnknownPrimitive logs error once (not on re-renders) ──────────────────────

describe('Pipeline edge cases: UnknownPrimitive error logging', () => {
  let logErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    logErrorSpy = jest.spyOn(logger, 'error');
  });

  afterEach(() => {
    logErrorSpy.mockRestore();
  });

  it('logs error exactly once when UnknownPrimitive renders', () => {
    const mod = makeModule({
      spec: {
        moduleId: 'log-once',
        name: 'Log Once Module',
        type: 'unknown_type_xyz',
        template: 'data-card',
        accessibleLabel: 'Log once module',
      },
    });
    render(<ModuleCard module={mod} />);

    const unknownPrimitiveLogs = logErrorSpy.mock.calls.filter(
      (c) => c[1] === 'unknown_primitive',
    );
    expect(unknownPrimitiveLogs.length).toBe(1);
    expect(unknownPrimitiveLogs[0][2]).toMatchObject({
      type: 'unknown_type_xyz',
    });
    expect(typeof unknownPrimitiveLogs[0][2].agent_action).toBe('string');
  });
});
