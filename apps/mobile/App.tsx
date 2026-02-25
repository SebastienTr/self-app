import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';

import { useAuthStore } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useChatStore } from '@/stores/chatStore';
import { connect, disconnect, loadPersistedMessages } from '@/services/wsClient';
import { initLocalDb, getCachedModules } from '@/services/localDb';
import { getSessionToken, getStoredBackendUrl } from '@/services/auth';
import { initModuleSync, cleanupModuleSync } from '@/services/moduleSync';
import { initChatSync, cleanupChatSync } from '@/services/chatSync';
import { logger } from '@/services/logger';
import { Orb } from '@/components/shell';
import { TabNavigator } from '@/navigation/TabNavigator';
import { tokens } from '@/constants/tokens';
import type { ConnectionStatus } from '@/types/ws';

/** Dark theme matching Twilight design tokens. */
const TwilightTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: tokens.colors.accent,
    background: tokens.colors.background,
    card: tokens.colors.background,
    text: tokens.colors.text,
    border: tokens.colors.border,
    notification: tokens.colors.accent,
  },
};

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

function AppContent() {
  const status = useConnectionStore((s) => s.status);
  const moduleCount = useModuleStore((s) => s.modules.size);
  const [initialized, setInitialized] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Hide Android navigation bar (immersive mode)
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
    }
  }, []);

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

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + tokens.spacing.sm }]}
    >
      {/* Compact header: Orb + title + status on one line */}
      <View style={styles.header}>
        <Orb size={32} />
        <Text style={styles.title}>Self</Text>
        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: STATUS_COLORS[status] },
            ]}
          />
          <Text style={styles.statusText}>
            {STATUS_LABELS[status]}
            {moduleCount > 0 ? ` \u00B7 ${moduleCount}` : ''}
          </Text>
        </View>
      </View>

      {/* Tab navigator — replaces two-mode crossfade (story 2-5b) */}
      {initialized && (
        <NavigationContainer theme={TwilightTheme}>
          <TabNavigator />
        </NavigationContainer>
      )}

      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  title: {
    ...tokens.typography.title,
    color: tokens.colors.text,
    lineHeight: 32,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...tokens.typography.caption,
    color: tokens.colors.textSecondary,
  },
});
