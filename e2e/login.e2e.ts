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

  test("on a phone the remember-me checkbox and the forgot-password link are on separate lines", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const checkbox = page.getByRole("checkbox", { name: "Recordarme" });
    const link = page.getByRole("link", { name: "¿Olvidaste tu contraseña?" });
    const checkboxBox = await checkbox.boundingBox();
    const linkBox = await link.boundingBox();

    expect(linkBox?.y).toBeGreaterThanOrEqual(
      (checkboxBox?.y ?? 0) + (checkboxBox?.height ?? 0),
    );

    // The link is as far from the button as one field is from the next
    const fields = await page
      .locator("mat-form-field")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
    const button = await page
      .getByRole("button", { name: "Iniciar sesión" })
      .boundingBox();
    const fieldGap = fields[1].top - fields[0].bottom;
    const linkGap =
      (button?.y ?? 0) - ((linkBox?.y ?? 0) + (linkBox?.height ?? 0));
    expect(linkGap).toBeGreaterThanOrEqual(fieldGap - 2);
  });
});
