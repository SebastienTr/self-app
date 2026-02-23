/**
 * Mock for expo-secure-store.
 *
 * Provides an in-memory key-value store that simulates SecureStore operations.
 * Used by Jest tests for auth service and any module that depends on expo-secure-store.
 */

const store = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return store.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}

// Test utility exports for resetting state between tests
export const __resetStore = (): void => {
  store.clear();
};
