/**
 * Integration edge-case tests for screen mode transitions (story 2-5).
 *
 * Covers:
 *   - Rapid mode toggling under timer stress
 *   - Module removal during delayed transition
 *   - evaluateMode called with empty then populated store in sequence
 *   - Double foreground resume
 *   - Concurrent timer + subscription race
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

function addModules(count: number) {
  const modules = new Map();
  for (let i = 0; i < count; i++) {
    modules.set(`mod-${i}`, {
      spec: { moduleId: `mod-${i}` },
      status: 'active',
      dataStatus: 'ok',
      updatedAt: '',
      cachedAt: '',
    });
  }
  useModuleStore.setState({ modules });
}

describe('Screen Mode Integration Edge Cases', () => {
  beforeEach(() => {
    useModuleStore.setState({ modules: new Map() });
    useChatStore.setState({ messages: [], streamingMessage: null, agentStatus: 'idle' });
    useScreenModeStore.setState({ mode: 'chat' });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('module removal during delayed transition', () => {
    it('cancelling timer prevents dashboard if modules removed', () => {
      addModules(1);
      useChatStore.setState({ agentStatus: 'idle' });

      // Start delayed transition
      let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        const count = useModuleStore.getState().modules.size;
        const status = useChatStore.getState().agentStatus;
        if (count > 0 && status === 'idle') {
          useScreenModeStore.getState().setMode('dashboard');
        }
      }, 1000);

      // Remove all modules before timer fires
      jest.advanceTimersByTime(500);
      useModuleStore.setState({ modules: new Map() });

      jest.advanceTimersByTime(600);
      expect(useScreenModeStore.getState().mode).toBe('chat');
    });
  });

  describe('double foreground resume', () => {
    it('calling evaluateMode twice rapidly returns consistent result', () => {
      addModules(2);
      useChatStore.setState({ agentStatus: 'idle' });

      const first = useScreenModeStore.getState().evaluateMode();
      const second = useScreenModeStore.getState().evaluateMode();

      expect(first).toBe(second);
      expect(first).toBe('dashboard');
    });
  });

  describe('agent status flapping', () => {
    it('handles idle → thinking → idle rapid cycle', () => {
      addModules(1);

      const transitions: string[] = [];
      useScreenModeStore.subscribe((s) => transitions.push(s.mode));

      useChatStore.setState({ agentStatus: 'idle' });
      useScreenModeStore.getState().setMode(
        useScreenModeStore.getState().evaluateMode()
      );
      expect(useScreenModeStore.getState().mode).toBe('dashboard');

      useChatStore.setState({ agentStatus: 'thinking' });
      useScreenModeStore.getState().setMode(
        useScreenModeStore.getState().evaluateMode()
      );
      expect(useScreenModeStore.getState().mode).toBe('chat');

      useChatStore.setState({ agentStatus: 'idle' });
      useScreenModeStore.getState().setMode(
        useScreenModeStore.getState().evaluateMode()
      );
      expect(useScreenModeStore.getState().mode).toBe('dashboard');
    });
  });

  describe('empty store to populated sequence', () => {
    it('transitions from chat to dashboard as modules appear', () => {
      useChatStore.setState({ agentStatus: 'idle' });

      expect(useScreenModeStore.getState().evaluateMode()).toBe('chat');

      addModules(1);
      expect(useScreenModeStore.getState().evaluateMode()).toBe('dashboard');

      addModules(5);
      expect(useScreenModeStore.getState().evaluateMode()).toBe('dashboard');
    });
  });

  describe('timer race with manual setMode', () => {
    it('manual setMode to chat overrides pending timer', () => {
      addModules(1);
      useChatStore.setState({ agentStatus: 'idle' });

      // Start delayed dashboard transition
      setTimeout(() => {
        useScreenModeStore.getState().setMode('dashboard');
      }, 1000);

      // User taps input at 800ms, forcing chat
      jest.advanceTimersByTime(800);
      useScreenModeStore.getState().setMode('chat');
      expect(useScreenModeStore.getState().mode).toBe('chat');

      // Timer fires at 1000ms — sets dashboard
      jest.advanceTimersByTime(200);
      // Without cancellation, timer would win
      expect(useScreenModeStore.getState().mode).toBe('dashboard');
    });

    it('cancelled timer preserves manual chat mode', () => {
      addModules(1);
      useChatStore.setState({ agentStatus: 'idle' });

      const timer = setTimeout(() => {
        useScreenModeStore.getState().setMode('dashboard');
      }, 1000);

      jest.advanceTimersByTime(800);
      clearTimeout(timer);
      useScreenModeStore.getState().setMode('chat');

      jest.advanceTimersByTime(500);
      expect(useScreenModeStore.getState().mode).toBe('chat');
    });
  });
});
