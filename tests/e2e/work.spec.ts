import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("work screen renders the track/view toggles and the timeline lanes", async ({ page }) => {
  await login(page);
  await page.goto("/work");

  await expect(page.getByRole("heading", { name: "Work", exact: true })).toBeVisible();

  // Track toggle is ProductOS / SSC Platform; view toggle is Timeline / Kanban.
  await expect(page.getByRole("button", { name: "ProductOS" })).toBeVisible();
  await expect(page.getByRole("button", { name: "SSC Platform" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Timeline" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kanban" })).toBeVisible();

  // No LINEAR_API_KEY in the e2e env and nothing synced yet, so the (empty)
  // timeline lanes render — including the "This quarter" axis label — with no
  // "No Linear issues cached yet" empty-state text.
  await expect(page.getByText("This quarter").first()).toBeVisible();

  // Switching views/tracks doesn't error even with an empty board.
  await page.getByRole("button", { name: "Kanban" }).click();
  await page.getByRole("button", { name: "SSC Platform" }).click();
  await page.getByRole("button", { name: "Timeline" }).click();
  await page.getByRole("button", { name: "ProductOS" }).click();
  await expect(page.getByRole("heading", { name: "Work", exact: true })).toBeVisible();

  // The Shipped lane is pinned to the bottom of the timeline (its label + the
  // "This quarter" lane above it both render even on an empty board).
  await expect(page.getByText("Shipped", { exact: true }).first()).toBeVisible();

  // The "How We Work" operating-system section renders below the board.
  await expect(page.getByRole("heading", { name: "How We Work" })).toBeVisible();
  await expect(page.getByText("Change Control Board").first()).toBeVisible();
});

test("nav links to Work from Planning", async ({ page }) => {
  await login(page);
  // Exact match: once the matrix is approved (a prior test in the shared-DB
  // suite), the Plan page also renders a "View on Work board →" link, so a
  // substring match on "Work" would be ambiguous. The nav link is exactly "Work".
  await page.getByRole("link", { name: "Work", exact: true }).click();
  await expect(page).toHaveURL(/\/work$/);
});

test("Friday Update generates in the slide-over and can be closed", async ({ page }) => {
  await login(page);
  await page.goto("/work");

  // The Friday Update is now a right slide-over opened from the header button.
  await page.getByRole("button", { name: "Generate Update" }).click();

  await expect(
    page.getByRole("heading", { name: "Product & Engineering Update" }),
  ).toBeVisible();

  // It auto-generates from the live board + dataset: a generated timestamp plus
  // the impact/win sections become visible.
  await expect(page.getByText(/generated/)).toBeVisible();
  await expect(page.getByText("Customer impact")).toBeVisible();
  await expect(page.getByText("One win to celebrate")).toBeVisible();

  // The slide-over closes.
  await page.getByRole("button", { name: "✕" }).click();
  await expect(
    page.getByRole("heading", { name: "Product & Engineering Update" }),
  ).toHaveCount(0);
});
