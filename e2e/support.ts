import { Page } from "@playwright/test";

/** A fixed "now" so relative dates ("3 months ago") never change between runs */
export const FIXED_NOW = new Date("2026-09-19T12:00:00Z");

export async function freezeTime(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_NOW);
}

/**
 * `/dashboard/**` is behind `authGuard`, which checks the stored token against
 * `GET /user` (see `AuthSessionService`). There is no auth backend in the e2e
 * stack, so we seed a fake token and stub that request instead.
 */
async function mockSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("app.auth.token", "e2e-fake-token");
  });

  // Empty names/photo_url/role name keep the "Guest" look the screenshots were baselined with;
  // the superadmin role is what shows the whole menu
  await page.route("http://localhost:8000/api/user", (route) =>
    route.fulfill({
      json: {
        id: 1,
        first_name: "",
        last_name: "",
        email: "e2e@example.com",
        photo_url: "",
        roles: [{ id: 1, code: "superadmin", name: "" }],
      },
    }),
  );
}

/** Waits for the splash screen to disappear and, for pages inside the layout, for it to be ready */
export async function gotoApp(page: Page, path = "/dashboard"): Promise<void> {
  if (path.startsWith("/dashboard")) {
    await mockSession(page);
  }

  await page.goto(path);
  await page.locator("#app-splash-screen").waitFor({ state: "detached" });
  if (path.startsWith("/dashboard")) {
    await page.locator("app-sidenav").waitFor();
  }
}
