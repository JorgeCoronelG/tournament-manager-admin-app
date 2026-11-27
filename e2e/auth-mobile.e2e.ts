import { expect, Locator, Page, test } from "@playwright/test";
import { freezeTime } from "./support";

const SCREENS = ["/", "/recuperar-contrasena", "/activar-cuenta"];

async function open(page: Page, path: string) {
  await freezeTime(page);
  await page.goto(path);
  await page.locator("#app-splash-screen").waitFor({ state: "detached" });
}

const noSideScroll = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBe(0);

/** Each field's error stays above whatever comes after the field */
async function errorsFit(page: Page) {
  const errors = page.locator("mat-error");
  await expect(errors.first()).toBeVisible();
  const overflow = await page.locator("mat-form-field").evaluateAll(
    (fields) =>
      fields.filter((field) => {
        const error = field.querySelector("mat-error");

        return (
          !!error &&
          error.getBoundingClientRect().bottom >
            field.getBoundingClientRect().bottom + 1
        );
      }).length,
  );
  expect(overflow).toBe(0);
}

/**
 * Scrolls as a user does, with the wheel. `scrollIntoView` would also move a box
 * with `overflow: hidden`, which nobody can drag.
 */
async function reach(page: Page, target: Locator) {
  const size = page.viewportSize()!;
  await page.mouse.move(size.width / 2, size.height / 2);

  await expect(async () => {
    const box = (await target.boundingBox())!;
    const down = box.y + box.height - size.height;
    const delta = down > 0 ? down + 8 : box.y < 0 ? box.y - 8 : 0;

    if (delta) {
      await page.mouse.wheel(0, delta);
    }
    await expect(target).toBeInViewport({ ratio: 1, timeout: 500 });
  }).toPass({ timeout: 5000 });
}

/** With the keyboard up (a short viewport) the field and the button can be reached */
async function withKeyboard(page: Page, field: Locator, button: Locator) {
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: 320 });
  // A tap on the field once the keyboard is up: gaining focus scrolls to it
  await field.blur();
  await field.focus();
  await expect(field).toBeInViewport();
  await reach(page, button);
  await page.setViewportSize(size);
}

const touchHeight = async (link: Locator) => (await link.boundingBox())!.height;

for (const viewport of [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
  { width: 667, height: 375 },
]) {
  test.describe(`auth screens ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("login: touch area, errors and keyboard", async ({ page }) => {
      await open(page, "/");
      // No needless scroll where the card fits
      if (viewport.height > 600) {
        expect(
          await page
            .locator("div.overflow-y-auto")
            .evaluate((el) => el.scrollHeight - el.clientHeight),
        ).toBe(0);
      }
      if (viewport.width < 600) {
        expect(
          await touchHeight(
            page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }),
          ),
        ).toBeGreaterThanOrEqual(44);
      }
      const submit = page.getByRole("button", { name: "Iniciar sesión" });
      await submit.click();
      await errorsFit(page);
      await noSideScroll(page);
      await withKeyboard(
        page,
        page.getByLabel("Contraseña", { exact: true }),
        submit,
      );
    });

    test("forgot password: request and reset steps", async ({ page }) => {
      await page.route(/\/forgot-password$/, (route) =>
        route.fulfill({ json: {} }),
      );
      await open(page, "/recuperar-contrasena");
      const back = page.getByRole("link", { name: "Volver a iniciar sesión" });
      if (viewport.width < 600) {
        expect(await touchHeight(back)).toBeGreaterThanOrEqual(44);
      }
      const send = page.getByRole("button", { name: "Enviar código" });
      await send.click();
      await errorsFit(page);
      await page.getByLabel("Correo").fill("ana@example.com");
      await send.click();

      const reset = page.getByRole("button", { name: "Cambiar contraseña" });
      await expect(reset).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Mostrar|visib/i }),
      ).toHaveCount(2);
      await reset.click();
      await errorsFit(page);
      await page.getByLabel("Nueva contraseña").fill("123");
      await page.getByLabel("Confirmar contraseña").fill("456");
      await page.getByLabel("Confirmar contraseña").blur();
      await errorsFit(page);
      await noSideScroll(page);
      await reach(page, reset);
      await reach(
        page,
        page.getByRole("button", { name: "Solicitar otro código" }),
      );
      await withKeyboard(page, page.getByLabel("Confirmar contraseña"), reset);
    });

    test("activate: manual, rejected and activated", async ({ page }) => {
      let reject = true;
      await page.route(/\/activate-account$/, (route) => {
        if (route.request().method() !== "POST") {
          return route.fallback();
        }

        return reject
          ? route.fulfill({
              status: 422,
              json: { code: 422, error: "El código venció o no es válido." },
            })
          : route.fulfill({ json: {} });
      });
      await open(page, "/activar-cuenta");
      const submit = page.getByRole("button", { name: "Activar cuenta" });
      await submit.click();
      await errorsFit(page);
      await noSideScroll(page);

      await page.getByLabel("Correo").fill("ana@example.com");
      await page.getByLabel("Código de verificación").fill("123456");
      await page.getByLabel("Nueva contraseña").fill("secret123");
      await page.getByLabel("Confirmar contraseña").fill("secret123");
      await withKeyboard(page, page.getByLabel("Confirmar contraseña"), submit);
      await submit.click();
      await expect(
        page.getByText("Pide una nueva invitación al administrador."),
      ).toBeVisible();
      await noSideScroll(page);

      await reach(page, submit);
      reject = false;
      await submit.click();
      await expect(
        page.getByRole("link", { name: "Ir al inicio de sesión" }),
      ).toBeVisible();
      await noSideScroll(page);
    });

    test("activate from the e-mail link", async ({ page }) => {
      await open(page, "/activar-cuenta?email=ana@example.com&code=123456");
      await expect(page.getByLabel("Correo")).toHaveCount(0);
      await noSideScroll(page);
    });
  });
}

for (const path of SCREENS) {
  test(`desktop centres the card of ${path}`, async ({ page }) => {
    await open(page, path);
    const card = (await page.locator(".max-w-md").boundingBox())!;
    const size = page.viewportSize()!;
    expect(Math.abs(card.x + card.width / 2 - size.width / 2)).toBeLessThan(2);
    expect(Math.abs(card.y + card.height / 2 - size.height / 2)).toBeLessThan(
      2,
    );
  });
}

test("a low desktop window reaches the whole card", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 420 });
  await open(page, "/activar-cuenta");
  await reach(page, page.getByRole("button", { name: "Activar cuenta" }));
  await reach(page, page.getByRole("img", { name: "Logo" }));
});

test("the three screens share the dark background", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const colors: string[] = [];

  for (const path of SCREENS) {
    await open(page, path);
    await page.evaluate(() => document.body.classList.add("dark"));
    colors.push(
      await page
        .locator("div.h-dvh")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    );
  }

  expect(new Set(colors).size).toBe(1);
  expect(colors[0]).not.toBe("rgb(243, 244, 246)");
});
