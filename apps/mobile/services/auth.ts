/**
 * Auth service — async wrapper around expo-secure-store for session management.
 *
 * Manages session token and backend URL persistence.
 * Uses expo-secure-store (platform secure enclave) for all secrets.
 *
 * Architecture boundary: "SecureStore | auth.ts | API keys + session token only"
 */

import * as SecureStore from 'expo-secure-store';

import { logger } from './logger';

// --- SecureStore key constants ---

const SESSION_TOKEN_KEY = 'self_session_token';
const BACKEND_URL_KEY = 'self_backend_url';

// --- Session token management ---

/**
 * Read the session token from SecureStore.
 * Returns null if no token is stored.
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    logger.debug('auth', 'get_session_token', { has_token: token !== null });
    return token;
  } catch (err) {
    logger.error('auth', 'get_session_token_failed', {
      error: String(err),
      agent_action: 'Check expo-secure-store availability on this platform',
    });
    return null;
  }
}

/**
 * Store a session token in SecureStore.
 */
export async function setSessionToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    logger.info('auth', 'session_token_stored');
  } catch (err) {
    logger.error('auth', 'set_session_token_failed', {
      error: String(err),
      agent_action: 'Check expo-secure-store write permissions',
    });
  }
}

/**
 * Remove the session token from SecureStore.
 */
export async function clearSessionToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    logger.info('auth', 'session_token_cleared');
  } catch (err) {
    logger.error('auth', 'clear_session_token_failed', {
      error: String(err),
      agent_action: 'Check expo-secure-store delete permissions',
    });
  }
}

// --- Backend URL management ---

/**
 * Read the stored backend URL from SecureStore.
 * Returns null if no URL is stored.
 */
export async function getStoredBackendUrl(): Promise<string | null> {
  try {
    const url = await SecureStore.getItemAsync(BACKEND_URL_KEY);
    logger.debug('auth', 'get_backend_url', { has_url: url !== null });
    return url;
  } catch (err) {
    logger.error('auth', 'get_backend_url_failed', {
      error: String(err),
      agent_action: 'Check expo-secure-store availability on this platform',
    });
    return null;
  }
}

/**
 * Store the backend URL in SecureStore.
 */
export async function setStoredBackendUrl(url: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(BACKEND_URL_KEY, url);
    logger.info('auth', 'backend_url_stored');
  } catch (err) {
    logger.error('auth', 'set_backend_url_failed', {
      error: String(err),
      agent_action: 'Check expo-secure-store write permissions',
    });
  }
}

// --- Token generation ---

/**
 * Generate a UUID v4 session token.
 * Uses crypto.randomUUID() when available (modern Hermes),
 * falls back to Math.random()-based generation otherwise.
 */
export function generateSessionToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --- Session configuration check ---

/**
 * Check if a session is fully configured (both token AND backend URL exist).
 */
export async function isSessionConfigured(): Promise<boolean> {
  const [token, url] = await Promise.all([
    getSessionToken(),
    getStoredBackendUrl(),
  ]);
  return token !== null && url !== null;
}

// --- Session reset (developer/debug feature) ---

/**
 * Reset the current session by sending auth_reset to the backend.
 *
 * Sends the auth_reset WS message, then clears local auth state.
 * After reset, the user will need to re-pair with the backend.
 *
 * This is a developer/debug feature — no UI button in V1.
 */
export async function resetSession(): Promise<void> {
  // Lazy import to avoid circular dependency
  const { send } = require('./wsClient');
  const { useAuthStore } = require('@/stores/authStore');

  // Send auth_reset to backend (invalidates server-side session)
  send({ type: 'auth_reset', payload: {} });

  // Clear local auth state
  await clearSessionToken();
  useAuthStore.getState().clearAuth();

  logger.info('auth', 'session_reset', {
    agent_action: 'Session has been reset. User must re-pair with backend.',
  });
}
