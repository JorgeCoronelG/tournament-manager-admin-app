import { signal } from "@angular/core";
import { describe, expect, it } from "vitest";
import { formUnchanged } from "./form-unchanged";

interface Model {
  name: string;
  phone: string | null;
  roles: number[];
  start: Date | null;
  steps: string[];
}

const initial = (): Model => ({
  name: "Ana",
  phone: null,
  roles: [2, 1],
  start: new Date(2026, 10, 2),
  steps: ["a", "b"],
});

describe("formUnchanged", () => {
  it("is true until a value changes, and false again while it differs", () => {
    const model = signal(initial());
    const unchanged = formUnchanged(model);

    expect(unchanged()).toBe(true);

    model.update((value) => ({ ...value, name: "Eva" }));
    expect(unchanged()).toBe(false);

    model.update((value) => ({ ...value, name: "Ana" }));
    expect(unchanged()).toBe(true);
  });

  it("ignores surrounding spaces and treats null and empty as the same", () => {
    const model = signal(initial());
    const unchanged = formUnchanged(model);

    model.update((value) => ({ ...value, name: " Ana ", phone: "" }));

    expect(unchanged()).toBe(true);
  });

  it("compares dates by time, not by instance", () => {
    const model = signal(initial());
    const unchanged = formUnchanged(model);

    model.update((value) => ({ ...value, start: new Date(2026, 10, 2) }));
    expect(unchanged()).toBe(true);

    model.update((value) => ({ ...value, start: new Date(2026, 10, 3) }));
    expect(unchanged()).toBe(false);
  });

  it("ignores the order only of the lists marked as unordered", () => {
    const model = signal(initial());
    const unchanged = formUnchanged(model, { unordered: ["roles"] });

    model.update((value) => ({ ...value, roles: [1, 2] }));
    expect(unchanged()).toBe(true);

    model.update((value) => ({ ...value, steps: ["b", "a"] }));
    expect(unchanged()).toBe(false);
  });
});
