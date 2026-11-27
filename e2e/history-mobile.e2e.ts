import { expect, Page, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeTournaments,
  mockGroupsApi,
  mockMatchesApi,
  mockPlayoffsApi,
  mockTournamentsApi,
} from "./support";

const LONG = "Deportivo Los Campeones del Bajío de la Frontera Norte";
const TEAMS = [LONG, "Búhos", "Cóndores", "Delfines"];

const team = (id: number, name: string) => ({
  registration_id: id,
  team_id: id * 10,
  team_name: name,
  logo_url: null,
});

const playoff = (group_id: number, name: string) => ({
  group_id,
  name,
  champion: team(1, LONG),
  rounds: [
    {
      index: 1,
      name: "Final",
      legs: 1,
      ties: [
        {
          id: group_id,
          round_index: 1,
          bracket_position: 1,
          team_a: team(1, LONG),
          team_b: team(2, "Búhos"),
          seed_a: 1,
          seed_b: 2,
          matches: [
            {
              id: group_id * 10,
              leg: null,
              scheduled_date: "2026-10-07",
              home_team: team(1, LONG),
              away_team: team(2, "Búhos"),
              home_goals: 2,
              away_goals: 1,
              home_penalties: null,
              away_penalties: null,
              status: "played",
            },
          ],
          aggregate: null,
          winner_team_id: 10,
          winner_registration_id: 1,
          decided_by: "score",
        },
      ],
    },
  ],
});

async function mocks(page: Page, playoffs: number) {
  await freezeTime(page);
  await mockTournamentsApi(page, { tournaments: makeTournaments(4) });
  const names = ["Oro", "Plata de consolación", "Bronce"].slice(0, playoffs);
  await mockGroupsApi(page, {
    groups: [
      { id: 1, name: "Grupo A", type: "regular_stage" },
      ...names.map((name, i) => ({
        id: 10 + i,
        name,
        type: "playoff" as const,
        start_date: "2026-10-01",
        sources: [{ source_group_id: 1, position_start: 1, position_end: 2 }],
      })),
    ],
    teams: TEAMS.map((name, i) => ({
      id: i + 1,
      name,
      manager: null,
      groupId: 1,
    })),
  });
  await mockMatchesApi(page, {
    groups: [{ id: 1, name: "Grupo A", teams: TEAMS }],
    generated: true,
    played: true,
    extras: {
      1: {
        status: "played",
        home_score: 3,
        away_score: 0,
        is_walkover: true,
        walkover_reason: "El visitante no se presentó al partido",
        match_datetime: "2026-10-10T10:00:00",
        field: { id: 1, name: "Cancha 01" },
        referee: { id: 1, name: "Ramiro Árbitro" },
      },
    },
  });
  await mockPlayoffsApi(page, {
    bracket: { playoffs: names.map((n, i) => playoff(10 + i, n)) },
  });
  await page.route(/\/tournaments\/history\/years$/, (route) =>
    route.fulfill({ json: { data: [2025, 2026] } }),
  );
  await page.route(/\/tournaments\/history(\?.*)?$/, (route) => {
    const size = Number(
      new URL(route.request().url()).searchParams.get("per_page") ?? 10,
    );

    return route.fulfill({
      json: {
        data: Array.from({ length: Math.min(size, 25) }, (_, i) => ({
          id: i === 0 ? 3 : 100 + i,
          name: i === 0 ? "Torneo de Clausura de Veteranos 2026" : `Copa ${i}`,
          start_date: "2026-01-10",
          end_date: "2026-06-10",
          teams_count: 12,
          playoffs_count: playoffs,
        })),
        meta: { total: 25, current_page: 1, per_page: size, last_page: 3 },
        total: 25,
      },
    });
  });
  await page.route(/\/tournaments\/3$/, (route) =>
    route.fulfill({
      json: {
        ...makeTournaments(4)[2],
        name: "Torneo de Clausura de Veteranos 2026",
        status: "finished",
      },
    }),
  );
  await page.route(/\/tournaments\/3\/summary$/, (route) =>
    route.fulfill({
      json: {
        teams_count: 12,
        playoffs_count: playoffs,
        matches_played: 66,
        goals_scored: 188,
        playoffs: names.map((name, i) => ({
          id: 10 + i,
          name,
          positions: "1-2",
          champion: { id: 1, name: LONG, logo_url: null },
          runner_up: { id: 2, name: LONG, logo_url: null },
        })),
        champion: null,
      },
    }),
  );
}

