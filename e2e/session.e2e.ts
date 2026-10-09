import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp } from "./support";

test.describe("session", () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page);
  });

  test("a 401 ends the session: clears the data and goes to the login", async ({
    page,
  }) => {
    await page.route(/\/referees(\?.*)?$/, (route) =>
      route.fulfill({
        status: 401,
        json: { code: 401, error: "No autenticado." },
      }),
    );
    await page.addInitScript(() =>
      localStorage.setItem("app.active-league.1", "1"),
    );

    await gotoApp(page, "/dashboard");

    // The list's request is the one answered with a 401
    await page.getByText("Árbitros", { exact: true }).click();
    await page.getByRole("link", { name: "Gestión" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("No autenticado.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Iniciar sesión" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => [
        localStorage.getItem("app.auth.token"),
        localStorage.getItem("app.active-league.1"),
      ]),
    ).toEqual([null, null]);
  });
});
