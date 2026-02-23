/**
 * Module-related type definitions.
 *
 * ModuleStatus tracks lifecycle state (loading → active → stale → dormant).
 * DataStatus tracks data freshness separately (ok / stale / error).
 * A module can be status: 'active' but dataStatus: 'error' if refresh failed.
 */

import type { ModuleSpec } from './ws';

/** Lifecycle status of a module (from architecture state machine). */
export type ModuleStatus =
  | 'loading'
  | 'active'
  | 'refreshing'
  | 'stale'
  | 'dormant'
  | 'error';

/** Data freshness status — separate from lifecycle status. */
export type DataStatus = 'ok' | 'stale' | 'error';

/** Full module state as tracked in the module store. */
export interface ModuleState {
  spec: ModuleSpec;
  status: ModuleStatus;
  dataStatus: DataStatus;
  updatedAt: string;
  cachedAt: string;
}

/** A module row as stored in and retrieved from expo-sqlite cache. */
export interface CachedModule {
  module_id: string;
  spec: string; // JSON-serialized ModuleSpec
  status: string;
  updated_at: string;
  cached_at: string;
}
