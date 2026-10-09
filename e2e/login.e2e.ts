import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp } from "./support";

test.describe("login", () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page);
  });

  test("a rejected sign-in (403) shows the server's message and keeps no session", async ({
    page,
  }) => {
    let body: unknown;
    await page.route(/\/api\/login$/, (route) => {
      body = route.request().postDataJSON();

      return route.fulfill({
        status: 403,
        json: {
          code: 403,
          error: "Tu cuenta no tiene acceso al panel de administración.",
        },
      });
    });
    await gotoApp(page, "/");

    await page.getByLabel("Correo").fill("arbitro@example.com");
    await page.getByLabel("Contraseña", { exact: true }).fill("secret123");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(
      page.getByText("Tu cuenta no tiene acceso al panel de administración."),
    ).toBeVisible();
    expect(body).toEqual({
      email: "arbitro@example.com",
      password: "secret123",
      client: "web",
    });
    await expect(page).toHaveURL(/\/$/);
    expect(
      await page.evaluate(() => localStorage.getItem("app.auth.token")),
    ).toBeNull();
  });
});
