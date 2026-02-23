import { moduleSpecSchema, CURRENT_SCHEMA_VERSION } from '../index';
import { createTestModuleSpec } from './fixtures/moduleSpec';

describe('moduleSpecSchema', () => {
  it('validates a valid module spec', () => {
    const spec = createTestModuleSpec();
    const result = moduleSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it('validates a spec with all optional fields', () => {
    const spec = createTestModuleSpec({
      createdAt: '2026-02-23T08:00:00Z',
      updatedAt: '2026-02-23T09:00:00Z',
      vitalityScore: 85,
    });
    const result = moduleSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it('validates a spec with dataSources populated', () => {
    const spec = createTestModuleSpec({
      dataSources: [
        { id: 'ds-1', type: 'api', config: { url: 'https://example.com' } },
        { id: 'ds-2', type: 'manual' },
      ],
    });
    const result = moduleSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  describe('required fields validation', () => {
    it('rejects missing id with descriptive error', () => {
      const { id: _, ...spec } = createTestModuleSpec();
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
      if (!result.success) {
        const idError = result.error.issues.find((i) =>
          i.path.includes('id')
        );
        expect(idError).toBeDefined();
      }
    });

    it('rejects missing name with descriptive error', () => {
      const { name: _, ...spec } = createTestModuleSpec();
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects missing type with descriptive error', () => {
      const { type: _, ...spec } = createTestModuleSpec();
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects missing dataSources with descriptive error', () => {
      const { dataSources: _, ...spec } = createTestModuleSpec();
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects missing refreshInterval with descriptive error', () => {
      const { refreshInterval: _, ...spec } = createTestModuleSpec();
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects missing schemaVersion with descriptive error', () => {
      const { schemaVersion: _, ...spec } = createTestModuleSpec();
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects missing accessibleLabel (NFR31)', () => {
      const { accessibleLabel: _, ...spec } = createTestModuleSpec();
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });
  });

  describe('enum validation', () => {
    it('rejects invalid type enum value', () => {
      const spec = createTestModuleSpec({ type: 'invalid' as any });
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('accepts all valid type values', () => {
      const types = ['metric', 'list', 'text', 'status', 'table'] as const;
      for (const type of types) {
        const spec = createTestModuleSpec({ type });
        const result = moduleSpecSchema.safeParse(spec);
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid template enum value', () => {
      const spec = createTestModuleSpec({ template: 'invalid' as any });
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects invalid status enum value', () => {
      const spec = createTestModuleSpec({ status: 'invalid' as any });
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });
  });

  describe('field constraints', () => {
    it('rejects non-UUID id', () => {
      const spec = createTestModuleSpec({ id: 'not-a-uuid' });
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const spec = createTestModuleSpec({ name: '' });
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects negative refreshInterval', () => {
      const spec = createTestModuleSpec({ refreshInterval: -1 });
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects zero refreshInterval', () => {
      const spec = createTestModuleSpec({ refreshInterval: 0 });
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects non-integer schemaVersion', () => {
      const spec = createTestModuleSpec({ schemaVersion: 1.5 });
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects zero schemaVersion', () => {
      const spec = createTestModuleSpec({ schemaVersion: 0 });
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects empty accessibleLabel', () => {
      const spec = createTestModuleSpec({ accessibleLabel: '' });
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects vitalityScore above 100', () => {
      const spec = createTestModuleSpec({ vitalityScore: 101 });
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });

    it('rejects vitalityScore below 0', () => {
      const spec = createTestModuleSpec({ vitalityScore: -1 });
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(false);
    });
  });

  describe('schema versioning', () => {
    it('exports CURRENT_SCHEMA_VERSION as 1', () => {
      expect(CURRENT_SCHEMA_VERSION).toBe(1);
    });

    it('schemaVersion field is present and numeric', () => {
      const spec = createTestModuleSpec();
      const result = moduleSpecSchema.safeParse(spec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.schemaVersion).toBe('number');
        expect(Number.isInteger(result.data.schemaVersion)).toBe(true);
      }
    });
  });
});
