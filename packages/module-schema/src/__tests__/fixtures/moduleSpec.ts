import type { ModuleSpec } from '../../moduleSpec';

export const createTestModuleSpec = (overrides?: Partial<ModuleSpec>): ModuleSpec => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Module',
  type: 'metric',
  template: 'data-card',
  dataSources: [],
  refreshInterval: 3600,
  schemaVersion: 1,
  accessibleLabel: 'Test module displaying metric data',
  status: 'active',
  ...overrides,
});
