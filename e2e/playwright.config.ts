import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end and visual regression tests.
 *
 *   npm run e2e:docker    everything in Docker, in the same image CI uses. Use this
 *                         one: the screenshots in e2e/__screenshots__ are rendered there.
 *   npm run e2e           only the tests (`cd e2e && npm ci` first), against `npm start` + `npm run api` that you
 *                         started yourself (needs Playwright browsers installed).
 *
 * The app runs with `ng serve` against the mock API, exactly as in development.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"]
    ? [["github"], ["html", { open: "never" }]]
    : "list",
  // Generous timeouts: the first requests hit a cold dev server compiling lazy chunks
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled" },
  },
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:4200",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
