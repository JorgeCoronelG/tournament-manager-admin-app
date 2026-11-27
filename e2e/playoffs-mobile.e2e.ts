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

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

const TEAMS = ["Águilas", "Búhos", "Cóndores", "Delfines"];

const team = (id: number, name: string) => ({
  registration_id: id,
  team_id: id * 10,
  team_name: name,
  logo_url: null,
});

const LONG_A = "Águilas Doradas del Norte de la Ciudad";
const LONG_B = "Deportivo Los Campeones del Bajío";

const match = (
  id: number,
  leg: number | null,
  home: ReturnType<typeof team> | null,
  away: ReturnType<typeof team> | null,
  score: [number, number] | null = null,
  extra: Record<string, unknown> = {},
) => ({
  id,
  leg,
  scheduled_date: "2026-12-07",
  match_datetime: "2026-12-07T10:00:00",
  field: { id: 1, name: "Cancha 1" },
  referee: null,
  home_team: home,
  away_team: away,
  home_goals: score?.[0] ?? null,
  away_goals: score?.[1] ?? null,
  home_penalties: null,
  away_penalties: null,
  status: score ? "played" : "scheduled",
  ...extra,
});

const tie = (
  id: number,
  round: number,
  a: ReturnType<typeof team> | null,
  b: ReturnType<typeof team> | null,
  matches: unknown[],
  winner: number | null = null,
) => ({
  id,
  round_index: round,
  bracket_position: 1,
  team_a: a,
  team_b: b,
  seed_a: a ? 1 : null,
  seed_b: b ? 4 : null,
  matches,
  aggregate: null,
  winner_team_id: winner ? winner * 10 : null,
  winner_registration_id: winner,
  decided_by: null,
});

const A = team(1, LONG_A);
const B = team(4, "Lobos");
const C = team(2, LONG_B);
const D = team(3, "Toros");

/** Semifinal (home and away) with one tie played and one open, and a Final to be defined */
const OPEN = {
  playoffs: [
    {
      group_id: 10,
      name: "Oro",
      champion: null,
      rounds: [
        {
          index: 1,
          name: "Semifinal",
          legs: 2,
          ties: [
            tie(1, 1, A, B, [
              match(101, 1, A, B, [2, 1]),
              match(102, 2, B, A, null, {
                original_match_datetime: "2026-12-08T09:00:00",
                schedule_locked: true,
              }),
            ]),
            tie(
              2,
              1,
              C,
              D,
              [match(103, 1, C, D, [1, 1]), match(104, 2, D, C)],
              3,
            ),
          ],
        },
        {
          index: 2,
          name: "Final",
          legs: 1,
          ties: [tie(3, 2, null, D, [match(105, null, null, D)])],
        },
      ],
    },
  ],
};

/** The semifinals are decided and the Final already has a result: the semifinal results are locked */
const LOCKED = {
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
            tie(1, 1, A, B, [match(101, null, A, B, [2, 1])], 1),
            tie(2, 1, C, D, [match(103, null, C, D, [0, 1])], 3),
          ],
        },
        {
          index: 2,
          name: "Final",
          legs: 1,
          ties: [tie(3, 2, A, D, [match(105, null, A, D, [1, 0])], 1)],
        },
      ],
    },
  ],
};

const CHAMPION = {
  playoffs: [
    {
      group_id: 10,
      name: "Oro",
      champion: A,
      rounds: [
        {
          index: 1,
          name: "Final",
          legs: 1,
          ties: [tie(3, 1, A, D, [match(105, null, A, D, [1, 0])], 1)],
        },
      ],
    },
  ],
};

async function open(page: Page, bracket: unknown) {
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
  await mockMatchesApi(page, {
    groups: [{ id: 1, name: "Grupo A", teams: TEAMS }],
    generated: true,
  });
  await mockPlayoffsApi(page, { bracket });
  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: "Torneo 04" }).click();
  await page.getByRole("tab", { name: "Liguilla" }).click();
}

const noHorizontalScroll = async (page: Page) =>
  expect(
    await page.evaluate(() => {
      const wide = [
        document.documentElement,
        ...document.querySelectorAll<HTMLElement>(
          ".mat-mdc-tab-body-content, app-bracket-view, section",
        ),
      ].filter(
        (el) =>
          el.scrollWidth > el.clientWidth ||
          (el.classList.contains("mat-mdc-tab-body-content") &&
            el.scrollHeight > el.clientHeight),
      );

      return wide.map((el) => el.tagName + "." + el.className.slice(0, 40));
    }),
  ).toEqual([]);

