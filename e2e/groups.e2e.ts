import { expect, Page, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeTournaments,
  mockGroupsApi,
  mockTournamentsApi,
  MockGroup,
  MockGroupTeam,
} from "./support";

const TWO_GROUPS: MockGroup[] = [
  { id: 1, name: "Grupo A", type: "regular_stage" },
  { id: 2, name: "Grupo B", type: "regular_stage" },
];

const TEAMS: MockGroupTeam[] = [
  { id: 1, name: "Águilas", manager: "Ana Pérez", groupId: 1 },
  { id: 2, name: "Búhos", manager: null, groupId: 1 },
  { id: 3, name: "Cóndores", manager: "Carla López", groupId: 2 },
  { id: 4, name: "Delfines", manager: null, groupId: 2 },
];

async function open(
  page: Page,
  options: Parameters<typeof mockGroupsApi>[1] = {},
  tournament = "Torneo 01",
) {
  await freezeTime(page);
  await mockTournamentsApi(page, {
    tournaments: makeTournaments(4).map((t) =>
      t.id === 4 ? { ...t, status: "playoffs" as const } : t,
    ),
  });
  const api = await mockGroupsApi(page, options);
  await gotoApp(page, "/dashboard/torneos/grupos");
  await page.getByRole("combobox", { name: "Torneo" }).click();
  await page.getByRole("option", { name: tournament }).click();

  return api;
}

const card = (page: Page, name: string) => page.getByRole("article", { name });

