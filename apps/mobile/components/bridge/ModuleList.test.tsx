/**
 * Unit tests for ModuleList component.
 *
 * Tests empty state, module rendering, offline indicator visibility,
 * and FlatList integration.
 *
 * Note: Uses jest.mock to mock the store hooks to avoid
 * infinite re-render issues from Zustand selector reference instability
 * with React 19 test renderer.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import type { ModuleState } from '@/types/module';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock localDb
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

// Mock the stores to avoid infinite re-render from selector reference instability
let mockModules: ModuleState[] = [];
let mockConnectionStatus = 'connected';

jest.mock('@/stores/moduleStore', () => ({
  useModuleStore: (selector: (state: any) => any) => {
    const modulesMap = new Map(mockModules.map((m: ModuleState) => [m.spec.moduleId, m]));
    const state = {
      getAllModules: () => mockModules,
      modules: modulesMap,
    };
    return selector(state);
  },
}));

jest.mock('@/stores/connectionStore', () => ({
  useConnectionStore: (selector: (state: any) => any) => {
    const state = { status: mockConnectionStatus };
    return selector(state);
  },
}));

import { ModuleList } from './ModuleList';

function makeModule(id: string, name: string, overrides: Partial<ModuleState> = {}): ModuleState {
  return {
    spec: { moduleId: id, name } as any,
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

describe('ModuleList', () => {
  describe('empty state', () => {
    it('shows "No modules yet" when there are no modules', () => {
      const { getByText } = render(<ModuleList />);
      expect(getByText('No modules yet')).toBeTruthy();
    });

    it('does not show offline indicator when empty and disconnected', () => {
      mockConnectionStatus = 'disconnected';
      const { queryByText, getByText } = render(<ModuleList />);

      expect(getByText('No modules yet')).toBeTruthy();
      expect(queryByText('Showing cached data')).toBeNull();
    });
  });

  describe('module rendering', () => {
    it('renders module cards when modules exist', () => {
      mockModules = [
        makeModule('mod-1', 'Module One'),
        makeModule('mod-2', 'Module Two'),
      ];

      const { getByText } = render(<ModuleList />);

      expect(getByText('Module One')).toBeTruthy();
      expect(getByText('Module Two')).toBeTruthy();
    });

    it('does not show empty state when modules exist', () => {
      mockModules = [makeModule('mod-1', 'Module One')];

      const { queryByText } = render(<ModuleList />);
      expect(queryByText('No modules yet')).toBeNull();
    });
  });

  describe('offline indicator', () => {
    it('shows "Showing cached data" when disconnected with modules', () => {
      mockModules = [makeModule('mod-1', 'Cached Module')];
      mockConnectionStatus = 'disconnected';

      const { getByText } = render(<ModuleList />);

      expect(getByText('Showing cached data')).toBeTruthy();
      expect(getByText('Cached Module')).toBeTruthy();
    });

    it('shows "Showing cached data" when reconnecting with modules', () => {
      mockModules = [makeModule('mod-1', 'Module')];
      mockConnectionStatus = 'reconnecting';

      const { getByText } = render(<ModuleList />);
      expect(getByText('Showing cached data')).toBeTruthy();
    });

    it('does not show offline indicator when connected', () => {
      mockModules = [makeModule('mod-1', 'Module')];
      mockConnectionStatus = 'connected';

      const { queryByText } = render(<ModuleList />);
      expect(queryByText('Showing cached data')).toBeNull();
    });

    it('shows "Showing cached data" during connecting status with cached modules', () => {
      mockModules = [makeModule('mod-1', 'Module')];
      mockConnectionStatus = 'connecting';

      const { getByText } = render(<ModuleList />);
      expect(getByText('Showing cached data')).toBeTruthy();
    });
  });
});
