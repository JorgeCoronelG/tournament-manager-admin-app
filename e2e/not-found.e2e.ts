import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp } from "./support";

test.describe("not found", () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page);
  });

  test("unknown routes show the 404 page", async ({ page }) => {
    await gotoApp(page, "/dashboard/this/does/not/exist");

    await expect(page.getByText("Página no encontrada").first()).toBeVisible();
    await page.getByRole("link", { name: "Volver al panel" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
