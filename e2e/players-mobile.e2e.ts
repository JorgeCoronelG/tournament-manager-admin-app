import { expect, test, type Page } from "@playwright/test";
import { freezeTime, gotoApp, makePlayers, mockPlayersApi } from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

/** The open dialog has no horizontal overflow and its buttons are on screen */
async function expectDialogFits(page: Page, width: number, height: number) {
  const dialog = page.locator(".mat-mdc-dialog-panel");
  await expect(dialog).toBeVisible();

  const sizes = await dialog.evaluate((panel) => {
    const content = panel.querySelector(".mat-mdc-dialog-content");
    const box = panel.getBoundingClientRect();
    const actions = panel
      .querySelector(".mat-mdc-dialog-actions")
      ?.getBoundingClientRect();

    return {
      left: box.left,
      right: box.right,
      contentX: content ? content.scrollWidth - content.clientWidth : 0,
      actionsBottom: actions?.bottom ?? 0,
      pageX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });

  expect(sizes.left).toBeGreaterThanOrEqual(0);
  expect(sizes.right).toBeLessThanOrEqual(width);
  expect(sizes.contentX).toBeLessThanOrEqual(0);
  expect(sizes.pageX).toBeLessThanOrEqual(0);
  expect(sizes.actionsBottom).toBeLessThanOrEqual(height);
}

for (const viewport of viewports) {
  test.describe(`players on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await freezeTime(page);
    });

    test("the page fits, there is no add button and the filters fold", async ({
      page,
    }) => {
      const api = await mockPlayersApi(page, { players: makePlayers(30) });
      await gotoApp(page, "/dashboard/jugadores");
      await expect(page.locator("tr[mat-row]")).toHaveCount(10);
      await expect(page.getByRole("button", { name: /Agregar/ })).toHaveCount(
        0,
      );

      // The page does not overflow; only the wide table scrolls sideways
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

      await page.getByRole("combobox", { name: "Rama" }).click();
      await page.getByRole("option", { name: "Femenil" }).click();
      await page.getByRole("combobox", { name: "Estado" }).click();
      await page.getByRole("option", { name: "Vetado" }).click();
      await expect(
        page.getByRole("button", { name: "Filtros, 2 activos" }),
      ).toBeVisible();
      expect(api.queries.at(-1)?.get("gender")).toBe("female");
      expect(api.queries.at(-1)?.get("banned")).toBe("true");

      await page.getByRole("button", { name: "Limpiar", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Filtros", exact: true }),
      ).toBeVisible();
    });

    test("the menu opens the detail, changes the branch and bans and reactivates", async ({
      page,
    }) => {
      const api = await mockPlayersApi(page, { players: makePlayers(5) });
      await gotoApp(page, "/dashboard/jugadores");

      const rows = page.locator("tr[mat-row]");
      await expect(rows).toHaveCount(5);
      // Sorted by name: the first row is "Ana", player 1
      const menu = () =>
        rows.first().getByRole("button", { name: "Acciones" }).click();

      // The detail has rosters and long names: it must still fit
      await menu();
      await page.getByRole("menuitem", { name: "Ver detalle" }).click();
      await expect(page.getByText("Halcones del Norte")).toBeVisible();
      await expectDialogFits(page, viewport.width, viewport.height);
      await page.getByRole("button", { name: "Cerrar" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await menu();
      await page.getByRole("menuitem", { name: "Corregir rama" }).click();
      await expectDialogFits(page, viewport.width, viewport.height);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancelar" })
        .click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await menu();
      await page.getByRole("menuitem", { name: "Vetar" }).click();
      const dialog = page.getByRole("dialog");
      await expectDialogFits(page, viewport.width, viewport.height);
      await dialog.getByLabel("Motivo").fill("Conducta antideportiva grave");
      await dialog.getByRole("button", { name: "Vetar" }).click();
      await expect(dialog).toBeHidden();
      expect(api.banned).toEqual([1]);

      await menu();
      await page.getByRole("menuitem", { name: "Reactivar" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Reactivar" })
        .click();
      await expect(page.getByText("Jugador reactivado.")).toBeVisible();
      expect(api.unbanned).toEqual([1]);
    });
  });
}
