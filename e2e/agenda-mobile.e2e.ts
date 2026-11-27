import { expect, Page, test } from "@playwright/test";
import {
  AgendaApiOptions,
  freezeTime,
  gotoApp,
  makeFields,
  makeTournaments,
  mockAgendaApi,
  mockFieldsApi,
  mockRefereesApi,
  mockTournamentsApi,
} from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

const LONG_HOME = "Águilas Doradas del Norte de la Ciudad";
const LONG_AWAY = "Deportivo Los Campeones del Bajío";

const slot = (day: string, hour: number) => ({
  start: `${day}T${String(hour).padStart(2, "0")}:00:00`,
  end: `${day}T${String(hour + 1).padStart(2, "0")}:00:00`,
});

const MATCHES: NonNullable<AgendaApiOptions["matches"]> = [
  {
    id: 1,
    tournament: { id: 2, name: "Torneo 02" },
    round_label: "Jornada 1",
    home_team: LONG_HOME,
    away_team: LONG_AWAY,
    ...slot("2026-09-19", 9),
    field: { id: 1, name: "Cancha 1" },
    referee: { id: 7, name: "Ana Ruiz" },
  },
  {
    id: 2,
    tournament: { id: 2, name: "Torneo 02" },
    round_label: "Jornada 1",
    home_team: "Cóndores",
    away_team: "Delfines",
    ...slot("2026-09-19", 9),
    field: { id: 2, name: "Cancha 2" },
    referee: null,
  },
  {
    id: 3,
    tournament: { id: 2, name: "Torneo 02" },
    round_label: "Semifinal (vuelta)",
    home_team: "Halcones",
    away_team: "Leones",
    ...slot("2026-09-19", 11),
    field: { id: 1, name: "Cancha 1" },
    referee: { id: 8, name: "Luis Pérez" },
    extra: {
      status: "played",
      leg: 2,
      home_score: 1,
      away_score: 1,
      global_home: 3,
      global_away: 3,
      home_penalties: 4,
      away_penalties: 5,
    },
  },
  {
    id: 4,
    tournament: { id: 3, name: "Torneo 03" },
    round_label: "Jornada 2",
    home_team: "Toros",
    away_team: "Lobos",
    ...slot("2026-09-20", 10),
    field: null,
    referee: null,
    extra: { schedule_locked: true },
  },
];

async function open(
  page: Page,
  options: AgendaApiOptions = { matches: MATCHES },
) {
  await freezeTime(page);
  await mockTournamentsApi(page, { tournaments: makeTournaments(4) });
  await mockFieldsApi(page, { fields: makeFields(2) });
  await mockRefereesApi(page, { referees: [] });
  const api = await mockAgendaApi(page, options);
  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("tab", { name: "Agenda de la liga" }).click();

  return api;
}

/** Nothing in the page scrolls sideways (the page, the tab body, the agenda) */
async function noScroll(page: Page) {
  const wide = await page.evaluate(() =>
    [
      document.documentElement,
      ...document.querySelectorAll<HTMLElement>(
        ".mat-mdc-tab-body-content, app-agenda-view",
      ),
    ]
      .filter((el) => el.scrollWidth > el.clientWidth)
      .map(
        (el) =>
          `${el.tagName}.${el.className.slice(0, 50)} ${el.scrollWidth}>${el.clientWidth}`,
      ),
  );

  expect(wide).toEqual([]);
}

