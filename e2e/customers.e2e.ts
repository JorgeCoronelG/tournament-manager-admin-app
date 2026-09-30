import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp } from "./support";

test.describe("dashboard and customers", () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page);
  });

  test("the dashboard shows the customer statistics from the API", async ({
    page,
  }) => {
    await gotoApp(page);

    await expect(page).toHaveTitle(/Panel/);
    await expect(page.getByText("Clientes totales")).toBeVisible();
    await expect(page.getByText("Clientes recientes")).toBeVisible();
    await expect(page.locator("li a")).toHaveCount(5);
  });

  test("the list can be searched, filtered, sorted and paginated", async ({
    page,
  }) => {
    await gotoApp(page, "/dashboard/customers");

    const rows = page.locator("tr[mat-row]");
    const range = page.locator(".mat-mdc-paginator-range-label");

    await expect(rows).toHaveCount(10);
    await expect(range).toContainText("de");

    await page.getByRole("searchbox").fill("García");
    await expect(range).toHaveText(/1 – \d de \d/);
    await expect(rows.first()).toContainText("García");

    await page.getByRole("searchbox").fill("zzzzzz");
    await expect(
      page.getByText("Ningún cliente coincide con tu búsqueda."),
    ).toBeVisible();
    await page.getByRole("searchbox").fill("");

    // Wait for each panel to be gone before opening it again
    const chooseStatus = async (option: string) => {
      await page.getByRole("combobox", { name: "Estado" }).click();
      await page.getByRole("option", { name: option, exact: true }).click();
      await expect(page.getByRole("listbox")).toBeHidden();
    };

    await chooseStatus("Inactivo");
    await expect(rows.first()).toContainText("Inactivo");

    await chooseStatus("Todos");

    const firstBefore = await rows.first().locator("a").textContent();
    await page.getByRole("button", { name: "Nombre" }).click();
    await expect(rows.first().locator("a")).not.toHaveText(firstBefore ?? "");

    await page.getByRole("button", { name: "Página siguiente" }).click();
    await expect(range).toContainText("11 –");
  });

  test("a customer can be opened and a missing one is handled", async ({
    page,
  }) => {
    await gotoApp(page, "/dashboard/customers");
    await page.locator("tr[mat-row] a").first().click();

    await expect(page).toHaveURL(/\/customers\/\d+$/);
    await expect(page.getByText("Empresa", { exact: true })).toBeVisible();

    await gotoApp(page, "/dashboard/customers/99999");
    await expect(page.getByText("Este cliente no existe.")).toBeVisible();
  });

  test("a customer can be created, with validation", async ({ page }) => {
    await gotoApp(page, "/dashboard/customers");
    await page.getByRole("button", { name: "Nuevo cliente" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog.getByText("Este campo es obligatorio")).toHaveCount(2);

    await dialog.getByLabel("Nombre").fill("E2E Person");
    await dialog.getByLabel("Correo").fill("not-an-email");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog.getByText("Ingresa un correo válido")).toBeVisible();

    await dialog.getByLabel("Correo").fill(`e2e.${Date.now()}@example.com`);
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.request().method() === "POST" && r.url().endsWith("/customers"),
      ),
      dialog.getByRole("button", { name: "Guardar" }).click(),
    ]);
    const { id } = await response.json();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("Cliente creado")).toBeVisible();

    // Remove what this test created so later (visual) tests see the same data
    await page.request.delete(`http://localhost:3000/customers/${id}`);
  });

  test("unknown routes show the 404 page", async ({ page }) => {
    await gotoApp(page, "/dashboard/this/does/not/exist");

    await expect(page.getByText("Página no encontrada").first()).toBeVisible();
    await page.getByRole("link", { name: "Volver al panel" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
