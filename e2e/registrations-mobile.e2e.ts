import { expect, Page, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeRegistrations,
  makeTournaments,
  mockRegistrationsApi,
  mockTournamentsApi,
} from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

async function open(
  page: Page,
  tournament: string,
  count = 12,
  withdrawn = false,
) {
  await mockTournamentsApi(page, { tournaments: makeTournaments(3) });
  const api = await mockRegistrationsApi(page, {
    registrations: makeRegistrations(count, { withdrawn }),
  });
  await gotoApp(page, "/dashboard/torneos/inscripciones");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: tournament }).click();

  return api;
}

const pageOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

for (const viewport of viewports) {
  test.describe(`registrations on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });
    const tag = `${viewport.width}x${viewport.height}`;

    test.beforeEach(async ({ page }) => {
      await freezeTime(page);
    });

    test("planning: full-width controls, no overflow, compact paginator", async ({
      page,
    }, testInfo) => {
      await open(page, "Torneo 01");
      await expect(page.locator("tr[mat-row]")).toHaveCount(10);

      const widths = await page.evaluate(() => {
        const box = (el: Element | null) => el?.getBoundingClientRect().width;
        const fields = document.querySelectorAll("mat-form-field");
        const register = Array.from(document.querySelectorAll("button")).find(
          (b) => b.textContent?.includes("Inscribir equipos"),
        );

        return {
          picker: box(fields[0]),
          search: box(fields[1]),
          register: box(register ?? null),
          tableY: (() => {
            const el = document.querySelector(".app-table-scroll");

            return el ? el.scrollHeight - el.clientHeight : 0;
          })(),
        };
      });
      expect(widths.picker).toBeGreaterThan(viewport.width - 56);
      expect(widths.search).toBeGreaterThan(viewport.width - 56);
      expect(widths.register).toBeGreaterThan(viewport.width - 56);
      expect(widths.tableY).toBeLessThanOrEqual(0);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);

      // "⋮" is the first column
      await expect(
        page
          .locator("tr[mat-row]")
          .first()
          .locator("td")
          .first()
          .getByRole("button", {
            name: "Acciones",
          }),
      ).toBeVisible();

      // Compact paginator, and the next page scrolls back to the table
      await expect(page.locator(".mat-mdc-paginator-page-size")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Primera página" }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Página siguiente" }).click();
      await expect(page.locator(".mat-mdc-paginator-range-label")).toHaveText(
        "11 – 12 de 12",
      );
      await page.screenshot({
        path: testInfo.outputPath(`planning-${tag}.png`),
      });
    });

    test("the menu removes a registration after confirming", async ({
      page,
    }, testInfo) => {
      const api = await open(page, "Torneo 01", 3);
      const rows = page.locator("tr[mat-row]");
      await expect(rows).toHaveCount(3);

      await rows.first().getByRole("button", { name: "Acciones" }).click();
      await expect(page.getByRole("menuitem")).toHaveText([
        "Quitar inscripción",
      ]);
      await page.screenshot({ path: testInfo.outputPath(`menu-${tag}.png`) });
      await page.getByRole("menuitem", { name: "Quitar inscripción" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Quitar/ })
        .click();
      await expect(rows).toHaveCount(2);
      expect(api.removed).toEqual([1]);
    });

    test("the register dialog fits the screen", async ({ page }, testInfo) => {
      await open(page, "Torneo 01", 3);
      await page.getByRole("button", { name: "Inscribir equipos" }).click();
      await expectDialogFits(page, viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`register-dialog-${tag}.png`),
      });
    });

    test("in progress: no register button, a withdrawn row keeps its muted look and the menu fits the status", async ({
      page,
    }, testInfo) => {
      await open(page, "Torneo 02", 10, true);
      const rows = page.locator("tr[mat-row]");
      await expect(rows).toHaveCount(10);
      await expect(
        page.getByRole("button", { name: "Inscribir equipos" }),
      ).toHaveCount(0);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);

      // Row 5 (index 4) is withdrawn: dimmed, and no "Dar de baja" in its menu
      await expect(rows.nth(4).locator("td").nth(1)).toHaveClass(/opacity-60/);
      await rows.nth(4).getByRole("button", { name: "Acciones" }).click();
      await expect(page.getByRole("menuitem")).toHaveText([
        "Reemplazar equipo",
        "Ver historial de equipos",
      ]);
      await page.keyboard.press("Escape");

      await rows.first().getByRole("button", { name: "Acciones" }).click();
      await expect(page.getByRole("menuitem")).toHaveText([
        "Reemplazar equipo",
        "Dar de baja",
        "Ver historial de equipos",
      ]);
      await page.screenshot({
        path: testInfo.outputPath(`in-progress-${tag}.png`),
      });
      await page.keyboard.press("Escape");
    });

    test("withdraw, replace and history dialogs fit the screen", async ({
      page,
    }, testInfo) => {
      await open(page, "Torneo 02", 3);
      const first = page.locator("tr[mat-row]").first();

      await first.getByRole("button", { name: "Acciones" }).click();
      await page.getByRole("menuitem", { name: "Dar de baja" }).click();
      await expect(page.getByRole("dialog")).toContainText(
        "partidos pendientes",
      );
      await expectDialogFits(page, viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`withdraw-dialog-${tag}.png`),
      });
      await page.getByRole("button", { name: "Cancelar" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await first.getByRole("button", { name: "Acciones" }).click();
      await page.getByRole("menuitem", { name: "Reemplazar equipo" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectDialogFits(page, viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`replace-dialog-${tag}.png`),
      });
      await page.getByRole("button", { name: "Cancelar" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await first.getByRole("button", { name: "Acciones" }).click();
      await page
        .getByRole("menuitem", { name: "Ver historial de equipos" })
        .click();
      await expect(page.getByRole("dialog")).toContainText("Equipo anterior");
      await expectDialogFits(page, viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`history-dialog-${tag}.png`),
      });
    });
  });
}

/** Inside the screen, no horizontal scroll and the title and buttons in view */
async function expectDialogFits(page: Page, width: number): Promise<void> {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const sizes = await dialog.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const content = el.querySelector("mat-dialog-content") as HTMLElement;

    return {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      contentX: content.scrollWidth - content.clientWidth,
      innerHeight: window.innerHeight,
    };
  });
  expect(sizes.left).toBeGreaterThanOrEqual(0);
  expect(sizes.right).toBeLessThanOrEqual(width);
  expect(sizes.top).toBeGreaterThanOrEqual(0);
  expect(sizes.bottom).toBeLessThanOrEqual(sizes.innerHeight);
  expect(sizes.contentX).toBeLessThanOrEqual(0);
  await expect(
    dialog.locator("mat-dialog-actions button").last(),
  ).toBeInViewport();
  expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
}
