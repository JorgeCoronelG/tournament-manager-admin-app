import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The first render of a Material table is slow on a busy machine (CI, or a
    // dev server rebuilding next to the tests): 5 s was not enough
    testTimeout: 20_000,
  },
});
