/**
 * Unit tests for chatSync service.
 *
 * Tests all WS message handler branches:
 *   - chat_stream with done: false → startAgentStream + appendStreamDelta
 *   - chat_stream with done: true → finalizeAgentMessage
 *   - status message → setAgentStatus
 *   - error message when agent active → addErrorMessage
 *   - error message when agent idle → ignored
 */

// Mock wsClient before imports
jest.mock('@/services/wsClient', () => ({
  onMessage: jest.fn(),
}));

jest.mock('@/services/streamBuffer', () => ({
  bufferToken: jest.fn(),
  flushImmediately: jest.fn(),
  resetStreamBuffer: jest.fn(),
  setStreamBufferSink: jest.fn(),
}));

// Mock chatStore before imports
jest.mock('@/stores/chatStore', () => ({
  useChatStore: {
    getState: jest.fn(),
  },
}));

import { onMessage } from '@/services/wsClient';
import {
  bufferToken,
  flushImmediately,
  resetStreamBuffer,
  setStreamBufferSink,
} from '@/services/streamBuffer';
import { useChatStore } from '@/stores/chatStore';
import { initChatSync, cleanupChatSync } from './chatSync';

const mockOnMessage = onMessage as jest.MockedFunction<typeof onMessage>;
const mockBufferToken = bufferToken as jest.MockedFunction<typeof bufferToken>;
const mockFlushImmediately = flushImmediately as jest.MockedFunction<typeof flushImmediately>;
const mockResetStreamBuffer = resetStreamBuffer as jest.MockedFunction<typeof resetStreamBuffer>;
const mockSetStreamBufferSink = setStreamBufferSink as jest.MockedFunction<typeof setStreamBufferSink>;
const mockGetState = useChatStore.getState as jest.MockedFunction<typeof useChatStore.getState>;

