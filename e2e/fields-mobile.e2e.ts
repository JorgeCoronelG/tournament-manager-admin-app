import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp, makeFields, mockFieldsApi } from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

for (const viewport of viewports) {
  test.describe(`fields on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await freezeTime(page);
    });

    test("the page fits, the table does not scroll inside and the status filter folds", async ({
      page,
    }) => {
      const api = await mockFieldsApi(page, { fields: makeFields(30) });
      await gotoApp(page, "/dashboard/canchas");
      await expect(page.locator("tr[mat-row]")).toHaveCount(10);

      const sizes = await page.evaluate(() => {
        const scroll = document.querySelector(".app-table-scroll");

        return {
          pageX:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          tableY: scroll ? scroll.scrollHeight - scroll.clientHeight : 0,
        };
      });
      expect(sizes.pageX).toBeLessThanOrEqual(0);
      expect(sizes.tableY).toBeLessThanOrEqual(0);

      await expect(page.locator("mat-select")).toHaveCount(0);
      await page.getByRole("button", { name: "Filtros" }).click();
      await page.getByRole("combobox", { name: "Estado" }).click();
      await page.getByRole("option", { name: "Inactiva" }).click();
      await expect(
        page.getByRole("button", { name: "Filtros, 1 activos" }),
      ).toBeVisible();
      expect(api.queries.at(-1)?.get("status")).toBe("inactive");

      await page.getByRole("button", { name: "Limpiar", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Filtros", exact: true }),
      ).toBeVisible();
    });

    test("the row menu edits, deactivates, activates and deletes (with confirmation)", async ({
      page,
    }) => {
      const api = await mockFieldsApi(page, { fields: makeFields(2) });
      await gotoApp(page, "/dashboard/canchas");

      const rows = page.locator("tr[mat-row]");
      await expect(rows).toHaveCount(2);
      const menu = () =>
        rows.first().getByRole("button", { name: "Acciones" }).click();

      await menu();
      await page.getByRole("menuitem", { name: "Editar" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cancelar" }).click();
      await expect(dialog).toBeHidden();

      await menu();
      await page.getByRole("menuitem", { name: "Desactivar" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Desactivar" })
        .click();
      await expect(rows.first()).toContainText("Inactiva");
      expect(api.statusChanges).toEqual([{ id: 1, status: "inactive" }]);

      // Activating does not ask
      await menu();
      await page.getByRole("menuitem", { name: "Activar" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(rows.first()).toContainText("Activa");

      await menu();
      await page.getByRole("menuitem", { name: "Eliminar" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Eliminar" })
        .click();
      await expect(rows).toHaveCount(1);
      expect(api.deleted).toEqual([1]);
    });
  });
}
