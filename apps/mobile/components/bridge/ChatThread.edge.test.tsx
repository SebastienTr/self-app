/**
 * Edge-case tests for ChatThread bridge component — Story 2.1 TEA expansion.
 *
 * Covers paths NOT exercised by ChatThread.test.tsx:
 *   - Empty streaming message bubble (streamingMessage = '')
 *   - Mixed messages list: user + agent + error in sequence
 *   - isError flag correctly propagated to ChatBubble (error border check via testID is indirect)
 *   - Large message list renders without crashing
 *   - Streaming message renders with accessibility label
 *   - Transition: messages present AND streaming message simultaneously
 *   - StreamingMessage becomes null (finalized) — streaming bubble disappears
 *   - Message with isError=true does not show streaming indicator
 *   - Re-render with updated messages list (store selector update)
 *   - Zero-length streamingMessage (empty string) is still rendered as streaming bubble
 */

jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock chatStore
jest.mock('@/stores/chatStore', () => ({
  useChatStore: jest.fn(),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { useChatStore, type ChatStore } from '@/stores/chatStore';
import { ChatThread } from './ChatThread';

const mockUseChatStore = useChatStore as jest.MockedFunction<typeof useChatStore>;

function makeState(partial: Partial<ChatStore>): ChatStore {
  return partial as unknown as ChatStore;
}

describe('ChatThread — edge cases', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('empty string streamingMessage (streaming started, no delta yet)', () => {
    it('renders streaming bubble even when streamingMessage is empty string', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(makeState({ messages: [], streamingMessage: '' }))
      );

      const { getByTestId } = render(<ChatThread />);
      // Empty string is not null — streaming bubble should appear
      expect(getByTestId('streaming-indicator')).toBeTruthy();
    });

    it('renders streaming bubble with empty content when streamingMessage is empty string', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(makeState({ messages: [], streamingMessage: '' }))
      );

      // Should not throw even with empty string content
      expect(() => render(<ChatThread />)).not.toThrow();
    });
  });

  describe('mixed message types in sequence', () => {
    it('renders user, agent, and error messages together without crashing', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(
          makeState({
            messages: [
              {
                id: '1',
                role: 'user',
                content: 'Hello',
                timestamp: '2026-01-01T00:00:00.000Z',
              },
              {
                id: '2',
                role: 'agent',
                content: 'Hi there!',
                timestamp: '2026-01-01T00:00:01.000Z',
              },
              {
                id: '3',
                role: 'agent',
                content: 'Something went wrong',
                timestamp: '2026-01-01T00:00:02.000Z',
                isError: true,
              },
            ],
            streamingMessage: null,
          })
        )
      );

      const { getByText } = render(<ChatThread />);
      expect(getByText('Hello')).toBeTruthy();
      expect(getByText('Hi there!')).toBeTruthy();
      expect(getByText('Something went wrong')).toBeTruthy();
    });

    it('all three message types are visible simultaneously', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(
          makeState({
            messages: [
              {
                id: '1',
                role: 'user',
                content: 'User question',
                timestamp: '2026-01-01T00:00:00.000Z',
              },
              {
                id: '2',
                role: 'agent',
                content: 'Agent answer',
                timestamp: '2026-01-01T00:00:01.000Z',
              },
              {
                id: '3',
                role: 'agent',
                content: 'Error: Provider unavailable',
                timestamp: '2026-01-01T00:00:02.000Z',
                isError: true,
              },
            ],
            streamingMessage: null,
          })
        )
      );

      const { getAllByRole } = render(<ChatThread />);
      // Each ChatBubble has accessibilityRole="text"
      const bubbles = getAllByRole('text');
      expect(bubbles).toHaveLength(3);
    });
  });

  describe('messages AND streaming message simultaneously', () => {
    it('renders both finalized messages and streaming bubble at the same time', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(
          makeState({
            messages: [
              {
                id: '1',
                role: 'user',
                content: 'What is 2+2?',
                timestamp: '2026-01-01T00:00:00.000Z',
              },
            ],
            streamingMessage: 'The answer is...',
          })
        )
      );

      const { getByText, getByTestId } = render(<ChatThread />);
      expect(getByText('What is 2+2?')).toBeTruthy();
      expect(getByText('The answer is...')).toBeTruthy();
      expect(getByTestId('streaming-indicator')).toBeTruthy();
    });

    it('renders exactly one streaming indicator when messages exist + streaming', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(
          makeState({
            messages: [
              {
                id: '1',
                role: 'user',
                content: 'Question',
                timestamp: '2026-01-01T00:00:00.000Z',
              },
              {
                id: '2',
                role: 'agent',
                content: 'Previous answer',
                timestamp: '2026-01-01T00:00:01.000Z',
              },
            ],
            streamingMessage: 'New streaming...',
          })
        )
      );

      const { getAllByTestId } = render(<ChatThread />);
      // Only the active streaming bubble should have the indicator
      expect(getAllByTestId('streaming-indicator')).toHaveLength(1);
    });
  });

  describe('finalized messages do not show streaming indicator', () => {
    it('completed agent messages do not render streaming indicator', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(
          makeState({
            messages: [
              {
                id: '1',
                role: 'agent',
                content: 'Completed response',
                timestamp: '2026-01-01T00:00:00.000Z',
              },
            ],
            streamingMessage: null,
          })
        )
      );

      const { queryByTestId } = render(<ChatThread />);
      expect(queryByTestId('streaming-indicator')).toBeNull();
    });

    it('error messages do not show streaming indicator', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(
          makeState({
            messages: [
              {
                id: '1',
                role: 'agent',
                content: 'LLM failed',
                timestamp: '2026-01-01T00:00:00.000Z',
                isError: true,
              },
            ],
            streamingMessage: null,
          })
        )
      );

      const { queryByTestId } = render(<ChatThread />);
      expect(queryByTestId('streaming-indicator')).toBeNull();
    });
  });

  describe('large message lists', () => {
    it('renders 50 messages without crashing', () => {
      const messages = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        role: (i % 2 === 0 ? 'user' : 'agent') as 'user' | 'agent',
        content: `Message ${i}`,
        timestamp: `2026-01-01T00:${String(i).padStart(2, '0')}:00.000Z`,
      }));

      mockUseChatStore.mockImplementation((selector) =>
        selector(makeState({ messages, streamingMessage: null }))
      );

      expect(() => render(<ChatThread />)).not.toThrow();
    });
  });

  describe('accessibility', () => {
    it('conversation thread accessibility label is always present', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(makeState({ messages: [], streamingMessage: null }))
      );

      const { getByLabelText } = render(<ChatThread />);
      expect(getByLabelText('Conversation thread')).toBeTruthy();
    });

    it('streaming bubble has agent accessibility label', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(makeState({ messages: [], streamingMessage: 'Typing...' }))
      );

      const { getByLabelText } = render(<ChatThread />);
      expect(getByLabelText('Agent: Typing...')).toBeTruthy();
    });

    it('user messages have You: prefix in accessibility label', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(
          makeState({
            messages: [
              {
                id: '1',
                role: 'user',
                content: 'My question',
                timestamp: '2026-01-01T00:00:00.000Z',
              },
            ],
            streamingMessage: null,
          })
        )
      );

      const { getByLabelText } = render(<ChatThread />);
      expect(getByLabelText('You: My question')).toBeTruthy();
    });
  });

  describe('re-render with updated store state', () => {
    it('updates rendered content when messages list changes', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(makeState({ messages: [], streamingMessage: null }))
      );

      const { rerender, queryByText } = render(<ChatThread />);
      expect(queryByText('New message')).toBeNull();

      // Simulate store update
      mockUseChatStore.mockImplementation((selector) =>
        selector(
          makeState({
            messages: [
              {
                id: '1',
                role: 'user',
                content: 'New message',
                timestamp: '2026-01-01T00:00:00.000Z',
              },
            ],
            streamingMessage: null,
          })
        )
      );

      rerender(<ChatThread />);
      expect(queryByText('New message')).toBeTruthy();
    });

    it('streaming bubble disappears after finalization (streamingMessage becomes null)', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(makeState({ messages: [], streamingMessage: 'In progress...' }))
      );

      const { rerender, queryByTestId } = render(<ChatThread />);
      expect(queryByTestId('streaming-indicator')).toBeTruthy();

      // Simulate finalization
      mockUseChatStore.mockImplementation((selector) =>
        selector(
          makeState({
            messages: [
              {
                id: '1',
                role: 'agent',
                content: 'In progress...',
                timestamp: '2026-01-01T00:00:00.000Z',
              },
            ],
            streamingMessage: null,
          })
        )
      );

      rerender(<ChatThread />);
      expect(queryByTestId('streaming-indicator')).toBeNull();
    });
  });
});
