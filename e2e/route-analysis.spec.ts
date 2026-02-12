import { test, expect } from "@playwright/test";

test("home page loads route calculator", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "European Vignette Portal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Calculate route" })).toBeVisible();
});
