import { expect, Page, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeTournaments,
  mockGroupsApi,
  mockTournamentsApi,
  MockGroup,
  MockGroupTeam,
} from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

const GROUPS: MockGroup[] = [
  {
    id: 1,
    name: "Grupo A de nombre bastante largo para recortar",
    type: "regular_stage",
  },
  { id: 2, name: "Grupo B", type: "regular_stage" },
  { id: 3, name: "Grupo C", type: "regular_stage" },
  {
    id: 10,
    name: "Liguilla de Oro",
    type: "playoff",
    start_date: "2026-10-10",
    round_interval_days: 7,
    sources: [{ source_group_id: 2, position_start: 1, position_end: 2 }],
  },
];

const TEAMS: MockGroupTeam[] = [
  {
    id: 1,
    name: "Águilas Doradas del Norte de la Ciudad",
    manager: "Ana Pérez de la Torre",
    groupId: 1,
  },
  { id: 2, name: "Búhos", manager: null, groupId: 1 },
  { id: 3, name: "Cóndores", manager: "Carla López", groupId: 2 },
  { id: 4, name: "Delfines", manager: null, groupId: 2 },
  { id: 5, name: "Sin grupo todavía", manager: "Luis", groupId: null },
];

async function open(
  page: Page,
  tournament = "Torneo 01",
  options: Parameters<typeof mockGroupsApi>[1] = {
    groups: GROUPS,
    teams: TEAMS,
  },
) {
  await freezeTime(page);
  await mockTournamentsApi(page, {
    tournaments: makeTournaments(4).map((t) =>
      t.id === 4 ? { ...t, status: "playoffs" as const } : t,
    ),
  });
  const api = await mockGroupsApi(page, options);
  await gotoApp(page, "/dashboard/torneos/grupos");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: tournament }).click();

  return api;
}

const overflow = (page: Page) =>
  page.evaluate(() => ({
    page:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    inner: Array.from(document.querySelectorAll("article"))
      .map((el) => el.parentElement as HTMLElement)
      .map((el) => el.scrollWidth - el.clientWidth),
  }));

async function expectDialogFits(page: Page, width: number) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const sizes = await dialog.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const content = el.querySelector("mat-dialog-content") as HTMLElement;

    return {
      left: box.left,
      right: box.right,
      bottom: box.bottom,
      h: window.innerHeight,
      contentX: content.scrollWidth - content.clientWidth,
    };
  });
  expect(sizes.left).toBeGreaterThanOrEqual(0);
  expect(sizes.right).toBeLessThanOrEqual(width);
  expect(sizes.bottom).toBeLessThanOrEqual(sizes.h);
  expect(sizes.contentX).toBeLessThanOrEqual(0);
  await expect(
    dialog.locator("mat-dialog-actions button").last(),
  ).toBeInViewport();
}

