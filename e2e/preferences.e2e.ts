import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test.describe("preferences", () => {
  test("theme and color scheme survive a reload", async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.clear();
        sessionStorage.setItem("seeded", "1");
      }
    });
    await gotoApp(page);

    await page.getByRole("button", { name: "Abrir ajustes" }).click();
    await page.getByRole("button", { name: "Modo oscuro" }).click();
    await page.getByRole("button", { name: "TEAL" }).click();
    await page.keyboard.press("Escape");
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
    await gotoApp(page);

    await page.getByRole("button", { name: "Abrir ajustes" }).click();
    await expect(page.locator("body")).toHaveClass(/app-scrollblock/);

    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/app-scrollblock/);
  });
});
