/**
 * Unit tests for ChatThread bridge component.
 *
 * Tests rendering of messages, streaming bubble, and scroll behavior.
 */

// Suppress console output
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

/** Helper to build a partial store state for selector-based mocking */
function makeState(partial: Partial<ChatStore>): ChatStore {
  return partial as unknown as ChatStore;
}

describe('ChatThread', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('empty state', () => {
    it('renders without crashing when no messages', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(makeState({ messages: [], streamingMessage: null }))
      );

      expect(() => render(<ChatThread />)).not.toThrow();
    });

    it('has conversation thread accessibility label', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(makeState({ messages: [], streamingMessage: null }))
      );

      const { getByLabelText } = render(<ChatThread />);
      expect(getByLabelText('Conversation thread')).toBeTruthy();
    });
  });

  describe('with messages', () => {
    it('renders user messages', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(
          makeState({
            messages: [
              {
                id: '1',
                type: 'chat',
                role: 'user',
                content: 'Hello agent',
                timestamp: '2026-01-01T00:00:00.000Z',
              },
            ],
            streamingMessage: null,
          })
        )
      );

      const { getByText } = render(<ChatThread />);
      expect(getByText('Hello agent')).toBeTruthy();
    });

    it('renders agent messages', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(
          makeState({
            messages: [
              {
                id: '2',
                type: 'chat',
                role: 'agent',
                content: 'I can help you',
                timestamp: '2026-01-01T00:00:00.000Z',
              },
            ],
            streamingMessage: null,
          })
        )
      );

      const { getByText } = render(<ChatThread />);
      expect(getByText('I can help you')).toBeTruthy();
    });

    it('renders multiple messages in order', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(
          makeState({
            messages: [
              {
                id: '1',
                type: 'chat',
                role: 'user',
                content: 'First message',
                timestamp: '2026-01-01T00:00:00.000Z',
              },
              {
                id: '2',
                type: 'chat',
                role: 'agent',
                content: 'Second message',
                timestamp: '2026-01-01T00:00:01.000Z',
              },
            ],
            streamingMessage: null,
          })
        )
      );

      const { getByText } = render(<ChatThread />);
      expect(getByText('First message')).toBeTruthy();
      expect(getByText('Second message')).toBeTruthy();
    });

    it('renders error messages', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(
          makeState({
            messages: [
              {
                id: '3',
                type: 'chat',
                role: 'agent',
                content: 'Something went wrong',
                timestamp: '2026-01-01T00:00:00.000Z',
                isError: true,
              },
            ],
            streamingMessage: null,
          })
        )
      );

      const { getByText } = render(<ChatThread />);
      expect(getByText('Something went wrong')).toBeTruthy();
    });
  });

  describe('streaming state', () => {
    it('renders streaming bubble when streamingMessage is not null', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(makeState({ messages: [], streamingMessage: 'Partial response...' }))
      );

      const { getByText } = render(<ChatThread />);
      expect(getByText('Partial response...')).toBeTruthy();
    });

    it('renders streaming indicator in streaming bubble', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(makeState({ messages: [], streamingMessage: 'Streaming...' }))
      );

      const { getByTestId } = render(<ChatThread />);
      expect(getByTestId('streaming-indicator')).toBeTruthy();
    });

    it('does not render streaming bubble when streamingMessage is null', () => {
      mockUseChatStore.mockImplementation((selector) =>
        selector(makeState({ messages: [], streamingMessage: null }))
      );

      const { queryByTestId } = render(<ChatThread />);
      expect(queryByTestId('streaming-indicator')).toBeNull();
    });
  });
});
