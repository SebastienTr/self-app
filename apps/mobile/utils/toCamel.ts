/**
 * Deep snake_case to camelCase converter for incoming WS JSON payloads.
 *
 * Converts all object keys from snake_case to camelCase recursively.
 * Handles nested objects, arrays, and preserves primitive values.
 */

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function toCamel<T = unknown>(data: unknown): T {
  if (data === null || data === undefined) {
    return data as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => toCamel(item)) as T;
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[snakeToCamel(key)] = toCamel(value);
    }
    return result as T;
  }

  // Primitives pass through unchanged
  return data as T;
}
