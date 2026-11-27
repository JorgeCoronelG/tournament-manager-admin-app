import { expect, Locator, Page, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeFields,
  makeTournaments,
  mockFieldsApi,
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
const LONG_A = "Águilas Doradas del Norte de la Ciudad";
const LONG_B = "Deportivo Los Campeones del Bajío";

const proposal = (
  id: number,
  matchday: number,
  group: string,
  at: string | null,
) => ({
  id,
  matchday,
  group,
  home_team: id % 2 ? LONG_A : "Cóndores",
  away_team: id % 2 ? LONG_B : "Delfines",
  match_datetime: at,
  field: at ? { id: 1, name: "Cancha 01" } : null,
});

const PREVIEW = {
  seed: 7,
  scheduled: 3,
  unscheduled: 1,
  locked_kept: 1,
  played_kept: 2,
  assigned_kept: 0,
  warnings: [
    {
      matchday: 2,
      unscheduled: 1,
      message: "Falta 1 espacio en la jornada 2.",
    },
    { unscheduled: 0, message: "Un aviso más de la asignación." },
  ],
  matchdays: [
    {
      matchday: 1,
      week_start: "2026-12-05",
      week_end: "2026-12-06",
      matches: 2,
      scheduled: 2,
      unscheduled: 0,
    },
    {
      matchday: 2,
      week_start: "2026-12-12",
      week_end: "2026-12-13",
      matches: 2,
      scheduled: 1,
      unscheduled: 1,
    },
  ],
  matches: [
    proposal(1, 1, "Grupo A", "2026-12-05T09:00:00"),
    proposal(2, 1, "Grupo B", "2026-12-05T10:00:00"),
    proposal(3, 2, "Grupo A", "2026-12-12T09:00:00"),
    proposal(4, 2, "Grupo B", null),
  ],
};

const PLAYOFF_PREVIEW = {
  ...PREVIEW,
  matchdays: [],
  matches: [],
  warnings: [],
  rounds: [
    {
      liguilla: "Oro",
      round_name: "Semifinal",
      leg: 1,
      date: "2026-12-20",
      matches: 2,
      scheduled: 1,
      unscheduled: 1,
    },
    {
      liguilla: "Oro",
      round_name: "Final",
      leg: null,
      date: null,
      matches: 1,
      scheduled: 0,
      unscheduled: 1,
    },
  ],
};

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

async function routes(
  page: Page,
  preview: unknown,
  generateWarnings: unknown[] = [],
) {
  const writes: string[] = [];

  await page.route(/\/tournaments\/\d+\/schedule\/preview$/, (route) =>
    route.fulfill({ json: preview }),
  );
  await page.route(/\/tournaments\/\d+\/schedule\/generate$/, (route) => {
    writes.push("generate");

    return route.fulfill({
      json: { ...(preview as object), warnings: generateWarnings },
    });
  });

  return writes;
}

async function common(page: Page, tournament: string, playoffs: boolean) {
  await freezeTime(page);
  await mockTournamentsApi(page, {
    tournaments: makeTournaments(4).map((t) =>
      t.id === 4 ? { ...t, status: "playoffs" as const } : t,
    ),
  });
  await mockGroupsApi(page, {
    groups: [
      { id: 1, name: "Grupo A", type: "regular_stage" },
      ...(playoffs
        ? [
            {
              id: 10,
              name: "Oro",
              type: "playoff" as const,
              start_date: "2026-12-07",
              sources: [
                { source_group_id: 1, position_start: 1, position_end: 4 },
              ],
            },
          ]
        : []),
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
  if (playoffs) {
    await mockPlayoffsApi(page, { bracket: BRACKET });
  }
}

const settled = (page: Page) =>
  expect(page.locator(".mat-mdc-dialog-surface")).toHaveCSS(
    "transform",
    "none",
  );

async function openRegular(page: Page, generateWarnings: unknown[] = []) {
  await common(page, "Torneo 02", false);
  const writes = await routes(page, PREVIEW, generateWarnings);
  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: "Torneo 02" }).click();
  await page.getByRole("button", { name: "Asignar horarios" }).click();
  await settled(page);

  return { writes, dialog: page.locator("mat-dialog-container") };
}

async function openPlayoffs(page: Page) {
  await common(page, "Torneo 04", true);
  await routes(page, PLAYOFF_PREVIEW);
  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: "Torneo 04" }).click();
  await page.getByRole("tab", { name: "Liguilla" }).click();
  await page
    .getByRole("button", { name: "Asignar horarios de liguilla" })
    .click();
  await settled(page);

  return page.locator("mat-dialog-container");
}