describe('chatSync', () => {
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

    // Mock onMessage to capture handlers and return unsubscribe functions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnMessage.mockImplementation((type: any, handler: any) => {
      handlers.set(type, handler);
      const unsub = jest.fn();
      unsubFns.push(unsub);
      return unsub;
    });

    // Mock store state
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

  describe('initChatSync', () => {
    it('registers handlers for chat_stream, status, and error', () => {
      initChatSync();
      expect(mockOnMessage).toHaveBeenCalledWith('chat_stream', expect.any(Function));
      expect(mockOnMessage).toHaveBeenCalledWith('status', expect.any(Function));
      expect(mockOnMessage).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSetStreamBufferSink).toHaveBeenCalledTimes(1);
    });

    it('returns a cleanup function', () => {
      const cleanup = initChatSync();
      expect(typeof cleanup).toBe('function');
    });
  });

  describe('chat_stream handler', () => {
    beforeEach(() => {
      initChatSync();
    });

    it('calls startAgentStream when done is false and no stream in progress', () => {
      mockStore.streamingMessage = null;

      handlers.get('chat_stream')?.({
        type: 'chat_stream',
        payload: { delta: 'Hello', done: false },
      });

      expect(mockStore.startAgentStream).toHaveBeenCalledTimes(1);
      expect(mockBufferToken).toHaveBeenCalledWith('Hello');
    });

    it('does NOT call startAgentStream when stream already in progress', () => {
      mockStore.streamingMessage = 'existing content';

      handlers.get('chat_stream')?.({
        type: 'chat_stream',
        payload: { delta: ' more', done: false },
      });

      expect(mockStore.startAgentStream).not.toHaveBeenCalled();
      expect(mockBufferToken).toHaveBeenCalledWith(' more');
    });

    it('buffers the delta when done is false', () => {
      mockStore.streamingMessage = '';

      handlers.get('chat_stream')?.({
        type: 'chat_stream',
        payload: { delta: 'token', done: false },
      });

      expect(mockBufferToken).toHaveBeenCalledWith('token');
    });

    it('calls finalizeAgentMessage when done is true', () => {
      handlers.get('chat_stream')?.({
        type: 'chat_stream',
        payload: { delta: '', done: true },
      });

      expect(mockFlushImmediately).toHaveBeenCalledTimes(1);
      expect(mockStore.finalizeAgentMessage).toHaveBeenCalledTimes(1);
      expect(mockBufferToken).not.toHaveBeenCalled();
      expect(mockStore.startAgentStream).not.toHaveBeenCalled();
    });

    it('ignores messages with wrong type', () => {
      handlers.get('chat_stream')?.({
        type: 'status',
        payload: { state: 'thinking' },
      });

      expect(mockStore.startAgentStream).not.toHaveBeenCalled();
      expect(mockBufferToken).not.toHaveBeenCalled();
      expect(mockStore.finalizeAgentMessage).not.toHaveBeenCalled();
    });

    it('deduplicates chat_stream messages by seq', () => {
      mockStore.streamingMessage = '';

      const handler = handlers.get('chat_stream');
      handler?.({
        type: 'chat_stream',
        seq: 10,
        payload: { delta: 'A', done: false },
      });
      handler?.({
        type: 'chat_stream',
        seq: 10,
        payload: { delta: 'A', done: false },
      });

      expect(mockBufferToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('status handler', () => {
    beforeEach(() => {
      initChatSync();
    });

    it('calls setAgentStatus with the payload state', () => {
      handlers.get('status')?.({
        type: 'status',
        payload: { state: 'thinking' },
      });

      expect(mockFlushImmediately).toHaveBeenCalledTimes(1);
      expect(mockStore.setAgentStatus).toHaveBeenCalledWith('thinking');
    });

    it('handles idle status', () => {
      handlers.get('status')?.({
        type: 'status',
        payload: { state: 'idle' },
      });

      expect(mockStore.setAgentStatus).toHaveBeenCalledWith('idle');
    });

    it('does not flush stream buffer for streaming status', () => {
      handlers.get('status')?.({
        type: 'status',
        payload: { state: 'streaming' },
      });

      expect(mockFlushImmediately).not.toHaveBeenCalled();
      expect(mockStore.setAgentStatus).toHaveBeenCalledWith('streaming');
    });

    it('ignores messages with wrong type', () => {
      handlers.get('status')?.({
        type: 'chat_stream',
        payload: { delta: '', done: true },
      });

      expect(mockStore.setAgentStatus).not.toHaveBeenCalled();
    });

    it('deduplicates status messages by seq', () => {
      const handler = handlers.get('status');
      handler?.({ type: 'status', seq: 7, payload: { state: 'thinking' } });
      handler?.({ type: 'status', seq: 7, payload: { state: 'idle' } });

      expect(mockStore.setAgentStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handler', () => {
    beforeEach(() => {
      initChatSync();
    });

    it('calls addErrorMessage when agent was processing (agentStatus !== idle)', () => {
      mockStore.agentStatus = 'thinking';

      handlers.get('error')?.({
        type: 'error',
        payload: { code: 'LLM_CHAT_FAILED', message: 'Provider error' },
      });

      expect(mockFlushImmediately).toHaveBeenCalledTimes(1);
      expect(mockStore.addErrorMessage).toHaveBeenCalledWith('Provider error');
    });

    it('does NOT call addErrorMessage when agent is idle', () => {
      mockStore.agentStatus = 'idle';

      handlers.get('error')?.({
        type: 'error',
        payload: { code: 'AUTH_REQUIRED', message: 'Auth required' },
      });

      expect(mockFlushImmediately).toHaveBeenCalledTimes(1);
      expect(mockStore.addErrorMessage).not.toHaveBeenCalled();
    });

    it('uses fallback message when message field is missing', () => {
      mockStore.agentStatus = 'thinking';

      handlers.get('error')?.({
        type: 'error',
        payload: { code: 'LLM_CHAT_FAILED' },
      });

      expect(mockStore.addErrorMessage).toHaveBeenCalledWith('Agent error');
    });

    it('ignores messages with wrong type', () => {
      mockStore.agentStatus = 'thinking';

      handlers.get('error')?.({
        type: 'status',
        payload: { state: 'idle' },
      });

      expect(mockStore.addErrorMessage).not.toHaveBeenCalled();
    });

    it('deduplicates error messages by seq', () => {
      mockStore.agentStatus = 'thinking';
      const handler = handlers.get('error');
      handler?.({
        type: 'error',
        seq: 11,
        payload: { code: 'LLM_CHAT_FAILED', message: 'Provider error' },
      });
      handler?.({
        type: 'error',
        seq: 11,
        payload: { code: 'LLM_CHAT_FAILED', message: 'Provider error' },
      });

      expect(mockStore.addErrorMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanupChatSync', () => {
    it('calls all unsubscribe functions on cleanup', () => {
      initChatSync();
      expect(unsubFns).toHaveLength(3);

      cleanupChatSync();

      expect(mockFlushImmediately).toHaveBeenCalled();
      expect(mockResetStreamBuffer).toHaveBeenCalledTimes(1);
      for (const unsub of unsubFns) {
        expect(unsub).toHaveBeenCalledTimes(1);
      }
    });
  });
});
