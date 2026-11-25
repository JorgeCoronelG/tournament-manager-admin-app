import { expect, Locator, Page, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeFields,
  makeTournaments,
  mockAgendaApi,
  mockFieldsApi,
  mockGroupsApi,
  mockMatchesApi,
  mockPlayoffsApi,
  mockRefereesApi,
  mockTournamentsApi,
} from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

const TEAMS = ["Águilas", "Búhos", "Cóndores", "Delfines"];

const SLOTS = Array.from({ length: 9 }, (_, i) => ({
  start_time: `${String(8 + i).padStart(2, "0")}:00`,
  end_time: `${String(9 + i).padStart(2, "0")}:00`,
  field_id: (i % 2) + 1,
  field_name: `Cancha 0${(i % 2) + 1}`,
}));

const REFEREES = [
  { id: 7, name: "Ana Ruiz", available: true, reason: null },
  {
    id: 8,
    name: "Luis Paz Fernández del Valle",
    available: false,
    reason: "Ocupado en Águilas vs Búhos (Sáb 07/11, 8:00 a.m.).",
  },
];

/** Slots, referees and the writes of the dialog */
async function dialogRoutes(page: Page) {
  const writes: Array<[string, string]> = [];

  await page.route(/\/leagues\/\d+\/matches\/\d+\/available-slots/, (route) =>
    route.fulfill({ json: { date: "2026-11-10", slots: SLOTS } }),
  );
  await page.route(
    /\/leagues\/\d+\/matches\/\d+\/available-referees/,
    (route) => route.fulfill({ json: { referees: REFEREES } }),
  );
  await page.route(
    /\/leagues\/\d+\/matches\/\d+\/(schedule|swap-schedule)$/,
    (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      writes.push([request.method(), path.replace(/^.*\/matches\/\d+/, "")]);

      return route.fulfill({
        json: path.endsWith("/swap-schedule")
          ? { match: {}, with_match: {}, warnings: [] }
          : {
              warnings: [{ code: "past_date", message: "La fecha ya pasó." }],
            },
      });
    },
  );

  return writes;
}

const settled = (page: Page) =>
  expect(page.locator(".mat-mdc-dialog-surface")).toHaveCSS(
    "transform",
    "none",
  );

async function openFromCalendar(page: Page, scheduled = true) {
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
    extras: scheduled
      ? {
          1: {
            match_datetime: "2026-11-10T10:00:00",
            field: { id: 1, name: "Cancha 01" },
          },
        }
      : {},
  });
  const writes = await dialogRoutes(page);
  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: "Torneo 02" }).click();
  await page
    .locator("mat-expansion-panel li")
    .first()
    .getByRole("button", { name: "Acciones del partido" })
    .click();
  await page.getByRole("menuitem", { name: /Programar/ }).click();
  await settled(page);

  return { writes, dialog: page.locator("mat-dialog-container") };
}

const team = (id: number, name: string) => ({
  registration_id: id,
  team_id: id * 10,
  team_name: name,
  logo_url: null,
});

const BRACKET = {
  playoffs: [
    {
      group_id: 10,
      name: "Oro",
      champion: null,
      rounds: [
        {
          index: 1,
          name: "Semifinal",
          legs: 1,
          ties: [
            {
              id: 1,
              round_index: 1,
              bracket_position: 1,
              team_a: team(1, "Halcones"),
              team_b: team(4, "Lobos"),
              seed_a: 1,
              seed_b: 4,
              matches: [
                {
                  id: 101,
                  leg: null,
                  scheduled_date: "2026-12-20",
                  home_team: team(1, "Halcones"),
                  away_team: team(4, "Lobos"),
                  home_goals: null,
                  away_goals: null,
                  home_penalties: null,
                  away_penalties: null,
                  status: "scheduled",
                },
              ],
              aggregate: null,
              winner_team_id: null,
              winner_registration_id: null,
              decided_by: null,
            },
          ],
        },
      ],
    },
  ],
};

async function openFromBracket(page: Page) {
  await freezeTime(page);
  await mockTournamentsApi(page, {
    tournaments: makeTournaments(4).map((t) =>
      t.id === 4 ? { ...t, status: "playoffs" as const } : t,
    ),
  });
  await mockGroupsApi(page, {
    groups: [
      { id: 1, name: "Grupo A", type: "regular_stage" },
      {
        id: 10,
        name: "Oro",
        type: "playoff" as const,
        start_date: "2026-12-07",
        sources: [{ source_group_id: 1, position_start: 1, position_end: 4 }],
      },
    ],
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
  });
  await mockPlayoffsApi(page, { bracket: BRACKET });
  await dialogRoutes(page);
  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: "Torneo 04" }).click();
  await page.getByRole("tab", { name: "Liguilla" }).click();
  await page
    .getByRole("button", { name: "Acciones del partido" })
    .first()
    .click();
  await page.getByRole("menuitem", { name: /Programar/ }).click();
  await settled(page);

  return page.locator("mat-dialog-container");
}