test.describe("groups", () => {
  test("asks for a tournament first", async ({ page }) => {
    await freezeTime(page);
    await mockTournamentsApi(page, { tournaments: makeTournaments(2) });
    await gotoApp(page, "/dashboard/torneos/grupos");

    await expect(
      page.getByText("Elige un torneo para ver sus grupos."),
    ).toBeVisible();
  });

  test("a single group has no move menu and explains itself", async ({
    page,
  }) => {
    await open(page, { teams: TEAMS.map((t) => ({ ...t, groupId: 1 })) });

    await expect(
      page.getByText("Si el torneo no se divide en grupos"),
    ).toBeVisible();
    await expect(card(page, "Fase regular")).toContainText("4 equipos");
    await expect(page.getByRole("button", { name: /Mover/ })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Reparto aleatorio" }),
    ).toHaveCount(0);
  });

  test("lists each group with its teams and delegates", async ({ page }) => {
    await open(page, { groups: TWO_GROUPS, teams: TEAMS });

    await expect(card(page, "Grupo A")).toContainText("2 equipos");
    await expect(card(page, "Grupo A")).toContainText("Águilas (Ana Pérez)");
    await expect(card(page, "Grupo A")).toContainText("Búhos");
    await expect(card(page, "Grupo B")).toContainText("Cóndores (Carla López)");
  });

  test("creates, renames and deletes groups, with the delete rules", async ({
    page,
  }) => {
    const api = await open(page, { groups: TWO_GROUPS, teams: TEAMS });

    // A repeated name shows the backend's message
    await page.getByRole("button", { name: "Nuevo grupo" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nombre del grupo").fill("grupo  a");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(
      dialog.getByText("Ya hay un grupo con ese nombre en este torneo."),
    ).toBeVisible();

    await dialog.getByLabel("Nombre del grupo").fill("Grupo C");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();
    await expect(card(page, "Grupo C")).toContainText("0 equipos");
    expect(api.writes[1]).toEqual(["POST", "/", { name: "Grupo C" }]);

    await page.getByRole("button", { name: "Renombrar Grupo C" }).click();
    await page.getByLabel("Nombre del grupo").fill("Grupo Z");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(card(page, "Grupo Z")).toBeVisible();

    // A group with teams cannot go; an empty one can
    await expect(
      page.getByRole("button", { name: "Eliminar Grupo A" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Eliminar Grupo Z" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Eliminar" })
      .click();
    await expect(card(page, "Grupo Z")).toHaveCount(0);
  });

  test("moves a team to another group", async ({ page }) => {
    const api = await open(page, { groups: TWO_GROUPS, teams: TEAMS });

    await page
      .getByRole("button", { name: "Mover Águilas a otro grupo" })
      .click();
    await page.getByRole("menuitem", { name: "Grupo B" }).click();

    await expect(card(page, "Grupo B")).toContainText("Águilas");
    await expect(card(page, "Grupo A")).toContainText("1 equipo");
    expect(api.writes.at(-1)).toEqual([
      "PUT",
      "/assignments",
      { assignments: [{ registration_id: 1, group_id: 2 }] },
    ]);
  });

  test("teams without a group show in their own panel", async ({ page }) => {
    await open(page, {
      groups: TWO_GROUPS,
      teams: [...TEAMS.slice(0, 3), { ...TEAMS[3], groupId: null }],
    });

    const panel = page.getByText("Estos equipos no tienen grupo.");
    await expect(panel).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Sin grupo" }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Mover Delfines a otro grupo" })
      .click();
    await page.getByRole("menuitem", { name: "Grupo A" }).click();

    await expect(panel).toBeHidden();
    await expect(card(page, "Grupo A")).toContainText("Delfines");
  });

  test("the random assignment asks for confirmation first", async ({
    page,
  }) => {
    const api = await open(page, {
      groups: TWO_GROUPS,
      teams: TEAMS.map((t) => ({ ...t, groupId: 1 })),
    });

    await page.getByRole("button", { name: "Reparto aleatorio" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Se reemplazará la asignación actual");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    expect(api.writes).toEqual([]);

    await page.getByRole("button", { name: "Reparto aleatorio" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Repartir" })
      .click();

    await expect(card(page, "Grupo A")).toContainText("2 equipos");
    await expect(card(page, "Grupo B")).toContainText("2 equipos");
  });

  test("creates, edits and deletes a playoff with one and with two sources", async ({
    page,
  }) => {
    const api = await open(page, { groups: TWO_GROUPS, teams: TEAMS });

    await page.getByRole("button", { name: "Nueva liguilla" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nombre", { exact: true }).fill("Oro");
    await dialog.getByRole("button", { name: "Abrir calendario" }).click();
    await page
      .locator(".mat-calendar-body-cell")
      .getByText("20", { exact: true })
      .click();

    await dialog.getByRole("combobox", { name: "Grupo" }).click();
    await page.getByRole("option", { name: "Grupo A" }).click();
    await dialog.getByLabel("Desde la posición").fill("1");
    await dialog.getByLabel("Hasta la posición").fill("3");

    // The total is checked live: 3 is not a power of 2
    await expect(dialog.getByText("Total: 3 equipos")).toBeVisible();
    await expect(
      dialog.getByText("El total debe ser 2, 4, 8, 16 o 32."),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Guardar" }).click();
    expect(api.writes).toEqual([]);

    await dialog.getByLabel("Hasta la posición").fill("4");
    await expect(dialog.getByText("Total: 4 equipos")).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: "Semifinal" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();

    const oro = card(page, "Oro");
    await expect(oro).toContainText("Grupo A: posiciones 1 a 4");
    await expect(oro).toContainText("Total: 4 equipos");
    await expect(oro).toContainText("Semifinal: 20/09/2026");
    await expect(oro).toContainText("Final: 27/09/2026");
    expect(api.writes[0][2]).toMatchObject({
      name: "Oro",
      type: "playoff",
      start_date: "2026-09-20",
      round_interval_days: 7,
      sources: [{ source_group_id: 1, position_start: 1, position_end: 4 }],
    });

    // Two sources, one line each; overlapping ranges show the backend's message
    await page.getByRole("button", { name: "Editar Oro" }).click();
    await dialog.getByLabel("Hasta la posición").fill("2");
    await dialog.getByRole("button", { name: "Agregar fuente" }).click();
    await dialog.getByRole("combobox", { name: "Grupo" }).nth(1).click();
    await page.getByRole("option", { name: "Grupo A" }).click();
    await dialog.getByLabel("Desde la posición").nth(1).fill("2");
    await dialog.getByLabel("Hasta la posición").nth(1).fill("3");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog.getByText("Las posiciones se traslapan")).toBeVisible();

    await dialog.getByRole("combobox", { name: "Grupo" }).nth(1).click();
    await page.getByRole("option", { name: "Grupo B" }).click();
    await dialog.getByLabel("Desde la posición").nth(1).fill("1");
    await dialog.getByLabel("Hasta la posición").nth(1).fill("2");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();
    await expect(oro).toContainText("Grupo A: posiciones 1 a 2");
    await expect(oro).toContainText("Grupo B: posiciones 1 a 2");

    await page.getByRole("button", { name: "Eliminar Oro" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Eliminar" })
      .click();
    await expect(card(page, "Oro")).toHaveCount(0);
  });

  async function pickDay(page: Page, label: string, day: string) {
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox", { name: label, exact: true })
      .locator("xpath=ancestor::mat-form-field")
      .getByRole("button", { name: "Abrir calendario" })
      .click();
    await page
      .locator(".mat-calendar-body-cell")
      .getByText(day, { exact: true })
      .click();
  }

  async function pickStart(page: Page, day: string) {
    await page
      .getByRole("dialog")
      .getByLabel("Fecha de inicio")
      .locator("xpath=ancestor::mat-form-field")
      .getByRole("button", { name: "Abrir calendario" })
      .click();
    await page
      .locator(".mat-calendar-body-cell")
      .getByText(day, { exact: true })
      .click();
  }

  async function fillEightTeams(page: Page) {
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nombre", { exact: true }).fill("Oro");
    await dialog.getByRole("combobox", { name: "Grupo" }).click();
    await page.getByRole("option", { name: "Grupo A" }).click();
    await dialog.getByLabel("Desde la posición").fill("1");
    await dialog.getByLabel("Hasta la posición").fill("8");
  }

  test("playoff rounds are filled from the start date and keep manual dates", async ({
    page,
  }) => {
    const api = await open(page, { groups: TWO_GROUPS, teams: TEAMS });

    await page.getByRole("button", { name: "Nueva liguilla" }).click();
    const dialog = page.getByRole("dialog");
    await fillEightTeams(page);
    await dialog
      .getByLabel("Fecha de inicio")
      .locator("xpath=ancestor::mat-form-field")
      .getByRole("button", { name: "Abrir calendario" })
      .click();
    await page
      .locator(".mat-calendar-body-cell")
      .getByText("7", { exact: true })
      .click();

    const quarters = dialog.getByRole("textbox", { name: "Cuartos de final" });
    const semis = dialog.getByRole("textbox", { name: "Semifinal" });
    const final = dialog.getByRole("textbox", { name: "Final", exact: true });
    await expect(quarters).toHaveValue(/7\/0?9\/2026/);
    await expect(semis).toHaveValue(/14\/0?9\/2026/);
    await expect(final).toHaveValue(/21\/0?9\/2026/);

    // A hand-picked date survives a new interval; the rest are recalculated
    await pickDay(page, "Semifinal", "9");
    await dialog.getByLabel("Días entre rondas").fill("2");
    await expect(quarters).toHaveValue(/7\/0?9\/2026/);
    await expect(semis).toHaveValue(/9\/0?9\/2026/);
    await expect(final).toHaveValue(/11\/0?9\/2026/);

    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();
    expect(api.writes[0][2]).toMatchObject({
      start_date: "2026-09-07",
      round_interval_days: 2,
      round_dates: ["2026-09-07", "2026-09-09", "2026-09-11"],
    });
    const oro = card(page, "Oro");
    await expect(oro).toContainText("Cuartos de final: 07/09/2026");
    await expect(oro).toContainText("Semifinal: 09/09/2026");
    await expect(oro).toContainText("Final: 11/09/2026");
  });

  test("sends no round dates when none was edited by hand", async ({
    page,
  }) => {
    const api = await open(page, { groups: TWO_GROUPS, teams: TEAMS });

    await page.getByRole("button", { name: "Nueva liguilla" }).click();
    const dialog = page.getByRole("dialog");
    await fillEightTeams(page);
    await pickStart(page, "7");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();

    expect(api.writes[0][2]).toMatchObject({ start_date: "2026-09-07" });
    expect(api.writes[0][2]).not.toHaveProperty("round_dates");
  });

  test("rounds out of order cannot be saved", async ({ page }) => {
    const api = await open(page, { groups: TWO_GROUPS, teams: TEAMS });

    await page.getByRole("button", { name: "Nueva liguilla" }).click();
    const dialog = page.getByRole("dialog");
    await fillEightTeams(page);
    await pickStart(page, "14");
    await pickDay(page, "Final", "10");
    await expect(
      dialog.getByText("Las fechas de las rondas deben ir en orden."),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Guardar" }).click();
    expect(api.writes).toEqual([]);
  });

  test("a new number of rounds recalculates the dates and says so", async ({
    page,
  }) => {
    await open(page, { groups: TWO_GROUPS, teams: TEAMS });

    await page.getByRole("button", { name: "Nueva liguilla" }).click();
    const dialog = page.getByRole("dialog");
    await fillEightTeams(page);
    await pickStart(page, "7");
    await pickDay(page, "Semifinal", "9");
    await expect(dialog.getByText("Cambió el número de rondas")).toHaveCount(0);

    await dialog.getByLabel("Hasta la posición").fill("4");
    await expect(
      dialog.getByText(
        "Cambió el número de rondas; se recalcularon las fechas.",
      ),
    ).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: "Semifinal" }),
    ).toHaveValue(/7\/0?9\/2026/);
    await expect(
      dialog.getByRole("textbox", { name: "Final", exact: true }),
    ).toHaveValue(/14\/0?9\/2026/);
  });

  test("editing a saved playoff keeps its manual dates, or its automatic ones", async ({
    page,
  }) => {
    await open(page, {
      groups: [
        ...TWO_GROUPS,
        {
          id: 10,
          name: "Oro",
          type: "playoff",
          start_date: "2026-10-05",
          round_interval_days: 7,
          round_dates: ["2026-10-05", "2026-10-07", "2026-10-14"],
          sources: [{ source_group_id: 1, position_start: 1, position_end: 8 }],
        },
        {
          id: 11,
          name: "Plata",
          type: "playoff",
          start_date: "2026-10-05",
          round_interval_days: 7,
          sources: [{ source_group_id: 2, position_start: 1, position_end: 4 }],
        },
      ],
      teams: TEAMS,
    });
    const dialog = page.getByRole("dialog");

    await page.getByRole("button", { name: "Editar Oro" }).click();
    await dialog.getByLabel("Días entre rondas").fill("3");
    await expect(
      dialog.getByRole("textbox", { name: "Semifinal" }),
    ).toHaveValue(/7\/10\/2026/);
    await expect(
      dialog.getByRole("textbox", { name: "Final", exact: true }),
    ).toHaveValue(/14\/10\/2026/);
    await dialog.getByRole("button", { name: "Cancelar" }).click();

    await page.getByRole("button", { name: "Editar Plata" }).click();
    await dialog.getByLabel("Días entre rondas").fill("3");
    await expect(
      dialog.getByRole("textbox", { name: "Final", exact: true }),
    ).toHaveValue(/8\/10\/2026/);
  });

  test("warns when the finals do not share a date", async ({ page }) => {
    await open(page, {
      groups: [
        ...TWO_GROUPS,
        {
          id: 10,
          name: "Oro",
          type: "playoff",
          start_date: "2026-10-01",
          sources: [{ source_group_id: 1, position_start: 1, position_end: 2 }],
        },
        {
          id: 11,
          name: "Plata",
          type: "playoff",
          start_date: "2026-10-05",
          sources: [{ source_group_id: 2, position_start: 1, position_end: 2 }],
        },
      ],
      teams: TEAMS,
    });

    await expect(
      page.getByText("Las finales de las liguillas no coinciden"),
    ).toBeVisible();
  });

  test("a tournament in progress locks the groups but not the playoffs", async ({
    page,
  }) => {
    await open(
      page,
      {
        groups: [
          ...TWO_GROUPS,
          {
            id: 10,
            name: "Oro",
            type: "playoff",
            start_date: "2026-10-01",
            sources: [
              { source_group_id: 1, position_start: 1, position_end: 2 },
            ],
          },
          {
            id: 11,
            name: "Plata",
            type: "playoff",
            editable: false,
            sources: [
              { source_group_id: 2, position_start: 1, position_end: 2 },
            ],
          },
        ],
        teams: TEAMS,
      },
      "Torneo 02",
    );

    await expect(
      page.getByText(
        "El torneo está en curso: los grupos ya no se pueden modificar.",
      ),
    ).toBeVisible();
    await expect(card(page, "Grupo A")).toContainText("Águilas");
    await expect(page.getByRole("button", { name: "Nuevo grupo" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Reparto aleatorio" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Mover|Renombrar|Eliminar Grupo/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Nueva liguilla" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Editar Oro" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Editar Plata" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Eliminar Plata" }),
    ).toHaveCount(0);
    // A playoff without dates says so and still names its rounds
    await expect(card(page, "Plata")).toContainText("Fechas por definir");
    await expect(card(page, "Plata")).toContainText("Final");
  });

  test("a tournament in its playoff stage is read only", async ({ page }) => {
    await open(
      page,
      {
        groups: [
          ...TWO_GROUPS,
          {
            id: 10,
            name: "Oro",
            type: "playoff",
            start_date: "2026-10-01",
            sources: [
              { source_group_id: 1, position_start: 1, position_end: 2 },
            ],
          },
        ],
        teams: TEAMS,
      },
      "Torneo 04",
    );

    await expect(
      page.getByText(
        "El torneo está en liguilla: los grupos y las liguillas ya no se pueden modificar.",
      ),
    ).toBeVisible();
    await expect(card(page, "Oro")).toContainText("Final: 01/10/2026");
    await expect(
      page.getByRole("button", {
        name: /Nuevo grupo|Nueva liguilla|Mover|Eliminar|Renombrar|Editar/,
      }),
    ).toHaveCount(0);
  });

  test("a playoff can be saved without dates", async ({ page }) => {
    const api = await open(page, { groups: TWO_GROUPS, teams: TEAMS });

    await page.getByRole("button", { name: "Nueva liguilla" }).click();
    const dialog = page.getByRole("dialog");
    await fillEightTeams(page);
    await expect(
      dialog.getByText("Las fechas se definirán al cerrar la fase regular."),
    ).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: "Semifinal" }),
    ).toHaveCount(0);
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();

    expect(api.writes[0][2]).toMatchObject({
      start_date: null,
      round_dates: null,
    });
    await expect(card(page, "Oro")).toContainText("Fechas por definir");
  });

  test("registrations show the group column only with several groups", async ({
    page,
  }) => {
    await freezeTime(page);
    await mockTournamentsApi(page, { tournaments: makeTournaments(2) });
    await mockGroupsApi(page, {
      groups: TWO_GROUPS,
      teams: [...TEAMS.slice(0, 3), { ...TEAMS[3], groupId: null }],
    });
    await gotoApp(page, "/dashboard/torneos/inscripciones");
    await page.getByRole("combobox", { name: "Torneo" }).click();
    await page.getByRole("option", { name: "Torneo 01" }).click();

    await expect(
      page.getByRole("columnheader", { name: "Grupo" }),
    ).toBeVisible();
    const rows = page.locator("tr[mat-row]");
    await expect(rows.filter({ hasText: "Águilas" })).toContainText("Grupo A");
    await expect(rows.filter({ hasText: "Cóndores" })).toContainText("Grupo B");
    await expect(rows.filter({ hasText: "Delfines" })).toContainText(
      "Sin grupo",
    );
  });

  test("registrations have no group column with a single group", async ({
    page,
  }) => {
    await freezeTime(page);
    await mockTournamentsApi(page, { tournaments: makeTournaments(2) });
    await mockGroupsApi(page, {
      teams: TEAMS.map((t) => ({ ...t, groupId: 1 })),
    });
    await gotoApp(page, "/dashboard/torneos/inscripciones");
    await page.getByRole("combobox", { name: "Torneo" }).click();
    await page.getByRole("option", { name: "Torneo 01" }).click();

    await expect(page.locator("tr[mat-row]")).toHaveCount(4);
    await expect(page.getByRole("columnheader", { name: "Grupo" })).toHaveCount(
      0,
    );
  });
});
