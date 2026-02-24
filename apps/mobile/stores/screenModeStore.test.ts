/**
 * Unit tests for screenModeStore.
 */

// Must mock localDb to prevent expo-sqlite crash
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

import { useModuleStore } from '@/stores/moduleStore';
import { useScreenModeStore, useScreenMode } from '@/stores/screenModeStore';

describe('screenModeStore', () => {
  beforeEach(() => {
    useModuleStore.setState({ modules: new Map() });
    useScreenModeStore.setState({ mode: 'chat' });
  });

  describe('initial state', () => {
    it('starts in chat mode by default', () => {
      const { mode } = useScreenModeStore.getState();
      expect(mode).toBe('chat');
    });
  });

  describe('setMode', () => {
    it('transitions to dashboard mode', () => {
      useScreenModeStore.getState().setMode('dashboard');
      expect(useScreenModeStore.getState().mode).toBe('dashboard');
    });

    it('transitions to chat mode', () => {
      useScreenModeStore.getState().setMode('dashboard');
      useScreenModeStore.getState().setMode('chat');
      expect(useScreenModeStore.getState().mode).toBe('chat');
    });

    it('is idempotent when setting same mode', () => {
      useScreenModeStore.getState().setMode('chat');
      expect(useScreenModeStore.getState().mode).toBe('chat');
    });
  });

  describe('evaluateMode', () => {
    it('returns chat when 0 modules', () => {
      useModuleStore.setState({ modules: new Map() });
      const result = useScreenModeStore.getState().evaluateMode();
      expect(result).toBe('chat');
    });

    it('returns dashboard when modules > 0 and agent idle', () => {
      const modules = new Map();
      modules.set('mod-1', {
        spec: { moduleId: 'mod-1' },
        status: 'active',
        dataStatus: 'ok',
        updatedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      });
      useModuleStore.setState({ modules });
      const result = useScreenModeStore.getState().evaluateMode('idle');
      expect(result).toBe('dashboard');
    });

    it('returns chat when modules > 0 but agent is not idle', () => {
      const modules = new Map();
      modules.set('mod-1', {
        spec: { moduleId: 'mod-1' },
        status: 'active',
        dataStatus: 'ok',
        updatedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      });
      useModuleStore.setState({ modules });
      const result = useScreenModeStore.getState().evaluateMode('thinking');
      expect(result).toBe('chat');
    });

    it('returns dashboard when modules > 0 and agentStatus defaults to idle', () => {
      const modules = new Map();
      modules.set('mod-1', {
        spec: { moduleId: 'mod-1' },
        status: 'active',
        dataStatus: 'ok',
        updatedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      });
      useModuleStore.setState({ modules });
      const result = useScreenModeStore.getState().evaluateMode();
      expect(result).toBe('dashboard');
    });
  });

  describe('useScreenMode selector', () => {
    it('is exported as a function', () => {
      expect(typeof useScreenMode).toBe("function");
    });
  });
});
