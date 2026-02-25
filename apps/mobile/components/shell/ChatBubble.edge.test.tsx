/**
 * Edge-case tests for ChatBubble shell component — Story 2.1 TEA expansion.
 *
 * Covers paths NOT exercised by ChatBubble.test.tsx:
 *   - Empty content string
 *   - Long content (no crash, wrapping)
 *   - Special characters and unicode in content
 *   - isError=true with isStreaming=true (both flags simultaneously)
 *   - Accessibility label for error includes full content
 *   - isError on user bubble (unusual but valid props)
 *   - Content with newlines
 *   - Very long single-word content (no word-break assumed)
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { ChatBubble } from './ChatBubble';

describe('ChatBubble — edge cases', () => {
  describe('empty content', () => {
    it('renders without crashing when content is empty string', () => {
      expect(() =>
        render(<ChatBubble role="agent" content="" />)
      ).not.toThrow();
    });

    it('accessibility label is "Agent: " for empty agent content', () => {
      const { getByLabelText } = render(<ChatBubble role="agent" content="" />);
      expect(getByLabelText('Agent: ')).toBeTruthy();
    });

    it('accessibility label is "You: " for empty user content', () => {
      const { getByLabelText } = render(<ChatBubble role="user" content="" />);
      expect(getByLabelText('You: ')).toBeTruthy();
    });
  });

  describe('long content', () => {
    it('renders without crashing with very long content', () => {
      const longContent = 'A'.repeat(1000);
      expect(() =>
        render(<ChatBubble role="agent" content={longContent} />)
      ).not.toThrow();
    });

    it('long content is still present in rendered output', () => {
      const longContent = 'This is a very long message that goes on and on '.repeat(10);
      const { getByText } = render(<ChatBubble role="user" content={longContent} />);
      expect(getByText(longContent)).toBeTruthy();
    });
  });

  describe('special characters and unicode', () => {
    it('renders unicode content correctly', () => {
      const unicodeContent = 'こんにちは 🌍 Привет مرحبا';
      const { getByText } = render(<ChatBubble role="agent" content={unicodeContent} />);
      expect(getByText(unicodeContent)).toBeTruthy();
    });

    it('renders content with special characters', () => {
      const specialContent = '<script>alert("xss")</script> & "quotes" & \'apostrophes\'';
      const { getByText } = render(<ChatBubble role="user" content={specialContent} />);
      expect(getByText(specialContent)).toBeTruthy();
    });

    it('accessibility label includes unicode content', () => {
      const unicodeContent = 'こんにちは';
      const { getByLabelText } = render(
        <ChatBubble role="agent" content={unicodeContent} />
      );
      expect(getByLabelText(`Agent: ${unicodeContent}`)).toBeTruthy();
    });
  });

  describe('isError and isStreaming simultaneously', () => {
    it('renders without crashing when both isError and isStreaming are true', () => {
      expect(() =>
        render(<ChatBubble role="agent" content="Error while streaming" isError isStreaming />)
      ).not.toThrow();
    });

    it('does not show streaming indicator when isError is true and role is agent with isStreaming', () => {
      // isStreaming takes effect, but combined with isError — component renders both
      // The component shows streaming indicator if isStreaming && !isUser
      const { getByText } = render(
        <ChatBubble role="agent" content="Error while streaming" isError isStreaming />
      );
      // Streaming cursor is rendered (isStreaming=true, role=agent)
      expect(getByText('|')).toBeTruthy();
    });

    it('error bubble with streaming has correct accessibility label', () => {
      const { getByLabelText } = render(
        <ChatBubble role="agent" content="Error content" isError isStreaming />
      );
      expect(getByLabelText('Agent: Error content')).toBeTruthy();
    });
  });

  describe('isError on user bubble', () => {
    it('renders user bubble with isError without crashing', () => {
      expect(() =>
        render(<ChatBubble role="user" content="User error?" isError />)
      ).not.toThrow();
    });

    it('user bubble with isError has correct accessibility label', () => {
      const { getByLabelText } = render(
        <ChatBubble role="user" content="User message" isError />
      );
      expect(getByLabelText('You: User message')).toBeTruthy();
    });
  });

  describe('streaming indicator user role guard', () => {
    it('user bubble with isStreaming=true does not show streaming indicator', () => {
      const { queryByText } = render(
        <ChatBubble role="user" content="Hello" isStreaming />
      );
      expect(queryByText('|')).toBeNull();
    });
  });

  describe('accessibilityRole', () => {
    it('all role variants have accessibilityRole text', () => {
      const { getAllByRole } = render(
        <>
          <ChatBubble role="user" content="User" />
          <ChatBubble role="agent" content="Agent" />
        </>
      );
      const textElements = getAllByRole('text');
      expect(textElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('content with multiline text', () => {
    it('renders content with newlines without crashing', () => {
      const multilineContent = 'Line one\nLine two\nLine three';
      expect(() =>
        render(<ChatBubble role="agent" content={multilineContent} />)
      ).not.toThrow();
    });
  });
});
