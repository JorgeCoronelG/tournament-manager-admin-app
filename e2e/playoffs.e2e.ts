import { expect, Page, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeTournaments,
  mockGroupsApi,
  mockMatchesApi,
  mockPlayoffsApi,
  mockTournamentsApi,
  PlayoffsApiOptions,
} from "./support";

const TEAMS = ["Águilas", "Búhos", "Cóndores", "Delfines"];

const team = (id: number, name: string) => ({
  registration_id: id,
  team_id: id * 10,
  team_name: name,
  logo_url: null,
});

const seed = (n: number, id: number, name: string) => ({
  seed: n,
  registration_id: id,
  team_id: id * 10,
  team_name: name,
});

const PROPOSAL = {
  blockers: [],
  warnings: [{ type: "tied_qualified", group: "Grupo A", positions: [3, 4] }],
  playoffs: [
    {
      group_id: 10,
      name: "Oro",
      qualified: [
        { ...seed(1, 1, "Halcones"), source_group: "Grupo A", position: 1 },
        { ...seed(2, 2, "Tigres"), source_group: "Grupo A", position: 2 },
        { ...seed(3, 3, "Toros"), source_group: "Grupo A", position: 3 },
        { ...seed(4, 4, "Lobos"), source_group: "Grupo A", position: 4 },
      ],
      rounds: [
        {
          name: "Semifinal",
          legs: 2,
          ties: [
            {
              bracket_position: 1,
              team_a: seed(1, 1, "Halcones"),
              team_b: seed(4, 4, "Lobos"),
            },
            {
              bracket_position: 2,
              team_a: seed(2, 2, "Tigres"),
              team_b: seed(3, 3, "Toros"),
            },
          ],
        },
        {
          name: "Final",
          legs: 1,
          ties: [{ bracket_position: 1, team_a: null, team_b: null }],
        },
      ],
      dates: ["2026-12-07", "2026-12-10", "2026-12-16"],
      round_legs: [2, 1],
    },
  ],
};

const BLOCKED = {
  blockers: [
    {
      type: "pending_matches",
      message: "Faltan partidos de la fase regular por jugar.",
      count: 3,
      examples: [
        {
          match_id: 1,
          group: "Grupo A",
          matchday: 2,
          home: "Halcones",
          away: "Lobos",
        },
      ],
    },
    {
      type: "unresolved_ties",
      message: "Hay empates sin resolver.",
      group: "Grupo A",
      positions: [2, 3],
    },
  ],
  warnings: [],
  playoffs: [],
};

