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

  const PLAYED = { generated: true, played: true, groups: [FOUR] };

  test("captures a result and shows the score, the played tag and the count", async ({
    page,
  }) => {
    const api = await open(page, "Torneo 02", {
      generated: true,
      groups: [FOUR],
    });

    await page
      .getByRole("button", {
        name: /Capturar resultado de Águilas contra Delfines/,
      })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Goles de Águilas").fill("2");
    await dialog.getByLabel("Goles de Delfines").fill("1");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();

    expect(api.writes).toEqual([
      ["PATCH", "/1/result", { home_goals: 2, away_goals: 1 }],
    ]);
    await expect(page.getByText("2 - 1")).toBeVisible();
    await expect(page.getByText("Jugado", { exact: true })).toBeVisible();
    await expect(page.getByText("Sin fecha")).toBeVisible();
    await expect(
      page.getByText("6 partidos en 3 jornadas · 1 jugados"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Regenerar" }),
    ).toBeDisabled();
  });

  test("a score outside 0 to 99 is not sent", async ({ page }) => {
    const api = await open(page, "Torneo 02", {
      generated: true,
      groups: [FOUR],
    });

    await page
      .getByRole("button", { name: /Capturar resultado de Águilas/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Goles de Águilas").fill("100");
    await dialog.getByLabel("Goles de Delfines").fill("1");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(dialog.getByText("de 0 a 99")).toBeVisible();
    expect(api.writes).toEqual([]);
  });

  test("shows the backend's refusal when saving a result", async ({ page }) => {
    await open(page, "Torneo 02", {
      generated: true,
      groups: [FOUR],
      refuse: "La fase regular ya está cerrada.",
    });

    await page
      .getByRole("button", { name: /Capturar resultado de Águilas/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Goles de Águilas").fill("1");
    await dialog.getByLabel("Goles de Delfines").fill("1");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(
      dialog.getByText("La fase regular ya está cerrada."),
    ).toBeVisible();
  });

  test("voids a result after confirming", async ({ page }) => {
    const api = await open(page, "Torneo 02", PLAYED);

    await page
      .getByRole("button", { name: /Capturar resultado de Águilas/ })
      .first()
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Anular resultado" })
      .click();
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Anular", exact: true })
      .click();

    await expect(page.getByText("Jugado", { exact: true })).toHaveCount(0);
    expect(api.writes).toEqual([["DELETE", "/1/result", null]]);
  });

  test("the standings start at zero without a tie alert", async ({ page }) => {
    await open(page, "Torneo 02", { generated: true, groups: [FOUR] });

    await page.getByRole("tab", { name: "Tabla de posiciones" }).click();

    await expect(
      page.getByText("Orden: Puntos, Diferencia de goles, Goles a favor."),
    ).toBeVisible();
    await expect(page.locator("tr[mat-row]")).toHaveCount(4);
    await expect(
      page.getByText("Hay equipos empatados sin resolver."),
    ).toHaveCount(0);
  });

  test("sets the order of tied teams by hand and removes it", async ({
    page,
  }) => {
    const api = await open(page, "Torneo 02", PLAYED);

    await page.getByRole("tab", { name: "Tabla de posiciones" }).click();
    await expect(
      page.getByText("Hay equipos empatados sin resolver."),
    ).toBeVisible();
    await expect(page.locator("tr[mat-row]").nth(1)).toContainText("Búhos");
    await expect(page.locator("tr[mat-row]").nth(1)).toContainText("Empate");

    await page.getByRole("button", { name: "Definir orden" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Bajar Búhos" }).click();
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();

    expect(api.writes[0]).toEqual([
      "PUT",
      "/standings/manual-order",
      { group_id: 1, registration_ids: [3, 2] },
    ]);
    await expect(page.locator("tr[mat-row]").nth(1)).toContainText("Cóndores");
    await expect(
      page.getByText("Hay equipos empatados sin resolver."),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Quitar orden manual" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Quitar", exact: true })
      .click();
    await expect(
      page.getByText("Hay equipos empatados sin resolver."),
    ).toBeVisible();
  });

  test("a tournament in its playoffs shows the table but cannot edit", async ({
    page,
  }) => {
    await open(page, "Torneo 04", PLAYED);

    await expect(
      page.getByRole("button", { name: /Capturar resultado/ }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "Tabla de posiciones" }).click();
    await expect(page.locator("tr[mat-row]")).toHaveCount(4);
    await expect(
      page.getByRole("button", { name: /Definir orden|Quitar orden/ }),
    ).toHaveCount(0);
  });
});
