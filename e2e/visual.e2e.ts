import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp } from "./support";

/**
 * Visual regression. Update the baselines with `npm run e2e:docker -- --update-snapshots`
 * after an intentional UI change, and review the diff of the images in the PR.
 */
test.describe("visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page);
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("app.lang", "en");
    });
  });

  test("dashboard", async ({ page }) => {
    await gotoApp(page);
    await expect(page.getByText("Recent customers")).toBeVisible();

    await expect(page).toHaveScreenshot("dashboard.png");
  });

  test("customers", async ({ page }) => {
    await gotoApp(page, "/customers");
    await expect(page.locator("tr[mat-row]")).toHaveCount(10);

    await expect(page).toHaveScreenshot("customers.png");
  });

  test("settings panel", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Open settings" }).click();
    await page.locator(".sidebar.open").waitFor();

    await expect(page).toHaveScreenshot("settings-panel.png");
  });

  for (const [scheme, theme] of [
    ["light", "app-theme-default"],
    ["dark", "app-theme-default"],
    ["dark", "app-theme-teal"],
  ]) {
    test(`style guide, ${scheme} ${theme}`, async ({ page }) => {
      // The page scrolls inside the layout, so use a viewport tall enough for all of it
      await page.setViewportSize({ width: 1440, height: 1500 });
      await gotoApp(page, "/styleguide");
      await page.evaluate(
        ([s, t]) => {
          document.body.classList.remove("light", "dark", "app-theme-default");
          document.body.classList.add(s, t);
        },
        [scheme, theme],
      );

      await expect(page).toHaveScreenshot(`styleguide-${scheme}-${theme}.png`);
    });
  }
});
