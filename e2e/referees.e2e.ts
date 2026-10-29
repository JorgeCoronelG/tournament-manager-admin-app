import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp, makeReferees, mockRefereesApi } from "./support";

test.describe("referees", () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page);
  });

  test("the list can be searched, filtered and paginated", async ({ page }) => {
    const api = await mockRefereesApi(page, { referees: makeReferees(12) });
    await gotoApp(page, "/dashboard/arbitros");

    const rows = page.locator("tr[mat-row]");
    const range = page.locator(".mat-mdc-paginator-range-label");

    await expect(rows).toHaveCount(5);
    await expect(range).toHaveText("1 – 5 de 12");

    await page.getByRole("button", { name: "Página siguiente" }).click();
    await expect(range).toHaveText("6 – 10 de 12");

    await page.getByRole("combobox", { name: "En la liga" }).click();
    await page.getByRole("option", { name: "Inactivo" }).click();
    await expect(range).toHaveText("1 – 3 de 3");
    expect(api.queries.at(-1)?.get("status")).toBe("inactive");

    await page.getByRole("searchbox").fill("arbitro4@");
    await expect(range).toHaveText("1 – 1 de 1");
  });

  test("only pending accounts can be edited or re-invited", async ({
    page,
  }) => {
    await mockRefereesApi(page, { referees: makeReferees(3) });
    await gotoApp(page, "/dashboard/arbitros");

    const rows = page.locator("tr[mat-row]");
    // Newest first: ids 1, 2, 3; only id 2 is pending
    await expect(
      rows.nth(0).getByRole("button", { name: "Editar" }),
    ).toHaveCount(0);
    await expect(
      rows.nth(1).getByRole("button", { name: "Editar" }),
    ).toHaveCount(1);
    await expect(
      rows.nth(1).getByRole("button", { name: "Reenviar invitación" }),
    ).toHaveCount(1);
  });

  test("a referee can be deactivated and removed after confirming", async ({
    page,
  }) => {
    const api = await mockRefereesApi(page, { referees: makeReferees(1) });
    await gotoApp(page, "/dashboard/arbitros");

    const row = page.locator("tr[mat-row]").first();
    await row.getByRole("button", { name: "Dar de baja en la liga" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Desactivar" })
      .click();
    await expect(row).toContainText("Inactivo");
    expect(api.statusChanges).toEqual([{ id: 1, status: "inactive" }]);

    await row.getByRole("button", { name: "Quitar de la liga" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Quitar" })
      .click();

    await expect(page.getByText("Aún no hay registros.")).toBeVisible();
    expect(api.removed).toEqual([1]);
  });

  test("a referee is added with their code", async ({ page }) => {
    const api = await mockRefereesApi(page, {
      lookup: {
        status: 200,
        body: {
          user_id: 7,
          first_name: "Ana",
          last_name: "Pérez",
          photo_url: null,
          already_in_league: false,
        },
      },
    });
    await gotoApp(page, "/dashboard/arbitros");

    await page.getByRole("button", { name: "Agregar árbitro" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Ya tiene clave" }).click();
    await dialog.getByRole("textbox", { name: "Clave" }).fill("arb0007");
    await dialog.getByRole("button", { name: "Buscar" }).click();

    await expect(dialog).toContainText("Ana Pérez");
    await dialog.getByRole("button", { name: "Agregar a la liga" }).click();
    await expect(dialog).toBeHidden();
    expect(api.attached).toEqual([{ user_code: "ARB0007" }]);
  });

  test("an unknown code gets a neutral message", async ({ page }) => {
    await mockRefereesApi(page);
    await gotoApp(page, "/dashboard/arbitros");

    await page.getByRole("button", { name: "Agregar árbitro" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Ya tiene clave" }).click();
    await dialog.getByRole("textbox", { name: "Clave" }).fill("NOPE");
    await dialog.getByRole("button", { name: "Buscar" }).click();

    await expect(
      dialog.getByText("No encontramos un árbitro con esa clave"),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Agregar a la liga" }),
    ).toBeDisabled();
  });

  test("a duplicate email shows on its field and leads to the code tab", async ({
    page,
  }) => {
    await mockRefereesApi(page, {
      create: {
        status: 422,
        body: {
          code: 422,
          error: { email: ["El correo ya está registrado."] },
        },
      },
    });
    await gotoApp(page, "/dashboard/arbitros");

    await page.getByRole("button", { name: "Agregar árbitro" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nombre").fill("Ana");
    await dialog.getByLabel("Apellido").fill("Pérez");
    await dialog.getByLabel("Correo").fill("ana@example.com");
    await dialog.getByRole("button", { name: "Crear árbitro" }).click();

    await expect(
      dialog.getByText("El correo ya está registrado."),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Buscar por clave" }).click();
    await expect(dialog.getByRole("textbox", { name: "Clave" })).toBeVisible();
    await expect(dialog).toContainText("Pídele su clave");
  });
});
