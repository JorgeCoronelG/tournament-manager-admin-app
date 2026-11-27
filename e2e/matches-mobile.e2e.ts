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
  MatchesApiOptions,
} from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

const LONG = [
  "Águilas Doradas del Norte de la Ciudad",
  "Búhos",
  "Deportivo Los Campeones del Bajío",
  "Delfines",
];

const TEAMS = LONG.map((name, i) => ({
  id: i + 1,
  name,
  manager: null,
  groupId: 1,
}));

/** Matches of every state the rows can show */
const EXTRAS: MatchesApiOptions["extras"] = {
  1: {
    status: "played",
    home_score: 12,
    away_score: 10,
    match_datetime: "2026-10-10T10:00:00",
    referee: { id: 1, name: "Ramiro Árbitro" },
  },
  2: {
    match_datetime: "2026-10-10T12:00:00",
    field: { id: 1, name: "Cancha 1" },
    referee: null,
  },
  3: {
    status: "played",
    home_score: 3,
    away_score: 0,
    is_walkover: true,
    walkover_reason: "No se presentó",
    match_datetime: null,
  },
  4: {
    match_datetime: "2026-10-17T10:00:00",
    original_match_datetime: "2026-10-16T09:00:00",
    schedule_locked: true,
    referee: { id: 2, name: "Lucía Silva" },
  },
};

async function open(
  page: Page,
  {
    options = {},
    noHours = false,
    withdrawnTeam,
    groups = 1,
  }: {
    options?: MatchesApiOptions;
    noHours?: boolean;
    withdrawnTeam?: number;
    groups?: number;
  } = {},
) {
  await freezeTime(page);
  await mockTournamentsApi(page, { tournaments: makeTournaments(4) });
  const regular = Array.from({ length: groups }, (_, i) => ({
    id: i + 1,
    name: `Grupo ${String.fromCharCode(65 + i)}`,
    type: "regular_stage" as const,
  }));
  await mockGroupsApi(page, {
    groups: regular,
    teams: TEAMS.map((t) => ({ ...t, groupId: 1 })),
  });
  await mockFieldsApi(page, { fields: makeFields(2) });
  const api = await mockMatchesApi(page, {
    groups: regular.map((g) => ({ id: g.id, name: g.name, teams: LONG })),
    generated: true,
    extras: EXTRAS,
    ...options,
  });

  if (noHours) {
    await page.route(/\/tournaments\/\d+\/schedule-config$/, (route) =>
      route.fulfill({
        json: {
          schedule_start_date: null,
          windows: [],
          blocks: [],
          match_duration_minutes: 60,
        },
      }),
    );
  }

  if (withdrawnTeam) {
    await page.route(/\/tournaments\/\d+\/registrations(\?.*)?$/, (route) =>
      route.fulfill({
        json: {
          data: TEAMS.map((t) => ({
            id: t.id,
            status: t.id === withdrawnTeam ? "withdrawn" : "active",
            created_at: "2026-01-01T00:00:00.000Z",
            team: { id: t.id, name: t.name, logo_url: null, manager: null },
          })),
          links: { first: null, last: "x", prev: null, next: null },
          meta: {
            currentPage: 1,
            from: 1,
            lastPage: 1,
            perPage: 100,
            to: 4,
            total: 4,
          },
        },
      }),
    );
  }

  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: "Torneo 02" }).click();

  return api;
}

const pageOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

