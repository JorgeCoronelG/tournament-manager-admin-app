import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test.describe("preferences", () => {
  test("the dark mode toggle switches the theme and survives a reload", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.clear();
        sessionStorage.setItem("seeded", "1");
      }
    });
    await gotoApp(page);
    await expect(page.locator("body")).not.toHaveClass(/\bdark\b/);

    await page.getByRole("button", { name: "Cambiar a modo oscuro" }).click();
    await expect(page.locator("body")).toHaveClass(/\bdark\b/);

    await page.reload();
    await page.locator("app-sidenav").waitFor();
    await expect(page.locator("body")).toHaveClass(/\bdark\b/);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    await page.getByRole("button", { name: "Cambiar a modo claro" }).click();
    await expect(page.locator("body")).not.toHaveClass(/\bdark\b/);
  });
});
