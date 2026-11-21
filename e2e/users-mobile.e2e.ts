import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp, makeUsers, mockUsersApi } from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

for (const viewport of viewports) {
  test.describe(`users on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await freezeTime(page);
    });

    test("the page fits, the table does not scroll inside and filters fold", async ({
      page,
    }) => {
      await mockUsersApi(page, { users: makeUsers(30) });
      await gotoApp(page, "/dashboard/usuarios");
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
      await expect(page.locator("mat-select")).toHaveCount(2);
      await page.getByRole("button", { name: "Filtros" }).click();
      await expect(page.locator("mat-select")).toHaveCount(0);
    });

    test("the row menu edits and deletes (with confirmation)", async ({
      page,
    }) => {
      const api = await mockUsersApi(page, { users: makeUsers(3) });
      await gotoApp(page, "/dashboard/usuarios");

      const rows = page.locator("tr[mat-row]");
      await expect(rows).toHaveCount(3);

      await rows.first().getByRole("button", { name: "Acciones" }).click();
      await page.getByRole("menuitem", { name: "Editar" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cancelar" }).click();
      await expect(dialog).toBeHidden();

      await rows.first().getByRole("button", { name: "Acciones" }).click();
      await page.getByRole("menuitem", { name: "Eliminar" }).click();
      await expect(page.getByRole("dialog")).toContainText(
        "¿Seguro que quieres eliminar a Ana Pérez?",
      );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Eliminar" })
        .click();

      await expect(page.getByText("Usuario eliminado")).toBeVisible();
      expect(api.deleted).toEqual([1]);
      await expect(rows).toHaveCount(2);
    });
  });
}