for (const viewport of viewports) {
  test.describe(`agenda on a phone ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("keeps the navigation on one row and the date field below", async ({
      page,
    }) => {
      await open(page);
      const box = async (name: string | RegExp) =>
        (await page.getByRole("button", { name }).first().boundingBox())!;
      const prev = await box("Día anterior");
      const today = await box("Hoy");
      const week = await page
        .getByRole("radio", { name: "Semana" })
        .boundingBox();
      const date = await page
        .locator("app-agenda-view mat-form-field")
        .first()
        .boundingBox();

      expect(Math.abs(prev.y - today.y)).toBeLessThan(12);
      expect(
        Math.abs(week!.y + week!.height / 2 - (today.y + today.height / 2)),
      ).toBeLessThan(20);
      expect(prev.height).toBeGreaterThanOrEqual(40);
      expect(date!.y).toBeGreaterThan(today.y + today.height - 1);
      expect(date!.width).toBeGreaterThan(viewport.width - 56);
      await noScroll(page);
      await page.screenshot({
        path: `test-results/agenda-barra-${viewport.width}.png`,
      });
    });

    test("opens the datepicker as a modal inside the screen", async ({
      page,
    }) => {
      await open(page);
      await page.getByRole("button", { name: "Open calendar" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({
        path: `test-results/agenda-datepicker-${viewport.width}.png`,
      });
    });

    test("folds the filters into a panel with a badge and clears them", async ({
      page,
    }) => {
      const api = await open(page);
      const toggle = page.getByRole("button", { name: /^Filtros/ });

      await expect(page.getByRole("combobox", { name: "Cancha" })).toHaveCount(
        0,
      );
      await page.screenshot({
        path: `test-results/agenda-filtros-cerrados-${viewport.width}.png`,
      });
      await toggle.click();
      await page.getByRole("checkbox", { name: "Solo sin árbitro" }).check();
      await page.getByRole("combobox", { name: "Cancha" }).click();
      await page.getByRole("option", { name: "Cancha 1" }).click();

      await expect(toggle).toHaveAccessibleName(/2 activos/);
      for (const name of ["Torneo", "Árbitro", "Cancha"]) {
        const box = await page.getByRole("combobox", { name }).boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 80);
      }
      await page.screenshot({
        path: `test-results/agenda-filtros-abiertos-${viewport.width}.png`,
      });
      await expect
        .poll(() => api.queries.at(-1)?.get("unassigned_referee"))
        .toBe("1");

      await page.getByRole("button", { name: "Limpiar filtros" }).click();
      await expect(toggle).toHaveAccessibleName("Filtros");
      await expect(
        page.getByRole("checkbox", { name: "Solo sin árbitro" }),
      ).not.toBeChecked();
    });

    test("stacks the pending tournaments with a full-width button", async ({
      page,
    }) => {
      await open(page);
      const section = page.locator("section", {
        hasText: "Partidos pendientes",
      });
      const button = section
        .getByRole("button", { name: "Ver calendario" })
        .first();

      await expect(button).toBeVisible();
      const [b, name] = await Promise.all([
        button.boundingBox(),
        section.locator("p.font-medium").first().boundingBox(),
      ]);
      expect(b!.y).toBeGreaterThan(name!.y + name!.height - 1);
      expect(b!.width).toBeGreaterThanOrEqual(viewport.width - 80);
      await section.screenshot({
        path: `test-results/agenda-pendientes-${viewport.width}.png`,
      });
    });

    test("lists the day by hour with stacked teams, scores, global and shootout", async ({
      page,
    }) => {
      await open(page);
      const cards = page.locator("app-agenda-view li button");

      await expect(cards).toHaveCount(3);
      await expect(page.locator("app-agenda-view table")).toHaveCount(0);
      await expect(page.locator("app-agenda-view app-logo-image")).toHaveCount(
        0,
      );
      // by hour, then by field
      await expect(cards.nth(0)).toContainText(LONG_HOME);
      await expect(cards.nth(1)).toContainText("Cóndores");
      const played = cards.nth(2);
      await expect(played).toContainText("Global: 3 - 3");
      await expect(played).toContainText("Penales: 4 - 5");
      await expect(played).toBeDisabled();
      await expect(cards.nth(0)).toContainText(
        "Sin árbitro".replace("Sin árbitro", "Ana Ruiz"),
      );
      await expect(cards.nth(1)).toContainText("Sin árbitro");

      const home = await cards
        .nth(0)
        .locator("span.line-clamp-2")
        .first()
        .boundingBox();
      const away = await cards
        .nth(0)
        .locator("span.line-clamp-2")
        .nth(1)
        .boundingBox();
      expect(away!.y).toBeGreaterThan(home!.y + home!.height - 1);
      await noScroll(page);
      await page.screenshot({
        path: `test-results/agenda-dia-${viewport.width}.png`,
      });

      await cards.nth(0).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    });

    test("lists every day of the week without sideways scroll", async ({
      page,
    }) => {
      await open(page);
      await page.getByRole("radio", { name: "Semana" }).click();

      await expect(
        page.getByRole("heading", { level: 3, name: /19\/09\/2026/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 3, name: /20\/09\/2026/ }),
      ).toBeVisible();
      await expect(page.locator("app-agenda-view table")).toHaveCount(0);
      await expect(page.locator("app-agenda-view li button")).toHaveCount(4);
      await noScroll(page);
      await page.screenshot({
        path: `test-results/agenda-semana-${viewport.width}.png`,
      });
    });

    test("shows the empty message and the error with a retry", async ({
      page,
    }) => {
      await open(page, { matches: [] });
      await expect(
        page.getByText("No hay partidos programados para este periodo."),
      ).toBeVisible();

      await page.route(/\/leagues\/\d+\/agenda(\?.*)?$/, (route) =>
        route.fulfill({ status: 500, json: { error: "boom" } }),
      );
      await page.getByRole("button", { name: "Día siguiente" }).click();
      await expect(page.getByRole("alert")).toContainText(
        "No pudimos cargar la agenda.",
      );
      await expect(
        page.getByRole("button", { name: "Reintentar" }),
      ).toBeVisible();
    });
  });
}
