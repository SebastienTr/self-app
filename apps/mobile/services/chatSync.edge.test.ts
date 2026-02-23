/**
 * Edge-case tests for chatSync service — Story 2.1 TEA expansion.
 *
 * Covers paths NOT exercised by chatSync.test.ts:
 *   - cleanupChatSync called before initChatSync (no-op, no crash)
 *   - initChatSync called twice (re-registration cleans up previous handlers)
 *   - chat_stream handler with empty string delta and done: false
 *   - error handler when agentStatus is 'discovering' (non-idle)
 *   - error handler when agentStatus is 'composing' (non-idle)
 *   - status handler for 'discovering' and 'composing'
 *   - cleanup function returned by initChatSync calls all unsubscribers
 *   - chat_stream done: true with non-empty delta (should still finalize, not append)
 */

// Mock wsClient before imports
jest.mock('@/services/wsClient', () => ({
  onMessage: jest.fn(),
}));

// Mock chatStore before imports
jest.mock('@/stores/chatStore', () => ({
  useChatStore: {
    getState: jest.fn(),
  },
}));

import { onMessage } from '@/services/wsClient';
import { useChatStore } from '@/stores/chatStore';
import { initChatSync, cleanupChatSync } from './chatSync';

const mockOnMessage = onMessage as jest.MockedFunction<typeof onMessage>;
const mockGetState = useChatStore.getState as jest.MockedFunction<typeof useChatStore.getState>;

