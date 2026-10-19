import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp, makeFields, mockFieldsApi } from "./support";

test.describe("fields", () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page);
  });

  test("asks to pick a league when none is active", async ({ page }) => {
    await mockFieldsApi(page, { fields: makeFields(3) });
    await gotoApp(page, "/dashboard/canchas", {
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

  test("the list can be searched, filtered and paginated", async ({ page }) => {
    const api = await mockFieldsApi(page, { fields: makeFields(12) });
    await gotoApp(page, "/dashboard/canchas");

    const rows = page.locator("tr[mat-row]");
    const range = page.locator(".mat-mdc-paginator-range-label");

    await expect(rows).toHaveCount(5);
    await expect(range).toHaveText("1 – 5 de 12");
    expect(api.queries[0].get("sort")).toBe("-created_at");

    await page.getByRole("button", { name: "Página siguiente" }).click();
    await expect(range).toHaveText("6 – 10 de 12");

    await page.getByRole("combobox", { name: "Estado" }).click();
    await page.getByRole("option", { name: "Inactiva" }).click();
    await expect(range).toHaveText("1 – 3 de 3");
    expect(api.queries.at(-1)?.get("status")).toBe("inactive");

    await page.getByRole("searchbox").fill("Cancha 04");
    await expect(range).toHaveText("1 – 1 de 1");
  });

  test("creates a field, validating the name first", async ({ page }) => {
    const api = await mockFieldsApi(page);
    await gotoApp(page, "/dashboard/canchas");

    await page.getByRole("button", { name: "Agregar cancha" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog.getByText("Este campo es obligatorio")).toBeVisible();
    expect(api.created).toEqual([]);

    await dialog.getByLabel("Nombre").fill("  Cancha Norte ");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden();
    expect(api.created).toEqual([{ name: "Cancha Norte", status: "active" }]);
    await expect(page.locator("tr[mat-row]")).toContainText("Cancha Norte");
  });

  test("shows the server's error for a repeated name", async ({ page }) => {
    await mockFieldsApi(page, {
      create: {
        status: 422,
        body: { code: 422, error: { name: ["La cancha ya existe."] } },
      },
    });
    await gotoApp(page, "/dashboard/canchas");

    await page.getByRole("button", { name: "Agregar cancha" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nombre").fill("Cancha 01");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(dialog.getByText("La cancha ya existe.")).toBeVisible();
  });

  test("edits the name of a field", async ({ page }) => {
    const api = await mockFieldsApi(page, { fields: makeFields(1) });
    await gotoApp(page, "/dashboard/canchas");

    await page
      .locator("tr[mat-row]")
      .first()
      .getByRole("button", { name: "Editar" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Nombre")).toHaveValue("Cancha 01");
    await dialog.getByLabel("Nombre").fill("Cancha Central");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(dialog).toBeHidden();
    expect(api.updated).toEqual([{ id: 1, body: { name: "Cancha Central" } }]);
    await expect(page.locator("tr[mat-row]").first()).toContainText(
      "Cancha Central",
    );
  });

  test("asks before deactivating, but not before activating", async ({
    page,
  }) => {
    const api = await mockFieldsApi(page, { fields: makeFields(1) });
    await gotoApp(page, "/dashboard/canchas");
    const row = page.locator("tr[mat-row]").first();

    await row.getByRole("button", { name: "Desactivar" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Desactivar" })
      .click();
    await expect(row).toContainText("Inactiva");
    expect(api.statusChanges).toEqual([{ id: 1, status: "inactive" }]);

    await row.getByRole("button", { name: "Activar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(row).toContainText("Activa");
    expect(api.statusChanges.at(-1)).toEqual({ id: 1, status: "active" });
  });

  test("deletes a field after confirming", async ({ page }) => {
    const api = await mockFieldsApi(page, { fields: makeFields(1) });
    await gotoApp(page, "/dashboard/canchas");

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
});
