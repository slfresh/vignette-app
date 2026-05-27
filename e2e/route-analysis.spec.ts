import { test, expect } from "@playwright/test";

test("home page loads route calculator", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "EuroDrive" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Calculate route" })).toBeVisible();
});

test("URL params trigger results section", async ({ page }) => {
  await page.goto("/?from=Munich%2C%20Germany&to=Vienna%2C%20Austria");
  await expect(page.locator('section[aria-live="polite"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/ESTIMATED TOTAL ROAD CHARGES|GESCHÄTZTE STRASSENGEBÜHREN/i)).toBeVisible({ timeout: 30_000 });
});

test("URL params with coordinates trigger results section", async ({ page }) => {
  await page.goto(
    "/?from=Munich%2C%20Germany&to=Vienna%2C%20Austria&from_lat=48.137&from_lon=11.575&to_lat=48.208&to_lon=16.373",
  );
  await expect(page.locator('section[aria-live="polite"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/ESTIMATED TOTAL ROAD CHARGES|GESCHÄTZTE STRASSENGEBÜHREN/i)).toBeVisible({ timeout: 30_000 });
});
