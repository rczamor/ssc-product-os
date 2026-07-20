import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("work screen renders with Kanban/timeline toggle and internal/external filter", async ({
  page,
}) => {
  await login(page);
  await page.goto("/work");

  await expect(page.getByRole("heading", { name: "Work" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kanban" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Timeline" })).toBeVisible();
  await expect(page.getByRole("button", { name: "External (product)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Internal (OS + role)" })).toBeVisible();

  // No LINEAR_API_KEY in the e2e env and nothing synced yet, so the empty state renders.
  await expect(page.getByText("No Linear issues cached yet")).toBeVisible();

  // Switching views/filters doesn't error even with an empty board.
  await page.getByRole("button", { name: "Timeline" }).click();
  await page.getByRole("button", { name: "Internal (OS + role)" }).click();
  await expect(page.getByRole("heading", { name: "Work" })).toBeVisible();
});

test("nav links to Work from Planning", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Work" }).click();
  await expect(page).toHaveURL(/\/work$/);
});

test("Friday Update generates from the live board + dataset and regenerates cleanly", async ({ page }) => {
  await login(page);
  await page.goto("/work");

  await expect(page.getByRole("heading", { name: "Friday Product & Engineering Update" })).toBeVisible();
  await expect(page.getByText("Not generated yet.")).toBeVisible();

  await page.getByRole("button", { name: "Generate update" }).click();
  await expect(page.getByText(/^Generated /)).toBeVisible();
  await expect(page.getByText("Customer impact")).toBeVisible();
  await expect(page.getByText("One win to celebrate")).toBeVisible();

  // Regenerating replaces cleanly: still exactly one Friday Update section, not a duplicate.
  await page.getByRole("button", { name: "Regenerate update" }).click();
  await expect(page.getByRole("heading", { name: "Friday Product & Engineering Update" })).toHaveCount(1);
  await expect(page.getByText(/^Generated /)).toHaveCount(1);
});
