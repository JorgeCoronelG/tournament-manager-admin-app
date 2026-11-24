import { expect, test } from "@playwright/test";
import {
  freezeTime,
  gotoApp,
  makeTournaments,
  mockTournamentsApi,
} from "./support";

const viewports = [
  { width: 375, height: 667 },
  { width: 360, height: 640 },
];

for (const viewport of viewports) {
  test.describe(`tournaments on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await freezeTime(page);
    });

    test("the page fits, the table does not scroll inside and the filters fold", async ({
      page,
    }) => {
      const api = await mockTournamentsApi(page, {
        tournaments: makeTournaments(30),
      });
      await gotoApp(page, "/dashboard/torneos");
      await expect(page.locator("tr[mat-row]")).toHaveCount(10);
      await expect(page.getByText("Torneos activos 1 de 3")).toBeVisible();

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
      await expect(
        page.getByRole("button", { name: "Nuevo torneo" }),
      ).toBeVisible();

      await expect(page.locator("mat-form-field mat-select")).toHaveCount(0);
      await page.getByRole("button", { name: "Filtros" }).click();
      await page.getByRole("combobox", { name: "Género" }).click();
      await page.getByRole("option", { name: "Femenil" }).click();
      await page.getByRole("combobox", { name: "Estado" }).click();
      await page.getByRole("option", { name: "En curso" }).click();
      await expect(
        page.getByRole("button", { name: "Filtros, 2 activos" }),
      ).toBeVisible();
      expect(api.queries.at(-1)?.get("gender")).toBe("female");
      expect(api.queries.at(-1)?.get("status")).toBe("in_progress");

      await page.getByRole("button", { name: "Limpiar", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Filtros", exact: true }),
      ).toBeVisible();
    });

    test("the row menu edits, starts and deletes (with confirmation)", async ({
      page,
    }) => {
      const api = await mockTournamentsApi(page, {
        tournaments: makeTournaments(3),
      });
      await gotoApp(page, "/dashboard/torneos");

      const rows = page.locator("tr[mat-row]");
      await expect(rows).toHaveCount(3);
      // Newest first: planning, in progress, finished (no menu)
      await expect(rows.nth(2).getByRole("button")).toHaveCount(0);

      await rows.first().getByRole("button", { name: "Acciones" }).click();
      await page.getByRole("menuitem", { name: "Editar" }).click();
      await expect(page.getByRole("dialog")).toContainText("Editar torneo");
      await page.getByRole("button", { name: "Cancelar" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await rows.first().getByRole("button", { name: "Acciones" }).click();
      await page.getByRole("menuitem", { name: "Iniciar torneo" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Iniciar" })
        .click();
      await expect(rows.first()).toContainText("En curso");
      expect(api.statusChanges).toEqual([{ id: 1, status: "in_progress" }]);

      await rows.first().getByRole("button", { name: "Acciones" }).click();
      await expect(
        page.getByRole("menuitem", { name: "Finalizar torneo" }),
      ).toBeVisible();
      await expect(
        page.getByRole("menuitem", { name: "Eliminar" }),
      ).toHaveCount(0);
      await page.keyboard.press("Escape");
    });

    test("a planned tournament is deleted from the menu after confirming", async ({
      page,
    }) => {
      const api = await mockTournamentsApi(page, {
        tournaments: makeTournaments(1),
      });
      await gotoApp(page, "/dashboard/torneos");

      const rows = page.locator("tr[mat-row]");
      await expect(rows).toHaveCount(1);
      await rows.first().getByRole("button", { name: "Acciones" }).click();
      await page.getByRole("menuitem", { name: "Eliminar" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Eliminar" })
        .click();
      await expect(page.getByText("Aún no hay registros.")).toBeVisible();
      expect(api.deleted).toEqual([1]);
    });

    test("the form scrolls inside, keeps its title and buttons and has no horizontal scroll", async ({
      page,
    }) => {
      await mockTournamentsApi(page);
      await gotoApp(page, "/dashboard/torneos");

      await page.getByRole("button", { name: "Nuevo torneo" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("tab", { name: "Configuración" }).click();

      const metrics = await dialog.evaluate((el) => {
        const content = el.querySelector("mat-dialog-content") as HTMLElement;
        const box = el.getBoundingClientRect();

        return {
          contentY: content.scrollHeight - content.clientHeight,
          contentX: content.scrollWidth - content.clientWidth,
          dialogX: el.scrollWidth - el.clientWidth,
          fits: box.left >= 0 && box.right <= window.innerWidth,
        };
      });
      expect(metrics.contentX).toBeLessThanOrEqual(0);
      expect(metrics.dialogX).toBeLessThanOrEqual(0);
      expect(metrics.fits).toBe(true);

      // Fields in one column: min and max age stack
      const min = await dialog.getByLabel("Edad mínima").boundingBox();
      const max = await dialog.getByLabel("Edad máxima").boundingBox();
      expect(max!.y).toBeGreaterThan(min!.y + min!.height - 1);

      // With the keyboard open the visible height shrinks: the actions stay in view
      await page.setViewportSize({
        width: viewport.width,
        height: 300,
      });
      await expect(dialog.getByRole("heading")).toBeInViewport();
      await expect(
        dialog.getByRole("button", { name: "Guardar" }),
      ).toBeInViewport();
      await expect(
        dialog.getByRole("button", { name: "Cancelar" }),
      ).toBeInViewport();
      const scrolls = await dialog.evaluate((el) => {
        const content = el.querySelector("mat-dialog-content") as HTMLElement;

        return content.scrollHeight > content.clientHeight;
      });
      expect(scrolls).toBe(true);
    });
  });
}
