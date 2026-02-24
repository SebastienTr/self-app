/**
 * Edge-case tests for screenModeStore (story 2-5).
 *
 * Covers:
 *   - evaluateMode with all AgentState variants
 *   - Rapid setMode toggling (idempotency)
 *   - evaluateMode with many modules
 *   - setMode does not fire subscriber when value unchanged
 */

jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

import { useModuleStore } from '@/stores/moduleStore';
import { useChatStore } from '@/stores/chatStore';
import { useScreenModeStore } from '@/stores/screenModeStore';

function addModules(count: number) {
  const modules = new Map();
  for (let i = 0; i < count; i++) {
    modules.set(`mod-${i}`, {
      spec: { moduleId: `mod-${i}` },
      status: 'active',
      dataStatus: 'ok',
      updatedAt: new Date().toISOString(),
      cachedAt: new Date().toISOString(),
    });
  }
  useModuleStore.setState({ modules });
}

describe('screenModeStore edge cases', () => {
  beforeEach(() => {
    useModuleStore.setState({ modules: new Map() });
    useChatStore.setState({ messages: [], streamingMessage: null, agentStatus: 'idle' });
    useScreenModeStore.setState({ mode: 'chat' });
  });

  describe('evaluateMode with all AgentState variants', () => {
    beforeEach(() => addModules(1));

    it('returns chat when agent is thinking', () => {
      expect(useScreenModeStore.getState().evaluateMode('thinking')).toBe('chat');
    });

    it('returns chat when agent is composing', () => {
      expect(useScreenModeStore.getState().evaluateMode('composing')).toBe('chat');
    });

    it('returns chat when agent is error', () => {
      expect(useScreenModeStore.getState().evaluateMode('error')).toBe('chat');
    });

    it('returns dashboard only for idle', () => {
      expect(useScreenModeStore.getState().evaluateMode('idle')).toBe('dashboard');
    });
  });

  describe('rapid setMode toggling', () => {
    it('handles rapid chat/dashboard/chat toggles', () => {
      const { setMode } = useScreenModeStore.getState();
      setMode('dashboard');
      setMode('chat');
      setMode('dashboard');
      setMode('chat');
      expect(useScreenModeStore.getState().mode).toBe('chat');
    });

    it('does not fire subscriber on no-op set', () => {
      const listener = jest.fn();
      useScreenModeStore.subscribe(listener);
      listener.mockClear();

      useScreenModeStore.getState().setMode('chat'); // already chat
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('evaluateMode with many modules', () => {
    it('returns dashboard with 100 modules and idle', () => {
      addModules(100);
      expect(useScreenModeStore.getState().evaluateMode('idle')).toBe('dashboard');
    });

    it('returns chat with 100 modules and thinking', () => {
      addModules(100);
      expect(useScreenModeStore.getState().evaluateMode('thinking')).toBe('chat');
    });
  });

  describe('evaluateMode reads live store state', () => {
    it('reflects moduleStore changes without explicit arg', () => {
      useChatStore.setState({ agentStatus: 'idle' });
      expect(useScreenModeStore.getState().evaluateMode()).toBe('chat');

      addModules(1);
      expect(useScreenModeStore.getState().evaluateMode()).toBe('dashboard');
    });

    it('reflects chatStore agentStatus changes without explicit arg', () => {
      addModules(1);
      useChatStore.setState({ agentStatus: 'thinking' });
      expect(useScreenModeStore.getState().evaluateMode()).toBe('chat');

      useChatStore.setState({ agentStatus: 'idle' });
      expect(useScreenModeStore.getState().evaluateMode()).toBe('dashboard');
    });
  });
});
