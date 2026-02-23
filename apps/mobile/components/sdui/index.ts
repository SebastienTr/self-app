/**
 * SDUI primitives barrel export.
 *
 * External consumers should import from '@/components/sdui'
 * rather than reaching into individual files.
 */

export { getPrimitive } from './registry';
export type { PrimitiveProps } from './registry';

export { TextPrimitive } from './TextPrimitive';
export type { TextPrimitiveProps, TextVariant } from './TextPrimitive';

export { MetricPrimitive } from './MetricPrimitive';
export type { MetricPrimitiveProps, TrendDirection } from './MetricPrimitive';

export { LayoutPrimitive } from './LayoutPrimitive';
export type { LayoutPrimitiveProps, LayoutDirection } from './LayoutPrimitive';

export { CardPrimitive } from './CardPrimitive';
export type { CardPrimitiveProps, PrimitiveChild } from './CardPrimitive';

export { ListPrimitive } from './ListPrimitive';
export type { ListPrimitiveProps, ListItem } from './ListPrimitive';

export { UnknownPrimitive } from './UnknownPrimitive';
export type { UnknownPrimitiveProps } from './UnknownPrimitive';

export { getTemplate } from './templates';
export type { TemplateDefinition, TemplateSlot, TemplateLayout } from './templates';
