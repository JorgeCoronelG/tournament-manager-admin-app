import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test.describe("sidenav", () => {
  test("the collapsed sidenav has no horizontal scrollbar", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Contraer barra lateral" }).click();
    await expect(page.locator(".app-sidenav.collapsed")).toBeVisible();

    // A collapsed sidenav stays open while it is hovered, and the real
    // `mouseleave` is sometimes lost after the click (the pointer is gone, the
    // sidenav stays open). This test is about the scrollbar, not the hover, so
    // close it deterministically.
    await page.mouse.move(900, 400);
    await page.locator(".app-sidenav").dispatchEvent("mouseleave");

    const container = page.locator(".mat-drawer-inner-container");
    await expect
      .poll(async () => (await container.boundingBox())?.width)
      .toBeLessThan(100);

    const overflow = await container.evaluate((element) => ({
      overflowX: getComputedStyle(element).overflowX,
      scrollable: element.scrollWidth > element.clientWidth,
    }));

    expect(overflow.overflowX).toBe("hidden");
    expect(overflow.scrollable).toBe(true);
  });
});
