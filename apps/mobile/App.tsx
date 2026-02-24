import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useChatStore } from '@/stores/chatStore';
import { connect, disconnect, loadPersistedMessages, send } from '@/services/wsClient';
import { initLocalDb, getCachedModules } from '@/services/localDb';
import { getSessionToken, getStoredBackendUrl } from '@/services/auth';
import { initModuleSync, cleanupModuleSync } from '@/services/moduleSync';
import { initChatSync, cleanupChatSync } from '@/services/chatSync';
import { logger } from '@/services/logger';
import { ModuleList, ChatThread } from '@/components/bridge';
import { PairingScreen, Orb, ChatInput } from '@/components/shell';
import { tokens } from '@/constants/tokens';
import type { ConnectionStatus } from '@/types/ws';

/** Map connection status to a colored indicator. */
const STATUS_COLORS: Record<ConnectionStatus, string> = {
  connected: tokens.colors.success,
  connecting: tokens.colors.warning,
  reconnecting: tokens.colors.warning,
  disconnected: tokens.colors.error,
};

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting...',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
};

export default function App() {
  const status = useConnectionStore((s) => s.status);
  const moduleCount = useModuleStore((s) => s.modules.size);
  const authStatus = useAuthStore((s) => s.authStatus);
  const agentStatus = useChatStore((s) => s.agentStatus);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function startup() {
      const startTime = Date.now();

      // 1. Initialize local database
      await initLocalDb();

      // 2. Load cached modules from expo-sqlite
      const cached = await getCachedModules();
      if (cached.length > 0) {
        useModuleStore.getState().loadFromCache(cached);
      }

      // 3. Load persisted pending messages
      await loadPersistedMessages();

      // 4. Load auth state from SecureStore
      const [token, backendUrl] = await Promise.all([
        getSessionToken(),
        getStoredBackendUrl(),
      ]);

      const authStore = useAuthStore.getState();
      // In dev, prefer env var URL over stored URL (handles tunnel mode)
      const effectiveUrl =
        __DEV__ && process.env.EXPO_PUBLIC_DEV_BACKEND_URL
          ? process.env.EXPO_PUBLIC_DEV_BACKEND_URL
          : backendUrl;

      if (token && effectiveUrl) {
        authStore.setSessionToken(token);
        authStore.setBackendUrl(effectiveUrl);
        authStore.setAuthStatus('authenticating');
      }

      // 5. Register module sync handlers
      initModuleSync();

      // 5b. Register chat sync handlers
      initChatSync();

      setInitialized(true);

      const startupDuration = Date.now() - startTime;
      logger.info('app', 'startup_complete', {
        cached_modules: cached.length,
        startup_ms: startupDuration,
        has_session: !!token,
        agent_action: startupDuration > 2000
          ? 'Startup exceeded 2s target (NFR1). Investigate slow operations.'
          : null,
      });

      // 6. Connect to WebSocket if session is configured
      if (token && effectiveUrl) {
        connect(effectiveUrl);
      }
    }

    startup();

    return () => {
      disconnect();
      cleanupModuleSync();
      cleanupChatSync();
    };
  }, []);

  /** Handle sending a chat message: add to store + send to backend. */
  function handleSend(message: string) {
    useChatStore.getState().addUserMessage(message);
    send({ type: 'chat', payload: { message } });
  }

  // Show pairing screen if not configured or auth failed
  const showPairing =
    authStatus === 'unconfigured' ||
    authStatus === 'auth_failed' ||
    authStatus === 'pairing';

  const isInputDisabled = agentStatus !== 'idle' || status !== 'connected';

  return (
    <View style={styles.container}>
      {initialized && showPairing ? (
        <PairingScreen />
      ) : (
        <>
          <Text style={styles.title}>self</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: STATUS_COLORS[status] },
              ]}
            />
            <Text style={styles.statusText}>
              {STATUS_LABELS[status]}
              {moduleCount > 0 ? ` \u00B7 ${moduleCount} module${moduleCount !== 1 ? 's' : ''}` : ''}
            </Text>
          </View>

          {/* Orb: agent state indicator */}
          <Orb />

          {/* ChatThread: scrollable message list */}
          {initialized && <ChatThread />}

          {/* ModuleList: SDUI module rendering (Epic 3) */}
          {initialized && <ModuleList />}

          {/* ChatInput: message input at bottom */}
          {initialized && (
            <ChatInput
              onSend={handleSend}
              disabled={isInputDisabled}
            />
          )}
        </>
      )}

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    alignItems: 'center',
    paddingTop: 60,
  },
  title: {
    ...tokens.typography.title,
    fontSize: 32,
    color: tokens.colors.text,
    marginBottom: tokens.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    ...tokens.typography.caption,
    color: tokens.colors.textSecondary,
  },
});
