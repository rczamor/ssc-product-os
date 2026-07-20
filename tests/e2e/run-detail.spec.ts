import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("run detail renders deliverable, findings, and screenshots", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "view →" }).first().click();

  await expect(page.getByRole("heading", { name: "Prompt-1 Deliverable" })).toBeVisible();
  await expect(page.getByText("3 things we like")).toBeVisible();
  await expect(page.getByText("5 things we do not like")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kill / Fix / Double Down" })).toBeVisible();
  await expect(page.getByText("First action this week")).toBeVisible();

  // Persona sections with findings.
  await expect(page.getByRole("heading", { name: "Vendor Risk Manager" })).toBeVisible();
  await expect(page.getByText("JTBD:").first()).toBeVisible();

  // The seeded screenshot renders from the bytea-backed endpoint.
  const img = page.locator('img[src^="/api/screenshots/"]').first();
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  const res = await page.request.get(src!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/jpeg");
});

test("reviewer can vote on a finding and approve the matrix", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "view →" }).first().click();

  // Accuracy strip is present.
  await expect(page.getByRole("heading", { name: "AI accuracy & oversight" })).toBeVisible();

  // Every finding shows an Agent/Human origin badge and a review control.
  await expect(page.getByText("Your review").first()).toBeVisible();

  // Cast an up-vote on the first finding.
  const firstAgree = page.getByRole("button", { name: "▲ Agree" }).first();
  await firstAgree.click();
  await expect(firstAgree).toHaveAttribute("aria-pressed", "true");

  // Approve the matrix (two-step confirm), then it shows the approved state.
  await page.getByRole("button", { name: "Approve matrix" }).click();
  await page.getByRole("button", { name: "Confirm approval" }).click();
  await expect(page.getByText("Matrix approved")).toBeVisible();

  // The Linear push control only appears once approved, and the draft materializes.
  await expect(page.getByText("Linear push", { exact: true })).toBeVisible();
  await expect(page.getByText(/tickets drafted from the matrix/)).toBeVisible();
});
