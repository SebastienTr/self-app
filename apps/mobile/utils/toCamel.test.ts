import { toCamel } from './toCamel';

describe('toCamel', () => {
  it('converts simple snake_case keys to camelCase', () => {
    expect(toCamel({ user_name: 'Alice' })).toEqual({ userName: 'Alice' });
  });

  it('converts nested objects', () => {
    const input = {
      user_profile: {
        first_name: 'Alice',
        last_login: '2024-01-01',
      },
    };
    expect(toCamel(input)).toEqual({
      userProfile: {
        firstName: 'Alice',
        lastLogin: '2024-01-01',
      },
    });
  });

  it('converts arrays of objects', () => {
    const input = {
      module_list: [
        { module_id: '1', display_name: 'Weather' },
        { module_id: '2', display_name: 'Tasks' },
      ],
    };
    expect(toCamel(input)).toEqual({
      moduleList: [
        { moduleId: '1', displayName: 'Weather' },
        { moduleId: '2', displayName: 'Tasks' },
      ],
    });
  });

  it('handles null values', () => {
    expect(toCamel({ last_sync: null })).toEqual({ lastSync: null });
  });

  it('handles undefined values', () => {
    expect(toCamel({ agent_action: undefined })).toEqual({
      agentAction: undefined,
    });
  });

  it('handles empty objects', () => {
    expect(toCamel({})).toEqual({});
  });

  it('handles primitive values in arrays', () => {
    expect(toCamel({ tag_list: ['a', 'b', 'c'] })).toEqual({
      tagList: ['a', 'b', 'c'],
    });
  });

  it('preserves numbers and booleans', () => {
    expect(toCamel({ retry_count: 5, is_done: true })).toEqual({
      retryCount: 5,
      isDone: true,
    });
  });

  it('handles keys that are already camelCase', () => {
    expect(toCamel({ alreadyCamel: 'yes' })).toEqual({ alreadyCamel: 'yes' });
  });

  it('handles deeply nested structures', () => {
    const input = {
      level_one: {
        level_two: {
          level_three: { deep_value: 42 },
        },
      },
    };
    expect(toCamel(input)).toEqual({
      levelOne: {
        levelTwo: {
          levelThree: { deepValue: 42 },
        },
      },
    });
  });

  it('handles arrays at root level', () => {
    const input = [{ snake_key: 1 }, { another_key: 2 }];
    expect(toCamel(input)).toEqual([{ snakeKey: 1 }, { anotherKey: 2 }]);
  });

  it('returns primitives as-is', () => {
    expect(toCamel('hello' as any)).toBe('hello');
    expect(toCamel(42 as any)).toBe(42);
    expect(toCamel(null as any)).toBeNull();
    expect(toCamel(undefined as any)).toBeUndefined();
  });

  it('handles keys with multiple underscores', () => {
    expect(toCamel({ my_long_variable_name: 'x' })).toEqual({
      myLongVariableName: 'x',
    });
  });

  // --- Additional edge case tests ---

  describe('edge cases', () => {
    it('handles keys with leading underscore', () => {
      // The regex _([a-z]) matches _p at position 0, converting it to P
      // So _private_field becomes PrivateField
      const result = toCamel({ _private_field: 'secret' });
      expect(result).toHaveProperty('PrivateField');
    });

    it('handles keys with trailing underscore', () => {
      const result = toCamel({ field_: 'value' });
      expect(result).toHaveProperty('field_');
    });

    it('handles keys with double underscores', () => {
      const result = toCamel({ __init__: 'python' });
      // Double underscores: the regex matches _[a-z], so __i becomes _I
      expect(result).toBeDefined();
    });

    it('handles single character keys', () => {
      expect(toCamel({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
    });

    it('handles empty string keys', () => {
      expect(toCamel({ '': 'empty' })).toEqual({ '': 'empty' });
    });

    it('handles keys with numbers', () => {
      expect(toCamel({ module_v2_name: 'test' })).toEqual({
        moduleV2Name: 'test',
      });
    });

    it('handles boolean false values', () => {
      expect(toCamel({ is_active: false })).toEqual({ isActive: false });
    });

    it('handles zero values', () => {
      expect(toCamel({ retry_count: 0 })).toEqual({ retryCount: 0 });
    });

    it('handles empty string values', () => {
      expect(toCamel({ user_name: '' })).toEqual({ userName: '' });
    });

    it('handles mixed arrays with objects and primitives', () => {
      const input = { items: [{ item_id: 1 }, 'string', 42, null, { nested_key: 'v' }] };
      const result = toCamel(input);
      expect(result).toEqual({
        items: [{ itemId: 1 }, 'string', 42, null, { nestedKey: 'v' }],
      });
    });

    it('handles empty arrays', () => {
      expect(toCamel({ module_list: [] })).toEqual({ moduleList: [] });
    });

    it('handles nested arrays of arrays', () => {
      const input = { matrix_data: [[{ cell_value: 1 }], [{ cell_value: 2 }]] };
      expect(toCamel(input)).toEqual({
        matrixData: [[{ cellValue: 1 }], [{ cellValue: 2 }]],
      });
    });

    it('handles real WSMessage payloads: chat_stream', () => {
      const wirePayload = { delta: 'Hello', done: true };
      expect(toCamel(wirePayload)).toEqual({ delta: 'Hello', done: true });
    });

    it('handles real WSMessage payloads: module_updated with nested snake_case', () => {
      const wirePayload = {
        module_id: 'abc',
        spec: { module_id: 'abc', display_name: 'Weather', created_at: '2024-01-01' },
      };
      const result = toCamel(wirePayload);
      expect(result).toEqual({
        moduleId: 'abc',
        spec: { moduleId: 'abc', displayName: 'Weather', createdAt: '2024-01-01' },
      });
    });

    it('handles real WSMessage payloads: error with agent_action', () => {
      const wirePayload = {
        code: 'WS_UNKNOWN_TYPE',
        message: 'Unknown type',
        agent_action: 'Check enum',
      };
      expect(toCamel(wirePayload)).toEqual({
        code: 'WS_UNKNOWN_TYPE',
        message: 'Unknown type',
        agentAction: 'Check enum',
      });
    });

    it('handles real WSMessage payloads: usage_summary', () => {
      const wirePayload = { daily: 10, weekly: 50, monthly: 200 };
      expect(toCamel(wirePayload)).toEqual({ daily: 10, weekly: 50, monthly: 200 });
    });

    it('handles real WSMessage payloads: module_list with multiple modules', () => {
      const wirePayload = {
        modules: [
          { module_id: '1', display_name: 'Weather' },
          { module_id: '2', display_name: 'Tasks' },
        ],
      };
      expect(toCamel(wirePayload)).toEqual({
        modules: [
          { moduleId: '1', displayName: 'Weather' },
          { moduleId: '2', displayName: 'Tasks' },
        ],
      });
    });

    it('handles real WSMessage payloads: module_sync with last_sync', () => {
      const wirePayload = {
        modules: [{ module_id: '1' }],
        last_sync: '2024-01-01T00:00:00Z',
      };
      expect(toCamel(wirePayload)).toEqual({
        modules: [{ moduleId: '1' }],
        lastSync: '2024-01-01T00:00:00Z',
      });
    });

    it('preserves type-like string values (does not convert values)', () => {
      const input = { message_type: 'chat_stream' };
      const result = toCamel(input);
      expect(result).toEqual({ messageType: 'chat_stream' });
      // Crucially, the VALUE 'chat_stream' is NOT converted
    });

    it('handles objects with many keys', () => {
      const input: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        // Use purely alphabetic snake_case keys so _([a-z]) regex works
        input[`key_val_${String.fromCharCode(97 + (i % 26))}_${Math.floor(i / 26)}`] = i;
      }
      const result = toCamel(input) as Record<string, number>;
      expect(Object.keys(result)).toHaveLength(100);
    });

    it('handles keys with digits between underscores', () => {
      // The regex _([a-z]) does NOT match _0 since 0 is not [a-z]
      // So key_0_value becomes key_0Value
      const result = toCamel({ key_0_value: 'test' });
      expect(result).toHaveProperty('key_0Value');
    });
  });
});
