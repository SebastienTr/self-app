import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { useConnectionStore } from '@/stores/connectionStore';
import { useModuleStore } from '@/stores/moduleStore';
import { connect, disconnect, loadPersistedMessages } from '@/services/wsClient';
import { initLocalDb, getCachedModules } from '@/services/localDb';
import { initModuleSync } from '@/services/moduleSync';
import { logger } from '@/services/logger';
import { ModuleList } from '@/components/bridge';
import { tokens } from '@/constants/tokens';
import { getBackendUrl } from '@/utils/getBackendUrl';
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
  const backendUrl = useConnectionStore((s) => s.backendUrl);
  const moduleCount = useModuleStore((s) => s.modules.size);
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

      // 4. Register module sync handlers
      initModuleSync();

      setInitialized(true);

      const startupDuration = Date.now() - startTime;
      logger.info('app', 'startup_complete', {
        cached_modules: cached.length,
        startup_ms: startupDuration,
        agent_action: startupDuration > 2000
          ? 'Startup exceeded 2s target (NFR1). Investigate slow operations.'
          : null,
      });

      // 5. Connect to WebSocket (async, non-blocking)
      const url = backendUrl || getBackendUrl();
      connect(url);
    }

    startup();

    return () => {
      disconnect();
    };
  }, [backendUrl]);

  return (
    <View style={styles.container}>
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

      {initialized && <ModuleList />}

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