async function openFromAgenda(page: Page) {
  await freezeTime(page);
  await mockTournamentsApi(page, { tournaments: makeTournaments(4) });
  await mockFieldsApi(page, { fields: makeFields(2) });
  await mockRefereesApi(page, { referees: [] });
  await mockAgendaApi(page, {
    matches: [
      {
        id: 1,
        tournament: { id: 2, name: "Torneo 02" },
        round_label: "Jornada 1",
        home_team: "Águilas",
        away_team: "Búhos",
        start: "2026-09-19T09:00:00",
        end: "2026-09-19T10:00:00",
        field: { id: 1, name: "Cancha 01" },
        referee: null,
      },
    ],
  });
  await dialogRoutes(page);
  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("tab", { name: "Agenda de la liga" }).click();
  await page.locator("app-agenda-view li button").first().click();
  await settled(page);

  return page.locator("mat-dialog-container");
}

/** Nothing scrolls sideways, and no nested scroller besides the dialog's content */
const noScroll = async (dialog: Locator, nested = false) =>
  expect(
    await dialog.evaluate((el, allowNested) => {
      const content = el.querySelector<HTMLElement>("mat-dialog-content")!;
      const inner = [...content.querySelectorAll<HTMLElement>("*")].filter(
        (node) =>
          node.tagName !== "MAT-PROGRESS-BAR" &&
          ["auto", "scroll"].includes(getComputedStyle(node).overflowY) &&
          node.scrollHeight > node.clientHeight + 1,
      );

      return [el, content]
        .filter((node) => node.scrollWidth > node.clientWidth)
        .map((node) => `x:${node.tagName}`)
        .concat(allowNested ? [] : inner.map((node) => `y:${node.className}`));
    }, nested),
  ).toEqual([]);

const inside = async (
  locator: Locator,
  viewport: { width: number; height: number },
) => {
  const box = (await locator.boundingBox())!;

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
};

const fullscreen = async (
  page: Page,
  viewport: { width: number; height: number },
) => {
  const box = (await page.locator("mat-dialog-container").boundingBox())!;

  expect(Math.round(box.width)).toBe(viewport.width);
  expect(Math.round(box.height)).toBe(viewport.height);
};

