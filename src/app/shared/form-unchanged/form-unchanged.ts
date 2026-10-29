import { computed, Signal } from "@angular/core";

export interface FormUnchangedOptions<T> {
  /** Fields that are lists whose order does not matter (e.g. the roles) */
  unordered?: ReadonlyArray<keyof T>;
}

/**
 * Whether a form's value is still the one it had when this was called, to keep
 * Save disabled while editing with no changes. Values are compared as they would
 * be sent: strings trimmed, `null`/`undefined` equal to `""`, dates by time, and
 * the `unordered` lists in no particular order.
 *
 * Call it right after the model is created, with the model's initial value:
 *
 * ```ts
 * readonly unchanged = this.user ? formUnchanged(this.model) : signal(false);
 * ```
 */
export function formUnchanged<T extends object>(
  model: Signal<T>,
  options: FormUnchangedOptions<T> = {},
): Signal<boolean> {
  const unordered = new Set<PropertyKey>(options.unordered ?? []);
  const normalize = (value: T): string =>
    JSON.stringify(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, field]) => [
          key,
          normalizeField(field, unordered.has(key)),
        ]),
    );
  const initial = normalize(model());

  return computed(() => normalize(model()) === initial);
}

function normalizeField(value: unknown, unordered: boolean): unknown {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => normalizeField(item, false));

    return unordered
      ? items.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      : items;
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, field]) => [key, normalizeField(field, false)]),
    );
  }

  return value;
}
