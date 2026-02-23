import { toSnake } from './toSnake';

describe('toSnake', () => {
  it('converts simple camelCase keys to snake_case', () => {
    expect(toSnake({ userName: 'Alice' })).toEqual({ user_name: 'Alice' });
  });

  it('converts nested objects', () => {
    const input = {
      userProfile: {
        firstName: 'Alice',
        lastLogin: '2024-01-01',
      },
    };
    expect(toSnake(input)).toEqual({
      user_profile: {
        first_name: 'Alice',
        last_login: '2024-01-01',
      },
    });
  });

  it('converts arrays of objects', () => {
    const input = {
      moduleList: [
        { moduleId: '1', displayName: 'Weather' },
        { moduleId: '2', displayName: 'Tasks' },
      ],
    };
    expect(toSnake(input)).toEqual({
      module_list: [
        { module_id: '1', display_name: 'Weather' },
        { module_id: '2', display_name: 'Tasks' },
      ],
    });
  });

  it('handles null values', () => {
    expect(toSnake({ lastSync: null })).toEqual({ last_sync: null });
  });

  it('handles undefined values', () => {
    expect(toSnake({ agentAction: undefined })).toEqual({
      agent_action: undefined,
    });
  });

  it('handles empty objects', () => {
    expect(toSnake({})).toEqual({});
  });

  it('handles primitive values in arrays', () => {
    expect(toSnake({ tagList: ['a', 'b', 'c'] })).toEqual({
      tag_list: ['a', 'b', 'c'],
    });
  });

  it('preserves numbers and booleans', () => {
    expect(toSnake({ retryCount: 5, isDone: true })).toEqual({
      retry_count: 5,
      is_done: true,
    });
  });

  it('handles keys that are already snake_case', () => {
    expect(toSnake({ already_snake: 'yes' } as any)).toEqual({
      already_snake: 'yes',
    });
  });

  it('handles deeply nested structures', () => {
    const input = {
      levelOne: {
        levelTwo: {
          levelThree: { deepValue: 42 },
        },
      },
    };
    expect(toSnake(input)).toEqual({
      level_one: {
        level_two: {
          level_three: { deep_value: 42 },
        },
      },
    });
  });

  it('handles arrays at root level', () => {
    const input = [{ snakeKey: 1 }, { anotherKey: 2 }];
    expect(toSnake(input)).toEqual([{ snake_key: 1 }, { another_key: 2 }]);
  });

  it('returns primitives as-is', () => {
    expect(toSnake('hello' as any)).toBe('hello');
    expect(toSnake(42 as any)).toBe(42);
    expect(toSnake(null as any)).toBeNull();
    expect(toSnake(undefined as any)).toBeUndefined();
  });

  it('handles consecutive uppercase letters', () => {
    expect(toSnake({ wsURL: 'x' })).toEqual({ ws_url: 'x' });
  });

  it('is inverse of toCamel for standard keys', () => {
    const { toCamel } = require('./toCamel');
    const original = { module_id: '1', last_sync: '2024-01-01', agent_action: 'test' };
    const camelized = toCamel(original);
    const roundTripped = toSnake(camelized);
    expect(roundTripped).toEqual(original);
  });

  // --- Additional edge case tests ---

  describe('edge cases', () => {
    it('handles single character keys', () => {
      expect(toSnake({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
    });

    it('handles empty string keys', () => {
      expect(toSnake({ '': 'empty' })).toEqual({ '': 'empty' });
    });

    it('handles keys with numbers', () => {
      expect(toSnake({ moduleV2Name: 'test' })).toEqual({
        module_v2_name: 'test',
      });
    });

    it('handles boolean false values', () => {
      expect(toSnake({ isActive: false })).toEqual({ is_active: false });
    });

    it('handles zero values', () => {
      expect(toSnake({ retryCount: 0 })).toEqual({ retry_count: 0 });
    });

    it('handles empty string values', () => {
      expect(toSnake({ userName: '' })).toEqual({ user_name: '' });
    });

    it('handles mixed arrays with objects and primitives', () => {
      const input = { items: [{ itemId: 1 }, 'string', 42, null, { nestedKey: 'v' }] };
      const result = toSnake(input);
      expect(result).toEqual({
        items: [{ item_id: 1 }, 'string', 42, null, { nested_key: 'v' }],
      });
    });

    it('handles empty arrays', () => {
      expect(toSnake({ moduleList: [] })).toEqual({ module_list: [] });
    });

    it('handles nested arrays of arrays', () => {
      const input = { matrixData: [[{ cellValue: 1 }], [{ cellValue: 2 }]] };
      expect(toSnake(input)).toEqual({
        matrix_data: [[{ cell_value: 1 }], [{ cell_value: 2 }]],
      });
    });

    it('handles real outgoing WSMessage payloads: sync', () => {
      const payload = { lastSync: '2024-01-01T00:00:00Z' };
      expect(toSnake(payload)).toEqual({ last_sync: '2024-01-01T00:00:00Z' });
    });

    it('handles real outgoing WSMessage payloads: module_action', () => {
      const payload = { moduleId: '123', action: 'refresh' };
      expect(toSnake(payload)).toEqual({ module_id: '123', action: 'refresh' });
    });

    it('handles real outgoing WSMessage payloads: log', () => {
      const payload = {
        layer: 'mobile:ws',
        event: 'connected',
        severity: 'info',
        context: { backendUrl: 'ws://localhost:8000/ws' },
      };
      expect(toSnake(payload)).toEqual({
        layer: 'mobile:ws',
        event: 'connected',
        severity: 'info',
        context: { backend_url: 'ws://localhost:8000/ws' },
      });
    });

    it('preserves string values containing camelCase (does not convert values)', () => {
      const input = { displayName: 'myModuleName' };
      const result = toSnake(input);
      expect(result).toEqual({ display_name: 'myModuleName' });
      // Crucially, the VALUE 'myModuleName' is NOT converted
    });

    it('handles PascalCase keys', () => {
      const result = toSnake({ ModuleId: 'abc' });
      expect(result).toEqual({ module_id: 'abc' });
    });

    it('handles all-uppercase keys', () => {
      const result = toSnake({ URL: 'http://example.com' });
      expect(result).toEqual({ url: 'http://example.com' });
    });

    it('handles objects with many keys', () => {
      const input: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        input[`key${i}Value`] = i;
      }
      const result = toSnake(input) as Record<string, number>;
      expect(Object.keys(result)).toHaveLength(100);
      expect(result['key0_value']).toBe(0);
      expect(result['key99_value']).toBe(99);
    });

    it('round-trips nested WSMessage payloads correctly', () => {
      const { toCamel } = require('./toCamel');
      const wirePayload = {
        modules: [
          { module_id: '1', display_name: 'Weather', created_at: '2024-01-01' },
          { module_id: '2', display_name: 'Tasks', created_at: '2024-02-01' },
        ],
        last_sync: '2024-02-15T00:00:00Z',
      };
      const camelized = toCamel(wirePayload);
      const roundTripped = toSnake(camelized);
      expect(roundTripped).toEqual(wirePayload);
    });

    it('round-trips error payload correctly', () => {
      const { toCamel } = require('./toCamel');
      const wirePayload = {
        code: 'WS_UNKNOWN_TYPE',
        message: 'Unknown type',
        agent_action: 'Check enum',
      };
      const camelized = toCamel(wirePayload);
      const roundTripped = toSnake(camelized);
      expect(roundTripped).toEqual(wirePayload);
    });
  });
});
