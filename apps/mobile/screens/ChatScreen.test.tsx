/**
 * Unit tests for ChatScreen (stories 2-5b, 2-4).
 *
 * Tests rendering of ChatThread + ChatInput, handleSend wiring,
 * input disabled state, ModuleLink press navigation,
 * and PromptChips before first message.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock localDb to prevent expo-sqlite crash
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

// Mock useKeyboardVisible hook
jest.mock('@/hooks/useKeyboardVisible', () => ({
  useKeyboardVisible: () => ({ keyboardVisible: false, keyboardHeight: 0 }),
}));

// Mock logger
jest.mock('@/services/logger', () => ({
  logger: { info: jest.fn(), warning: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Track navigation calls
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Mock wsClient
const mockSend = jest.fn();
jest.mock('@/services/wsClient', () => ({
  send: (...args: unknown[]) => mockSend(...args),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { useChatStore } from '@/stores/chatStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { ChatScreen } from './ChatScreen';

describe('ChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useChatStore.setState({
      messages: [],
      streamingMessage: null,
      agentStatus: 'idle',
    });
    useConnectionStore.setState({ status: 'connected' });
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<ChatScreen />)).not.toThrow();
    });

    it('renders ChatInput with "Message input" label', () => {
      const { getByLabelText } = render(<ChatScreen />);
      expect(getByLabelText('Message input')).toBeTruthy();
    });

    it('renders ChatThread with "Conversation thread" label', () => {
      const { getByLabelText } = render(<ChatScreen />);
      expect(getByLabelText('Conversation thread')).toBeTruthy();
    });
  });

  describe('input disabled state', () => {
    it('enables input when agent is idle and connection is connected', () => {
      useChatStore.setState({ agentStatus: 'idle' });
      useConnectionStore.setState({ status: 'connected' });

      const { getByLabelText } = render(<ChatScreen />);
      const sendButton = getByLabelText('Send message');
      // When disabled AND no text, button is disabled (both conditions: no text + disabled)
      // Check that the input is editable
      const input = getByLabelText('Message input');
      expect(input.props.editable).not.toBe(false);
    });

    it('disables input when agent is thinking', () => {
      useChatStore.setState({ agentStatus: 'thinking' });
      useConnectionStore.setState({ status: 'connected' });

      const { getByLabelText } = render(<ChatScreen />);
      const input = getByLabelText('Message input');
      expect(input.props.editable).toBe(false);
    });

    it('disables input when connection is disconnected', () => {
      useChatStore.setState({ agentStatus: 'idle' });
      useConnectionStore.setState({ status: 'disconnected' });

      const { getByLabelText } = render(<ChatScreen />);
      const input = getByLabelText('Message input');
      expect(input.props.editable).toBe(false);
    });

    it('disables input when both agent is busy and disconnected', () => {
      useChatStore.setState({ agentStatus: 'thinking' });
      useConnectionStore.setState({ status: 'disconnected' });

      const { getByLabelText } = render(<ChatScreen />);
      const input = getByLabelText('Message input');
      expect(input.props.editable).toBe(false);
    });
  });

  describe('message sending', () => {
    it('sends message via wsClient when user submits text', () => {
      useChatStore.setState({ agentStatus: 'idle' });
      useConnectionStore.setState({ status: 'connected' });

      const { getByLabelText } = render(<ChatScreen />);
      const input = getByLabelText('Message input');
      const sendButton = getByLabelText('Send message');

      fireEvent.changeText(input, 'Hello world');
      fireEvent.press(sendButton);

      expect(mockSend).toHaveBeenCalledWith({
        type: 'chat',
        payload: { message: 'Hello world' },
      });
    });

    it('adds user message to chatStore when sending', () => {
      useChatStore.setState({ agentStatus: 'idle' });
      useConnectionStore.setState({ status: 'connected' });

      const { getByLabelText } = render(<ChatScreen />);
      const input = getByLabelText('Message input');
      const sendButton = getByLabelText('Send message');

      fireEvent.changeText(input, 'Test message');
      fireEvent.press(sendButton);

      const messages = useChatStore.getState().messages;
      expect(messages.length).toBeGreaterThanOrEqual(1);
      const userMsg = messages.find((m: any) => m.type === 'chat' && m.role === 'user');
      expect(userMsg).toBeDefined();
    });
  });

  describe('prompt chips (before first message)', () => {
    it('shows prompt chips when no messages exist', () => {
      useChatStore.setState({ messages: [] });
      const { getByText } = render(<ChatScreen />);
      expect(getByText("What's the weather like?")).toBeTruthy();
      expect(getByText('Track something for me')).toBeTruthy();
      expect(getByText('Help me organize my week')).toBeTruthy();
    });

    it('hides prompt chips when messages exist', () => {
      useChatStore.setState({
        messages: [
          { id: 'msg-1', type: 'chat', role: 'user', content: 'Hi', timestamp: new Date().toISOString() },
        ],
      });
      const { queryByText } = render(<ChatScreen />);
      expect(queryByText("What's the weather like?")).toBeNull();
    });

    it('sends message when chip is pressed', () => {
      useChatStore.setState({ messages: [] });
      const { getByText } = render(<ChatScreen />);
      fireEvent.press(getByText("What's the weather like?"));
      expect(mockSend).toHaveBeenCalledWith({
        type: 'chat',
        payload: { message: "What's the weather like?" },
      });
    });

    it('shows persona chip when persona is set', () => {
      useChatStore.setState({ messages: [] });
      useConnectionStore.setState({ status: 'connected', persona: 'flame' });
      const { getByText } = render(<ChatScreen />);
      expect(getByText('Automate something')).toBeTruthy();
    });
  });

  describe('ModuleLink press navigation', () => {
    it('navigates to Home with highlightModuleId when ModuleLink is pressed', () => {
      // Set up a module_card message in chat
      const modules = new Map();
      modules.set('mod-1', {
        spec: { moduleId: 'mod-1', title: 'Weather' },
        status: 'active',
        dataStatus: 'ok',
        updatedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      });

      const { useModuleStore } = require('@/stores/moduleStore');
      useModuleStore.setState({ modules });

      useChatStore.setState({
        messages: [
          {
            id: 'msg-1',
            type: 'module_card',
            moduleId: 'mod-1',
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const { getByText } = render(<ChatScreen />);
      // ModuleLink renders with the title "Weather" and "voir" action
      const voirLink = getByText(/voir/);
      fireEvent.press(voirLink);

      expect(mockNavigate).toHaveBeenCalledWith('Home', { highlightModuleId: 'mod-1' });
    });
  });
});
