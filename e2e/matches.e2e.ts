import { expect, Page, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeTournaments,
  mockGroupsApi,
  mockMatchesApi,
  mockTournamentsApi,
  MatchesApiOptions,
} from "./support";

const TEAMS = [
  { id: 1, name: "Águilas", manager: null, groupId: 1 },
  { id: 2, name: "Búhos", manager: null, groupId: 1 },
  { id: 3, name: "Cóndores", manager: null, groupId: 1 },
  { id: 4, name: "Delfines", manager: null, groupId: 1 },
];

/** Tournament 01 is in planning, 02 in progress, 03 finished, 04 in its playoffs */
async function open(
  page: Page,
  tournament: string,
  options: MatchesApiOptions = {},
  doubleRound = false,
) {
  await freezeTime(page);
  await mockTournamentsApi(page, {
    tournaments: makeTournaments(4).map((t) => ({
      ...t,
      rounds: doubleRound ? (2 as const) : (1 as const),
      ...(t.id === 4 && { status: "playoffs" as const }),
    })),
  });
  await mockGroupsApi(page, {
    groups: [{ id: 1, name: "Grupo A", type: "regular_stage" }],
    teams: TEAMS,
  });
  const api = await mockMatchesApi(page, options);
  await gotoApp(page, "/dashboard/torneos/calendario");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: tournament }).click();

  return api;
}

const FOUR = {
  id: 1,
  name: "Grupo A",
  teams: ["Águilas", "Búhos", "Cóndores", "Delfines"],
};

test.describe("matches", () => {
  test("a tournament in planning asks to start it first", async ({ page }) => {
    await open(page, "Torneo 01");

    await expect(
      page.getByText("Inicia el torneo para generar el calendario."),
    ).toBeVisible();
  });

  test("an empty calendar offers to generate it, summarizing each group", async ({
    page,
  }) => {
    const api = await open(page, "Torneo 02", { groups: [FOUR] });

    await expect(page.getByText("Aún no hay calendario")).toBeVisible();
    await page.getByRole("button", { name: "Generar calendario" }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("4 equipos, 3 jornadas, 6 partidos"),
    ).toBeVisible();
    await expect(
      dialog.getByRole("checkbox", { name: "Sortear el orden de los equipos" }),
    ).toBeChecked();
    await dialog
      .getByRole("checkbox", { name: "Sortear el orden de los equipos" })
      .uncheck();
    await dialog.getByRole("button", { name: "Generar" }).click();
    await expect(dialog).toBeHidden();

    expect(api.writes).toEqual([["POST", "/generate", { shuffle: false }]]);
    await expect(page.getByText("6 partidos en 3 jornadas")).toBeVisible();
    await expect(page.getByText("Jornada 1")).toBeVisible();
    await expect(page.getByText("Por programar").first()).toBeVisible();
  });

  test("shows the backend's refusal in the dialog", async ({ page }) => {
    await open(page, "Torneo 02", {
      groups: [FOUR],
      refuse:
        "Los partidos mínimos para liguilla (9) superan los que jugará cada equipo.",
    });

    await page.getByRole("button", { name: "Generar calendario" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Generar" }).click();

    await expect(
      dialog.getByText("Los partidos mínimos para liguilla (9)"),
    ).toBeVisible();
  });

  test("an odd group shows who rests, and a double round splits in two", async ({
    page,
  }) => {
    await open(page, "Torneo 02", { generated: true, rounds: 2 }, true);

    await expect(page.getByText("6 partidos en 6 jornadas")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vuelta 1" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vuelta 2" })).toBeVisible();
    await expect(page.getByText(/Descansa: /).first()).toBeVisible();
  });

  test("long calendars open only the first matchday", async ({ page }) => {
    await open(
      page,
      "Torneo 02",
      { generated: true, groups: [FOUR], rounds: 2 },
      true,
    );

    await expect(
      page.getByRole("button", { name: "Jornada 1" }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("button", { name: "Jornada 2" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("several groups get a tab each", async ({ page }) => {
    await open(page, "Torneo 02", {
      generated: true,
      groups: [
        { id: 1, name: "Grupo A", teams: ["Águilas", "Búhos"] },
        { id: 2, name: "Grupo B", teams: ["Cóndores", "Delfines"] },
      ],
    });

    await expect(page.getByRole("tab", { name: "Grupo A" })).toBeVisible();
    await page.getByRole("tab", { name: "Grupo B" }).click();
    await expect(page.getByText("Delfines").first()).toBeVisible();
  });

  test("regenerates after confirming, and deletes the calendar", async ({
    page,
  }) => {
    const api = await open(page, "Torneo 02", {
      groups: [FOUR],
      generated: true,
    });

    await page.getByRole("button", { name: "Regenerar" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("Se reemplazarán todos los partidos."),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Regenerar" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Borrar calendario" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Borrar", exact: true })
      .click();

    await expect(page.getByText("Aún no hay calendario")).toBeVisible();
    expect(api.writes.map(([method, path]) => `${method} ${path}`)).toEqual([
      "POST /generate",
      "DELETE ",
    ]);
  });

  test("played matches disable regenerate and delete", async ({ page }) => {
    await open(page, "Torneo 02", {
      groups: [FOUR],
      generated: true,
      played: true,
    });

    await expect(
      page.getByRole("button", { name: "Regenerar" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Borrar calendario" }),
    ).toBeDisabled();
  });

  test("finished and playoff tournaments are read only", async ({ page }) => {
    await open(page, "Torneo 04", { groups: [FOUR], generated: true });

    await expect(page.getByText("6 partidos en 3 jornadas")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Regenerar|Borrar|Generar/ }),
    ).toHaveCount(0);
  });
});
