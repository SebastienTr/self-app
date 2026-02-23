/**
 * Chat sync service — WS message handler registration for chat-related messages.
 *
 * Registers handlers for:
 *   - chat_stream → streams agent response tokens into chatStore
 *   - status      → updates agentStatus in chatStore
 *   - error       → shows error message if agent was processing
 *
 * Call initChatSync() on app startup to register handlers.
 * Follows the same pattern as moduleSync.ts.
 */

import type { WSMessage } from '@/types/ws';
import { onMessage } from '@/services/wsClient';
import { useChatStore } from '@/stores/chatStore';

/** Unsubscribe functions returned by onMessage registrations. */
let unsubscribers: (() => void)[] = [];

/**
 * Initialize chat sync handlers.
 * Registers WS message handlers for all chat-related message types.
 * Call once on app startup.
 * Returns an unsubscribe/cleanup function.
 */
export function initChatSync(): () => void {
  // Clean up any previous registrations
  cleanupChatSync();

  // chat_stream — agent response streaming
  unsubscribers.push(
    onMessage('chat_stream', (msg: WSMessage) => {
      if (msg.type !== 'chat_stream') return;
      const store = useChatStore.getState();

      if (!msg.payload.done) {
        // Start stream if not already started
        if (store.streamingMessage === null) {
          store.startAgentStream();
        }
        store.appendStreamDelta(msg.payload.delta);
      } else {
        store.finalizeAgentMessage();
      }
    }),
  );

  // status — agent state updates
  unsubscribers.push(
    onMessage('status', (msg: WSMessage) => {
      if (msg.type !== 'status') return;
      useChatStore.getState().setAgentStatus(msg.payload.state);
    }),
  );

  // error — LLM errors during chat (only when agent was processing)
  unsubscribers.push(
    onMessage('error', (msg: WSMessage) => {
      if (msg.type !== 'error') return;
      const store = useChatStore.getState();
      // Only handle errors when the agent was actively processing
      // AUTH errors (AUTH_REQUIRED, etc.) are handled by wsClient itself
      if (store.agentStatus !== 'idle') {
        store.addErrorMessage(msg.payload.message ?? 'Agent error');
      }
    }),
  );

  // Return cleanup function for use in App.tsx
  return cleanupChatSync;
}

/**
 * Clean up chat sync handlers.
 */
export function cleanupChatSync(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers = [];
}
