/**
 * SettingsScreen — Settings tab absorbing PairingScreen + connection info.
 *
 * Architecture layer: Screen (bridge between navigation and components).
 * - When not paired: shows pairing form (backend URL + token + Connect)
 * - When paired: shows connection info + disconnect button
 * - About section with version
 */

import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAuthStore } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useModuleStore } from '@/stores/moduleStore';
import { PairingScreen } from '@/components/shell';
import { disconnect } from '@/services/wsClient';
import { clearSessionToken, clearStoredBackendUrl } from '@/services/auth';
import { tokens } from '@/constants/tokens';

export function SettingsScreen() {
  const authStatus = useAuthStore((s) => s.authStatus);
  const backendUrl = useAuthStore((s) => s.backendUrl);
  const connectionStatus = useConnectionStore((s) => s.status);
  const moduleCount = useModuleStore((s) => s.modules.size);

  const showPairing =
    authStatus === 'unconfigured' ||
    authStatus === 'auth_failed' ||
    authStatus === 'pairing';

  async function handleDisconnect() {
    disconnect();
    await clearSessionToken();
    await clearStoredBackendUrl();
    useAuthStore.getState().clearAuth();
  }

  if (showPairing) {
    return <PairingScreen />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Connection</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Backend</Text>
          <Text style={styles.value} numberOfLines={1}>{backendUrl ?? 'N/A'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={[styles.value, connectionStatus === 'connected' && styles.valueSuccess]}>
            {connectionStatus}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Modules</Text>
          <Text style={styles.value}>{moduleCount}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.disconnectButton}
        onPress={handleDisconnect}
        accessibilityLabel="Disconnect and re-pair"
      >
        <Text style={styles.disconnectText}>Disconnect & Re-pair</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { marginTop: tokens.spacing.xl }]}>About</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>App</Text>
          <Text style={styles.value}>Self</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>0.1.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    padding: tokens.spacing.lg,
  },
  sectionTitle: {
    ...tokens.typography.subtitle,
    color: tokens.colors.text,
    marginBottom: tokens.spacing.sm,
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...tokens.typography.body,
    color: tokens.colors.textSecondary,
  },
  value: {
    ...tokens.typography.body,
    color: tokens.colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  valueSuccess: {
    color: tokens.colors.success,
  },
  disconnectButton: {
    backgroundColor: tokens.colors.error,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    marginTop: tokens.spacing.lg,
    minHeight: 48,
  },
  disconnectText: {
    ...tokens.typography.subtitle,
    color: tokens.colors.text,
  },
});
