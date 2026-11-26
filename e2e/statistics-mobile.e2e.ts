import { expect, Page, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeTournaments,
  mockGroupsApi,
  mockTournamentsApi,
} from "./support";

const LONG = "Deportivo Los Campeones del Bajío de la Frontera";
const NAMES = [LONG, "Búhos", "Cóndores", "Delfines", "Halcones", "Lobos"];

const rows = () =>
  NAMES.map((team_name, i) => ({
    position: i < 3 ? 1 : 4,
    registration_id: i + 1,
    team_id: (i + 1) * 10,
    team_name,
    logo_url: null,
    played: 38,
    won: 20,
    drawn: 10,
    lost: 8,
    goals_for: 105,
    goals_against: 100,
    goal_difference: -15,
    points: 114,
    tied: true,
    withdrawn: i === 0,
    playoff: i < 4 ? { id: 10, name: "Oro", priority: 1 } : null,
  }));

async function open(page: Page, groupCount: number) {
  let manual = false;
  const writes: string[] = [];

  await freezeTime(page);
  await mockTournamentsApi(page, { tournaments: makeTournaments(4) });
  await mockGroupsApi(page, {
    groups: [{ id: 1, name: "Grupo A", type: "regular_stage" }],
    teams: [],
  });
  await page.route(/\/tournaments\/\d+\/standings(\/.*)?(\?.*)?$/, (route) => {
    const method = route.request().method();

    if (method !== "GET") {
      writes.push(method);
      manual = method === "PUT";
    }

    return route.fulfill({
      json: {
        groups: Array.from({ length: groupCount }, (_, g) => ({
          group_id: g + 1,
          group_name: `Grupo Regional Norte ${g + 1}`,
          criteria: ["points", "goal_difference"],
          rows: rows(),
          ties: manual
            ? []
            : [
                [1, 2, 3],
                [4, 5, 6],
              ],
          has_manual_order: manual,
          complete: true,
          ties_pending: !manual,
        })),
        playoffs: [
          { id: 10, name: "Oro", priority: 1, positions: "1-4" },
          { id: 11, name: "Plata de consolación", priority: 2, positions: "5" },
        ],
      },
    });
  });
  await gotoApp(page, "/dashboard/torneos/estadisticas");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: "Torneo 02" }).click();
  await expect(page.locator("tr[mat-row]").first()).toBeVisible();

  return writes;
}

/** Neither the page nor the table scrolls sideways */
async function expectNoSideScroll(page: Page) {
  expect(
    await page.evaluate(() => {
      const table = document.querySelector("table[mat-table]")!;
      const box = table.parentElement!;

      return [
        box.scrollWidth - box.clientWidth,
        document.documentElement.scrollWidth - window.innerWidth,
      ];
    }),
  ).toEqual([0, 0]);
}

for (const viewport of [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
  { width: 599, height: 800 },
]) {
  test.describe(`statistics ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test("fits the table, explains it and orders the ties", async ({
      page,
    }) => {
      const writes = await open(page, 1);
      await expectNoSideScroll(page);
      await expect(page.locator("th", { hasText: /^\s*GF\s*$/ })).toBeHidden();
      await expect(page.locator("th", { hasText: "Pts" })).toBeVisible();
      await expect(
        page.locator("p.grid", { hasText: "Partidos jugados" }),
      ).toBeVisible();

      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: /zonas de clasificación|como imagen/ })
        .click();
      await download;

      await page.getByRole("button", { name: "Definir orden" }).click();
      await expect(page.locator(".mat-mdc-dialog-surface")).toHaveCSS(
        "transform",
        "none",
      );
      const dialog = page.getByRole("dialog");
      await expect(dialog.locator("app-logo-image").first()).toBeHidden();
      expect(
        await dialog
          .locator("mat-dialog-content")
          .evaluate((el) => el.scrollWidth - el.clientWidth),
      ).toBe(0);
      const arrow = await dialog
        .getByRole("button", { name: `Bajar ${LONG}` })
        .boundingBox();
      expect(arrow!.width).toBeGreaterThanOrEqual(40);
      await dialog.getByRole("button", { name: `Bajar ${LONG}` }).click();
      await dialog.getByRole("button", { name: "Guardar" }).click();
      await expect(dialog).toHaveCount(0);
      await page.getByRole("button", { name: "Quitar orden manual" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Quitar", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Definir orden" }),
      ).toBeVisible();
      expect(writes).toContain("DELETE");
    });

    test("several groups use tabs", async ({ page }) => {
      await open(page, 4);
      await expect(page.getByRole("tab")).toHaveCount(5);
      await expectNoSideScroll(page);
    });
  });
}

test.describe("statistics from 600px", () => {
  test.use({ viewport: { width: 640, height: 800 } });

  test("keeps the ten columns and the logos", async ({ page }) => {
    await open(page, 1);
    await expect(page.locator("th[mat-header-cell]:visible")).toHaveCount(10);
    await expect(page.locator("td app-logo-image").first()).toBeVisible();
    await expect(
      page.locator("p.grid", { hasText: "Partidos jugados" }),
    ).toBeHidden();
  });
});