/** Nothing scrolls sideways, and the proposal does not hold a second vertical scroller */
const noScroll = async (dialog: Locator) =>
  expect(
    await dialog.evaluate((el) => {
      const content = el.querySelector<HTMLElement>("mat-dialog-content")!;
      const nested = [...content.querySelectorAll<HTMLElement>("*")].filter(
        (node) =>
          node !== content &&
          node.tagName !== "MAT-PROGRESS-BAR" &&
          ["auto", "scroll"].includes(getComputedStyle(node).overflowY) &&
          node.scrollHeight > node.clientHeight + 1,
      );

      return [el, content]
        .filter((node) => node.scrollWidth > node.clientWidth)
        .map((node) => `x:${node.tagName}`)
        .concat(nested.map((node) => `y:${node.tagName}.${node.className}`));
    }),
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

for (const viewport of viewports) {
  test.describe(`assign schedule on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });
    const tag = String(viewport.width);

    test("fills the screen with the options and two rows of buttons", async ({
      page,
    }) => {
      const { dialog } = await openRegular(page);
      const container = (await dialog.boundingBox())!;

      expect(Math.round(container.width)).toBe(viewport.width);
      expect(Math.round(container.height)).toBe(viewport.height);

      for (const radio of await page.getByRole("radio").all()) {
        const box = (await radio
          .locator("xpath=ancestor::mat-radio-button")
          .boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(40);
      }

      const preview = dialog.getByRole("button", { name: "Vista previa" });
      const confirm = dialog.getByRole("button", {
        name: "Asignar",
        exact: true,
      });
      const cancel = dialog.getByRole("button", { name: "Cancelar" });
      await expect(confirm).toBeDisabled();
      const [p, c, x] = (await Promise.all(
        [preview, confirm, cancel].map((b) => b.boundingBox()),
      )) as NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>[];

      expect(Math.abs(p.y - c.y)).toBeLessThan(2);
      expect(Math.abs(p.width - c.width)).toBeLessThan(4);
      expect(x.y).toBeGreaterThan(p.y + p.height - 1);
      expect(x.width).toBeGreaterThan(viewport.width - 56);
      for (const button of [preview, confirm, cancel]) {
        await inside(button, viewport);
      }
      await noScroll(dialog);
      await page.screenshot({
        path: `test-results/asignar-inicial-${tag}.png`,
      });
    });

    test("previews the summary 2x2, the warnings and a matchday with its counts under the title", async ({
      page,
    }) => {
      const { dialog } = await openRegular(page);

      await dialog.getByRole("button", { name: "Vista previa" }).click();
      await expect(dialog.getByText("Resumen de asignación")).toBeVisible();
      await expect(dialog.getByText("Falta 1 espacio")).toBeVisible();
      await expect(dialog.getByText("Un aviso más")).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Asignar", exact: true }),
      ).toBeEnabled();

      const stats = await dialog
        .locator("dl > div")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getBoundingClientRect().toJSON()),
        );
      expect(stats).toHaveLength(4);
      expect(Math.abs(stats[0].y - stats[1].y)).toBeLessThan(2);
      expect(stats[2].y).toBeGreaterThan(stats[0].y + stats[0].height - 1);
      expect(Math.abs(stats[2].y - stats[3].y)).toBeLessThan(2);
      await dialog.getByText("Resumen de asignación").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/asignar-resumen-${tag}.png`,
      });

      // the second matchday has a pending match: the counts go under the title
      const header = dialog.locator("mat-expansion-panel-header").nth(1);
      await header.scrollIntoViewIfNeeded();
      const [title, counts] = await Promise.all([
        header.getByText("Jornada 2").boundingBox(),
        header.getByText("2 partidos").boundingBox(),
      ]);
      expect(counts!.y).toBeGreaterThan(title!.y + title!.height - 1);
      await expect(header).toContainText("1 programado");
      await expect(header).toContainText("1 sin horario");

      await header.click();
      const matches = dialog
        .locator("mat-expansion-panel")
        .nth(1)
        .locator("li");
      await expect(matches).toHaveCount(2);
      await expect(matches.nth(0)).toContainText("Grupo A");
      await expect(matches.nth(1)).toContainText("Sin horario");
      await matches.first().scrollIntoViewIfNeeded();
      await noScroll(dialog);
      await page.screenshot({
        path: `test-results/asignar-jornada-${tag}.png`,
      });
    });

    test("confirming assigns and closes", async ({ page }) => {
      const { dialog, writes } = await openRegular(page);

      await dialog.getByRole("button", { name: "Vista previa" }).click();
      await dialog
        .getByRole("button", { name: "Asignar", exact: true })
        .click();

      await expect.poll(() => writes).toEqual(["generate"]);
      await expect(dialog).toHaveCount(0);
    });

    test("when slots were taken only Cerrar is left", async ({ page }) => {
      const { dialog } = await openRegular(page, [
        { code: "slot_taken", unscheduled: 1, message: "ocupado" },
      ]);

      await dialog.getByRole("button", { name: "Vista previa" }).click();
      await dialog
        .getByRole("button", { name: "Asignar", exact: true })
        .click();

      await expect(dialog.getByRole("status").first()).toContainText(
        "quedó sin horario",
      );
      const close = dialog.getByRole("button", { name: "Cerrar" });
      await expect(close).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Cancelar" }),
      ).toHaveCount(0);
      const box = (await close.boundingBox())!;
      expect(box.width).toBeGreaterThan(viewport.width - 56);
      await inside(close, viewport);
      await page.screenshot({ path: `test-results/asignar-taken-${tag}.png` });
      await close.click();
      await expect(dialog).toHaveCount(0);
    });

    test("the playoffs version lists a card per round, without resizing the dialog", async ({
      page,
    }) => {
      const dialog = await openPlayoffs(page);

      await expect(
        dialog.getByRole("button", { name: "Vista previa" }),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "Vista previa" }).click();

      await expect(dialog.locator("table")).toHaveCount(0);
      const cards = dialog
        .locator("ul > li")
        .filter({ hasText: "Ronda" })
        .or(dialog.locator("li").filter({ hasText: "Sin horario" }));
      await expect(dialog.getByText("Semifinal (ida)").first()).toBeVisible();
      await expect(dialog.getByText("20/12/2026")).toBeVisible();
      const container = (await dialog.boundingBox())!;
      expect(Math.round(container.width)).toBe(viewport.width);
      await expect(cards.first()).toBeVisible();
      const amber = dialog.locator("dl dd.text-amber-800");
      await expect(amber.first()).toHaveText("1");
      await noScroll(dialog);
      await dialog
        .getByText("Semifinal (ida)")
        .first()
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/asignar-liguilla-${tag}.png`,
      });
    });
  });
}
