import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("dashboard shows the seeded run with counts", async ({ page }) => {
  await login(page);
  const row = page.locator("tbody tr").first();
  await expect(row).toContainText("completed");
  await expect(row).toContainText("CISO");
  await expect(row).toContainText("✓"); // deliverable present
});

test("queueing a run request from the UI adds it to the queue", async ({ page }) => {
  await login(page);
  await page.getByPlaceholder("Note (optional)").fill("e2e enqueue test");
  await page.getByRole("button", { name: "Queue run" }).click();
  await expect(page.getByText("Queued. The agent worker picks requests up")).toBeVisible();
  await expect(page.getByText("e2e enqueue test")).toBeVisible();
  const badge = page
    .locator("li", { hasText: "e2e enqueue test" })
    .first()
    .getByText("queued", { exact: true });
  await expect(badge).toBeVisible();
});
