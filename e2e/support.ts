import { Page } from "@playwright/test";

/** A fixed "now" so relative dates ("3 months ago") never change between runs */
export const FIXED_NOW = new Date("2026-09-19T12:00:00Z");

export async function freezeTime(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_NOW);
}

/** Waits for the splash screen to disappear and the layout to be ready */
export async function gotoApp(page: Page, path = "/"): Promise<void> {
  await page.goto(path);
  await page.locator("#app-splash-screen").waitFor({ state: "detached" });
  await page.locator("app-sidenav").waitFor();
}
