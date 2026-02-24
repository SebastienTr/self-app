import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AppStateStatus } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';

import { useAuthStore } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useChatStore } from '@/stores/chatStore';
import { useScreenModeStore } from '@/stores/screenModeStore';
import { connect, disconnect, loadPersistedMessages, send } from '@/services/wsClient';
import { initLocalDb, getCachedModules } from '@/services/localDb';
import { getSessionToken, getStoredBackendUrl } from '@/services/auth';
import { initModuleSync, cleanupModuleSync } from '@/services/moduleSync';
import { initChatSync, cleanupChatSync } from '@/services/chatSync';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { logger } from '@/services/logger';
import { ModuleList, ChatThread } from '@/components/bridge';
import { PairingScreen, Orb, ChatInput } from '@/components/shell';
import { tokens } from '@/constants/tokens';
import type { ConnectionStatus } from '@/types/ws';

/** Animation duration for crossfade (250ms per spec). */
const CROSSFADE_DURATION = 250;

/** Delay before transitioning from Chat to Dashboard (1s per spec). */
const DASHBOARD_TRANSITION_DELAY = 1000;

/** Minimum background time before re-evaluating mode on foreground (5s per spec). */
const BACKGROUND_THRESHOLD_MS = 5000;

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
  const authStatus = useAuthStore((s) => s.authStatus);
  const agentStatus = useChatStore((s) => s.agentStatus);
  const screenMode = useScreenModeStore((s) => s.mode);
  const [initialized, setInitialized] = useState(false);
  const insets = useSafeAreaInsets();
  const { keyboardVisible } = useKeyboardVisible();

  // Animated opacity values for crossfade
  const chatOpacity = useRef(new Animated.Value(1)).current;
  const dashOpacity = useRef(new Animated.Value(0)).current;

  // Refs for transition management
  const dashboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundTimeRef = useRef<number>(0);
  const reduceMotionRef = useRef(false);

  // Check reduce motion accessibility setting
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotionRef.current = enabled;
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduceMotionRef.current = enabled;
    });
    return () => sub.remove();
  }, []);

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

      // 6. Evaluate initial screen mode based on cached modules
      const screenModeStore = useScreenModeStore.getState();
      const initialMode = screenModeStore.evaluateMode();
      screenModeStore.setMode(initialMode);

      setInitialized(true);

      const startupDuration = Date.now() - startTime;
      logger.info('app', 'startup_complete', {
        cached_modules: cached.length,
        startup_ms: startupDuration,
        has_session: !!token,
        initial_mode: initialMode,
        agent_action: startupDuration > 2000
          ? 'Startup exceeded 2s target (NFR1). Investigate slow operations.'
          : null,
      });

      // 7. Connect to WebSocket if session is configured
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

  // --- AppState foreground resume handler (AC #8) ---
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimeRef.current = Date.now();
      } else if (nextState === 'active' && backgroundTimeRef.current > 0) {
        const elapsed = Date.now() - backgroundTimeRef.current;
        backgroundTimeRef.current = 0;
        if (elapsed >= BACKGROUND_THRESHOLD_MS) {
          const newMode = useScreenModeStore.getState().evaluateMode();
          useScreenModeStore.getState().setMode(newMode);
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);

  // --- Crossfade animation when screenMode changes ---
  useEffect(() => {
    const toDash = screenMode === 'dashboard';
    const duration = reduceMotionRef.current ? 0 : CROSSFADE_DURATION;

    Animated.parallel([
      Animated.timing(chatOpacity, {
        toValue: toDash ? 0 : 1,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(dashOpacity, {
        toValue: toDash ? 1 : 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [screenMode, chatOpacity, dashOpacity]);

  // --- Keyboard close transition logic (AC #3, #4, #11) ---
  useEffect(() => {
    if (!keyboardVisible) {
      // Keyboard just closed
      const currentModuleCount = useModuleStore.getState().modules.size;
      const currentAgentStatus = useChatStore.getState().agentStatus;

      if (currentModuleCount > 0 && currentAgentStatus === 'idle') {
        // AC #3: modules exist + agent idle → transition to dashboard after delay
        dashboardTimerRef.current = setTimeout(() => {
          useScreenModeStore.getState().setMode('dashboard');
          dashboardTimerRef.current = null;
        }, DASHBOARD_TRANSITION_DELAY);
      } else if (currentModuleCount > 0 && currentAgentStatus !== 'idle') {
        // AC #11: agent is streaming → watch for idle, then transition
        const unsub = useChatStore.subscribe((state) => {
          if (state.agentStatus === 'idle') {
            unsub();
            // Only transition if modules still exist
            const mods = useModuleStore.getState().modules.size;
            if (mods > 0) {
              dashboardTimerRef.current = setTimeout(() => {
                useScreenModeStore.getState().setMode('dashboard');
                dashboardTimerRef.current = null;
              }, DASHBOARD_TRANSITION_DELAY);
            }
          }
        });
        // Clean up subscription if keyboard reopens
        return () => unsub();
      }
      // AC #4: 0 modules → stay in chat (no action needed)
    } else {
      // Keyboard opened — cancel any pending dashboard transition
      if (dashboardTimerRef.current !== null) {
        clearTimeout(dashboardTimerRef.current);
        dashboardTimerRef.current = null;
      }
    }

    return () => {
      if (dashboardTimerRef.current !== null) {
        clearTimeout(dashboardTimerRef.current);
        dashboardTimerRef.current = null;
      }
    };
  }, [keyboardVisible]);

  /** Handle ChatInput focus → switch to Chat Mode (AC #2). */
  const handleInputFocus = useCallback(() => {
    useScreenModeStore.getState().setMode('chat');
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
    <KeyboardAvoidingView
      style={styles.flex1}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        style={[styles.container, { paddingTop: insets.top + tokens.spacing.sm }]}
      >
        {initialized && showPairing ? (
          <PairingScreen />
        ) : (
          <>
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

            {/* Two-mode rendering with crossfade (story 2-5) */}
            {initialized && (
              <View style={styles.flex1}>
                <Animated.View
                  style={[styles.modeLayer, { opacity: chatOpacity }]}
                  pointerEvents={screenMode === 'chat' ? 'auto' : 'none'}
                >
                  <ChatThread />
                </Animated.View>
                <Animated.View
                  style={[styles.modeLayer, { opacity: dashOpacity }]}
                  pointerEvents={screenMode === 'dashboard' ? 'auto' : 'none'}
                >
                  <ModuleList />
                </Animated.View>
              </View>
            )}

            {/* ChatInput: always visible at bottom (constant anchor — AC #10) */}
            {initialized && (
              <ChatInput
                onSend={handleSend}
                disabled={isInputDisabled}
                onInputFocus={handleInputFocus}
              />
            )}
          </>
        )}

        <StatusBar style="light" />
      </View>
    </KeyboardAvoidingView>
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
  flex1: {
    flex: 1,
  },
  modeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
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
