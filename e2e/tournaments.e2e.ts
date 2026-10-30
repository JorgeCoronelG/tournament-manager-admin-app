import { expect, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeTournaments,
  mockTournamentsApi,
} from "./support";

test.describe("tournaments", () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page);
  });

  test("the list can be searched, filtered and paginated", async ({ page }) => {
    const api = await mockTournamentsApi(page, {
      tournaments: makeTournaments(12),
    });
    await gotoApp(page, "/dashboard/torneos");

    const rows = page.locator("tr[mat-row]");
    const range = page.locator(".mat-mdc-paginator-range-label");

    await expect(rows).toHaveCount(5);
    await expect(range).toHaveText("1 – 5 de 12");
    expect(api.queries[0].get("sort")).toBe("-created_at");

    await page.getByRole("button", { name: "Página siguiente" }).click();
    await expect(range).toHaveText("6 – 10 de 12");

    await page.getByRole("combobox", { name: "Género" }).click();
    await page.getByRole("option", { name: "Femenil" }).click();
    await expect(range).toHaveText("1 – 4 de 4");
    expect(api.queries.at(-1)?.get("gender")).toBe("female");

    await page.getByRole("searchbox").fill("Torneo 02");
    await expect(range).toHaveText("1 – 1 de 1");
  });

  test("shows the actions that fit each status", async ({ page }) => {
    await mockTournamentsApi(page, { tournaments: makeTournaments(3) });
    await gotoApp(page, "/dashboard/torneos");

    const rows = page.locator("tr[mat-row]");
    // makeTournaments cycles planning, in progress, finished; newest first
    await expect(rows.first().getByRole("button")).toHaveCount(3);
    await expect(rows.nth(1).getByRole("button")).toHaveCount(2);
    await expect(rows.nth(2).getByRole("button")).toHaveCount(0);
  });

  test("shows the Liguilla status and offers it in the status filter", async ({
    page,
  }) => {
    await mockTournamentsApi(page, {
      tournaments: makeTournaments(1).map((t) => ({
        ...t,
        status: "playoffs" as const,
      })),
    });
    await gotoApp(page, "/dashboard/torneos");

    await expect(page.locator("tr[mat-row]").first()).toContainText("Liguilla");
    await page.getByRole("combobox", { name: "Estado" }).click();
    await expect(page.getByRole("option", { name: "Liguilla" })).toBeVisible();
  });

  test("a tournament starts only after confirming", async ({ page }) => {
    const api = await mockTournamentsApi(page, {
      tournaments: makeTournaments(1),
    });
    await gotoApp(page, "/dashboard/torneos");

    await page
      .locator("tr[mat-row]")
      .first()
      .getByRole("button", { name: "Iniciar torneo" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("no se puede deshacer");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    expect(api.statusChanges).toEqual([]);

    await page
      .locator("tr[mat-row]")
      .first()
      .getByRole("button", { name: "Iniciar torneo" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Iniciar" })
      .click();
    await expect(page.locator("tr[mat-row]").first()).toContainText("En curso");
    expect(api.statusChanges).toEqual([{ id: 1, status: "in_progress" }]);
  });

  test("a planned tournament can be deleted after confirming", async ({
    page,
  }) => {
    const api = await mockTournamentsApi(page, {
      tournaments: makeTournaments(1),
    });
    await gotoApp(page, "/dashboard/torneos");

    await page
      .locator("tr[mat-row]")
      .first()
      .getByRole("button", { name: "Eliminar" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Eliminar" })
      .click();

    await expect(page.getByText("Aún no hay registros.")).toBeVisible();
    expect(api.deleted).toEqual([1]);
  });

  test("creating a tournament validates the ages and sends a Y-m-d date", async ({
    page,
  }) => {
    const api = await mockTournamentsApi(page);
    await gotoApp(page, "/dashboard/torneos");

    await page.getByRole("button", { name: "Nuevo torneo" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog.getByText("Este campo es obligatorio")).toHaveCount(3);

    await dialog.getByLabel("Nombre").fill("Apertura");
    await dialog.getByRole("combobox", { name: "Género" }).click();
    await page.getByRole("option", { name: "Mixto" }).click();
    // Read only: the date comes from the calendar (in Spanish), opened by clicking the field
    const date = dialog.getByLabel("Fecha de inicio");
    await date.click();
    await expect(
      page.getByRole("button", { name: "20 de septiembre de 2026" }),
    ).toBeVisible();
    await page
      .locator(".mat-calendar-body-cell")
      .getByText("20", { exact: true })
      .click();
    await expect(date).toHaveValue("20/09/2026");

    // Typing or erasing does nothing
    await date.press("Backspace");
    await date.pressSequentially("1");
    await expect(date).toHaveValue("20/09/2026");

    await dialog.getByRole("tab", { name: "Configuración" }).click();
    await dialog.getByLabel("Edad mínima").fill("40");
    await dialog.getByLabel("Edad máxima").fill("30");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(
      dialog.getByText("La edad máxima no puede ser menor que la mínima"),
    ).toBeVisible();

    await dialog.getByLabel("Edad máxima").fill("45");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();
    expect(api.created).toEqual([
      {
        name: "Apertura",
        gender: "mixed",
        min_age: 40,
        max_age: 45,
        start_date: "2026-09-20",
        max_roster_size: null,
        min_matches_for_playoffs: null,
        rounds: 1,
        match_duration_minutes: 60,
        tiebreakers: ["points", "goal_difference", "goals_for", "head_to_head"],
      },
    ]);
  });

  test("the rules fields validate the duration and the tiebreakers", async ({
    page,
  }) => {
    const api = await mockTournamentsApi(page);
    await gotoApp(page, "/dashboard/torneos");

    await page.getByRole("button", { name: "Nuevo torneo" }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel("Duración del partido (minutos)").fill("10");
    await expect(
      dialog.getByText("Ingresa una duración entre 20 y 180 minutos"),
    ).toBeVisible();
    await dialog.getByLabel("Duración del partido (minutos)").fill("90");

    await dialog.getByRole("tab", { name: "Configuración" }).click();
    await dialog.getByRole("combobox", { name: "Vueltas" }).click();
    await page.getByRole("option", { name: /Doble vuelta/ }).click();

    await dialog
      .getByRole("button", { name: "Subir Diferencia de goles" })
      .click();
    await dialog
      .getByRole("button", { name: "Agregar Partidos ganados" })
      .click();
    for (let i = 0; i < 5; i++) {
      await dialog
        .getByRole("button", { name: /^Quitar / })
        .first()
        .click();
    }
    await expect(
      dialog.getByText("Selecciona al menos un criterio"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Agregar Puntos" }).click();

    await dialog.getByRole("tab", { name: "General" }).click();
    await dialog.getByLabel("Nombre").fill("Apertura");
    await dialog.getByRole("combobox", { name: "Género" }).click();
    await page.getByRole("option", { name: "Mixto" }).click();
    const date = dialog.getByLabel("Fecha de inicio");
    await date.click();
    await page
      .locator(".mat-calendar-body-cell")
      .getByText("20", { exact: true })
      .click();
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();

    expect(api.created[0]).toMatchObject({
      rounds: 2,
      match_duration_minutes: 90,
      tiebreakers: ["points"],
    });
  });

  test("saving with no tiebreakers goes to the settings tab", async ({
    page,
  }) => {
    const api = await mockTournamentsApi(page);
    await gotoApp(page, "/dashboard/torneos");

    await page.getByRole("button", { name: "Nuevo torneo" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nombre").fill("Apertura");
    await dialog.getByRole("combobox", { name: "Género" }).click();
    await page.getByRole("option", { name: "Mixto" }).click();
    await dialog.getByLabel("Fecha de inicio").click();
    await page
      .locator(".mat-calendar-body-cell")
      .getByText("20", { exact: true })
      .click();
    await dialog.getByLabel("Duración del partido (minutos)").fill("");

    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(
      dialog.getByText("Ingresa una duración entre 20 y 180 minutos"),
    ).toBeVisible();

    await dialog.getByLabel("Duración del partido (minutos)").fill("60");
    await dialog.getByRole("tab", { name: "Configuración" }).click();
    for (let i = 0; i < 4; i++) {
      await dialog
        .getByRole("button", { name: /^Quitar / })
        .first()
        .click();
    }
    await dialog.getByRole("tab", { name: "General" }).click();
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(
      dialog.getByText("Selecciona al menos un criterio"),
    ).toBeInViewport();
    expect(api.created).toEqual([]);
  });
});
