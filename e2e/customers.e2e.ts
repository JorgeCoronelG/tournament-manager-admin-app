import { expect, test } from "@playwright/test";
import { freezeTime, gotoApp } from "./support";

test.describe("dashboard and customers", () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page);
    await page.addInitScript(() => localStorage.setItem("app.lang", "en"));
  });

  test("the dashboard shows the customer statistics from the API", async ({
    page,
  }) => {
    await gotoApp(page);

    await expect(page).toHaveTitle(/Dashboard/);
    await expect(page.getByText("Total customers")).toBeVisible();
    await expect(page.getByText("Recent customers")).toBeVisible();
    await expect(page.locator("li a")).toHaveCount(5);
  });

  test("the list can be searched, filtered, sorted and paginated", async ({
    page,
  }) => {
    await gotoApp(page, "/customers");

    const rows = page.locator("tr[mat-row]");
    const range = page.locator(".mat-mdc-paginator-range-label");

    await expect(rows).toHaveCount(10);
    await expect(range).toContainText("of");

    await page.getByRole("searchbox").fill("García");
    await expect(range).toHaveText(/1 – \d of \d/);
    await expect(rows.first()).toContainText("García");

    await page.getByRole("searchbox").fill("zzzzzz");
    await expect(
      page.getByText("No customers match your search."),
    ).toBeVisible();
    await page.getByRole("searchbox").fill("");

    // Wait for each panel to be gone before opening it again
    const chooseStatus = async (option: string) => {
      await page.getByRole("combobox", { name: "Status" }).click();
      await page.getByRole("option", { name: option, exact: true }).click();
      await expect(page.getByRole("listbox")).toBeHidden();
    };

    await chooseStatus("Inactive");
    await expect(rows.first()).toContainText("Inactive");

    await chooseStatus("All");

    const firstBefore = await rows.first().locator("a").textContent();
    await page.getByRole("button", { name: "Name" }).click();
    await expect(rows.first().locator("a")).not.toHaveText(firstBefore ?? "");

    await page.getByRole("button", { name: "Next page" }).click();
    await expect(range).toContainText("11 –");
  });

  test("a customer can be opened and a missing one is handled", async ({
    page,
  }) => {
    await gotoApp(page, "/customers");
    await page.locator("tr[mat-row] a").first().click();

    await expect(page).toHaveURL(/\/customers\/\d+$/);
    await expect(page.getByText("Company", { exact: true })).toBeVisible();

    await gotoApp(page, "/customers/99999");
    await expect(page.getByText("This customer does not exist.")).toBeVisible();
  });

  test("a customer can be created, with validation", async ({ page }) => {
    await gotoApp(page, "/customers");
    await page.getByRole("button", { name: "New customer" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("This field is required")).toHaveCount(2);

    await dialog.getByLabel("Name").fill("E2E Person");
    await dialog.getByLabel("Email").fill("not-an-email");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Enter a valid email address")).toBeVisible();

    await dialog.getByLabel("Email").fill(`e2e.${Date.now()}@example.com`);
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.request().method() === "POST" && r.url().endsWith("/customers"),
      ),
      dialog.getByRole("button", { name: "Save" }).click(),
    ]);
    const { id } = await response.json();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("Customer created")).toBeVisible();

    // Remove what this test created so later (visual) tests see the same data
    await page.request.delete(`http://localhost:3000/customers/${id}`);
  });

  test("unknown routes show the 404 page", async ({ page }) => {
    await gotoApp(page, "/this/does/not/exist");

    await expect(page.getByText("Page not found").first()).toBeVisible();
    await page.getByRole("link", { name: "Back to the dashboard" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
