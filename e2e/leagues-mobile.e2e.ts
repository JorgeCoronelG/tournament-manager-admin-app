import { expect, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeLeagues,
  makeUsers,
  mockLeaguesApi,
  mockUsersApi,
} from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

for (const viewport of viewports) {
  test.describe(`leagues on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await freezeTime(page);
      await mockUsersApi(page, { users: makeUsers(25) });
    });

    test("the page fits, the table does not scroll inside and the manager filter works", async ({
      page,
    }) => {
      const api = await mockLeaguesApi(page, { leagues: makeLeagues(30) });
      await gotoApp(page, "/dashboard/ligas");
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

      await expect(page.locator("app-league-admin-select")).toHaveCount(0);
      await page.getByRole("button", { name: "Filtros" }).click();

      // Focusing opens the options; clicking would fight the sticky toolbar over the field on short screens
      await page.getByLabel("Filtrar por encargado").focus();
      const option = page.getByRole("option").first();
      await expect(option).toBeVisible();
      // The options panel fits in the screen
      const box = await page
        .locator(".mat-mdc-autocomplete-panel")
        .boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        viewport.width,
      );
      await option.click();

      await expect(
        page.getByRole("button", { name: "Filtros, 1 activos" }),
      ).toBeVisible();
      await expect
        .poll(() => api.queries.at(-1)?.get("admin_user_id"))
        .not.toBeNull();

      await page.getByRole("button", { name: "Limpiar", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Filtros", exact: true }),
      ).toBeVisible();
      // The manager's name goes from the field too, not only from the filter
      await expect(page.getByLabel("Filtrar por encargado")).toHaveValue("");
    });

    test("the row menu edits, deactivates and deletes (with confirmation)", async ({
      page,
    }) => {
      const api = await mockLeaguesApi(page, { leagues: makeLeagues(3) });
      await gotoApp(page, "/dashboard/ligas");

      const rows = page.locator("tr[mat-row]");
      await expect(rows).toHaveCount(3);

      await rows.first().getByRole("button", { name: "Acciones" }).click();
      await page.getByRole("menuitem", { name: "Editar" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cancelar" }).click();
      await expect(dialog).toBeHidden();

      await rows.first().getByRole("button", { name: "Acciones" }).click();
      await page.getByRole("menuitem", { name: "Desactivar liga" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Desactivar" })
        .click();
      await expect(page.getByText("Liga desactivada.")).toBeVisible();
      expect(api.statuses).toEqual([{ id: 1, is_active: false }]);

      await rows.first().getByRole("button", { name: "Acciones" }).click();
      await page.getByRole("menuitem", { name: "Eliminar" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Eliminar" })
        .click();
      await expect(page.getByText("Liga eliminada")).toBeVisible();
      expect(api.deleted).toEqual([1]);
      await expect(rows).toHaveCount(2);
    });
  });
}
