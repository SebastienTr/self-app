import { z } from 'zod';

/** First Light SDUI primitive types */
export const moduleTypeEnum = z.enum(['metric', 'list', 'text', 'status', 'table']);

/** Known composition templates for First Light */
export const templateEnum = z.enum(['metric-dashboard', 'data-card', 'simple-list']);

/** Module lifecycle status */
export const moduleStatusEnum = z.enum(['active', 'dormant', 'archived']);

/** Data source schema — defines where a module gets its data */
export const dataSourceSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export type DataSource = z.infer<typeof dataSourceSchema>;

/** Module specification schema — source of truth for module definitions */
export const moduleSpecSchema = z.object({
  // Required fields
  id: z.string().uuid(),
  name: z.string().min(1),
  type: moduleTypeEnum,
  template: templateEnum.default('data-card'),
  dataSources: z.array(dataSourceSchema),
  refreshInterval: z.number().positive(),
  schemaVersion: z.number().int().positive(),
  accessibleLabel: z.string().min(1),

  // Optional fields
  status: moduleStatusEnum.default('active'),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  vitalityScore: z.number().min(0).max(100).optional(),
});

export type ModuleSpec = z.infer<typeof moduleSpecSchema>;
