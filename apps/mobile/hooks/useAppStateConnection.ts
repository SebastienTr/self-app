import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { connect } from '@/services/wsClient';
import { useAuthStore } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';

const RECONNECT_THRESHOLD_MS = 5_000;

/**
 * Reconnect the WebSocket when the app returns to foreground after a pause.
 *
 * Background transitions are a no-op (we let the OS close/keep the socket).
 * On foreground after >5s, trigger connect(url); wsClient handles auth + sync.
 */
export function useAppStateConnection(): void {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;

      if (nextState === 'active') {
        const wasInactive = prevState === 'background' || prevState === 'inactive';
        const backgroundedAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;

        if (wasInactive && backgroundedAt !== null) {
          const elapsedMs = Date.now() - backgroundedAt;
          if (elapsedMs > RECONNECT_THRESHOLD_MS) {
            const authState = useAuthStore.getState();
            const connectionState = useConnectionStore.getState();
            if (
              authState.sessionToken &&
              authState.backendUrl &&
              connectionState.status !== 'connected'
            ) {
              connect(authState.backendUrl);
            }
          }
        }
      } else if (
        (nextState === 'background' || nextState === 'inactive') &&
        prevState === 'active'
      ) {
        backgroundedAtRef.current = Date.now();
      }

      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
