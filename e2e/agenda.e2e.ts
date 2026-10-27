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

const MATCHES: NonNullable<AgendaApiOptions["matches"]> = [
  {
    id: 1,
    tournament: { id: 2, name: "Torneo 02" },
    round_label: "Jornada 1",
    home_team: "Águilas",
    away_team: "Búhos",
    start: "2026-09-19T09:00:00",
    end: "2026-09-19T10:00:00",
    field: { id: 1, name: "Cancha 1" },
    referee: { id: 7, name: "Ana Ruiz" },
  },
  {
    id: 2,
    tournament: { id: 2, name: "Torneo 02" },
    round_label: "Jornada 1",
    home_team: "Cóndores",
    away_team: "Delfines",
    start: "2026-09-19T10:00:00",
    end: "2026-09-19T11:00:00",
    field: { id: 2, name: "Cancha 2" },
    referee: null,
  },
];

async function open(page: Page, options: AgendaApiOptions = {}) {
  await freezeTime(page);
  await mockTournamentsApi(page, { tournaments: makeTournaments(4) });
  await mockFieldsApi(page, { fields: makeFields(2) });
  await mockRefereesApi(page, { referees: [] });
  const api = await mockAgendaApi(page, options);
  await gotoApp(page, "/dashboard/torneos/calendario");

  return api;
}

test.describe("agenda", () => {
  test("shows the matches by field and hides the tournament picker", async ({
    page,
  }) => {
    await open(page, { matches: MATCHES });

    await page.getByRole("tab", { name: "Agenda" }).click();

    await expect(
      page.getByText("La agenda muestra todos los torneos de la liga."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Programar Águilas vs Búhos/ }),
    ).toContainText("Árbitro: Ana Ruiz");
    await expect(
      page.getByRole("button", { name: /Programar Cóndores vs Delfines/ }),
    ).toContainText("Sin árbitro");
    await expect(
      page.getByText("3 partidos sin horario").first(),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Calendario" }).click();
    await expect(
      page.getByText("La agenda muestra todos los torneos de la liga."),
    ).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Torneo" })).toBeVisible();
  });

  test("filters by field and by matches without a referee", async ({
    page,
  }) => {
    const api = await open(page, { matches: MATCHES });
    await page.getByRole("tab", { name: "Agenda" }).click();

    await page.getByText("Solo sin árbitro").click();
    await expect(
      page.getByRole("button", { name: /Programar Águilas vs Búhos/ }),
    ).toHaveCount(0);
    expect(api.queries.at(-1)?.get("unassigned_referee")).toBe("1");
  });

  test("says when the period has no matches", async ({ page }) => {
    await open(page);
    await page.getByRole("tab", { name: "Agenda" }).click();

    await expect(
      page.getByText("No hay partidos programados para este periodo."),
    ).toBeVisible();
  });
});
