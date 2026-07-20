import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("Plan screen surfaces the seeded run and its themes matrix", async ({ page }) => {
  await login(page);

  // The "Last ran" card reflects the seeded, completed run.
  await expect(page.getByText("Last ran")).toBeVisible();
  await expect(page.getByText("completed", { exact: true })).toBeVisible();

  // The Themes matrix renders both the work / don't-work sections…
  await expect(page.getByText("Things that work")).toBeVisible();
  await expect(page.getByText(/Things that don.t/)).toBeVisible();
  // …and at least one seeded finding title.
  await expect(page.getByText("A-F letter grade is instantly board-legible")).toBeVisible();
});

test("Plan screen shows the compact feedback-sources chip row and emerging themes", async ({
  page,
}) => {
  await login(page);

  // The feedback panel is now a compact "FEEDBACK SOURCES" chip row.
  await expect(page.getByText("Feedback sources")).toBeVisible();
  // A connected scraped source (seeded) renders with the "scraped" tag.
  await expect(page.getByText("scraped").first()).toBeVisible();

  // Emerging themes are surfaced strictly as proposals pending approval.
  await expect(page.getByRole("heading", { name: "Emerging themes" })).toBeVisible();
  await expect(page.getByText("pending approval").first()).toBeVisible();
});
