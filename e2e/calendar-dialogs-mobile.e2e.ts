import { expect, Page, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeFields,
  makeTournaments,
  mockFieldsApi,
  mockGroupsApi,
  mockMatchesApi,
  mockTournamentsApi,
} from "./support";

const NAMES = Array.from(
  { length: 15 },
  (_, i) => `Deportivo Los Campeones del Bajío ${i + 1}`,
);

async function open(page: Page, generated: boolean, groups = 3) {
  await freezeTime(page);
  await mockTournamentsApi(page, { tournaments: makeTournaments(4) });
  const list = Array.from({ length: groups }, (_, g) => ({
    id: g + 1,
    name: `Grupo ${"ABC"[g]}`,
    teams: NAMES.slice(g * 5, g * 5 + 5),
  }));
  await mockGroupsApi(page, {
    groups: list.map((g) => ({
      id: g.id,
      name: g.name,
      type: "regular_stage" as const,
    })),
    teams: list.flatMap((g) =>
      g.teams.map((name, i) => ({
        id: g.id * 10 + i,
        name,
        manager: null,
        groupId: g.id,
      })),
    ),
  });
  await mockFieldsApi(page, { fields: makeFields(2) });
  await mockMatchesApi(page, {
    groups: list,
    generated,
    extras: generated
      ? {
          1: {
            match_datetime: "2026-11-10T10:00:00",
            field: { id: 1, name: "Cancha 01" },
          },
        }
      : {},
  });
  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: "Torneo 02" }).click();
}

const settled = (page: Page) =>
  expect(page.locator(".mat-mdc-dialog-surface")).toHaveCSS(
    "transform",
    "none",
  );

/** Centered with margins, nothing wider than the screen, buttons half and half */
async function check(page: Page, halves = true) {
  await settled(page);
  const dialog = page.locator("mat-dialog-container");
  const width = page.viewportSize()!.width;
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(15);
  expect(box.x + box.width).toBeLessThanOrEqual(width - 15);
  expect(
    await dialog.evaluate((root) =>
      Array.from(root.querySelectorAll("mat-dialog-content")).every(
        (el) => el.scrollWidth <= el.clientWidth + 1,
      ),
    ),
  ).toBe(true);
  if (halves) {
    const buttons = dialog.locator("mat-dialog-actions button");
    const a = (await buttons.nth(0).boundingBox())!;
    const b = (await buttons.nth(1).boundingBox())!;
    expect(Math.abs(a.width - b.width)).toBeLessThan(2);
    expect(Math.abs(a.y + a.height / 2 - (b.y + b.height / 2))).toBeLessThan(2);
  }
}

async function menu(page: Page, item: string) {
  await page.getByRole("button", { name: "Acciones del calendario" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

for (const viewport of [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
  { width: 599, height: 800 },
]) {
  test.describe(`calendar dialogs ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    for (const groups of [1, 3]) {
      test(`generate with ${groups} group(s)`, async ({ page }) => {
        await open(page, false, groups);
        await page.getByRole("button", { name: "Generar calendario" }).click();
        await check(page);
        const checkbox = page.getByRole("checkbox", { name: /Sortear/ });
        const host = page.locator("mat-dialog-container mat-checkbox");
        await host.scrollIntoViewIfNeeded();
        expect((await host.boundingBox())!.height).toBeGreaterThanOrEqual(48);
        await checkbox.uncheck();
        await expect(checkbox).not.toBeChecked();
        await page.getByRole("button", { name: "Cancelar" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      });
    }

    test("regenerate, delete and clear the hours", async ({ page }) => {
      await open(page, true);
      await menu(page, "Regenerar");
      await check(page);
      await page.getByRole("button", { name: "Cancelar" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await menu(page, "Borrar calendario");
      await check(page);
      await page.getByRole("button", { name: "Cancelar" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("button", { name: "Quitar horarios" }).click();
      await check(page);
      await page.getByRole("button", { name: "Quitar", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });
  });
}
