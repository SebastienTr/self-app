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
 */

import { create } from 'zustand';

import type { AgentState } from '@/types/ws';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  isError?: boolean;
}

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
          id: crypto.randomUUID(),
          role: 'user',
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
      const finalMessage: ChatMessage = {
        id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
          role: 'agent',
          content: message,
          timestamp: new Date().toISOString(),
          isError: true,
        },
      ],
      streamingMessage: null,
      agentStatus: 'idle' as AgentStatus,
    })),

  setAgentStatus: (status) => set({ agentStatus: status }),

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