const noSideScroll = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBe(0);

for (const viewport of [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
  { width: 599, height: 800 },
]) {
  test.describe(`history ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test("list: filters, menu and compact paginator", async ({ page }) => {
      await mocks(page, 1);
      await gotoApp(page, "/dashboard/torneos/historial");
      await expect(page.locator("tr[mat-row]")).toHaveCount(10);
      await noSideScroll(page);
      expect(
        await page
          .locator(".app-table-scroll")
          .evaluate((el) => el.scrollWidth - el.clientWidth),
      ).toBe(0);
      await expect(page.locator("mat-paginator mat-select")).toHaveCount(0);
      await page.getByRole("button", { name: /Filtros/ }).click();
      await page.getByRole("combobox", { name: "Año" }).click();
      await page.getByRole("option", { name: "2026" }).click();
      await expect(
        page.getByRole("button", { name: /1 activos/ }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Limpiar" }).click();
      await page.getByRole("button", { name: "Acciones" }).first().click();
      await page.getByRole("menuitem", { name: "Ver detalle" }).click();
      await expect(page).toHaveURL(/historial\/3/);
    });

    for (const playoffs of [1, 3]) {
      test(`summary with ${playoffs} playoff(s)`, async ({ page }) => {
        await mocks(page, playoffs);
        await gotoApp(page, "/dashboard/torneos/historial/3/resumen");
        await expect(page.getByText("Subcampeón").first()).toBeVisible();
        await noSideScroll(page);
      });
    }

    test("tabs: calendar, playoffs and standings", async ({ page }) => {
      await mocks(page, 3);
      await gotoApp(
        page,
        "/dashboard/torneos/historial/3/estadisticas/posiciones",
      );
      // A far tab opened by URL is scrolled into view
      const active = page.getByRole("tab", { name: "Estadísticas" });
      await expect(active).toBeInViewport({ ratio: 0.9 });
      expect((await active.boundingBox())!.height).toBeGreaterThanOrEqual(48);
      await expect(page.locator("tr[mat-row]").first()).toBeVisible();
      await noSideScroll(page);
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: /zonas de clasificación|como imagen/ })
        .click();
      await download;

      await gotoApp(page, "/dashboard/torneos/historial/3/calendario");
      const row = page.locator("mat-expansion-panel li").first();
      await expect(row).toBeVisible();
      await expect(row.locator("app-logo-image").first()).toBeHidden();
      await expect(
        row.getByText("El visitante no se presentó al partido"),
      ).toBeVisible();
      await noSideScroll(page);

      await gotoApp(page, "/dashboard/torneos/historial/3/liguilla");
      await expect(page.getByRole("heading", { name: "Final" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Acciones del partido|Descargar/ }),
      ).toHaveCount(0);
      await noSideScroll(page);
    });
  });
}

test.describe("history from 600px", () => {
  test.use({ viewport: { width: 640, height: 800 } });

  test("keeps the icon column and the logos", async ({ page }) => {
    await mocks(page, 1);
    await gotoApp(page, "/dashboard/torneos/historial");
    await expect(
      page.getByRole("link", { name: /Ver detalle del torneo/ }).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Acciones" })).toHaveCount(0);
    await gotoApp(page, "/dashboard/torneos/historial/3/calendario");
    await expect(
      page.locator("mat-expansion-panel li app-logo-image").first(),
    ).toBeVisible();
  });
});
