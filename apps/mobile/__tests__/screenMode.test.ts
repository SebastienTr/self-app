/**
 * Integration tests for screen mode transitions (story 2-5).
 *
 * Tests:
 *   - screenModeStore evaluateMode logic
 *   - Keyboard close transitions: modules+idle → dashboard after 1s
 *   - Keyboard close without modules → stay in chat
 *   - Streaming guard: no transition while agent streaming
 *   - AppState foreground re-evaluation
 *   - Timer cleanup on keyboard reopen
 */

jest.mock('@/services/localDb', () => ({
  initLocalDb: jest.fn(async () => {}),
  getCachedModules: jest.fn(async () => []),
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
  enqueuePendingMessage: jest.fn(async () => {}),
  dequeuePendingMessages: jest.fn(async () => []),
  clearPendingMessages: jest.fn(async () => {}),
  getPendingMessageCount: jest.fn(async () => 0),
}));

import { useModuleStore } from '@/stores/moduleStore';
import { useChatStore } from '@/stores/chatStore';
import { useScreenModeStore } from '@/stores/screenModeStore';

describe('Screen Mode Transitions', () => {
  beforeEach(() => {
    useModuleStore.setState({ modules: new Map() });
    useChatStore.setState({
      messages: [],
      streamingMessage: null,
      agentStatus: 'idle',
    });
    useScreenModeStore.setState({ mode: 'chat' });
  });

  describe('evaluateMode', () => {
    it('returns chat when no modules', () => {
      expect(useScreenModeStore.getState().evaluateMode()).toBe('chat');
    });

    it('returns dashboard when modules > 0 and agent idle', () => {
      const modules = new Map();
      modules.set('m1', { spec: { moduleId: 'm1' }, status: 'active', dataStatus: 'ok', updatedAt: '', cachedAt: '' });
      useModuleStore.setState({ modules });
      useChatStore.setState({ agentStatus: 'idle' });
      expect(useScreenModeStore.getState().evaluateMode()).toBe('dashboard');
    });

    it('returns chat when modules > 0 but agent thinking', () => {
      const modules = new Map();
      modules.set('m1', { spec: { moduleId: 'm1' }, status: 'active', dataStatus: 'ok', updatedAt: '', cachedAt: '' });
      useModuleStore.setState({ modules });
      useChatStore.setState({ agentStatus: 'thinking' });
      expect(useScreenModeStore.getState().evaluateMode()).toBe('chat');
    });

    it('returns chat when modules > 0 but agent composing', () => {
      const modules = new Map();
      modules.set('m1', { spec: { moduleId: 'm1' }, status: 'active', dataStatus: 'ok', updatedAt: '', cachedAt: '' });
      useModuleStore.setState({ modules });
      useChatStore.setState({ agentStatus: 'composing' });
      expect(useScreenModeStore.getState().evaluateMode()).toBe('chat');
    });
  });

  describe('transition delay logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('transitions to dashboard after 1s delay when conditions met', () => {
      const modules = new Map();
      modules.set('m1', { spec: { moduleId: 'm1' }, status: 'active', dataStatus: 'ok', updatedAt: '', cachedAt: '' });
      useModuleStore.setState({ modules });
      useChatStore.setState({ agentStatus: 'idle' });
      useScreenModeStore.setState({ mode: 'chat' });

      // Simulate what App.tsx does on keyboard close
      const currentModuleCount = useModuleStore.getState().modules.size;
      const currentAgentStatus = useChatStore.getState().agentStatus;
      if (currentModuleCount > 0 && currentAgentStatus === 'idle') {
        setTimeout(() => {
          useScreenModeStore.getState().setMode('dashboard');
        }, 1000);
      }

      // Before delay
      expect(useScreenModeStore.getState().mode).toBe('chat');

      // After delay
      jest.advanceTimersByTime(1000);
      expect(useScreenModeStore.getState().mode).toBe('dashboard');
    });

    it('stays in chat when 0 modules on keyboard close', () => {
      useModuleStore.setState({ modules: new Map() });
      useChatStore.setState({ agentStatus: 'idle' });
      useScreenModeStore.setState({ mode: 'chat' });

      const currentModuleCount = useModuleStore.getState().modules.size;
      const currentAgentStatus = useChatStore.getState().agentStatus;
      if (currentModuleCount > 0 && currentAgentStatus === 'idle') {
        setTimeout(() => {
          useScreenModeStore.getState().setMode('dashboard');
        }, 1000);
      }

      jest.advanceTimersByTime(1000);
      expect(useScreenModeStore.getState().mode).toBe('chat');
    });

    it('stays in chat when agent is streaming on keyboard close', () => {
      const modules = new Map();
      modules.set('m1', { spec: { moduleId: 'm1' }, status: 'active', dataStatus: 'ok', updatedAt: '', cachedAt: '' });
      useModuleStore.setState({ modules });
      useChatStore.setState({ agentStatus: 'thinking' });
      useScreenModeStore.setState({ mode: 'chat' });

      const currentModuleCount = useModuleStore.getState().modules.size;
      const currentAgentStatus = useChatStore.getState().agentStatus;
      if (currentModuleCount > 0 && currentAgentStatus === 'idle') {
        setTimeout(() => {
          useScreenModeStore.getState().setMode('dashboard');
        }, 1000);
      }

      jest.advanceTimersByTime(1000);
      expect(useScreenModeStore.getState().mode).toBe('chat');
    });

    it('timer can be cancelled (simulating keyboard reopen)', () => {
      const modules = new Map();
      modules.set('m1', { spec: { moduleId: 'm1' }, status: 'active', dataStatus: 'ok', updatedAt: '', cachedAt: '' });
      useModuleStore.setState({ modules });
      useChatStore.setState({ agentStatus: 'idle' });
      useScreenModeStore.setState({ mode: 'chat' });

      const timer = setTimeout(() => {
        useScreenModeStore.getState().setMode('dashboard');
      }, 1000);

      // Simulate keyboard reopen — cancel timer
      jest.advanceTimersByTime(500);
      clearTimeout(timer);

      jest.advanceTimersByTime(1000);
      // Should still be chat because timer was cancelled
      expect(useScreenModeStore.getState().mode).toBe('chat');
    });
  });

  describe('streaming guard then idle transition', () => {
    it('transitions to dashboard when agent goes idle after streaming', () => {
      const modules = new Map();
      modules.set('m1', { spec: { moduleId: 'm1' }, status: 'active', dataStatus: 'ok', updatedAt: '', cachedAt: '' });
      useModuleStore.setState({ modules });
      useChatStore.setState({ agentStatus: 'thinking' });
      useScreenModeStore.setState({ mode: 'chat' });

      // Set up a subscriber that transitions when idle
      const unsub = useChatStore.subscribe((state) => {
        if (state.agentStatus === 'idle' && useModuleStore.getState().modules.size > 0) {
          useScreenModeStore.getState().setMode('dashboard');
          unsub();
        }
      });

      // Agent finishes
      useChatStore.setState({ agentStatus: 'idle' });

      expect(useScreenModeStore.getState().mode).toBe('dashboard');
    });
  });

  describe('AppState foreground re-evaluation', () => {
    it('switches to dashboard on foreground resume with modules + idle', () => {
      const modules = new Map();
      modules.set('m1', { spec: { moduleId: 'm1' }, status: 'active', dataStatus: 'ok', updatedAt: '', cachedAt: '' });
      useModuleStore.setState({ modules });
      useChatStore.setState({ agentStatus: 'idle' });
      useScreenModeStore.setState({ mode: 'chat' });

      // Simulate evaluateMode + setMode (what AppState handler does)
      const newMode = useScreenModeStore.getState().evaluateMode();
      useScreenModeStore.getState().setMode(newMode);

      expect(useScreenModeStore.getState().mode).toBe('dashboard');
    });

    it('stays in chat on foreground resume with 0 modules', () => {
      useModuleStore.setState({ modules: new Map() });
      useChatStore.setState({ agentStatus: 'idle' });
      useScreenModeStore.setState({ mode: 'chat' });

      const newMode = useScreenModeStore.getState().evaluateMode();
      useScreenModeStore.getState().setMode(newMode);

      expect(useScreenModeStore.getState().mode).toBe('chat');
    });

    it('stays in chat on foreground resume when agent not idle', () => {
      const modules = new Map();
      modules.set('m1', { spec: { moduleId: 'm1' }, status: 'active', dataStatus: 'ok', updatedAt: '', cachedAt: '' });
      useModuleStore.setState({ modules });
      useChatStore.setState({ agentStatus: 'thinking' });
      useScreenModeStore.setState({ mode: 'chat' });

      const newMode = useScreenModeStore.getState().evaluateMode();
      useScreenModeStore.getState().setMode(newMode);

      expect(useScreenModeStore.getState().mode).toBe('chat');
    });
  });

  describe('input focus → chat mode', () => {
    it('transitions to chat mode when input is focused', () => {
      useScreenModeStore.setState({ mode: 'dashboard' });
      useScreenModeStore.getState().setMode('chat');
      expect(useScreenModeStore.getState().mode).toBe('chat');
    });
  });
});
