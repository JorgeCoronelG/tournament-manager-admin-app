import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp } from "./support";

const pages = [
  { name: "dashboard", path: "/" },
  { name: "customers", path: "/customers" },
  { name: "not found", path: "/nowhere" },
];

test.describe("accessibility (axe)", () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page);
    await page.addInitScript(() => localStorage.setItem("app.lang", "en"));
  });

  for (const { name, path } of pages) {
    test(`${name} has no detectable violations`, async ({ page }) => {
      await gotoApp(page, path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      expect(
        results.violations.flatMap((violation) =>
          violation.nodes.map(
            (node) =>
              `${violation.id}: ${node.target.join(" ")} — ${node.failureSummary?.split("\n")[1]?.trim()}`,
          ),
        ),
      ).toEqual([]);
    });
  }

  test("customers in dark mode has no detectable violations", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "app.preferences.v1",
        JSON.stringify({
          id: "poseidon",
          direction: "ltr",
          style: {
            themeClassName: "app-theme-default",
            colorScheme: "dark",
            borderRadius: { value: 0.5, unit: "rem" },
            buttonBorderRadius: null,
          },
          toolbarFixed: true,
          footer: { visible: true, fixed: false },
        }),
      ),
    );
    await gotoApp(page, "/customers");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toHaveClass(/\bdark\b/);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(
      results.violations.flatMap((violation) =>
        violation.nodes.map(
          (node) => `${violation.id}: ${node.target.join(" ")}`,
        ),
      ),
    ).toEqual([]);
  });
});
