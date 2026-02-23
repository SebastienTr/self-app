export {
  moduleSpecSchema,
  moduleTypeEnum,
  templateEnum,
  moduleStatusEnum,
  dataSourceSchema,
} from './moduleSpec';

export type { ModuleSpec, DataSource } from './moduleSpec';

export {
  textPrimitiveSchema,
  textVariantEnum,
  metricPrimitiveSchema,
  trendEnum,
  layoutPrimitiveSchema,
  layoutDirectionEnum,
  cardPrimitiveSchema,
  listPrimitiveSchema,
  listItemSchema,
} from './primitives';

export type {
  TextPrimitiveSpec,
  MetricPrimitiveSpec,
  LayoutPrimitiveSpec,
  CardPrimitiveSpec,
  ListPrimitiveSpec,
  ListItemSpec,
} from './primitives';

export const CURRENT_SCHEMA_VERSION = 1;
