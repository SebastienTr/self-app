/**
 * Unit tests for ChatBubble shell component.
 *
 * Tests user/agent/error/streaming variants and accessibility labels.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { ChatBubble } from './ChatBubble';

describe('ChatBubble', () => {
  describe('user bubble', () => {
    it('renders user message content', () => {
      const { getByText } = render(
        <ChatBubble role="user" content="Hello there" />
      );
      expect(getByText('Hello there')).toBeTruthy();
    });

    it('has correct accessibilityRole', () => {
      const { getByRole } = render(
        <ChatBubble role="user" content="Hello" />
      );
      expect(getByRole('text')).toBeTruthy();
    });

    it('has accessibility label combining role and content', () => {
      const { getByLabelText } = render(
        <ChatBubble role="user" content="Hello" />
      );
      expect(getByLabelText('You: Hello')).toBeTruthy();
    });
  });

  describe('agent bubble', () => {
    it('renders agent message content', () => {
      const { getByText } = render(
        <ChatBubble role="agent" content="I can help" />
      );
      expect(getByText('I can help')).toBeTruthy();
    });

    it('has accessibility label combining role and content', () => {
      const { getByLabelText } = render(
        <ChatBubble role="agent" content="I can help" />
      );
      expect(getByLabelText('Agent: I can help')).toBeTruthy();
    });
  });

  describe('error bubble', () => {
    it('renders error message content', () => {
      const { getByText } = render(
        <ChatBubble role="agent" content="Something went wrong" isError />
      );
      expect(getByText('Something went wrong')).toBeTruthy();
    });

    it('has accessibility label for error', () => {
      const { getByLabelText } = render(
        <ChatBubble role="agent" content="Error message" isError />
      );
      expect(getByLabelText('Agent: Error message')).toBeTruthy();
    });
  });

  describe('streaming bubble', () => {
    it('renders partial streaming content', () => {
      const { getByText } = render(
        <ChatBubble role="agent" content="Partial respon..." isStreaming />
      );
      expect(getByText('Partial respon...')).toBeTruthy();
    });

    it('renders streaming indicator', () => {
      const { getByTestId } = render(
        <ChatBubble role="agent" content="Hello" isStreaming />
      );
      expect(getByTestId('streaming-indicator')).toBeTruthy();
    });

    it('does not render streaming indicator when not streaming', () => {
      const { queryByTestId } = render(
        <ChatBubble role="agent" content="Complete response" />
      );
      expect(queryByTestId('streaming-indicator')).toBeNull();
    });

    it('does not render streaming indicator for user messages', () => {
      const { queryByTestId } = render(
        <ChatBubble role="user" content="User message" isStreaming />
      );
      expect(queryByTestId('streaming-indicator')).toBeNull();
    });
  });

  describe('pure component behavior', () => {
    it('renders without crashing with minimal props', () => {
      expect(() =>
        render(<ChatBubble role="user" content="test" />)
      ).not.toThrow();
    });

    it('renders without crashing for agent role', () => {
      expect(() =>
        render(<ChatBubble role="agent" content="test" />)
      ).not.toThrow();
    });
  });
});
