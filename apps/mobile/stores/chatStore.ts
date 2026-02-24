/**
 * Zustand store for chat state management.
 *
 * Conventions (from architecture):
 *   - State  = nouns (messages, streamingMessage, agentStatus)
 *   - Actions = imperative verbs (addUserMessage, startAgentStream, appendStreamDelta, ...)
 *   - Selectors = get + descriptive noun (getMessages, getIsStreaming, getAgentStatus)
 *   - NEVER use isLoading: boolean — always use AgentState enum
 *
 * One store per domain: chatStore manages chat ONLY.
 *
 * ChatMessage is a discriminated union:
 *   - type: 'chat' — regular user/agent messages
 *   - type: 'module_card' — inline module card rendered in chat thread
 */

import { create } from 'zustand';

import type { AgentState } from '@/types/ws';

/** UUID v4 with crypto.randomUUID() fallback for older Hermes engines. */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Regular chat message (user or agent). */
export interface ChatMessageChat {
  id: string;
  type: 'chat';
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  isError?: boolean;
}

/** Inline module card entry in chat thread. */
export interface ChatMessageModuleCard {
  id: string;
  type: 'module_card';
  moduleId: string;
  timestamp: string;
}

/** Discriminated union of all chat message types. */
export type ChatMessage = ChatMessageChat | ChatMessageModuleCard;

// AgentStatus = AgentState (same type, reused from ws.ts)
export type AgentStatus = AgentState;

export interface ChatStore {
  // State (nouns)
  messages: ChatMessage[];
  streamingMessage: string | null;
  agentStatus: AgentStatus;

  // Actions (imperative verbs)
  addUserMessage: (content: string) => void;
  startAgentStream: () => void;
  appendStreamDelta: (delta: string) => void;
  finalizeAgentMessage: () => void;
  addErrorMessage: (message: string) => void;
  setAgentStatus: (status: AgentStatus) => void;
  addModuleCard: (moduleId: string) => void;
  clearMessages: () => void;

  // Selectors (get + descriptive noun)
  getMessages: () => ChatMessage[];
  getIsStreaming: () => boolean;
  getAgentStatus: () => AgentStatus;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  messages: [],
  streamingMessage: null,
  agentStatus: 'idle',

  // Actions
  addUserMessage: (content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: uuid(),
          type: 'chat' as const,
          role: 'user' as const,
          content,
          timestamp: new Date().toISOString(),
        },
      ],
    })),

  startAgentStream: () =>
    set({
      streamingMessage: '',
      agentStatus: 'thinking',
    }),

  appendStreamDelta: (delta) =>
    set((state) => ({
      streamingMessage: state.streamingMessage !== null ? state.streamingMessage + delta : delta,
    })),

  finalizeAgentMessage: () =>
    set((state) => {
      if (state.streamingMessage === null) {
        return { agentStatus: 'idle' as AgentStatus };
      }
      const finalMessage: ChatMessageChat = {
        id: uuid(),
        type: 'chat',
        role: 'agent',
        content: state.streamingMessage,
        timestamp: new Date().toISOString(),
      };
      return {
        messages: [...state.messages, finalMessage],
        streamingMessage: null,
        agentStatus: 'idle' as AgentStatus,
      };
    }),

  addErrorMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: uuid(),
          type: 'chat' as const,
          role: 'agent' as const,
          content: message,
          timestamp: new Date().toISOString(),
          isError: true,
        },
      ],
      streamingMessage: null,
      agentStatus: 'idle' as AgentStatus,
    })),

  setAgentStatus: (status) => set({ agentStatus: status }),

  addModuleCard: (moduleId) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: uuid(),
          type: 'module_card' as const,
          moduleId,
          timestamp: new Date().toISOString(),
        },
      ],
    })),

  clearMessages: () =>
    set({
      messages: [],
      streamingMessage: null,
      agentStatus: 'idle',
    }),

  // Selectors
  getMessages: () => get().messages,
  getIsStreaming: () => get().streamingMessage !== null,
  getAgentStatus: () => get().agentStatus,
}));
