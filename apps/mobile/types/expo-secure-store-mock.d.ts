/**
 * Type augmentation for the expo-secure-store Jest mock.
 *
 * Adds the __resetStore test utility exported by __mocks__/expo-secure-store.ts.
 * The bare import turns this into a module augmentation (not a replacement).
 */
import type {} from 'expo-secure-store';

declare module 'expo-secure-store' {
  /** Clears the in-memory mock store between tests. */
  export const __resetStore: () => void;
}
