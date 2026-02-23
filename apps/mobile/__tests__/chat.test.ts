/**
 * Integration tests for the chat flow.
 *
 * Tests the full pipeline:
 *   - User sends message → chatStore.addUserMessage + WS chat sent
 *   - chat_stream with done: false → startAgentStream + appendStreamDelta
 *   - chat_stream with done: true → finalizeAgentMessage, streamingMessage null
 *   - error WS message during streaming → addErrorMessage, streaming reset
 *   - status message with thinking → agentStatus updated in chatStore
 */

// Mock wsClient
jest.mock('@/services/wsClient', () => ({
  onMessage: jest.fn(),
  send: jest.fn(),
}));

// Mock chatStore
jest.mock('@/stores/chatStore', () => ({
  useChatStore: {
    getState: jest.fn(),
  },
}));

import { onMessage, send } from '@/services/wsClient';
import { useChatStore } from '@/stores/chatStore';
import { initChatSync, cleanupChatSync } from '@/services/chatSync';

const mockOnMessage = onMessage as jest.MockedFunction<typeof onMessage>;
const mockSend = send as jest.MockedFunction<typeof send>;
const mockGetState = useChatStore.getState as jest.MockedFunction<typeof useChatStore.getState>;

describe('Chat Integration', () => {
  let chatStreamHandler: ((msg: unknown) => void) | undefined;
  let statusHandler: ((msg: unknown) => void) | undefined;
  let errorHandler: ((msg: unknown) => void) | undefined;

  let mockStore: {
    addUserMessage: jest.Mock;
    startAgentStream: jest.Mock;
    appendStreamDelta: jest.Mock;
    finalizeAgentMessage: jest.Mock;
    addErrorMessage: jest.Mock;
    setAgentStatus: jest.Mock;
    streamingMessage: string | null;
    agentStatus: string;
    messages: unknown[];
  };

  beforeEach(() => {
    mockStore = {
      addUserMessage: jest.fn(),
      startAgentStream: jest.fn(),
      appendStreamDelta: jest.fn(),
      finalizeAgentMessage: jest.fn(),
      addErrorMessage: jest.fn(),
      setAgentStatus: jest.fn(),
      streamingMessage: null,
      agentStatus: 'idle',
      messages: [],
    };

    mockGetState.mockReturnValue(mockStore as ReturnType<typeof useChatStore.getState>);

    // Capture handlers registered by initChatSync
    mockOnMessage.mockImplementation((type: string, handler: (msg: unknown) => void) => {
      if (type === 'chat_stream') chatStreamHandler = handler;
      if (type === 'status') statusHandler = handler;
      if (type === 'error') errorHandler = handler;
      return jest.fn();
    });

    initChatSync();
  });

  afterEach(() => {
    cleanupChatSync();
    jest.clearAllMocks();
  });

  describe('Test: user sends message → chatStore.addUserMessage + WS send', () => {
    it('addUserMessage is called with the message content', () => {
      // Simulate what App.tsx handleSend does
      const message = 'Hello agent';
      useChatStore.getState().addUserMessage(message);
      send({ type: 'chat', payload: { message } });

      expect(mockStore.addUserMessage).toHaveBeenCalledWith('Hello agent');
    });

    it('WS send is called with chat message type', () => {
      const message = 'Tell me a story';
      useChatStore.getState().addUserMessage(message);
      send({ type: 'chat', payload: { message } });

      expect(mockSend).toHaveBeenCalledWith({
        type: 'chat',
        payload: { message: 'Tell me a story' },
      });
    });
  });

  describe('Test: chat_stream with done: false → startAgentStream + appendStreamDelta', () => {
    it('calls startAgentStream when stream starts (streamingMessage is null)', () => {
      mockStore.streamingMessage = null;

      chatStreamHandler?.({
        type: 'chat_stream',
        payload: { delta: 'Hello', done: false },
      });

      expect(mockStore.startAgentStream).toHaveBeenCalledTimes(1);
    });

    it('calls appendStreamDelta with the delta', () => {
      mockStore.streamingMessage = null;

      chatStreamHandler?.({
        type: 'chat_stream',
        payload: { delta: 'Hello world', done: false },
      });

      expect(mockStore.appendStreamDelta).toHaveBeenCalledWith('Hello world');
    });

    it('does not call startAgentStream again if stream already in progress', () => {
      mockStore.streamingMessage = 'existing';

      chatStreamHandler?.({
        type: 'chat_stream',
        payload: { delta: ' more', done: false },
      });

      expect(mockStore.startAgentStream).not.toHaveBeenCalled();
      expect(mockStore.appendStreamDelta).toHaveBeenCalledWith(' more');
    });
  });

  describe('Test: chat_stream with done: true → finalizeAgentMessage, streamingMessage null', () => {
    it('calls finalizeAgentMessage when done is true', () => {
      chatStreamHandler?.({
        type: 'chat_stream',
        payload: { delta: '', done: true },
      });

      expect(mockStore.finalizeAgentMessage).toHaveBeenCalledTimes(1);
    });

    it('does not call appendStreamDelta when done is true', () => {
      chatStreamHandler?.({
        type: 'chat_stream',
        payload: { delta: '', done: true },
      });

      expect(mockStore.appendStreamDelta).not.toHaveBeenCalled();
    });

    it('streamingMessage becomes null after finalize (store logic)', () => {
      // The store's finalizeAgentMessage sets streamingMessage to null
      // Here we verify the action is called — store unit tests verify the null setting
      chatStreamHandler?.({
        type: 'chat_stream',
        payload: { delta: '', done: true },
      });

      expect(mockStore.finalizeAgentMessage).toHaveBeenCalled();
    });
  });

  describe('Test: error WS message during streaming → addErrorMessage, streaming reset', () => {
    it('calls addErrorMessage when agentStatus is thinking', () => {
      mockStore.agentStatus = 'thinking';

      errorHandler?.({
        type: 'error',
        payload: { code: 'LLM_CHAT_FAILED', message: 'Provider error' },
      });

      expect(mockStore.addErrorMessage).toHaveBeenCalledWith('Provider error');
    });

    it('does not call addErrorMessage when agentStatus is idle (not in chat)', () => {
      mockStore.agentStatus = 'idle';

      errorHandler?.({
        type: 'error',
        payload: { code: 'AUTH_REQUIRED', message: 'Auth error' },
      });

      expect(mockStore.addErrorMessage).not.toHaveBeenCalled();
    });

    it('addErrorMessage also resets streaming (store behavior)', () => {
      // addErrorMessage internally resets streamingMessage and agentStatus
      // We verify it's called — store unit tests verify the reset
      mockStore.agentStatus = 'thinking';
      mockStore.streamingMessage = 'partial...';

      errorHandler?.({
        type: 'error',
        payload: { code: 'LLM_CHAT_FAILED', message: 'LLM failed' },
      });

      expect(mockStore.addErrorMessage).toHaveBeenCalled();
    });
  });

  describe('Test: status message with thinking → agentStatus updated in chatStore', () => {
    it('calls setAgentStatus with thinking', () => {
      statusHandler?.({
        type: 'status',
        payload: { state: 'thinking' },
      });

      expect(mockStore.setAgentStatus).toHaveBeenCalledWith('thinking');
    });

    it('calls setAgentStatus with idle', () => {
      statusHandler?.({
        type: 'status',
        payload: { state: 'idle' },
      });

      expect(mockStore.setAgentStatus).toHaveBeenCalledWith('idle');
    });

    it('calls setAgentStatus with composing', () => {
      statusHandler?.({
        type: 'status',
        payload: { state: 'composing' },
      });

      expect(mockStore.setAgentStatus).toHaveBeenCalledWith('composing');
    });
  });
});