for (const viewport of viewports) {
  test.describe(`liguilla on a phone ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("stacks the rounds with the current one open and no horizontal scroll", async ({
      page,
    }) => {
      await open(page, OPEN);

      const semifinal = page.getByRole("button", { name: "Semifinal" }).first();
      const final = page.getByRole("button", { name: "Final", exact: true });
      await expect(semifinal).toHaveAttribute("aria-expanded", "true");
      await expect(final).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator("app-logo-image")).toHaveCount(0);
      await noHorizontalScroll(page);

      // the rounds are stacked, not side by side
      const boxes = await page
        .locator("app-bracket-view section")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getBoundingClientRect().toJSON()),
        );
      expect(boxes[1].top).toBeGreaterThan(boxes[0].bottom - 1);
      expect(boxes[0].width).toBeGreaterThan(viewport.width - 56);

      await final.click();
      await expect(final).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByText("Ganador semifinal 1")).toBeVisible();
      // a match without teams keeps its menu beside the date and referee
      const pending = page
        .getByRole("article", { name: /Por definir|Toros/ })
        .last();
      const menu = await pending
        .getByRole("button", { name: "Acciones del partido" })
        .boundingBox();
      const referee = await pending.getByText("Sin árbitro").boundingBox();
      expect(menu!.x).toBeGreaterThan(viewport.width - 90);
      expect(Math.abs(menu!.y - referee!.y)).toBeLessThan(40);
      await noHorizontalScroll(page);
      await page.locator("app-bracket-view").screenshot({
        path: `test-results/liguilla-rondas-${viewport.width}.png`,
      });
    });

    test("shows a home-and-away tie with stacked teams and readable notes", async ({
      page,
    }) => {
      await open(page, OPEN);
      const article = page.getByRole("article", {
        name: new RegExp(`^${LONG_A}`),
      });

      await expect(article.getByText("Ida", { exact: true })).toBeVisible();
      await expect(article.getByText("Vuelta", { exact: true })).toBeVisible();
      await expect(article.getByText("Antes:")).toBeVisible();
      await expect(
        article.getByText("Fijado: el generador no lo mueve."),
      ).toBeVisible();
      await expect(article.getByText("Por jugar")).toBeVisible();
      await expect(article.getByText("vs", { exact: true })).toBeVisible();
      await noHorizontalScroll(page);

      // home above away, and the score right of each team of a played match
      const played = article.locator("div.border-t").first();
      const teams = played.locator("span.line-clamp-2");
      const [home, away] = await teams.evaluateAll((nodes) =>
        nodes.map((n) => n.getBoundingClientRect().toJSON()),
      );
      expect(away.top).toBeGreaterThan(home.bottom - 1);
      await expect(played.locator("span.tabular-nums")).toHaveText([/2/, /1/]);
      await article.screenshot({
        path: `test-results/liguilla-cruce-${viewport.width}.png`,
      });
    });

    test("puts the match actions in a menu and explains the locked result", async ({
      page,
    }) => {
      await open(page, LOCKED);
      await page.getByRole("button", { name: "Semifinal" }).first().click();
      await expect(page.getByRole("article")).toHaveCount(3);

      await page
        .getByRole("button", { name: "Acciones del partido" })
        .first()
        .click();
      const items = page.getByRole("menuitem");
      await expect(items).toHaveCount(1);
      await expect(items.first()).toHaveAttribute("aria-disabled", "true");
      await expect(items.first()).toContainText(
        "la siguiente ronda ya tiene resultados",
      );
      await page.screenshot({
        path: `test-results/liguilla-menu-bloqueado-${viewport.width}.png`,
      });
      await page.keyboard.press("Escape");

      // the open round offers the normal menu
      await page.getByRole("button", { name: "Final", exact: true }).click();
    });

    test("offers a flat download menu with the results disabled until there are scores", async ({
      page,
    }) => {
      await open(page, OPEN);
      await page
        .getByRole("button", { name: "Descargar imagen" })
        .first()
        .click();

      const items = page.getByRole("menuitem");
      await expect(items).toHaveCount(6);
      await expect(items.nth(0)).toContainText("Ida");
      await expect(items.nth(2)).toContainText("Ida y vuelta");
      await expect(items.nth(3)).toHaveAttribute("aria-disabled", "false");
      await expect(items.nth(4)).toHaveAttribute("aria-disabled", "true");
      await expect(items.nth(4)).toContainText("Aún no hay resultados");
      await expect(
        page.locator("[aria-haspopup='menu'][role=menuitem]"),
      ).toHaveCount(0);
      await page.screenshot({
        path: `test-results/liguilla-descarga-${viewport.width}.png`,
      });
    });

    test("shows the champion banner and a full-width finish button", async ({
      page,
    }) => {
      await open(page, CHAMPION);

      await expect(page.getByRole("status")).toContainText(
        `Campeón: ${LONG_A}`,
      );
      const finish = page.getByRole("button", { name: "Finalizar torneo" });
      const [button, banner] = await Promise.all([
        finish.boundingBox(),
        page.getByRole("status").boundingBox(),
      ]);
      expect(Math.round(button!.width)).toBe(Math.round(banner!.width));
      await noHorizontalScroll(page);
      await page.locator("app-bracket-view").screenshot({
        path: `test-results/liguilla-campeon-${viewport.width}.png`,
      });
    });
  });
}
