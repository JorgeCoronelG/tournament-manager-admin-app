import { expect, test } from "@playwright/test";
import { gotoApp } from "./support";

test.describe("sidenav", () => {
  test("the collapsed sidenav has no horizontal scrollbar", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "Contraer barra lateral" }).click();
    await page.mouse.move(900, 400);

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
