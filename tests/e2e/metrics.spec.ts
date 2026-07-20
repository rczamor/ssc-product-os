import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("Measure screen renders the metric cards, action queue, and health board", async ({
  page,
}) => {
  await login(page);
  await page.goto("/metrics");

  await expect(page.getByRole("heading", { name: "Measure" })).toBeVisible();

  // The action queue surfaces the tripped triggers, with a firing count.
  await expect(page.getByRole("heading", { name: "Action queue" })).toBeVisible();
  await expect(page.getByText(/\d+ firing/)).toBeVisible();

  // Metric cards render by NAME (the id shows as a bare "1".."13", no "#").
  await expect(page.getByText("Feature Adoption Rate").first()).toBeVisible();
  await expect(page.getByText("AI Containment Rate").first()).toBeVisible();

  await expect(page.getByRole("heading", { name: "Feature Portfolio Health" })).toBeVisible();

  // The health board shows all 5 states.
  await expect(page.getByText("Strategic & growing", { exact: true })).toBeVisible();
  await expect(page.getByText("Valuable but hidden", { exact: true })).toBeVisible();
  await expect(page.getByText("Critical to few", { exact: true })).toBeVisible();
  await expect(page.getByText("Shipped, not adopted", { exact: true })).toBeVisible();
  await expect(page.getByText("Legacy / kill candidate", { exact: true })).toBeVisible();

  // Expanding a metric card reveals its action trigger + linked features.
  await page.getByText("Expand details").first().click();
  await expect(page.getByText("Action trigger").first()).toBeVisible();
});

test("nav links to Measure from Plan", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Measure" }).click();
  await expect(page).toHaveURL(/\/metrics$/);
});
