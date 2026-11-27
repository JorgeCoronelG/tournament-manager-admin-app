import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test.describe("dialogs on phones", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("the change-password dialog has no horizontal scroll", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.locator(".app-sidenav-user").click();
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();

    // The drawer closes so it does not stay open behind the dialog
    await expect(page.locator(".mat-drawer-opened")).toHaveCount(0);

    const dialog = page.locator(".mat-mdc-dialog-panel");
    await expect(dialog).toBeVisible();

    const sizes = await dialog.evaluate((panel) => {
      const content = panel.querySelector(".mat-mdc-dialog-content");
      return {
        panel: panel.getBoundingClientRect().width,
        contentScroll: content ? content.scrollWidth - content.clientWidth : 0,
        page:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      };
    });

    expect(sizes.panel).toBeLessThanOrEqual(360 - 32);
    expect(sizes.contentScroll).toBeLessThanOrEqual(0);
    expect(sizes.page).toBeLessThanOrEqual(0);
  });
});
