/**
 * Zod schemas for SDUI primitive data contracts.
 *
 * These schemas define the shape of primitive specs as they arrive
 * over the wire (after camelCase conversion by wsClient).
 * They are the source of truth for validating primitive data.
 */

import { z } from 'zod';

/** Base accessibility fields shared by all primitives. */
const accessibilityFields = {
  accessibleLabel: z.string().optional(),
  accessibleRole: z.string().optional(),
};

/** Text variant enum. */
export const textVariantEnum = z.enum(['title', 'subtitle', 'body', 'caption']);

/** Text primitive data contract. */
export const textPrimitiveSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  variant: textVariantEnum.default('body'),
  ...accessibilityFields,
});

export type TextPrimitiveSpec = z.infer<typeof textPrimitiveSchema>;

/** Trend direction enum. */
export const trendEnum = z.enum(['up', 'down', 'flat']);

/** Metric primitive data contract. */
export const metricPrimitiveSchema = z.object({
  type: z.literal('metric'),
  value: z.union([z.string(), z.number()]),
  label: z.string(),
  unit: z.string().optional(),
  trend: trendEnum.optional(),
  ...accessibilityFields,
});

export type MetricPrimitiveSpec = z.infer<typeof metricPrimitiveSchema>;

/** Layout direction enum. */
export const layoutDirectionEnum = z.enum(['vertical', 'horizontal']);

/** Layout primitive data contract. */
export const layoutPrimitiveSchema = z.object({
  type: z.literal('layout'),
  direction: layoutDirectionEnum.default('vertical'),
  columns: z.number().int().positive().optional(),
  gap: z.number().min(0).optional(),
  ...accessibilityFields,
});

export type LayoutPrimitiveSpec = z.infer<typeof layoutPrimitiveSchema>;

/** Card primitive data contract -- composite container. */
export const cardPrimitiveSchema = z.object({
  type: z.literal('card'),
  title: z.string().optional(),
  children: z
    .array(z.object({ type: z.string() }).passthrough())
    .optional(),
  ...accessibilityFields,
});

export type CardPrimitiveSpec = z.infer<typeof cardPrimitiveSchema>;

/** List item schema -- structured data for each row. */
export const listItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  trailing: z.string().optional(),
});

export type ListItemSpec = z.infer<typeof listItemSchema>;

/** List primitive data contract -- composite list display. */
export const listPrimitiveSchema = z.object({
  type: z.literal('list'),
  title: z.string().optional(),
  items: z.array(listItemSchema),
  ...accessibilityFields,
});

export type ListPrimitiveSpec = z.infer<typeof listPrimitiveSchema>;