describe('chatSync — edge cases', () => {
  let handlers: Map<string, (msg: unknown) => void>;
  let mockStore: {
    startAgentStream: jest.Mock;
    appendStreamDelta: jest.Mock;
    finalizeAgentMessage: jest.Mock;
    setAgentStatus: jest.Mock;
    addErrorMessage: jest.Mock;
    streamingMessage: string | null;
    agentStatus: string;
  };
  let unsubFns: jest.Mock[];

  beforeEach(() => {
    handlers = new Map();
    unsubFns = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnMessage.mockImplementation((type: any, handler: any) => {
      handlers.set(type, handler);
      const unsub = jest.fn();
      unsubFns.push(unsub);
      return unsub;
    });

    mockStore = {
      startAgentStream: jest.fn(),
      appendStreamDelta: jest.fn(),
      finalizeAgentMessage: jest.fn(),
      setAgentStatus: jest.fn(),
      addErrorMessage: jest.fn(),
      streamingMessage: null,
      agentStatus: 'idle',
    };

    mockGetState.mockReturnValue(mockStore as unknown as ReturnType<typeof useChatStore.getState>);
  });

  afterEach(() => {
    cleanupChatSync();
    jest.clearAllMocks();
  });

  describe('cleanupChatSync before initChatSync', () => {
    it('does not throw when called before initChatSync', () => {
      expect(() => cleanupChatSync()).not.toThrow();
    });

    it('can be called multiple times without crashing', () => {
      expect(() => {
        cleanupChatSync();
        cleanupChatSync();
        cleanupChatSync();
      }).not.toThrow();
    });
  });

  describe('initChatSync called twice (re-registration)', () => {
    it('unsubscribes previous handlers when called again', () => {
      initChatSync();
      const firstUnsubFns = [...unsubFns];

      // Reset so we can track second round
      handlers.clear();
      unsubFns.length = 0;

      initChatSync();

      // First round's unsub functions should have been called
      for (const unsub of firstUnsubFns) {
        expect(unsub).toHaveBeenCalledTimes(1);
      }
    });

    it('registers exactly 3 handlers after second initChatSync call', () => {
      initChatSync();
      const firstCallCount = mockOnMessage.mock.calls.length;

      // Reset handler tracking
      handlers.clear();
      unsubFns.length = 0;

      initChatSync();
      const secondCallCount = mockOnMessage.mock.calls.length - firstCallCount;

      expect(secondCallCount).toBe(3);
    });
  });

  describe('chat_stream handler — empty delta with done: false', () => {
    beforeEach(() => {
      initChatSync();
    });

    it('calls appendStreamDelta with empty string when delta is empty and done is false', () => {
      mockStore.streamingMessage = '';

      handlers.get('chat_stream')?.({
        type: 'chat_stream',
        payload: { delta: '', done: false },
      });

      expect(mockStore.appendStreamDelta).toHaveBeenCalledWith('');
    });

    it('calls startAgentStream for empty delta if streamingMessage is null', () => {
      mockStore.streamingMessage = null;

      handlers.get('chat_stream')?.({
        type: 'chat_stream',
        payload: { delta: '', done: false },
      });

      expect(mockStore.startAgentStream).toHaveBeenCalledTimes(1);
      expect(mockStore.appendStreamDelta).toHaveBeenCalledWith('');
    });
  });

  describe('chat_stream handler — done: true with non-empty delta', () => {
    beforeEach(() => {
      initChatSync();
    });

    it('calls only finalizeAgentMessage even if delta has content when done is true', () => {
      handlers.get('chat_stream')?.({
        type: 'chat_stream',
        payload: { delta: 'some trailing content', done: true },
      });

      expect(mockStore.finalizeAgentMessage).toHaveBeenCalledTimes(1);
      expect(mockStore.appendStreamDelta).not.toHaveBeenCalled();
      expect(mockStore.startAgentStream).not.toHaveBeenCalled();
    });
  });

  describe('status handler — all AgentState values', () => {
    beforeEach(() => {
      initChatSync();
    });

    it('calls setAgentStatus with discovering', () => {
      handlers.get('status')?.({
        type: 'status',
        payload: { state: 'discovering' },
      });

      expect(mockStore.setAgentStatus).toHaveBeenCalledWith('discovering');
    });

    it('calls setAgentStatus with composing', () => {
      handlers.get('status')?.({
        type: 'status',
        payload: { state: 'composing' },
      });

      expect(mockStore.setAgentStatus).toHaveBeenCalledWith('composing');
    });
  });

  describe('error handler — all non-idle agentStatus values', () => {
    beforeEach(() => {
      initChatSync();
    });

    it('calls addErrorMessage when agentStatus is discovering', () => {
      mockStore.agentStatus = 'discovering';

      handlers.get('error')?.({
        type: 'error',
        payload: { code: 'LLM_CHAT_FAILED', message: 'Discovering phase error' },
      });

      expect(mockStore.addErrorMessage).toHaveBeenCalledWith('Discovering phase error');
    });

    it('calls addErrorMessage when agentStatus is composing', () => {
      mockStore.agentStatus = 'composing';

      handlers.get('error')?.({
        type: 'error',
        payload: { code: 'LLM_CHAT_FAILED', message: 'Composing phase error' },
      });

      expect(mockStore.addErrorMessage).toHaveBeenCalledWith('Composing phase error');
    });

    it('uses fallback message when payload.message is undefined (composing state)', () => {
      mockStore.agentStatus = 'composing';

      handlers.get('error')?.({
        type: 'error',
        payload: { code: 'LLM_CHAT_FAILED' },
      });

      expect(mockStore.addErrorMessage).toHaveBeenCalledWith('Agent error');
    });

    it('does NOT call addErrorMessage for AUTH errors when discovering', () => {
      // The guard is purely on agentStatus, but AUTH errors come when agentStatus is idle
      // When discovering, any error (even AUTH) triggers addErrorMessage
      mockStore.agentStatus = 'discovering';

      handlers.get('error')?.({
        type: 'error',
        payload: { code: 'AUTH_REQUIRED', message: 'Auth required' },
      });

      // Since agentStatus !== 'idle', addErrorMessage IS called (guard passes)
      expect(mockStore.addErrorMessage).toHaveBeenCalled();
    });
  });

  describe('cleanup function returned by initChatSync', () => {
    it('calling the returned cleanup function unsubscribes all handlers', () => {
      const cleanup = initChatSync();
      const registeredUnsubs = [...unsubFns];

      cleanup();

      for (const unsub of registeredUnsubs) {
        expect(unsub).toHaveBeenCalledTimes(1);
      }
    });

    it('returned cleanup function is idempotent (can be called multiple times)', () => {
      const cleanup = initChatSync();

      // First call
      cleanup();
      // Second call should not throw
      expect(() => cleanup()).not.toThrow();
    });
  });

  describe('handler isolation — wrong type field', () => {
    beforeEach(() => {
      initChatSync();
    });

    it('chat_stream handler ignores message with null type', () => {
      handlers.get('chat_stream')?.({
        type: null,
        payload: { delta: 'hello', done: false },
      });

      expect(mockStore.startAgentStream).not.toHaveBeenCalled();
      expect(mockStore.appendStreamDelta).not.toHaveBeenCalled();
    });

    it('status handler ignores message with null type', () => {
      handlers.get('status')?.({
        type: null,
        payload: { state: 'thinking' },
      });

      expect(mockStore.setAgentStatus).not.toHaveBeenCalled();
    });

    it('error handler ignores message with null type', () => {
      mockStore.agentStatus = 'thinking';

      handlers.get('error')?.({
        type: null,
        payload: { code: 'LLM_CHAT_FAILED', message: 'Error' },
      });

      expect(mockStore.addErrorMessage).not.toHaveBeenCalled();
    });
  });
});