const played = (
  id: number,
  leg: number | null,
  home: [number, string],
  away: [number, string],
  score: [number, number] | null,
  penalties: [number, number] | null = null,
  date: string | null = "2026-12-07",
) => ({
  id,
  leg,
  scheduled_date: date,
  home_team: team(...home),
  away_team: team(...away),
  home_goals: score?.[0] ?? null,
  away_goals: score?.[1] ?? null,
  home_penalties: penalties?.[0] ?? null,
  away_penalties: penalties?.[1] ?? null,
  status: score ? "played" : "scheduled",
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
          legs: 2,
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
                played(101, 1, [1, "Halcones"], [4, "Lobos"], [2, 1]),
                played(
                  102,
                  2,
                  [4, "Lobos"],
                  [1, "Halcones"],
                  null,
                  null,
                  "2026-12-10",
                ),
              ],
              aggregate: { a: 2, b: 1 },
              winner_team_id: null,
              winner_registration_id: null,
              decided_by: null,
            },
            {
              id: 2,
              round_index: 1,
              bracket_position: 2,
              team_a: team(2, "Tigres"),
              team_b: team(3, "Toros"),
              seed_a: 2,
              seed_b: 3,
              matches: [
                played(103, 1, [2, "Tigres"], [3, "Toros"], [1, 1]),
                played(
                  104,
                  2,
                  [3, "Toros"],
                  [2, "Tigres"],
                  [2, 2],
                  [4, 3],
                  "2026-12-10",
                ),
              ],
              aggregate: { a: 3, b: 3 },
              winner_team_id: 30,
              winner_registration_id: 3,
              decided_by: "penalties",
            },
          ],
        },
        {
          index: 2,
          name: "Final",
          legs: 1,
          ties: [
            {
              id: 3,
              round_index: 2,
              bracket_position: 1,
              team_a: null,
              team_b: team(3, "Toros"),
              seed_a: null,
              seed_b: 3,
              matches: [
                {
                  id: 105,
                  leg: null,
                  scheduled_date: "2026-12-16",
                  home_team: null,
                  away_team: team(3, "Toros"),
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
    {
      group_id: 11,
      name: "Plata",
      champion: team(5, "Águilas"),
      rounds: [
        {
          index: 1,
          name: "Final",
          legs: 1,
          ties: [
            {
              id: 4,
              round_index: 1,
              bracket_position: 1,
              team_a: team(5, "Águilas"),
              team_b: team(6, "Búhos"),
              seed_a: 1,
              seed_b: 2,
              matches: [played(201, null, [5, "Águilas"], [6, "Búhos"], null)],
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

const bestRow = (
  rank: number,
  id: number,
  name: string,
  group: string,
  stats: [number, number, number, number],
  flags: { qualified?: boolean; tied?: boolean } = {},
) => ({
  rank,
  registration_id: id,
  team_id: id * 10,
  team_name: name,
  group,
  played: stats[0],
  points: stats[1],
  goal_difference: stats[2],
  goals_for: stats[3],
  points_per_match: stats[0] ? stats[1] / stats[0] : 0,
  qualified: flags.qualified ?? false,
  tied: flags.tied ?? false,
});

/** 4.º places of four groups: Halcones and Lobos are level and only one of them qualifies */
const BEST_TIED = {
  source_id: 7,
  position: 4,
  best_count: 1,
  table: [
    bestRow(1, 1, "Halcones", "Grupo A", [3, 4, 1, 3], { tied: true }),
    bestRow(2, 4, "Lobos", "Grupo B", [3, 4, 1, 3], { tied: true }),
    bestRow(3, 3, "Toros", "Grupo C", [3, 2, 0, 2]),
    bestRow(4, 2, "Tigres", "Grupo D", [3, 1, -2, 1]),
  ],
};

const BEST_BLOCKED = {
  blockers: [
    {
      type: "unresolved_ties",
      scope: "best_of_position",
      message: "Hay empates sin resolver.",
      source_id: 7,
      position: 4,
      group: "Oro",
      teams: ["Halcones", "Lobos"],
    },
  ],
  warnings: [],
  playoffs: [{ group_id: 10, name: "Oro", best_of: [BEST_TIED] }],
};

const BEST_RESOLVED = {
  ...PROPOSAL,
  warnings: [],
  playoffs: [
    {
      ...PROPOSAL.playoffs[0],
      best_of: [
        {
          ...BEST_TIED,
          table: [
            bestRow(1, 4, "Lobos", "Grupo B", [3, 4, 1, 3], {
              qualified: true,
            }),
            bestRow(2, 1, "Halcones", "Grupo A", [3, 4, 1, 3]),
            bestRow(3, 3, "Toros", "Grupo C", [3, 2, 0, 2]),
            bestRow(4, 2, "Tigres", "Grupo D", [3, 1, -2, 1]),
          ],
        },
      ],
    },
  ],
};

const BEST_INFO = {
  ...PROPOSAL,
  warnings: [],
  playoffs: [
    {
      ...PROPOSAL.playoffs[0],
      best_of: [
        {
          ...BEST_TIED,
          table: [
            bestRow(1, 3, "Toros", "Grupo C", [3, 6, 3, 5], {
              qualified: true,
            }),
            bestRow(2, 1, "Halcones", "Grupo A", [3, 4, 1, 3], { tied: true }),
            bestRow(3, 4, "Lobos", "Grupo B", [3, 4, 1, 3], { tied: true }),
            bestRow(4, 2, "Tigres", "Grupo D", [3, 1, -2, 1]),
          ],
        },
      ],
    },
  ],
};

/** Tournament 02 is in progress, 03 finished and 04 in its playoffs */
async function open(
  page: Page,
  tournament: string,
  options: PlayoffsApiOptions = {},
  withPlayoffs = true,
) {
  await freezeTime(page);
  const tournaments = await mockTournamentsApi(page, {
    tournaments: makeTournaments(4).map((t) =>
      t.id === 4 ? { ...t, status: "playoffs" as const } : t,
    ),
  });
  await mockGroupsApi(page, {
    groups: [
      { id: 1, name: "Grupo A", type: "regular_stage" },
      ...(withPlayoffs
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
  await mockMatchesApi(page, {
    groups: [{ id: 1, name: "Grupo A", teams: TEAMS }],
    generated: true,
  });
  const api = await mockPlayoffsApi(page, options);
  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: tournament }).click();

  return { api, tournaments };
}

test.describe("playoffs", () => {
  test("offers to close the regular phase only in progress and with playoffs", async ({
    page,
  }) => {
    await open(page, "Torneo 02", { preview: PROPOSAL });
    await expect(
      page.getByRole("button", { name: "Cerrar fase regular" }),
    ).toBeVisible();
  });

  test("without playoffs there is nothing to close", async ({ page }) => {
    await open(page, "Torneo 02", { preview: PROPOSAL }, false);

    await expect(page.getByRole("button", { name: "Regenerar" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cerrar fase regular" }),
    ).toHaveCount(0);
  });

  test("a tournament in its playoffs does not offer it", async ({ page }) => {
    await open(page, "Torneo 04", { bracket: BRACKET });

    await expect(
      page.getByRole("button", { name: "Cerrar fase regular" }),
    ).toHaveCount(0);
  });

  test("lists what blocks the closing and sends to the standings", async ({
    page,
  }) => {
    await open(page, "Torneo 02", { preview: BLOCKED });

    await page.getByRole("button", { name: "Cerrar fase regular" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Faltan 3 partidos por jugar")).toBeVisible();
    await expect(
      dialog.getByText("Grupo A, jornada 2: Halcones vs Lobos"),
    ).toBeVisible();
    await expect(
      dialog.getByText("Hay empates sin resolver en Grupo A, posiciones 2-3."),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Confirmar y pasar a liguilla" }),
    ).toHaveCount(0);

    await dialog
      .getByRole("button", {
        name: "Definir el orden en la tabla de posiciones",
      })
      .click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("tab", { name: "Tabla de posiciones" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  test("closes the phase with adjusted pairings and dates after confirming", async ({
    page,
  }) => {
    const { api } = await open(page, "Torneo 02", { preview: PROPOSAL });

    await page.getByRole("button", { name: "Cerrar fase regular" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText(
        "Hay equipos empatados entre los clasificados de Grupo A",
      ),
    ).toBeVisible();
    await expect(dialog.getByText("1. Halcones (Grupo A, 1°)")).toBeVisible();
    await expect(
      dialog.getByText("Mejor sembrado vs peor sembrado"),
    ).toBeVisible();
    await expect(dialog.getByText("Rondas siguientes: Final")).toBeVisible();

    // Swap the pairings: Halcones against Toros, Tigres against Lobos
    await dialog.getByRole("combobox", { name: "Cruce 1: equipo 2" }).click();
    await page.getByRole("option", { name: "3. Toros" }).click();
    // Toros was in the other pairing: it takes the team this slot had, so none repeats
    await expect(
      dialog.getByRole("combobox", { name: "Cruce 1: equipo 2" }),
    ).toContainText("Toros");
    await expect(
      dialog.getByRole("combobox", { name: "Cruce 2: equipo 2" }),
    ).toContainText("Lobos");
    await dialog.getByRole("button", { name: "Restablecer cruces" }).click();
    await expect(
      dialog.getByRole("combobox", { name: "Cruce 1: equipo 2" }),
    ).toContainText("Lobos");
    await dialog.getByRole("combobox", { name: "Cruce 1: equipo 2" }).click();
    await page.getByRole("option", { name: "3. Toros" }).click();

    await expect(
      dialog.getByRole("textbox", { name: "Semifinal (ida)" }),
    ).toHaveValue(/7\/0?12\/2026/);
    await expect(
      dialog.getByRole("textbox", { name: "Semifinal (vuelta)" }),
    ).toHaveValue(/10\/12\/2026/);
    await expect(
      dialog.getByRole("textbox", { name: "Final", exact: true }),
    ).toHaveValue(/16\/12\/2026/);

    await dialog
      .getByRole("button", { name: "Confirmar y pasar a liguilla" })
      .click();
    await expect(
      page.getByText("ya no se podrán modificar sus resultados"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    expect(api.writes).toEqual([
      [
        "POST",
        "/close-regular-phase",
        {
          liguillas: [
            {
              group_id: 10,
              ties: [
                { bracket_position: 1, team_a_id: 10, team_b_id: 30 },
                { bracket_position: 2, team_a_id: 20, team_b_id: 40 },
              ],
              round_dates: ["2026-12-07", "2026-12-10", "2026-12-16"],
            },
          ],
        },
      ],
    ]);
  });

  test("shows the backend's refusal when closing", async ({ page }) => {
    await open(page, "Torneo 02", {
      preview: PROPOSAL,
      refuse: "Las fechas de liguilla deben ser posteriores al último partido.",
    });

    await page.getByRole("button", { name: "Cerrar fase regular" }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Confirmar y pasar a liguilla" })
      .click();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(
      dialog.getByText("Las fechas de liguilla deben ser posteriores"),
    ).toBeVisible();
  });

  test("draws the bracket with scores, penalties, global and winner", async ({
    page,
  }) => {
    await open(page, "Torneo 04", { bracket: BRACKET });

    await page.getByRole("tab", { name: "Liguilla" }).click();
    await expect(
      page.getByRole("heading", { name: "Semifinal" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Final", exact: true }),
    ).toBeVisible();

    const tie = page.getByRole("article", { name: "Tigres / Toros" });
    await expect(tie).toContainText("2-2 (4-3 pen.)");
    await expect(tie).toContainText("Global: 3-3");
    await expect(tie).toContainText("Gana por penales");
    await expect(tie).toContainText("Ida");
    await expect(tie).toContainText("Vuelta");
    await expect(
      page.getByRole("article", { name: /Por definir/ }),
    ).toContainText("Por definir");
    await expect(
      page.getByRole("article", { name: "Halcones / Lobos" }),
    ).toContainText("Por jugar");

    await page.getByRole("combobox", { name: "Liguilla" }).click();
    await page.getByRole("option", { name: "Plata" }).click();
    await expect(page.getByText("Campeón: Águilas")).toBeVisible();
  });

  test("asks for penalties only in a second leg with a level global", async ({
    page,
  }) => {
    const { api } = await open(page, "Torneo 04", { bracket: BRACKET });
    await page.getByRole("tab", { name: "Liguilla" }).click();

    // Lobos (home) against Halcones: the first leg ended 2-1 for Halcones
    await page
      .getByRole("article", { name: "Halcones / Lobos" })
      .getByRole("button", { name: "Registrar resultado" })
      .click();
    const dialog = page.getByRole("dialog");
    // The dialog moves the focus to the first field when it opens: wait for it, or the typing lands in the wrong one
    await expect(dialog.getByLabel("Goles de Lobos")).toBeFocused();
    await dialog.getByLabel("Goles de Lobos").fill("1");
    await dialog.getByLabel("Goles de Halcones").fill("1");
    await expect(dialog.getByText("Global: 2-3")).toBeVisible();
    await expect(dialog.getByLabel("Penales de Lobos")).toHaveCount(0);

    await dialog.getByLabel("Goles de Lobos").fill("2");
    await expect(dialog.getByText("Global: 3-3")).toBeVisible();
    await dialog.getByLabel("Penales de Lobos").fill("3");
    await dialog.getByLabel("Penales de Halcones").fill("3");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog.getByText("Penales distintos")).toBeVisible();
    expect(api.writes).toEqual([]);

    await dialog.getByLabel("Penales de Halcones").fill("1");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();
    expect(api.writes).toEqual([
      [
        "PATCH",
        "/matches/102/result",
        {
          home_goals: 2,
          away_goals: 1,
          home_penalties: 3,
          away_penalties: 1,
        },
      ],
    ]);
  });

  test("a single match asks for penalties on a draw and drops them otherwise", async ({
    page,
  }) => {
    const { api } = await open(page, "Torneo 04", { bracket: BRACKET });
    await page.getByRole("tab", { name: "Liguilla" }).click();
    await page.getByRole("combobox", { name: "Liguilla" }).click();
    await page.getByRole("option", { name: "Plata" }).click();

    await page.getByRole("button", { name: "Registrar resultado" }).click();
    const dialog = page.getByRole("dialog");
    // The dialog moves the focus to the first field when it opens: wait for it, or the typing lands in the wrong one
    await expect(dialog.getByLabel("Goles de Águilas")).toBeFocused();
    await dialog.getByLabel("Goles de Águilas").fill("1");
    await dialog.getByLabel("Goles de Búhos").fill("1");
    await dialog.getByLabel("Penales de Águilas").fill("5");
    await dialog.getByLabel("Penales de Búhos").fill("4");

    await dialog.getByLabel("Goles de Búhos").fill("0");
    await expect(dialog.getByLabel("Penales de Águilas")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();

    expect(api.writes).toEqual([
      ["PATCH", "/matches/201/result", { home_goals: 1, away_goals: 0 }],
    ]);
  });

  test("shows the backend's refusal when saving a playoff result", async ({
    page,
  }) => {
    await open(page, "Torneo 04", {
      bracket: BRACKET,
      refuse: "Primero registra el resultado de la ida.",
    });
    await page.getByRole("tab", { name: "Liguilla" }).click();

    await page
      .getByRole("article", { name: "Halcones / Lobos" })
      .getByRole("button", { name: "Registrar resultado" })
      .click();
    const dialog = page.getByRole("dialog");
    // The dialog moves the focus to the first field when it opens: wait for it, or the typing lands in the wrong one
    await expect(dialog.getByLabel("Goles de Lobos")).toBeFocused();
    await dialog.getByLabel("Goles de Lobos").fill("0");
    await dialog.getByLabel("Goles de Halcones").fill("1");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(
      dialog.getByText("Primero registra el resultado de la ida."),
    ).toBeVisible();
  });

  test("voids a playoff result after confirming", async ({ page }) => {
    const { api } = await open(page, "Torneo 04", { bracket: BRACKET });
    await page.getByRole("tab", { name: "Liguilla" }).click();

    await page
      .getByRole("article", { name: "Tigres / Toros" })
      .getByRole("button", { name: "Anular resultado" })
      .last()
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Anular", exact: true })
      .click();

    await expect(page.getByText("Resultado anulado")).toBeVisible();
    expect(api.writes).toEqual([["DELETE", "/matches/104/result", null]]);
  });

  test("a finished tournament shows the bracket without buttons", async ({
    page,
  }) => {
    await open(page, "Torneo 03", { bracket: BRACKET });

    await page.getByRole("tab", { name: "Liguilla" }).click();
    await expect(
      page.getByRole("article", { name: "Tigres / Toros" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /Registrar|Editar|Anular|Terminar/,
      }),
    ).toHaveCount(0);
  });

  test("finishes the tournament once every tie has a winner", async ({
    page,
  }) => {
    const decided = structuredClone(BRACKET);
    decided.playoffs = [
      {
        ...decided.playoffs[1],
        champion: team(5, "Águilas"),
        rounds: [
          {
            ...decided.playoffs[1].rounds[0],
            ties: [
              {
                ...decided.playoffs[1].rounds[0].ties[0],
                winner_team_id: 50,
                winner_registration_id: 5,
              },
            ],
          },
        ],
      },
    ];
    const { tournaments } = await open(page, "Torneo 04", { bracket: decided });
    await page.getByRole("tab", { name: "Liguilla" }).click();

    await expect(page.getByText("Campeón: Águilas")).toBeVisible();
    await page.getByRole("button", { name: "Terminar torneo" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Finalizar" })
      .click();

    await expect
      .poll(() => tournaments.statusChanges)
      .toEqual([{ id: 4, status: "finished" }]);
  });

  test("does not offer to finish while a tie is open", async ({ page }) => {
    await open(page, "Torneo 04", { bracket: BRACKET });
    await page.getByRole("tab", { name: "Liguilla" }).click();

    await expect(
      page.getByRole("button", { name: "Terminar torneo" }),
    ).toHaveCount(0);
  });

  test("compares the best teams of a position and marks who qualifies", async ({
    page,
  }) => {
    await open(page, "Torneo 02", { preview: BEST_RESOLVED });

    await page.getByRole("button", { name: "Cerrar fase regular" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("Mejores 4.º lugares", { exact: true }),
    ).toBeVisible();
    const rows = dialog.locator("tbody tr");
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText("Lobos");
    await expect(rows.nth(0)).toContainText("Grupo B");
    await expect(rows.nth(0)).toContainText("Clasifica");
    await expect(rows.nth(1)).not.toContainText("Clasifica");
    await expect(rows.nth(1)).toHaveClass(/opacity-60/);
    await expect(rows.nth(0)).not.toHaveClass(/opacity-60/);
  });

  test("tied teams look alike: not highlighted as qualified nor dimmed as out", async ({
    page,
  }) => {
    await open(page, "Torneo 02", { preview: BEST_BLOCKED });

    await page.getByRole("button", { name: "Cerrar fase regular" }).click();
    const rows = page.getByRole("dialog").locator("tbody tr");

    for (const tied of [0, 1]) {
      await expect(rows.nth(tied)).toContainText("Empate");
      await expect(rows.nth(tied)).not.toContainText("Clasifica");
      await expect(rows.nth(tied)).not.toHaveClass(/opacity-60/);
    }
    // Clearly out of the cut: dimmed, without badges
    await expect(rows.nth(2)).toHaveClass(/opacity-60/);
    await expect(rows.nth(2)).not.toContainText("Empate");
  });

  test("a tie that does not change who qualifies is only a notice", async ({
    page,
  }) => {
    await open(page, "Torneo 02", { preview: BEST_INFO });

    await page.getByRole("button", { name: "Cerrar fase regular" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("pero no cambia quién clasifica"),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Confirmar y pasar a liguilla" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Definir orden" }),
    ).toHaveCount(0);
  });

  test("a tie at the cut blocks the closing until the order is set", async ({
    page,
  }) => {
    const { api } = await open(page, "Torneo 02", {
      preview: BEST_BLOCKED,
      previewAfterOrder: BEST_RESOLVED,
    });

    await page.getByRole("button", { name: "Cerrar fase regular" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("Hay empate en los mejores 4.º lugares."),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Confirmar y pasar a liguilla" }),
    ).toHaveCount(0);

    await dialog.getByRole("button", { name: "Definir orden" }).click();
    const order = page.getByRole("dialog").last();
    await order
      .getByRole("button", { name: "Bajar Halcones (Grupo A)" })
      .click();
    await order.getByRole("button", { name: "Guardar" }).click();

    expect(api.writes[0]).toEqual([
      "PUT",
      "/playoff-sources/7/manual-order",
      { team_ids: [40, 10] },
    ]);
    await expect(
      dialog.getByRole("button", { name: "Confirmar y pasar a liguilla" }),
    ).toBeVisible();
    await expect(dialog.getByText("1. Halcones (mejor 4.º)")).toHaveCount(0);

    await dialog.getByRole("button", { name: "Quitar orden manual" }).click();
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Quitar", exact: true })
      .click();
    await expect
      .poll(() => api.writes.at(-1))
      .toEqual(["DELETE", "/playoff-sources/7/manual-order", null]);
  });

  test("marks the best teams in the seeds", async ({ page }) => {
    await open(page, "Torneo 02", { preview: BEST_RESOLVED });

    await page.getByRole("button", { name: "Cerrar fase regular" }).click();

    await expect(
      page.getByRole("dialog").getByText("4. Lobos (mejor 4.º)"),
    ).toBeVisible();
  });
});
