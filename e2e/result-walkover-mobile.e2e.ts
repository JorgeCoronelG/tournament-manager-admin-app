import { expect, Locator, Page, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeTournaments,
  mockFieldsApi,
  mockGroupsApi,
  mockMatchesApi,
  mockTournamentsApi,
  makeFields,
} from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

const TEAMS = [
  "Águilas Doradas del Norte de la Ciudad",
  "Búhos",
  "Deportivo Los Campeones del Bajío",
  "Delfines",
];

async function openMenu(page: Page, item: RegExp, played = false) {
  await freezeTime(page);
  await mockTournamentsApi(page, { tournaments: makeTournaments(4) });
  await mockGroupsApi(page, {
    groups: [{ id: 1, name: "Grupo A", type: "regular_stage" }],
    teams: TEAMS.map((name, i) => ({
      id: i + 1,
      name,
      manager: null,
      groupId: 1,
    })),
  });
  await mockFieldsApi(page, { fields: makeFields(2) });
  await mockMatchesApi(page, {
    groups: [{ id: 1, name: "Grupo A", teams: TEAMS }],
    generated: true,
    extras: played
      ? {
          1: {
            status: "played",
            home_score: 2,
            away_score: 1,
            match_datetime: "2026-11-10T10:00:00",
          },
        }
      : {},
  });
  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: "Torneo 02" }).click();
  await page
    .locator("mat-expansion-panel li")
    .first()
    .getByRole("button", { name: "Acciones del partido" })
    .click();
  await page.getByRole("menuitem", { name: item }).click();
  await expect(page.locator(".mat-mdc-dialog-surface")).toHaveCSS(
    "transform",
    "none",
  );

  return page.locator("mat-dialog-container");
}

async function noOverflow(page: Page, dialog: Locator) {
  const box = await dialog.boundingBox();
  const width = page.viewportSize()!.width;
  expect(box!.x).toBeGreaterThanOrEqual(15);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width - 15);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

for (const viewport of viewports) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("new result: stacked fields, validation, no horizontal scroll", async ({
      page,
    }) => {
      const dialog = await openMenu(page, /Editar resultado/);
      await noOverflow(page, dialog);
      await expect(
        dialog.locator("p", { hasText: TEAMS[0] }).first(),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Anular resultado" }),
      ).toHaveCount(0);
      const home = dialog.getByLabel(`Goles de ${TEAMS[0]}`);
      const away = dialog
        .getByLabel(`Goles de ${TEAMS[2]}`)
        .or(dialog.locator("input").nth(1));
      const [a, b] = [await home.boundingBox(), await away.boundingBox()];
      expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);

      await home.fill("-1");
      await dialog.getByRole("button", { name: "Guardar" }).click();
      await expect(dialog.locator("mat-error").first()).toBeVisible();
      await noOverflow(page, dialog);
    });

    test("existing result: void sits in its own row", async ({ page }) => {
      const dialog = await openMenu(page, /Editar resultado/, true);
      const voidBtn = dialog.getByRole("button", { name: "Anular resultado" });
      const save = dialog.getByRole("button", { name: "Guardar" });
      const cancel = dialog.getByRole("button", { name: "Cancelar" });
      const [v, s, c] = [
        await voidBtn.boundingBox(),
        await save.boundingBox(),
        await cancel.boundingBox(),
      ];
      expect(v!.y + v!.height).toBeLessThanOrEqual(s!.y + 1);
      expect(Math.abs(s!.width - c!.width)).toBeLessThan(2);
      await noOverflow(page, dialog);
    });

    test("walkover: pick the loser and see the result box", async ({
      page,
    }) => {
      const dialog = await openMenu(page, /Ganado por default/);
      await noOverflow(page, dialog);
      const confirm = dialog.getByRole("button", {
        name: "Registrar victoria por default",
      });
      await expect(confirm).toContainText(/^\s*Registrar\s*$/);
      await expect(confirm).toBeDisabled();
      await dialog.getByRole("radio").first().check({ force: true });
      await expect(dialog.getByRole("status")).toBeVisible();
      await expect(confirm).toBeEnabled();
      await noOverflow(page, dialog);
      const cancel = await dialog
        .getByRole("button", { name: "Cancelar" })
        .boundingBox();
      const ok = await confirm.boundingBox();
      expect(Math.abs(cancel!.width - ok!.width)).toBeLessThan(2);
      expect(Math.abs(cancel!.height - ok!.height)).toBeLessThan(2);
    });
  });
}
