import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("run detail renders deliverable, findings, and screenshots", async ({ page }) => {
  await login(page);

  // The Plan page no longer has "view →" links (the eval-runs table is gone), so
  // navigate to the run detail directly using an id from the API.
  const res = await page.request.get("/api/runs");
  expect(res.status()).toBe(200);
  const { runs } = (await res.json()) as { runs: Array<{ id: string }> };
  expect(runs.length).toBeGreaterThan(0);
  await page.goto(`/runs/${runs[0].id}`);

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
  const shot = await page.request.get(src!);
  expect(shot.status()).toBe(200);
  expect(shot.headers()["content-type"]).toBe("image/jpeg");
});

test("reviewer can vote on a finding and approve the matrix on the Plan screen", async ({
  page,
}) => {
  await login(page);
  // The vote/approve controls now live on the Plan screen (`/`).

  // The AI accuracy & oversight strip is present.
  await expect(page.getByText("AI accuracy & oversight").first()).toBeVisible();

  // Every finding carries a "Your review" up/down control.
  await expect(page.getByText("Your review").first()).toBeVisible();

  // Cast an up-vote (▲ / aria-label "Agree") on the first finding; it registers.
  const firstAgree = page.getByRole("button", { name: "Agree" }).first();
  await firstAgree.click();
  await expect(firstAgree).toHaveAttribute("aria-pressed", "true");

  // Approval is a single click that also creates the tickets ("Approve & create
  // tickets →"). With no LINEAR_API_KEY in e2e the push degrades to a message, but
  // the run still transitions to approved.
  const approve = page.getByRole("button", { name: /Approve & create tickets/ });
  if (await approve.isVisible().catch(() => false)) {
    await approve.click();
  }
  await expect(page.getByText("Matrix approved")).toBeVisible();
});