for (const viewport of viewports) {
  test.describe(`calendar on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });
    const tag = `${viewport.width}x${viewport.height}`;
    const wide = viewport.width - 56;

    test("the top bar stacks, full width, with the reason written under Assign", async ({
      page,
    }, testInfo) => {
      await open(page);
      await expect(page.getByRole("article")).toHaveCount(0);

      for (const name of ["Configurar horarios", "Asignar horarios"]) {
        const box = await page.getByRole("button", { name }).boundingBox();
        expect(box!.width, name).toBeGreaterThan(wide);
      }
      const clear = await page
        .getByRole("button", { name: /Quitar horarios/ })
        .boundingBox();
      expect(clear!.width).toBeGreaterThan(wide);
      const picker = await page.locator("mat-form-field").first().boundingBox();
      expect(picker!.width).toBeGreaterThan(wide);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
      await page.screenshot({
        path: testInfo.outputPath(`top-bar-${tag}.png`),
      });
    });

    test("without hours Assign is disabled and says why", async ({
      page,
    }, testInfo) => {
      await open(page, { noHours: true });
      await expect(
        page.getByRole("button", { name: "Asignar horarios" }),
      ).toBeDisabled();
      await expect(
        page.getByText("Configura los horarios", { exact: false }).first(),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`top-bar-no-hours-${tag}.png`),
      });
    });

    test("rows of every state read fully and nothing scrolls sideways", async ({
      page,
    }, testInfo) => {
      await open(page);
      const rows = page.locator("mat-expansion-panel li");
      await expect(rows.first()).toBeVisible();

      const overflowing = await rows.evaluateAll(
        (items) =>
          items.filter((li) => li.scrollWidth > li.clientWidth + 1).length,
      );
      expect(overflowing).toBe(0);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);

      // The tab's own container must not scroll sideways either
      const tabScroll = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".mat-mdc-tab-body-content")).map(
          (el) => el.scrollWidth - el.clientWidth,
        ),
      );
      for (const extra of tabScroll) {
        expect(extra).toBeLessThanOrEqual(0);
      }

      // No logos on phones; the teams stack and no word is split
      await expect(page.locator("mat-accordion app-logo-image")).toHaveCount(0);
      const lines = await rows.evaluateAll((items) =>
        items.map((li) => {
          const box = (el: Element) => el.getBoundingClientRect();
          const names = Array.from(li.querySelectorAll("span.line-clamp-2"));
          const scores = Array.from(li.querySelectorAll("span.tabular-nums"));
          const menu = li.querySelector("app-row-actions");
          const chips = Array.from(
            li.querySelectorAll("span.rounded-full"),
          ).filter((el) =>
            ["Finalizado", "Reprogramado", "Por default"].includes(
              el.textContent?.trim() ?? "",
            ),
          );
          const first = box(names[0]);
          const last = box(names[1]);

          return {
            stacked: box(names[1]).top >= box(names[0]).bottom,
            split: names.some(
              (el) =>
                getComputedStyle(el).overflowWrap !== "normal" ||
                getComputedStyle(el).wordBreak !== "normal",
            ),
            clipped: names.some((el) => el.scrollWidth > el.clientWidth + 1),
            scoresAligned:
              scores.length === 0 ||
              Math.round(box(scores[0]).right) ===
                Math.round(box(scores[1]).right),
            // The menu is centered on the teams, in a column of its own
            menuCentered:
              !menu ||
              (box(menu).top + box(menu).height / 2 >= first.top &&
                box(menu).top + box(menu).height / 2 <= last.bottom),
            menuBesideScores:
              !menu ||
              scores.length === 0 ||
              box(scores[0]).right <= box(menu).left + 1,
            chipsOnTop: chips.every(
              (chip) => box(chip).bottom <= first.top + 1,
            ),
            chipsRight: chips.every(
              (chip) =>
                Math.round(box(chip).right) <= Math.round(box(li).right),
            ),
            chipCount: chips.length,
          };
        }),
      );
      for (const line of lines) {
        expect(line.stacked).toBe(true);
        expect(line.split).toBe(false);
        expect(line.clipped).toBe(false);
        expect(line.scoresAligned).toBe(true);
        expect(line.menuCentered).toBe(true);
        expect(line.menuBesideScores).toBe(true);
        expect(line.chipsOnTop).toBe(true);
        expect(line.chipsRight).toBe(true);
      }
      // Played, walkover and rescheduled matches all show their chips
      expect(
        lines.reduce((sum, line) => sum + line.chipCount, 0),
      ).toBeGreaterThanOrEqual(4);

      // Only the matches are divided: no line between the teams and the date
      await expect(page.locator("mat-accordion li > hr")).toHaveCount(0);

      const text = (await page.locator("mat-accordion").innerText()).replace(
        /\s+/g,
        " ",
      );
      for (const expected of [
        "Finalizado",
        "Reprogramado",
        "Antes:",
        "Por default",
        "No se presentó",
        "Por programar",
        "Ramiro Árbitro",
        "Sin árbitro",
      ]) {
        expect(text, expected).toContain(expected);
      }
      await page.screenshot({
        path: testInfo.outputPath(`matchday-${tag}.png`),
      });
    });

    test("the calendar menu shows why regenerate and delete are blocked", async ({
      page,
    }, testInfo) => {
      await open(page);
      await page
        .getByRole("button", { name: "Acciones del calendario" })
        .click();
      const items = page.getByRole("menuitem");
      await expect(items).toHaveCount(2);
      for (const item of await items.all()) {
        await expect(item).toBeDisabled();
        await expect(item).toContainText("hay partidos finalizados");
      }
      await page.screenshot({
        path: testInfo.outputPath(`calendar-menu-${tag}.png`),
      });
    });

    test("without played matches the calendar menu is enabled", async ({
      page,
    }) => {
      await open(page, { options: { extras: {} } });
      await page
        .getByRole("button", { name: "Acciones del calendario" })
        .click();
      await expect(page.getByRole("menuitem")).toHaveCount(2);
      await expect(page.getByRole("menuitem").first()).toBeEnabled();
    });

    test("the match menu opens the program, walkover and result dialogs", async ({
      page,
    }, testInfo) => {
      await open(page, { options: { extras: { 2: EXTRAS![2] } } });
      const second = page.locator("mat-expansion-panel li").first();
      const menu = () =>
        second.getByRole("button", { name: "Acciones del partido" }).click();

      await menu();
      await expect(page.getByRole("menuitem")).toHaveCount(3);
      await page.screenshot({
        path: testInfo.outputPath(`match-menu-${tag}.png`),
      });
      await page.getByRole("menuitem", { name: /Programar/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();

      await menu();
      await page.getByRole("menuitem", { name: /default/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();

      await menu();
      await page.getByRole("menuitem", { name: /resultado/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    });

    test("a match with a withdrawn team cannot take a result and says why", async ({
      page,
    }, testInfo) => {
      await open(page, { options: { extras: {} }, withdrawnTeam: 2 });
      const row = page
        .locator("mat-expansion-panel li")
        .filter({ hasText: "Búhos" })
        .first();
      await expect(row.getByText("Baja")).toBeVisible();
      await row.getByRole("button", { name: "Acciones del partido" }).click();
      const result = page.getByRole("menuitem", { name: /resultado/i });
      await expect(result).toBeDisabled();
      await expect(result).toContainText("Ganado por default");
      await page.screenshot({
        path: testInfo.outputPath(`match-menu-withdrawn-${tag}.png`),
      });
    });

    test("several groups make scrollable tabs inside the screen", async ({
      page,
    }, testInfo) => {
      await open(page, { groups: 4, options: { extras: {} } });
      await expect(page.getByRole("tab", { name: "Grupo A" })).toBeVisible();
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
      await page.screenshot({
        path: testInfo.outputPath(`group-tabs-${tag}.png`),
      });

      await expect(page.getByRole("tab", { name: "Por torneo" })).toBeVisible();
      await expect(
        page.getByRole("tab", { name: "Agenda de la liga" }),
      ).toBeVisible();
    });
  });
}
