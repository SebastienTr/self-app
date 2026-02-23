/**
 * Authentication type definitions.
 *
 * AuthStatus enum tracks the current state of the authentication flow.
 * NEVER use boolean flags (isAuthenticated) — always use this enum.
 */

export type AuthStatus =
  | 'unconfigured'
  | 'pairing'
  | 'authenticating'
  | 'authenticated'
  | 'auth_failed';
