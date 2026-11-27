import { expect, Page, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeRegistrations,
  makeRosterEntries,
  makeTournaments,
  mockRegistrationsApi,
  mockRostersApi,
  mockTournamentsApi,
} from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

/** Opens the page and picks the tournament and the first team */
async function open(
  page: Page,
  {
    tournament = "Torneo 02",
    status,
  }: { tournament?: string; status?: string } = {},
) {
  await mockTournamentsApi(page, {
    tournaments: makeTournaments(3).map((t) =>
      status && t.name === tournament
        ? { ...t, status: status as "playoffs" }
        : t,
    ),
  });
  await mockRegistrationsApi(page, {
    registrations: makeRegistrations(4, { withdrawn: false }),
  });
  const api = await mockRostersApi(page, { entries: makeRosterEntries(14) });
  await gotoApp(page, "/dashboard/torneos/plantillas");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: tournament }).click();
  await page.getByRole("combobox", { name: "Equipo" }).click();

  return api;
}

const pageOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

for (const viewport of viewports) {
  test.describe(`rosters on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });
    const tag = `${viewport.width}x${viewport.height}`;

    test.beforeEach(async ({ page }) => {
      await freezeTime(page);
    });

    test("the pickers are full width and the team panel stays inside the screen", async ({
      page,
    }, testInfo) => {
      await open(page);
      const panel = page.locator(".mat-mdc-select-panel");
      await expect(panel).toBeVisible();
      const box = await panel.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`pickers-${tag}.png`),
      });

      await page.getByRole("option").first().click();
      await expect(page.locator("tr[mat-row]")).toHaveCount(10);

      const widths = await page.evaluate(() =>
        Array.from(document.querySelectorAll("mat-form-field")).map(
          (el) => el.getBoundingClientRect().width,
        ),
      );
      // Tournament and team (the first two fields) take the whole width
      expect(widths[0]).toBeGreaterThan(viewport.width - 56);
      expect(widths[1]).toBeGreaterThan(viewport.width - 56);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    });

    test("search, filters toggle with badge, panel with status and clear; the table fits", async ({
      page,
    }, testInfo) => {
      const api = await open(page);
      await page.getByRole("option").first().click();
      await expect(page.locator("tr[mat-row]")).toHaveCount(10);

      const tableY = await page.evaluate(() => {
        const el = document.querySelector(".app-table-scroll");

        return el ? el.scrollHeight - el.clientHeight : 0;
      });
      expect(tableY).toBeLessThanOrEqual(0);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);

      await expect(page.getByRole("searchbox")).toBeVisible();
      await page.getByRole("button", { name: "Filtros" }).click();
      await page.getByRole("combobox", { name: "Estado" }).click();
      await page.getByRole("option", { name: "Removido" }).click();
      await expect(
        page.getByRole("button", { name: "Filtros, 1 activos" }),
      ).toBeVisible();
      expect(api.queries.at(-1)?.get("status")).toBe("removed");
      await page.screenshot({
        path: testInfo.outputPath(`filters-${tag}.png`),
      });

      await page.getByRole("button", { name: "Limpiar", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Filtros", exact: true }),
      ).toBeVisible();
      expect(api.queries.at(-1)?.get("status") ?? "").toBe("");

      // Compact paginator
      await expect(page.locator(".mat-mdc-paginator-page-size")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Primera página" }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Página siguiente" }).click();
      await expect(page.locator(".mat-mdc-paginator-range-label")).toHaveText(
        "11 – 14 de 14",
      );
    });

    test("the menu removes an active player and handles the rejoin of a removed one", async ({
      page,
    }, testInfo) => {
      const api = await open(page);
      await page.getByRole("option").first().click();
      const rows = page.locator("tr[mat-row]");
      await expect(rows).toHaveCount(10);
      await expect(
        rows
          .first()
          .locator("td")
          .first()
          .getByRole("button", { name: "Acciones" }),
      ).toBeVisible();

      // Active player: remove
      await rows.first().getByRole("button", { name: "Acciones" }).click();
      await expect(page.getByRole("menuitem")).toHaveText(["Quitar jugador"]);
      await page.screenshot({
        path: testInfo.outputPath(`menu-active-${tag}.png`),
      });
      await page.getByRole("menuitem", { name: "Quitar jugador" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const sizes = await dialog.evaluate((el) => ({
        right: el.getBoundingClientRect().right,
        bottom: el.getBoundingClientRect().bottom,
        h: window.innerHeight,
      }));
      expect(sizes.right).toBeLessThanOrEqual(viewport.width);
      expect(sizes.bottom).toBeLessThanOrEqual(sizes.h);
      await expect(
        dialog.getByRole("button", { name: "Cancelar" }),
      ).toBeInViewport();
      await dialog.getByRole("button", { name: "Cancelar" }).click();
      await expect(dialog).toBeHidden();

      // Removed player (4th row), no rejoin yet: authorize
      await rows.nth(3).getByRole("button", { name: "Acciones" }).click();
      await expect(page.getByRole("menuitem")).toHaveText([
        "Autorizar reingreso",
      ]);
      await page.screenshot({
        path: testInfo.outputPath(`menu-removed-${tag}.png`),
      });
      await page.keyboard.press("Escape");
      expect(api.removed).toEqual([]);
    });

    test("in the playoffs 'Quitar' is disabled and says why inside the menu", async ({
      page,
    }, testInfo) => {
      await open(page, { tournament: "Torneo 02", status: "playoffs" });
      await page.getByRole("option").first().click();
      const rows = page.locator("tr[mat-row]");
      await expect(rows).toHaveCount(10);

      await rows.first().getByRole("button", { name: "Acciones" }).click();
      const item = page.getByRole("menuitem", { name: /Quitar jugador/ });
      await expect(item).toBeDisabled();
      await expect(item).toContainText("La liguilla ya inició");
      await page.screenshot({
        path: testInfo.outputPath(`remove-disabled-${tag}.png`),
      });
    });
  });
}
