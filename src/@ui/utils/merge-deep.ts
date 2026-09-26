type PlainObject = Record<string, unknown>;

const isObject = (value: unknown): value is PlainObject =>
  !!value && typeof value === "object";

/**
 * Performs a deep merge of `source` into `target`.
 * Mutates `target` only but not its objects and arrays.
 *
 * @author inspired by [jhildenbiddle](https://stackoverflow.com/a/48218209).
 */
export function mergeDeep<T, P>(target: T, source: P): T & P {
  if (!isObject(target) || !isObject(source)) {
    return source as T & P;
  }

  const merged: PlainObject = target;
  const incoming: PlainObject = source;

  Object.keys(incoming).forEach((key) => {
    const targetValue = merged[key];
    const sourceValue = incoming[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      merged[key] = targetValue.concat(sourceValue);
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      merged[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
    } else {
      merged[key] = sourceValue;
    }
  });

  return target as T & P;
}
