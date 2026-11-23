import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp, makeTeams, mockTeamsApi } from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

for (const viewport of viewports) {
  test.describe(`teams on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await freezeTime(page);
    });

    test("the page fits, the table does not scroll inside and the filters fold", async ({
      page,
    }) => {
      const api = await mockTeamsApi(page, { teams: makeTeams(30) });
      await gotoApp(page, "/dashboard/equipos");
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

      await page.getByRole("combobox", { name: "Estado" }).click();
      await page.getByRole("option", { name: "Vetado" }).click();
      await expect(
        page.getByRole("button", { name: "Filtros, 1 activos" }),
      ).toBeVisible();
      expect(api.queries.at(-1)?.get("status")).toBe("banned");

      await page.getByRole("button", { name: "Limpiar", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Filtros", exact: true }),
      ).toBeVisible();
    });

    test("the menu shows all seven actions inside the screen and edits and deletes", async ({
      page,
    }) => {
      // The second team has a delegate with a pending account: every action applies
      const api = await mockTeamsApi(page, { teams: makeTeams(3) });
      await gotoApp(page, "/dashboard/equipos");

      const rows = page.locator("tr[mat-row]");
      await expect(rows).toHaveCount(3);

      await rows.nth(1).getByRole("button", { name: "Acciones" }).click();
      const items = page.getByRole("menuitem");
      await expect(items).toHaveText([
        "Editar",
        "Cambiar delegado",
        "Editar datos del delegado",
        "Reenviar invitación",
        "Quitar delegado",
        "Vetar",
        "Eliminar",
      ]);
      await expect(page.locator("mat-divider")).toHaveCount(1);

      const box = await page.locator(".mat-mdc-menu-panel").boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        viewport.width,
      );
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        viewport.height,
      );

      await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cancelar" }).click();
      await expect(dialog).toBeHidden();

      await rows.first().getByRole("button", { name: "Acciones" }).click();
      await page.getByRole("menuitem", { name: "Eliminar" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Eliminar" })
        .click();
      await expect(rows).toHaveCount(2);
      expect(api.deleted).toEqual([1]);
    });
  });
}
