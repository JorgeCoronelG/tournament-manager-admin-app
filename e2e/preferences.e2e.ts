import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test.describe("preferences", () => {
  test("theme, color scheme and language survive a reload", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.clear();
        sessionStorage.setItem("seeded", "1");
      }
    });
    await gotoApp(page);

    await page.getByRole("button", { name: "Open settings" }).click();
    await page.getByRole("button", { name: "Dark mode" }).click();
    await page.getByRole("button", { name: "TEAL" }).click();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Change language" }).click();
    await page.getByRole("menuitem", { name: "Español" }).click();
    await expect(page.getByRole("link", { name: "Clientes" })).toBeVisible();

    await page.reload();
    await page.locator("app-sidenav").waitFor();

    await expect(page.locator("body")).toHaveClass(/\bdark\b/);
    await expect(page.locator("body")).toHaveClass(/app-theme-teal/);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("link", { name: "Clientes" })).toBeVisible();
  });

  test("Escape closes the settings panel and releases the scroll lock", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("app.lang", "en"));
    await gotoApp(page);

    await page.getByRole("button", { name: "Open settings" }).click();
    await expect(page.locator("body")).toHaveClass(/app-scrollblock/);

    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/app-scrollblock/);
  });
});
