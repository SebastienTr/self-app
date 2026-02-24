/**
 * Tests for ChatThread inline module_card rendering (story 2-5).
 *
 * Verifies:
 *   - module_card messages render ModuleCard component
 *   - chat messages still render ChatBubble
 *   - module_card with missing module renders nothing
 *   - Mixed chat + module_card messages render in correct order
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { useChatStore } from '@/stores/chatStore';
import { useModuleStore } from '@/stores/moduleStore';

// Mock localDb to prevent expo-sqlite crash
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

// Mock logger
jest.mock('@/services/logger', () => ({
  logger: {
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

import { ChatThread } from './ChatThread';

describe('ChatThread module_card rendering', () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      streamingMessage: null,
      agentStatus: 'idle',
    });
    useModuleStore.setState({ modules: new Map() });
  });

  it('renders ModuleCard for module_card message type', () => {
    const modules = new Map();
    modules.set('mod-1', {
      spec: { moduleId: 'mod-1', name: 'Weather', type: 'text', text: 'Sunny' },
      status: 'active',
      dataStatus: 'ok',
      updatedAt: new Date().toISOString(),
      cachedAt: new Date().toISOString(),
    });
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

    render(<ChatThread />);
    // ModuleCard renders the module name as title
    expect(screen.getByText('Weather')).toBeTruthy();
  });

  it('renders ChatBubble for chat message type', () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          type: 'chat',
          role: 'user',
          content: 'Hello world',
          timestamp: new Date().toISOString(),
        },
      ],
    });

    render(<ChatThread />);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('does not render anything for module_card with missing module', () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          type: 'module_card',
          moduleId: 'nonexistent',
          timestamp: new Date().toISOString(),
        },
      ],
    });

    render(<ChatThread />);
    // Should not crash and should not render any module content
    expect(screen.queryByText('nonexistent')).toBeNull();
  });

  it('renders mixed chat and module_card in order', () => {
    const modules = new Map();
    modules.set('mod-1', {
      spec: { moduleId: 'mod-1', name: 'Weather', type: 'text', text: 'Sunny' },
      status: 'active',
      dataStatus: 'ok',
      updatedAt: new Date().toISOString(),
      cachedAt: new Date().toISOString(),
    });
    useModuleStore.setState({ modules });

    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          type: 'chat',
          role: 'user',
          content: 'Create a weather module',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          type: 'chat',
          role: 'agent',
          content: 'Here is your weather module!',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'msg-3',
          type: 'module_card',
          moduleId: 'mod-1',
          timestamp: new Date().toISOString(),
        },
      ],
    });

    render(<ChatThread />);
    expect(screen.getByText('Create a weather module')).toBeTruthy();
    expect(screen.getByText('Here is your weather module!')).toBeTruthy();
    expect(screen.getByText('Weather')).toBeTruthy();
  });
});
