import { expect, Page, test } from "@playwright/test";
import { freezeTime, gotoApp, makeTeams, mockTeamsApi } from "./support";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** Picks an option of a filter and waits for its panel to close, so the next one opens cleanly */
async function choose(page: Page, select: string, option: string) {
  await page.getByRole("combobox", { name: select }).click();
  await page.getByRole("option", { name: option }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
}

test.describe("teams", () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page);
  });

  test("asks to pick a league when none is active", async ({ page }) => {
    await mockTeamsApi(page, { teams: makeTeams(3) });
    await gotoApp(page, "/dashboard/equipos", {
      leagues: [
        { id: 1, name: "Liga A" },
        { id: 2, name: "Liga B" },
      ],
    });

    await expect(
      page.getByText("Selecciona una liga para continuar."),
    ).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
  });

  test("lists the teams with their delegate, status and the default logo", async ({
    page,
  }) => {
    const api = await mockTeamsApi(page, { teams: makeTeams(12) });
    await gotoApp(page, "/dashboard/equipos");

    const rows = page.locator("tr[mat-row]");
    await expect(rows).toHaveCount(5);
    await expect(page.locator(".mat-mdc-paginator-range-label")).toHaveText(
      "1 – 5 de 12",
    );
    expect(api.queries[0].get("sort")).toBe("-created_at");

    // Equipo 01: delegate with an active account; Equipo 02: pending; Equipo 03: none
    await expect(rows.nth(0)).toContainText("Ana Pérez");
    await expect(rows.nth(0).locator(".mat-column-manager")).toContainText(
      "Activo",
    );
    await expect(rows.nth(1)).toContainText("Pendiente");
    await expect(rows.nth(2)).toContainText("Sin delegado");
    await expect(rows.nth(0)).toContainText("Activo");

    // No logo_url: the shield icon on a neutral circle, never a broken image
    await expect(rows.nth(0).locator("app-logo-image img")).toHaveCount(0);
    await expect(rows.nth(0).locator("app-logo-image mat-icon")).toBeVisible();
  });

  test("filters by status and by 'Sin delegado', and searches by delegate", async ({
    page,
  }) => {
    const api = await mockTeamsApi(page, { teams: makeTeams(12) });
    await gotoApp(page, "/dashboard/equipos");
    const range = page.locator(".mat-mdc-paginator-range-label");

    await choose(page, "Estado", "Vetado");
    await expect(range).toHaveText("1 – 3 de 3");
    expect(api.queries.at(-1)?.get("status")).toBe("banned");

    await choose(page, "Estado", "Todos los estados");
    await choose(page, "Delegado", "Sin delegado");
    await expect(range).toHaveText("1 – 4 de 4");
    expect(api.queries.at(-1)?.get("has_manager")).toBe("false");

    // The options are the league's delegates; choosing one filters by their id
    await choose(page, "Delegado", "Bruno García");
    await expect(range).toHaveText("1 – 1 de 1");
    expect(api.queries.at(-1)?.get("manager_user_id")).toBe("101");

    await choose(page, "Delegado", "Todos los delegados");
    await page.getByRole("searchbox").fill("Bruno");
    await expect(range).toHaveText("1 – 1 de 1");
  });

  test("creates a team with a new delegate and uploads its logo", async ({
    page,
  }) => {
    const api = await mockTeamsApi(page);
    await gotoApp(page, "/dashboard/equipos");

    await page.getByRole("button", { name: "Agregar equipo" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Nombre" }).fill("  Tigres ");
    await dialog.getByRole("tab", { name: "Nuevo delegado" }).click();

    // The delegate's fields are validated before anything is sent
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(
      dialog.getByText("Este campo es obligatorio").first(),
    ).toBeVisible();
    expect(api.created).toEqual([]);

    await dialog.getByRole("textbox", { name: "Nombre" }).nth(1).fill("Ana");
    await dialog.getByRole("textbox", { name: "Apellido" }).fill("Pérez");
    await dialog.getByRole("textbox", { name: "Correo" }).fill("ana@e.com");
    await dialog
      .locator("input[type=file]")
      .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
    await expect(dialog.locator("app-logo-picker img")).toBeVisible();

    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();

    expect(api.created).toEqual([
      {
        name: "Tigres",
        manager: {
          first_name: "Ana",
          last_name: "Pérez",
          email: "ana@e.com",
          phone: null,
        },
      },
    ]);
    expect(api.logos).toHaveLength(1);
    expect(api.logos[0].contentType).toContain("multipart/form-data");
    await expect(page.locator("tr[mat-row]")).toContainText("Tigres");
  });

  test("a logo of the wrong type is rejected before uploading", async ({
    page,
  }) => {
    const api = await mockTeamsApi(page);
    await gotoApp(page, "/dashboard/equipos");

    await page.getByRole("button", { name: "Agregar equipo" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog
      .locator("input[type=file]")
      .setInputFiles({ name: "a.gif", mimeType: "image/gif", buffer: PNG });

    await expect(dialog.getByRole("alert")).toContainText("JPG, PNG o WebP");
    await dialog.getByRole("textbox", { name: "Nombre" }).fill("Tigres");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();
    expect(api.logos).toEqual([]);
  });

  test("assigns an existing delegate by their code", async ({ page }) => {
    const api = await mockTeamsApi(page, {
      teams: makeTeams(3),
      lookup: {
        status: 200,
        body: {
          user_id: 7,
          first_name: "Zoe",
          last_name: "Ruiz",
          photo_url: null,
        },
      },
    });
    await gotoApp(page, "/dashboard/equipos");

    // Equipo 03 has no delegate
    await page
      .locator("tr[mat-row]")
      .filter({ hasText: "Equipo 03" })
      .getByRole("button", { name: "Asignar delegado" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Ya tiene clave" }).click();
    await expect(
      dialog.getByRole("button", { name: "Asignar delegado" }),
    ).toBeDisabled();

    await dialog.getByRole("textbox", { name: "Clave" }).fill("zoe0007");
    await dialog.getByRole("button", { name: "Buscar" }).click();
    await expect(dialog).toContainText("Zoe Ruiz");
    await dialog.getByRole("button", { name: "Asignar delegado" }).click();

    await expect(dialog).toBeHidden();
    expect(api.managerSet).toEqual([
      { id: 3, body: { manager_user_code: "ZOE0007" } },
    ]);
  });

  test("an unknown code gets a neutral message", async ({ page }) => {
    await mockTeamsApi(page, { teams: makeTeams(3) });
    await gotoApp(page, "/dashboard/equipos");

    await page
      .locator("tr[mat-row]")
      .filter({ hasText: "Equipo 03" })
      .getByRole("button", { name: "Asignar delegado" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Ya tiene clave" }).click();
    await dialog.getByRole("textbox", { name: "Clave" }).fill("NOPE");
    await dialog.getByRole("button", { name: "Buscar" }).click();

    await expect(
      dialog.getByText("No encontramos un delegado con esa clave"),
    ).toBeVisible();
  });

  test("a duplicate email shows on its field and leads to the code tab", async ({
    page,
  }) => {
    await mockTeamsApi(page, {
      create: {
        status: 422,
        body: {
          code: 422,
          error: { "manager.email": ["El correo ya está registrado."] },
        },
      },
    });
    await gotoApp(page, "/dashboard/equipos");

    await page.getByRole("button", { name: "Agregar equipo" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Nombre" }).fill("Tigres");
    await dialog.getByRole("tab", { name: "Nuevo delegado" }).click();
    await dialog.getByRole("textbox", { name: "Nombre" }).nth(1).fill("Ana");
    await dialog.getByRole("textbox", { name: "Apellido" }).fill("Pérez");
    await dialog.getByRole("textbox", { name: "Correo" }).fill("ana@e.com");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(
      dialog.getByText("El correo ya está registrado."),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Buscar por clave" }).click();
    await expect(dialog.getByRole("textbox", { name: "Clave" })).toBeVisible();
  });

  test("asks before banning, but not before reactivating", async ({ page }) => {
    const api = await mockTeamsApi(page, { teams: makeTeams(1) });
    await gotoApp(page, "/dashboard/equipos");
    const row = page.locator("tr[mat-row]").first();

    await row.getByRole("button", { name: "Vetar" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Vetar" })
      .click();
    await expect(row).toContainText("Vetado");
    expect(api.statusChanges).toEqual([{ id: 1, status: "banned" }]);

    await row.getByRole("button", { name: "Levantar veto" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(row).toContainText("Activo");
    expect(api.statusChanges.at(-1)).toEqual({ id: 1, status: "active" });
  });

  test("removes a delegate after confirming", async ({ page }) => {
    const api = await mockTeamsApi(page, { teams: makeTeams(1) });
    await gotoApp(page, "/dashboard/equipos");

    await page
      .locator("tr[mat-row]")
      .first()
      .getByRole("button", { name: "Quitar delegado" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Quitar" })
      .click();

    await expect(page.locator("tr[mat-row]").first()).toContainText(
      "Sin delegado",
    );
    expect(api.managerRemoved).toEqual([1]);
  });

  test("deletes a team after confirming", async ({ page }) => {
    const api = await mockTeamsApi(page, { teams: makeTeams(1) });
    await gotoApp(page, "/dashboard/equipos");

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

  test("teams with the same name are told apart by their delegate, also when confirming", async ({
    page,
  }) => {
    const teams = makeTeams(3).map((team) => ({ ...team, name: "Halcones" }));
    await mockTeamsApi(page, { teams });
    await gotoApp(page, "/dashboard/equipos");

    const rows = page.locator("tr[mat-row]");
    await expect(rows).toHaveCount(3);

    for (const [index, team] of teams.entries()) {
      const label = team.manager
        ? `Halcones (delegado: ${team.manager.first_name} ${team.manager.last_name})`
        : "Halcones (sin delegado)";
      const manager = team.manager
        ? `${team.manager.first_name} ${team.manager.last_name}`
        : "Sin delegado";
      await expect(
        rows.nth(index).locator(".mat-column-manager"),
      ).toContainText(manager);

      // Teams are newest first by id, so rows follow the order of `teams`
      for (const action of ["Eliminar", "Vetar"]) {
        await rows.nth(index).getByRole("button", { name: action }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText(label);
        await dialog.getByRole("button", { name: "Cancelar" }).click();
        await expect(dialog).toBeHidden();
      }
    }
  });

  test("shows the server's duplicate message on the name when creating", async ({
    page,
  }) => {
    await mockTeamsApi(page, {
      create: {
        status: 422,
        body: {
          code: 422,
          error: {
            name: [
              "Ya existe un equipo sin delegado con ese nombre. Asigna un delegado para distinguirlos.",
            ],
          },
        },
      },
    });
    await gotoApp(page, "/dashboard/equipos");

    await page.getByRole("button", { name: "Agregar equipo" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("Puedes repetir el nombre si el delegado es distinto."),
    ).toBeVisible();
    await dialog.getByRole("textbox", { name: "Nombre" }).fill("Tigres");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(dialog).toContainText(
      "Ya existe un equipo sin delegado con ese nombre.",
    );
  });

  test("a duplicate when assigning a delegate shows in the dialog and keeps the row", async ({
    page,
  }) => {
    const api = await mockTeamsApi(page, {
      teams: makeTeams(3),
      assign: {
        status: 422,
        body: {
          code: 422,
          error: "Este delegado ya tiene un equipo con ese nombre.",
        },
      },
    });
    await gotoApp(page, "/dashboard/equipos");

    const row = page.locator("tr[mat-row]").filter({ hasText: "Equipo 03" });
    await row.getByRole("button", { name: "Asignar delegado" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Nuevo delegado" }).click();
    await dialog.getByRole("textbox", { name: "Nombre" }).fill("Ana");
    await dialog.getByRole("textbox", { name: "Apellido" }).fill("Pérez");
    await dialog.getByRole("textbox", { name: "Correo" }).fill("ana@e.com");
    await dialog.getByRole("button", { name: "Asignar delegado" }).click();

    await expect(dialog.getByRole("alert")).toContainText(
      "Este delegado ya tiene un equipo con ese nombre.",
    );
    await expect(dialog).toBeVisible();
    expect(api.managerSet).toHaveLength(1);

    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(row).toContainText("Sin delegado");
  });

  test("a failed delegate removal shows an error and keeps the delegate", async ({
    page,
  }) => {
    await mockTeamsApi(page, {
      teams: makeTeams(3),
      unassign: {
        status: 422,
        body: { code: 422, error: "No se puede quitar al delegado." },
      },
    });
    await gotoApp(page, "/dashboard/equipos");

    const row = page.locator("tr[mat-row]").filter({ hasText: "Equipo 01" });
    await row.getByRole("button", { name: "Quitar delegado" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Quitar" })
      .click();

    await expect(
      page.getByText("No se puede quitar al delegado."),
    ).toBeVisible();
    await expect(row.locator(".mat-column-manager")).not.toContainText(
      "Sin delegado",
    );
  });
});
