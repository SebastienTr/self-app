/**
 * Edge-case tests for chatStore (Zustand) — Story 2.1 TEA expansion.
 *
 * Covers paths NOT exercised by chatStore.test.ts:
 *   - appendStreamDelta when streamingMessage is null (null-guard branch)
 *   - finalizeAgentMessage with empty string streamingMessage (falsy but valid)
 *   - Full streaming cycle: stream → finalize preserves prior messages
 *   - addUserMessage empty content (empty string is valid)
 *   - clearMessages preserves store shape (no extra keys)
 *   - Multiple rapid state transitions (ordering safety)
 *   - addErrorMessage when streamingMessage is empty string (not just null)
 *   - setAgentStatus does not affect messages or streamingMessage
 *   - getIsStreaming: true for empty string streamingMessage
 */

jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import { useChatStore, type ChatMessageChat } from './chatStore';

function asChat(msg: unknown): ChatMessageChat {
  return msg as ChatMessageChat;
}

describe('chatStore — edge cases', () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      streamingMessage: null,
      agentStatus: 'idle',
    });
  });

  describe('appendStreamDelta — null streamingMessage guard', () => {
    it('handles appendStreamDelta when streamingMessage is null (guard branch)', () => {
      // streamingMessage starts as null, not via startAgentStream
      // The implementation: null + delta = delta (concat guard)
      useChatStore.getState().appendStreamDelta('orphan delta');
      // Should not throw, and should set streamingMessage to just delta
      expect(useChatStore.getState().streamingMessage).toBe('orphan delta');
    });

    it('appendStreamDelta null guard produces non-null streamingMessage', () => {
      useChatStore.getState().appendStreamDelta('first');
      expect(useChatStore.getState().streamingMessage).not.toBeNull();
    });
  });

  describe('finalizeAgentMessage — empty string streamingMessage', () => {
    it('finalizes an empty streaming message (adds empty-content agent message)', () => {
      useChatStore.getState().startAgentStream();
      // Do NOT append anything — streamingMessage is ''
      useChatStore.getState().finalizeAgentMessage();
      const messages = useChatStore.getState().messages;
      // Empty string is a valid content value — should create a message
      expect(messages).toHaveLength(1);
      expect(asChat(messages[0]).content).toBe('');
      expect(asChat(messages[0]).role).toBe('agent');
    });

    it('finalizeAgentMessage with empty string resets streamingMessage to null', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().finalizeAgentMessage();
      expect(useChatStore.getState().streamingMessage).toBeNull();
    });

    it('finalizeAgentMessage with empty string resets agentStatus to idle', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().finalizeAgentMessage();
      expect(useChatStore.getState().agentStatus).toBe('idle');
    });
  });

  describe('full streaming cycle preserves prior user messages', () => {
    it('prior user messages survive a full agent streaming cycle', () => {
      useChatStore.getState().addUserMessage('Hello');
      useChatStore.getState().addUserMessage('World');
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Response');
      useChatStore.getState().finalizeAgentMessage();

      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(3);
      expect(asChat(messages[0]).content).toBe('Hello');
      expect(asChat(messages[1]).content).toBe('World');
      expect(asChat(messages[2]).content).toBe('Response');
      expect(asChat(messages[2]).role).toBe('agent');
    });

    it('finalized agent message is appended after user messages', () => {
      useChatStore.getState().addUserMessage('Question');
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Answer');
      useChatStore.getState().finalizeAgentMessage();

      const messages = useChatStore.getState().messages;
      expect(asChat(messages[0]).role).toBe('user');
      expect(asChat(messages[1]).role).toBe('agent');
    });

    it('getIsStreaming is false before streaming, true during, false after', () => {
      expect(useChatStore.getState().getIsStreaming()).toBe(false);

      useChatStore.getState().startAgentStream();
      expect(useChatStore.getState().getIsStreaming()).toBe(true);

      useChatStore.getState().appendStreamDelta('hello');
      expect(useChatStore.getState().getIsStreaming()).toBe(true);

      useChatStore.getState().finalizeAgentMessage();
      expect(useChatStore.getState().getIsStreaming()).toBe(false);
    });
  });

  describe('getIsStreaming — empty string streamingMessage', () => {
    it('returns true when streamingMessage is empty string (not null)', () => {
      useChatStore.getState().startAgentStream();
      // streamingMessage is '' after startAgentStream
      expect(useChatStore.getState().streamingMessage).toBe('');
      expect(useChatStore.getState().getIsStreaming()).toBe(true);
    });
  });

  describe('addUserMessage — empty string content', () => {
    it('allows empty string content for user message', () => {
      useChatStore.getState().addUserMessage('');
      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(asChat(messages[0]).content).toBe('');
      expect(asChat(messages[0]).role).toBe('user');
    });

    it('empty string user message still gets a unique id and timestamp', () => {
      useChatStore.getState().addUserMessage('');
      const msg = useChatStore.getState().messages[0];
      expect(msg.id).toBeTruthy();
      expect(msg.timestamp).toBeTruthy();
    });
  });

  describe('addErrorMessage — when streaming was in progress', () => {
    it('resets streamingMessage from empty string to null', () => {
      // startAgentStream sets streamingMessage to ''
      useChatStore.getState().startAgentStream();
      expect(useChatStore.getState().streamingMessage).toBe('');
      useChatStore.getState().addErrorMessage('Error!');
      expect(useChatStore.getState().streamingMessage).toBeNull();
    });

    it('error message id is distinct from prior user message ids', () => {
      useChatStore.getState().addUserMessage('Hello');
      useChatStore.getState().startAgentStream();
      useChatStore.getState().addErrorMessage('Error occurred');
      const messages = useChatStore.getState().messages;
      expect(messages[0].id).not.toBe(messages[1].id);
    });

    it('multiple error messages each get unique ids', () => {
      useChatStore.getState().addErrorMessage('First error');
      useChatStore.getState().setAgentStatus('thinking');
      useChatStore.getState().addErrorMessage('Second error');
      const messages = useChatStore.getState().messages;
      expect(messages[0].id).not.toBe(messages[1].id);
    });
  });

  describe('setAgentStatus — isolated state change', () => {
    it('setAgentStatus does not affect messages array', () => {
      useChatStore.getState().addUserMessage('Hello');
      useChatStore.getState().setAgentStatus('thinking');
      expect(useChatStore.getState().messages).toHaveLength(1);
    });

    it('setAgentStatus does not affect streamingMessage', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('partial');
      useChatStore.getState().setAgentStatus('composing');
      expect(useChatStore.getState().streamingMessage).toBe('partial');
    });

    it('setAgentStatus to discovering is reflected in getAgentStatus', () => {
      useChatStore.getState().setAgentStatus('discovering');
      expect(useChatStore.getState().getAgentStatus()).toBe('discovering');
    });
  });

  describe('clearMessages — full state reset', () => {
    it('clears messages even when streamingMessage is in progress', () => {
      useChatStore.getState().addUserMessage('Hello');
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Response...');
      useChatStore.getState().clearMessages();

      expect(useChatStore.getState().messages).toHaveLength(0);
      expect(useChatStore.getState().streamingMessage).toBeNull();
      expect(useChatStore.getState().agentStatus).toBe('idle');
    });

    it('getIsStreaming returns false after clearMessages', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().getIsStreaming()).toBe(false);
    });

    it('getMessages returns empty array after clearMessages', () => {
      useChatStore.getState().addUserMessage('Hello');
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().getMessages()).toEqual([]);
    });
  });

  describe('ChatMessage shape invariants', () => {
    it('finalized agent message does not have isError set', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Normal response');
      useChatStore.getState().finalizeAgentMessage();
      const msg = useChatStore.getState().messages[0];
      expect(asChat(msg).isError).toBeUndefined();
    });

    it('user messages never have isError set', () => {
      useChatStore.getState().addUserMessage('Hello');
      const msg = useChatStore.getState().messages[0];
      expect(asChat(msg).isError).toBeUndefined();
    });

    it('each addUserMessage call generates distinct UUIDs', () => {
      const count = 5;
      for (let i = 0; i < count; i++) {
        useChatStore.getState().addUserMessage(`Message ${i}`);
      }
      const ids = useChatStore.getState().messages.map((m) => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(count);
    });
  });
});
