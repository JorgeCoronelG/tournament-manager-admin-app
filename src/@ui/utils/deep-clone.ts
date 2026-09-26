/**
 * Recursively clones plain objects, arrays and dates.
 */
function deepClone<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T;
  }

  const copy: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    copy[key] = deepClone(item);
  }

  return copy as T;
}

export default deepClone;
