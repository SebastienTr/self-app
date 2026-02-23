/**
 * PairingScreen — backend URL + pairing token form.
 *
 * Shown when no session is configured (first launch or after auth failure).
 * Collects backend URL and pairing token, then initiates the pairing flow.
 *
 * Architecture layer: Shell (static UI, no SDUI).
 * Design tokens: Twilight theme from constants/tokens.ts.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { tokens } from '@/constants/tokens';
import {
  generateSessionToken,
  setSessionToken,
  setStoredBackendUrl,
} from '@/services/auth';
import { getBackendUrl } from '@/utils/getBackendUrl';
import { connect } from '@/services/wsClient';
import { useAuthStore } from '@/stores/authStore';

export function PairingScreen() {
  const [url, setUrl] = useState(
    process.env.EXPO_PUBLIC_DEV_BACKEND_URL || (__DEV__ ? getBackendUrl() : ''),
  );
  const [pairingToken, setPairingToken] = useState(
    process.env.EXPO_PUBLIC_DEV_PAIRING_TOKEN || '',
  );

  const authStatus = useAuthStore((s) => s.authStatus);
  const pairingError = useAuthStore((s) => s.pairingError);

  const isLoading = authStatus === 'pairing' || authStatus === 'authenticating';
  const canConnect = url.trim().length > 0 && pairingToken.trim().length > 0 && !isLoading;

  async function handleConnect() {
    if (!canConnect) return;

    const store = useAuthStore.getState();

    try {
      // Clear any previous error
      store.setPairingError(null);

      // Store backend URL
      const trimmedUrl = url.trim();
      store.setBackendUrl(trimmedUrl);
      await setStoredBackendUrl(trimmedUrl);

      // Generate and store session token
      const sessionToken = generateSessionToken();
      store.setSessionToken(sessionToken);
      await setSessionToken(sessionToken);

      // Set auth status to pairing
      store.setAuthStatus('pairing');

      // Initiate WebSocket connection with pairing token
      connect(trimmedUrl, pairingToken.trim());
    } catch (err) {
      store.setPairingError(String(err));
      store.setAuthStatus('auth_failed');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect to Backend</Text>
      <Text style={styles.subtitle}>
        Enter your backend URL and pairing token to connect.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Backend URL</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="ws://192.168.1.x:8000/ws"
          placeholderTextColor={tokens.colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Backend URL"
        />

        <Text style={styles.label}>Pairing Token</Text>
        <TextInput
          style={styles.input}
          value={pairingToken}
          onChangeText={setPairingToken}
          placeholder="Paste pairing token here"
          placeholderTextColor={tokens.colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Pairing Token"
        />

        {pairingError && (
          <Text style={styles.error} testID="pairing-error">
            {pairingError}
          </Text>
        )}

        {isLoading && (
          <View testID="pairing-loading" style={styles.loadingRow}>
            <ActivityIndicator color={tokens.colors.accent} />
            <Text style={styles.loadingText}>Connecting...</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, !canConnect && styles.buttonDisabled]}
          onPress={handleConnect}
          disabled={!canConnect}
          accessibilityLabel="Connect to backend"
          accessibilityState={{ disabled: !canConnect }}
        >
          <Text style={[styles.buttonText, !canConnect && styles.buttonTextDisabled]}>
            Connect
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: 80,
    alignItems: 'center',
  },
  title: {
    ...tokens.typography.title,
    color: tokens.colors.text,
    marginBottom: tokens.spacing.sm,
  },
  subtitle: {
    ...tokens.typography.body,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: tokens.spacing.xl,
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  label: {
    ...tokens.typography.caption,
    color: tokens.colors.text,
    marginBottom: tokens.spacing.xs,
    marginTop: tokens.spacing.md,
  },
  input: {
    backgroundColor: tokens.colors.surfaceElevated,
    borderColor: tokens.colors.border,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    color: tokens.colors.text,
    ...tokens.typography.body,
    minHeight: 48, // NFR33: 44pt min touch target + padding
  },
  error: {
    ...tokens.typography.caption,
    color: tokens.colors.error,
    marginTop: tokens.spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
    justifyContent: 'center',
  },
  loadingText: {
    ...tokens.typography.caption,
    color: tokens.colors.textSecondary,
  },
  button: {
    backgroundColor: tokens.colors.accent,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    marginTop: tokens.spacing.lg,
    minHeight: 48, // NFR33: 44pt min touch target
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...tokens.typography.subtitle,
    color: tokens.colors.background,
  },
  buttonTextDisabled: {
    color: tokens.colors.background,
  },
});
