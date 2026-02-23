/**
 * Derive the backend WebSocket URL.
 *
 * In development on a physical device, Expo provides the dev machine's
 * LAN IP via Constants.expoConfig.hostUri (e.g. "192.168.1.42:8081").
 * We extract the hostname and build the WS URL from it.
 *
 * Falls back to localhost for simulators/emulators or production.
 */

import Constants from 'expo-constants';

const BACKEND_PORT = 8000;

export function getBackendUrl(): string {
  if (!__DEV__) {
    // Production: will be configured via pairing flow (story 1.6)
    return `ws://localhost:${BACKEND_PORT}/ws`;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `ws://${host}:${BACKEND_PORT}/ws`;
  }

  return `ws://localhost:${BACKEND_PORT}/ws`;
}
