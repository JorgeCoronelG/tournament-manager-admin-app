import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp, makeUsers, mockUsersApi } from "./support";

test.describe("users", () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page);
  });

  test("the list can be searched, sorted and paginated", async ({ page }) => {
    const api = await mockUsersApi(page, { users: makeUsers(12) });
    await gotoApp(page, "/dashboard/usuarios");

    const rows = page.locator("tr[mat-row]");
    const range = page.locator(".mat-mdc-paginator-range-label");

    await expect(rows).toHaveCount(5);
    await expect(range).toHaveText("1 – 5 de 12");

    await page.getByRole("button", { name: "Página siguiente" }).click();
    await expect(range).toHaveText("6 – 10 de 12");

    await page.getByRole("button", { name: "Nombre" }).first().click();
    await expect(range).toHaveText("1 – 5 de 12");
    await expect(rows.first()).toContainText("Ana");
    expect(api.queries.at(-1)?.get("sort")).toBe("first_name");

    await page.getByRole("searchbox").fill("Carla");
    await expect(range).toHaveText("1 – 1 de 1");
    await expect(rows.first()).toContainText("Carla");
  });

  test("an empty list and an empty search say different things", async ({
    page,
  }) => {
    await mockUsersApi(page, { users: [] });
    await gotoApp(page, "/dashboard/usuarios");
    await expect(page.getByText("Aún no hay registros.")).toBeVisible();

    await page.getByRole("searchbox").fill("zzzz");
    await expect(
      page.getByText("Ningún resultado coincide con tu búsqueda."),
    ).toBeVisible();
  });

  test("the table scrolls inside the card, not the page", async ({ page }) => {
    await mockUsersApi(page, { users: makeUsers(25) });
    await gotoApp(page, "/dashboard/usuarios");

    // Material's touch target sits over the select, so a plain click is intercepted
    await page
      .getByRole("combobox", { name: "Elementos por página" })
      .click({ force: true });
    await page.getByRole("option", { name: "25" }).click();
    await expect(page.locator("tr[mat-row]")).toHaveCount(25);

    const { pageScrolls, tableScrolls } = await page.evaluate(() => {
      const layout = document.querySelector(".app-layout-sidenav-content")!;
      const table = document.querySelector(".app-table-scroll")!;

      return {
        pageScrolls: layout.scrollHeight > layout.clientHeight,
        tableScrolls: table.scrollHeight > table.clientHeight,
      };
    });

    expect(pageScrolls).toBe(false);
    expect(tableScrolls).toBe(true);
    await expect(page.locator("mat-paginator")).toBeInViewport();
  });

  test("a user can be deleted after confirming", async ({ page }) => {
    const api = await mockUsersApi(page, { users: makeUsers(3) });
    await gotoApp(page, "/dashboard/usuarios");

    const rows = page.locator("tr[mat-row]");
    await expect(rows).toHaveCount(3);

    // Newest first: the first row is the user with id 1
    await rows.first().getByRole("button", { name: "Eliminar" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(
      "¿Seguro que quieres eliminar a Ana Pérez?",
    );
    await dialog.getByRole("button", { name: "Eliminar" }).click();

    await expect(page.getByText("Usuario eliminado")).toBeVisible();
    expect(api.deleted).toEqual([1]);
    await expect(rows).toHaveCount(2);
  });

  test("the server's field errors show up under their fields", async ({
    page,
  }) => {
    await mockUsersApi(page, {
      users: [],
      create: {
        status: 422,
        body: { code: 422, error: { email: ["El correo ya existe."] } },
      },
    });
    await gotoApp(page, "/dashboard/usuarios");

    await page.getByRole("button", { name: "Nuevo usuario" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nombre").fill("Ana Pérez");
    await dialog.getByLabel("Apellido").fill("López");
    await dialog.getByLabel("Correo").fill("ana@example.com");
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Administrador Liga" }).click();
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(dialog.getByText("El correo ya existe.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Guardar" })).toBeEnabled();
  });
});
