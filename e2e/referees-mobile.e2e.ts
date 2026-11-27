import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp, makeReferees, mockRefereesApi } from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

for (const viewport of viewports) {
  test.describe(`referees on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await freezeTime(page);
    });

    test("the page fits, the table does not scroll inside and the status filter folds", async ({
      page,
    }) => {
      const api = await mockRefereesApi(page, {
        referees: makeReferees(30),
      });
      await gotoApp(page, "/dashboard/arbitros");
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
      await page.getByRole("combobox", { name: "En la liga" }).click();
      await page.getByRole("option", { name: "Inactivo" }).click();
      await expect(
        page.getByRole("button", { name: "Filtros, 1 activos" }),
      ).toBeVisible();
      expect(api.queries.at(-1)?.get("status")).toBe("inactive");

      await page.getByRole("button", { name: "Limpiar", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Filtros", exact: true }),
      ).toBeVisible();
    });

    test("the row menu deactivates, activates and removes (with confirmation)", async ({
      page,
    }) => {
      const api = await mockRefereesApi(page, { referees: makeReferees(1) });
      await gotoApp(page, "/dashboard/arbitros");

      const rows = page.locator("tr[mat-row]");
      await expect(rows).toHaveCount(1);
      const menu = () =>
        rows.first().getByRole("button", { name: "Acciones" }).click();

      await menu();
      await page
        .getByRole("menuitem", { name: "Dar de baja en la liga" })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Desactivar" })
        .click();
      await expect(rows.first()).toContainText("Inactivo");
      expect(api.statusChanges).toEqual([{ id: 1, status: "inactive" }]);

      // Activating does not ask
      await menu();
      await page
        .getByRole("menuitem", { name: "Dar de alta en la liga" })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(rows.first()).toContainText("Activo");

      await menu();
      await page.getByRole("menuitem", { name: "Quitar de la liga" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Quitar" })
        .click();
      await expect(page.getByText("Aún no hay registros.")).toBeVisible();
      expect(api.removed).toEqual([1]);
    });
  });
}
