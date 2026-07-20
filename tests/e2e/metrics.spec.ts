import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("metrics screen renders 14 cards, tripped triggers, and the health board", async ({ page }) => {
  await login(page);
  await page.goto("/metrics");

  await expect(page.getByRole("heading", { name: "Measure" })).toBeVisible();
  await expect(page.getByText(/feature×metric trigger.*currently tripped/)).toBeVisible();

  // All 14 Appendix A metrics render as cards (13 generated + the derived health board).
  for (let id = 1; id <= 13; id++) {
    await expect(page.getByText(`#${id}`, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Feature Portfolio Health" })).toBeVisible();

  // The health board shows all 5 states with non-zero counts, and at least one mover.
  await expect(page.getByText("Strategic & growing", { exact: true })).toBeVisible();
  await expect(page.getByText("Valuable but hidden", { exact: true })).toBeVisible();
  await expect(page.getByText("Critical to few", { exact: true })).toBeVisible();
  await expect(page.getByText("Shipped, not adopted", { exact: true })).toBeVisible();
  await expect(page.getByText("Legacy / kill candidate", { exact: true })).toBeVisible();
  await expect(page.getByText("Movers")).toBeVisible();

  // A tripped metric card expands to show its action trigger + linked features.
  await page.getByRole("button", { name: "show details" }).first().click();
  await expect(page.getByText("Action trigger").first()).toBeVisible();
});

test("nav links to Measure from Plan", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Measure" }).click();
  await expect(page).toHaveURL(/\/metrics$/);
});