for (const viewport of viewports) {
  test.describe(`groups on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });
    const tag = `${viewport.width}x${viewport.height}`;

    test("cards stack in one column, section buttons are full width, nothing scrolls sideways", async ({
      page,
    }, testInfo) => {
      await open(page);
      await expect(page.getByRole("article")).toHaveCount(4);

      const layout = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll("article")).map(
          (el) => el.getBoundingClientRect(),
        );
        return {
          lefts: new Set(cards.map((c) => Math.round(c.left))).size,
          widths: cards.map((c) => c.width),
        };
      });
      expect(layout.lefts).toBe(1);
      for (const width of layout.widths) {
        expect(width).toBeGreaterThan(viewport.width - 56);
      }
      for (const name of ["Aleatorio", "Nuevo grupo", "Nueva liguilla"]) {
        const box = await page.getByRole("button", { name }).boundingBox();
        expect(box!.width, name).toBeGreaterThan(viewport.width - 56);
      }
      const sizes = await overflow(page);
      expect(sizes.page).toBeLessThanOrEqual(0);
      for (const inner of sizes.inner) {
        expect(inner).toBeLessThanOrEqual(0);
      }
      await page.screenshot({
        path: testInfo.outputPath(`page-${tag}.png`),
        fullPage: true,
      });
      await page.getByText("Sin grupo todavía").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath(`unassigned-${tag}.png`),
      });
    });

    test("the group menu renames and shows why a group cannot be deleted", async ({
      page,
    }, testInfo) => {
      await open(page);
      const first = page.getByRole("article").first();

      await first.getByRole("button", { name: "Acciones" }).click();
      await expect(page.getByRole("menuitem")).toHaveCount(2);
      const del = page.getByRole("menuitem", { name: /Eliminar/ });
      await expect(del).toBeDisabled();
      await expect(del).toContainText("equipos");
      await page.screenshot({
        path: testInfo.outputPath(`menu-group-${tag}.png`),
      });
      await page.getByRole("menuitem", { name: /Renombrar/ }).click();
      await expectDialogFits(page, viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`group-dialog-${tag}.png`),
      });
    });

    test("an empty group can be deleted from its menu", async ({ page }) => {
      await open(page);
      const empty = page.getByRole("article", { name: "Grupo C" });

      await empty.getByRole("button", { name: "Acciones" }).click();
      await page.getByRole("menuitem", { name: /Eliminar/ }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Eliminar/ })
        .click();
      await expect(empty).toHaveCount(0);
    });

    test("the playoff menu edits and deletes; 'Mover a' moves a team", async ({
      page,
    }, testInfo) => {
      const api = await open(page);
      const playoff = page.getByRole("article", { name: "Liguilla de Oro" });

      await playoff.getByRole("button", { name: "Acciones" }).click();
      await expect(page.getByRole("menuitem")).toHaveText([
        "Editar Liguilla de Oro",
        "Eliminar Liguilla de Oro",
      ]);
      await page.screenshot({
        path: testInfo.outputPath(`menu-playoff-${tag}.png`),
      });
      await page.keyboard.press("Escape");

      await page
        .getByRole("button", { name: "Mover Búhos a otro grupo" })
        .click();
      await page.screenshot({
        path: testInfo.outputPath(`move-menu-${tag}.png`),
      });
      await page.getByRole("menuitem", { name: "Grupo B" }).click();
      await expect(
        page.getByRole("article", { name: "Grupo B" }),
      ).toContainText("Búhos");
      expect(api.writes.at(-1)?.[1]).toBe("/assignments");
    });

    test("the playoff dialog fits, scrolls inside and stacks its sources", async ({
      page,
    }, testInfo) => {
      await open(page);
      await page.getByRole("button", { name: "Nueva liguilla" }).click();
      await expectDialogFits(page, viewport.width);
      const dialog = page.getByRole("dialog");
      await page.screenshot({
        path: testInfo.outputPath(`playoff-dialog-top-${tag}.png`),
      });

      // Start date and interval stack
      const start = await dialog
        .getByLabel("Fecha de inicio", { exact: true })
        .boundingBox();
      const interval = await dialog
        .getByLabel("Días entre rondas", { exact: true })
        .boundingBox();
      expect(interval!.y).toBeGreaterThan(start!.y + start!.height - 1);

      // The source's fields stack (group, from, to)
      const group = await dialog
        .getByRole("combobox", { name: "Grupo" })
        .boundingBox();
      const from = await dialog.getByLabel("Desde").boundingBox();
      expect(from!.y).toBeGreaterThan(group!.y + group!.height - 1);

      // The calendar opens inside the screen
      await dialog
        .getByRole("textbox", { name: "Fecha de inicio", exact: true })
        .locator("xpath=ancestor::mat-form-field")
        .getByRole("button", { name: "Abrir calendario" })
        .click();
      const calendar = page.locator(".mat-datepicker-content");
      await expect(calendar).toBeVisible();
      const box = await calendar.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      await page.keyboard.press("Escape");

      await dialog
        .locator("mat-dialog-content")
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
      await expect(
        dialog.getByRole("button", { name: "Guardar" }),
      ).toBeInViewport();
      await page.screenshot({
        path: testInfo.outputPath(`playoff-dialog-bottom-${tag}.png`),
      });
    });

    test("a tournament in its playoff stage has no menus", async ({ page }) => {
      await open(page, "Torneo 04");
      await expect(page.getByRole("article").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Acciones" })).toHaveCount(
        0,
      );
    });
  });
}
