/**
 * Unit tests for chatStore (Zustand).
 *
 * Tests all actions, selectors, and state transitions.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import { useChatStore } from './chatStore';

describe('chatStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useChatStore.setState({
      messages: [],
      streamingMessage: null,
      agentStatus: 'idle',
    });
  });

  describe('initial state', () => {
    it('starts with empty messages array', () => {
      expect(useChatStore.getState().messages).toEqual([]);
    });

    it('starts with null streamingMessage', () => {
      expect(useChatStore.getState().streamingMessage).toBeNull();
    });

    it('starts with idle agentStatus', () => {
      expect(useChatStore.getState().agentStatus).toBe('idle');
    });
  });

  describe('addUserMessage', () => {
    it('adds a user message to messages array', () => {
      useChatStore.getState().addUserMessage('Hello');
      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello');
    });

    it('generates a unique id for each message', () => {
      useChatStore.getState().addUserMessage('Message 1');
      useChatStore.getState().addUserMessage('Message 2');
      const messages = useChatStore.getState().messages;
      expect(messages[0].id).not.toBe(messages[1].id);
    });

    it('sets timestamp to ISO string', () => {
      useChatStore.getState().addUserMessage('Hello');
      const message = useChatStore.getState().messages[0];
      expect(message.timestamp).toBeTruthy();
      expect(new Date(message.timestamp).toISOString()).toBe(message.timestamp);
    });

    it('sets role to user', () => {
      useChatStore.getState().addUserMessage('Hello');
      expect(useChatStore.getState().messages[0].role).toBe('user');
    });

    it('does not set isError', () => {
      useChatStore.getState().addUserMessage('Hello');
      expect(useChatStore.getState().messages[0].isError).toBeUndefined();
    });

    it('appends multiple messages in order', () => {
      useChatStore.getState().addUserMessage('First');
      useChatStore.getState().addUserMessage('Second');
      const messages = useChatStore.getState().messages;
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
    });
  });

  describe('startAgentStream', () => {
    it('sets streamingMessage to empty string', () => {
      useChatStore.getState().startAgentStream();
      expect(useChatStore.getState().streamingMessage).toBe('');
    });

    it('sets agentStatus to thinking', () => {
      useChatStore.getState().startAgentStream();
      expect(useChatStore.getState().agentStatus).toBe('thinking');
    });

    it('does not add to messages array', () => {
      useChatStore.getState().startAgentStream();
      expect(useChatStore.getState().messages).toHaveLength(0);
    });
  });

  describe('appendStreamDelta', () => {
    it('concatenates delta to streamingMessage', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Hello');
      expect(useChatStore.getState().streamingMessage).toBe('Hello');
    });

    it('concatenates multiple deltas', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Hello');
      useChatStore.getState().appendStreamDelta(' World');
      expect(useChatStore.getState().streamingMessage).toBe('Hello World');
    });

    it('handles empty delta', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Hello');
      useChatStore.getState().appendStreamDelta('');
      expect(useChatStore.getState().streamingMessage).toBe('Hello');
    });
  });

  describe('finalizeAgentMessage', () => {
    it('creates a message from streamingMessage content', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Agent response');
      useChatStore.getState().finalizeAgentMessage();
      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Agent response');
      expect(messages[0].role).toBe('agent');
    });

    it('sets streamingMessage to null', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Response');
      useChatStore.getState().finalizeAgentMessage();
      expect(useChatStore.getState().streamingMessage).toBeNull();
    });

    it('sets agentStatus to idle', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Response');
      useChatStore.getState().finalizeAgentMessage();
      expect(useChatStore.getState().agentStatus).toBe('idle');
    });

    it('generates a unique id for finalized message', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Response');
      useChatStore.getState().finalizeAgentMessage();
      const message = useChatStore.getState().messages[0];
      expect(message.id).toBeTruthy();
    });

    it('sets timestamp on finalized message', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Response');
      useChatStore.getState().finalizeAgentMessage();
      const message = useChatStore.getState().messages[0];
      expect(message.timestamp).toBeTruthy();
      expect(new Date(message.timestamp).toISOString()).toBe(message.timestamp);
    });

    it('handles null streamingMessage gracefully', () => {
      // streamingMessage is null — should not throw or add empty message
      expect(() => {
        useChatStore.getState().finalizeAgentMessage();
      }).not.toThrow();
    });
  });

  describe('addErrorMessage', () => {
    it('adds an error message to messages array', () => {
      useChatStore.getState().addErrorMessage('Something went wrong');
      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(1);
    });

    it('sets role to agent for error messages', () => {
      useChatStore.getState().addErrorMessage('Error occurred');
      expect(useChatStore.getState().messages[0].role).toBe('agent');
    });

    it('sets isError to true', () => {
      useChatStore.getState().addErrorMessage('Error occurred');
      expect(useChatStore.getState().messages[0].isError).toBe(true);
    });

    it('sets content to the provided message', () => {
      useChatStore.getState().addErrorMessage('Provider failed');
      expect(useChatStore.getState().messages[0].content).toBe('Provider failed');
    });

    it('resets streaming state', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('partial...');
      useChatStore.getState().addErrorMessage('Error!');
      expect(useChatStore.getState().streamingMessage).toBeNull();
      expect(useChatStore.getState().agentStatus).toBe('idle');
    });
  });

  describe('setAgentStatus', () => {
    it('sets agentStatus to thinking', () => {
      useChatStore.getState().setAgentStatus('thinking');
      expect(useChatStore.getState().agentStatus).toBe('thinking');
    });

    it('sets agentStatus to discovering', () => {
      useChatStore.getState().setAgentStatus('discovering');
      expect(useChatStore.getState().agentStatus).toBe('discovering');
    });

    it('sets agentStatus to composing', () => {
      useChatStore.getState().setAgentStatus('composing');
      expect(useChatStore.getState().agentStatus).toBe('composing');
    });

    it('sets agentStatus back to idle', () => {
      useChatStore.getState().setAgentStatus('thinking');
      useChatStore.getState().setAgentStatus('idle');
      expect(useChatStore.getState().agentStatus).toBe('idle');
    });
  });

  describe('clearMessages', () => {
    it('clears all messages', () => {
      useChatStore.getState().addUserMessage('Hello');
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().messages).toHaveLength(0);
    });

    it('resets streamingMessage to null', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().streamingMessage).toBeNull();
    });

    it('resets agentStatus to idle', () => {
      useChatStore.getState().setAgentStatus('thinking');
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().agentStatus).toBe('idle');
    });
  });

  describe('getMessages selector', () => {
    it('returns empty array initially', () => {
      expect(useChatStore.getState().getMessages()).toEqual([]);
    });

    it('returns all messages after adding', () => {
      useChatStore.getState().addUserMessage('Hello');
      expect(useChatStore.getState().getMessages()).toHaveLength(1);
    });
  });

  describe('getIsStreaming selector', () => {
    it('returns false when streamingMessage is null', () => {
      expect(useChatStore.getState().getIsStreaming()).toBe(false);
    });

    it('returns true when streamingMessage is a string', () => {
      useChatStore.getState().startAgentStream();
      expect(useChatStore.getState().getIsStreaming()).toBe(true);
    });

    it('returns false after finalizeAgentMessage', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Hello');
      useChatStore.getState().finalizeAgentMessage();
      expect(useChatStore.getState().getIsStreaming()).toBe(false);
    });
  });

  describe('getAgentStatus selector', () => {
    it('returns idle initially', () => {
      expect(useChatStore.getState().getAgentStatus()).toBe('idle');
    });

    it('returns thinking after startAgentStream', () => {
      useChatStore.getState().startAgentStream();
      expect(useChatStore.getState().getAgentStatus()).toBe('thinking');
    });

    it('returns the current agentStatus', () => {
      useChatStore.getState().setAgentStatus('composing');
      expect(useChatStore.getState().getAgentStatus()).toBe('composing');
    });
  });
});
