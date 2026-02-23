import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { useConnectionStore } from '@/stores/connectionStore';
import { connect, disconnect } from '@/services/wsClient';
import type { ConnectionStatus } from '@/types/ws';

/** Default backend URL for development. */
const DEFAULT_BACKEND_URL = 'ws://localhost:8000/ws';

/** Map connection status to a colored indicator. */
const STATUS_COLORS: Record<ConnectionStatus, string> = {
  connected: '#22c55e',    // green
  connecting: '#f59e0b',   // amber
  reconnecting: '#f59e0b', // amber
  disconnected: '#ef4444', // red
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

  useEffect(() => {
    const url = backendUrl || DEFAULT_BACKEND_URL;
    connect(url);

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
        <Text style={styles.statusText}>{STATUS_LABELS[status]}</Text>
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e17',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fffffe',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 14,
    color: '#94a1b2',
  },
});
