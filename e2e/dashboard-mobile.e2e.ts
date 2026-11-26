import { expect, Page, test } from "@playwright/test";
import { gotoApp } from "./support";

/** Per card: its box, the icon's size and whether a word is wider than its label */
async function cards(page: Page) {
  await expect(page.getByText("Partidos esta semana")).toBeVisible();

  return page
    .locator("app-page-layout-content div.grid > div")
    .evaluateAll((elements) =>
      elements.map((card) => {
        const label = card.querySelector<HTMLElement>(".text-secondary")!;
        const range = document.createRange();
        const box = card.getBoundingClientRect();

        return {
          y: Math.round(box.y),
          height: Math.round(box.height),
          right: box.right,
          icon: card.querySelector("button")!.getBoundingClientRect().width,
          cut: (() => {
            range.selectNodeContents(label);

            return range.getBoundingClientRect().width > label.clientWidth + 1;
          })(),
        };
      }),
    );
}

for (const viewport of [
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 599, height: 800 },
]) {
  test(`dashboard cards fit a ${viewport.width}x${viewport.height} phone`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await gotoApp(page);
    const found = await cards(page);

    expect(found).toHaveLength(6);
    for (const card of found) {
      expect(card.right).toBeLessThanOrEqual(viewport.width);
      expect(card.icon).toBe(40);
      expect(card.cut).toBe(false);
      // Cards of a row are as tall as each other
      for (const other of found.filter((o) => o.y === card.y)) {
        expect(other.height).toBe(card.height);
      }
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBe(0);
  });
}

test("dashboard cards keep their size on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoApp(page);

  for (const card of await cards(page)) {
    expect(card.icon).toBe(48);
  }
});
