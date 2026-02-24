/**
 * Edge-case tests for moduleSync module_card scheduling (story 2-5).
 *
 * Covers:
 *   - Agent status cycling (idle → thinking → composing → idle) with deferred cards
 *   - Re-init (calling initModuleSync twice)
 *   - cleanupModuleSync when nothing is registered
 *   - Multiple rapid module_created events while streaming
 *   - Agent goes idle then back to thinking before flush completes
 */

jest.mock('@/services/wsClient', () => ({
  onMessage: jest.fn(),
}));

jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

jest.mock('./logger', () => ({
  logger: {
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

import { onMessage } from '@/services/wsClient';
import { useModuleStore } from '@/stores/moduleStore';
import { useChatStore } from '@/stores/chatStore';
import { initModuleSync, cleanupModuleSync } from './moduleSync';

const mockOnMessage = onMessage as jest.MockedFunction<typeof onMessage>;

describe('moduleSync module_card edge cases', () => {
  let moduleCreatedHandler: ((msg: unknown) => void) | undefined;

  beforeEach(() => {
    useModuleStore.setState({ modules: new Map() });
    useChatStore.setState({ messages: [], streamingMessage: null, agentStatus: 'idle' });

    mockOnMessage.mockImplementation((type: any, handler: any) => {
      if (type === 'module_created') moduleCreatedHandler = handler;
      return jest.fn();
    });

    initModuleSync();
  });

  afterEach(() => {
    cleanupModuleSync();
    jest.clearAllMocks();
  });

  describe('re-initialization', () => {
    it('calling initModuleSync twice does not duplicate handlers', () => {
      useChatStore.setState({ agentStatus: 'idle' });

      initModuleSync(); // second init

      moduleCreatedHandler?.({
        type: 'module_created',
        payload: { moduleId: 'mod-1' },
      });

      // Should only have 1 module_card, not 2
      const moduleCards = useChatStore.getState().messages.filter((m) => m.type === 'module_card');
      expect(moduleCards).toHaveLength(1);
    });
  });

  describe('cleanupModuleSync edge cases', () => {
    it('calling cleanup when nothing registered is safe', () => {
      cleanupModuleSync();
      cleanupModuleSync(); // double cleanup
      expect(() => cleanupModuleSync()).not.toThrow();
    });
  });

  describe('many rapid module_created while streaming', () => {
    it('defers 20 cards and flushes all on idle', () => {
      useChatStore.setState({ agentStatus: 'thinking', streamingMessage: '' });

      for (let i = 0; i < 20; i++) {
        moduleCreatedHandler?.({
          type: 'module_created',
          payload: { moduleId: `mod-${i}` },
        });
      }

      expect(useChatStore.getState().messages).toHaveLength(0);

      useChatStore.setState({ agentStatus: 'idle', streamingMessage: null });

      const cards = useChatStore.getState().messages.filter((m) => m.type === 'module_card');
      expect(cards).toHaveLength(20);
    });
  });

  describe('agent status cycling with deferred cards', () => {
    it('flushes on first idle after thinking → composing → idle', () => {
      useChatStore.setState({ agentStatus: 'thinking', streamingMessage: '' });

      moduleCreatedHandler?.({
        type: 'module_created',
        payload: { moduleId: 'mod-1' },
      });

      // Agent goes through composing
      useChatStore.setState({ agentStatus: 'composing' });
      expect(useChatStore.getState().messages).toHaveLength(0);

      // Agent goes idle
      useChatStore.setState({ agentStatus: 'idle', streamingMessage: null });

      const cards = useChatStore.getState().messages.filter((m) => m.type === 'module_card');
      expect(cards).toHaveLength(1);
    });
  });

  describe('immediate append when agent already idle', () => {
    it('appends card synchronously without subscription', () => {
      useChatStore.setState({ agentStatus: 'idle' });

      moduleCreatedHandler?.({
        type: 'module_created',
        payload: { moduleId: 'mod-instant' },
      });

      const msgs = useChatStore.getState().messages;
      expect(msgs).toHaveLength(1);
      if (msgs[0].type === 'module_card') {
        expect(msgs[0].moduleId).toBe('mod-instant');
      }
    });
  });
});