for (const viewport of viewports) {
  test.describe(`program match on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });
    const tag = String(viewport.width);

    test("edit view: stacked teams, text actions, date and time in two columns", async ({
      page,
    }) => {
      const { dialog } = await openFromCalendar(page);
      await fullscreen(page, viewport);

      const swap = dialog.getByRole("button", {
        name: "Intercambiar",
        exact: true,
      });
      const clear = dialog.getByRole("button", {
        name: "Quitar horario",
        exact: true,
      });
      const [s, c] = [
        (await swap.boundingBox())!,
        (await clear.boundingBox())!,
      ];
      expect(Math.abs(s.y - c.y)).toBeLessThan(2);
      expect(c.x).toBeGreaterThan(s.x + s.width - 1);

      const date = (await dialog.getByLabel("Fecha").boundingBox())!;
      const time = (await dialog
        .getByRole("combobox", { name: "Hora" })
        .boundingBox())!;
      const field = (await dialog
        .getByRole("combobox", { name: "Cancha" })
        .boundingBox())!;
      expect(Math.abs(date.y - time.y)).toBeLessThan(2);
      expect(field.y).toBeGreaterThan(date.y + date.height - 1);

      for (const name of ["Cancelar", "Guardar"]) {
        await inside(dialog.getByRole("button", { name }), viewport);
      }
      await noScroll(dialog);
      await page.screenshot({
        path: `test-results/programar-editar-${tag}.png`,
      });
    });

    test("datepicker opens as a modal and the timepicker stays inside the screen", async ({
      page,
    }) => {
      const { dialog } = await openFromCalendar(page);

      await dialog.locator("mat-datepicker-toggle button").click();
      const picker = page.locator("mat-datepicker-content");
      await expect(picker).toBeVisible();
      await inside(picker, viewport);
      await page.screenshot({
        path: `test-results/programar-datepicker-${tag}.png`,
      });
      await page
        .locator("button.mat-calendar-body-cell:not([disabled])")
        .last()
        .click();
      await expect(picker).toHaveCount(0);

      await dialog.locator("mat-timepicker-toggle button").click();
      const options = page.locator(".mat-timepicker-panel").first();
      await expect(options).toBeVisible();
      await inside(options, viewport);
      await page.screenshot({
        path: `test-results/programar-timepicker-${tag}.png`,
      });
      await page.keyboard.press("Escape");
    });

    test("an hour picked from the list does not read as empty while the field keeps the focus", async ({
      page,
    }) => {
      const { dialog } = await openFromCalendar(page, false);
      const time = dialog.getByRole("combobox", { name: "Hora" });

      await dialog.locator("mat-timepicker-toggle button").click();
      await page.getByRole("option").nth(5).click();

      await expect(time).not.toHaveValue("");
      await expect(time).toBeFocused();
      await expect(
        dialog.getByText("Este campo es obligatorio"),
      ).not.toBeVisible();
    });

    test("suggestions are touch-sized, expand without a nested scroll and fill the form", async ({
      page,
    }) => {
      const { dialog } = await openFromCalendar(page);
      const chips = dialog.locator("button[aria-pressed]");

      await expect(chips).toHaveCount(6);
      for (const chip of await chips.all()) {
        expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(39);
      }
      await chips.nth(2).click();
      await expect(chips.nth(2)).toHaveAttribute("aria-pressed", "true");

      await dialog
        .getByRole("button", { name: /Ver los 3 espacios restantes/ })
        .click();
      await expect(chips).toHaveCount(9);
      await chips.last().scrollIntoViewIfNeeded();
      await noScroll(dialog);
      await page.screenshot({
        path: `test-results/programar-sugerencias-${tag}.png`,
      });
    });

    test("the referee list shows who is busy, and the lock hint wraps", async ({
      page,
    }) => {
      const { dialog } = await openFromCalendar(page);

      await dialog.getByRole("combobox", { name: /Árbitro/ }).click();
      const busy = page.getByRole("option", { name: /Luis Paz/ });
      await expect(busy).toContainText("Ocupado · Águilas vs Búhos");
      await expect(busy).toHaveAttribute("aria-disabled", "true");
      await inside(page.locator(".mat-mdc-select-panel"), viewport);
      await page.screenshot({
        path: `test-results/programar-arbitro-${tag}.png`,
      });
      await page.getByRole("option", { name: "Ana Ruiz" }).click();

      const box = dialog.getByRole("checkbox", { name: /Fijar horario/ });
      await box.scrollIntoViewIfNeeded();
      await box.click();
      await noScroll(dialog);
    });

    test("saving with warnings closes the dialog and says them in a notice", async ({
      page,
    }) => {
      const { dialog, writes } = await openFromCalendar(page);

      await dialog.locator("button[aria-pressed]").nth(1).click();
      const save = dialog.getByRole("button", { name: "Guardar" });
      await expect(save).toBeEnabled();
      await save.click();

      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByText(/Horario guardado\. La fecha ya pasó\./),
      ).toBeVisible();
      expect(writes).toContainEqual(["PATCH", "/schedule"]);
      await page.screenshot({
        path: `test-results/programar-warnings-${tag}.png`,
      });
    });

    test("swap: search, choose, preview, go back and confirm", async ({
      page,
    }) => {
      const { dialog, writes } = await openFromCalendar(page);

      await dialog
        .getByRole("button", { name: "Intercambiar", exact: true })
        .click();
      await expect(
        dialog.getByRole("heading", { name: "Intercambiar partido" }),
      ).toBeVisible();
      const search = dialog.getByLabel("Buscar por equipo");
      await expect(search).toBeVisible();
      expect((await search.boundingBox())!.width).toBeGreaterThan(
        viewport.width - 110,
      );

      const options = dialog.locator("li button[aria-pressed]");
      expect(await options.count()).toBeGreaterThan(1);
      const first = (await options.first().boundingBox())!;
      expect(first.height).toBeGreaterThanOrEqual(47);
      await page.screenshot({
        path: `test-results/programar-intercambiar-${tag}.png`,
      });

      await search.fill("zzz");
      await expect(
        dialog.getByText("No hay partidos para intercambiar."),
      ).toBeVisible();
      await search.fill("");
      await options.first().click();
      await expect(dialog.getByText("Así quedarán los partidos")).toBeVisible();
      await dialog
        .getByText("Así quedarán los partidos")
        .scrollIntoViewIfNeeded();
      await noScroll(dialog, true);
      await page.screenshot({
        path: `test-results/programar-vista-previa-${tag}.png`,
      });

      const back = dialog.getByRole("button", { name: "Volver" });
      const confirm = dialog
        .getByRole("button", { name: "Intercambiar", exact: true })
        .last();
      const [b, c] = [
        (await back.boundingBox())!,
        (await confirm.boundingBox())!,
      ];
      expect(Math.abs(b.width - c.width)).toBeLessThan(4);
      await back.click();
      await expect(dialog.getByLabel("Fecha")).toBeVisible();

      await dialog
        .getByRole("button", { name: "Intercambiar", exact: true })
        .click();
      await options.first().click();
      await dialog
        .locator("mat-dialog-actions")
        .getByRole("button", { name: "Intercambiar", exact: true })
        .click();
      await expect
        .poll(() => writes)
        .toContainEqual(["POST", "/swap-schedule"]);
      await expect(dialog).toHaveCount(0);
    });

    test("opens full screen from the playoffs bracket", async ({ page }) => {
      const dialog = await openFromBracket(page);

      await fullscreen(page, viewport);
      await expect(dialog.getByText("Halcones")).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Intercambiar", exact: true }),
      ).toBeVisible();
      await noScroll(dialog);
    });

    test("opens full screen from the league agenda", async ({ page }) => {
      const dialog = await openFromAgenda(page);

      await fullscreen(page, viewport);
      await expect(dialog.getByText("Águilas")).toBeVisible();
      await noScroll(dialog);
    });
  });
}
