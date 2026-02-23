/**
 * Barrel export for bridge components.
 *
 * Bridge components own module lifecycle logic (loading, caching, freshness).
 * Per architecture: barrel per sub-folder, never a global components/index.ts.
 */

export { ErrorBoundary } from './ErrorBoundary';
export { FreshnessIndicator } from './FreshnessIndicator';
export { ModuleCard } from './ModuleCard';
export { ModuleList } from './ModuleList';
export { ChatThread } from './ChatThread';
