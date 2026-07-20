import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, login } from "./helpers";

test("unauthenticated visitors are redirected to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/runs/00000000-0000-4000-8000-000000000000");
  await expect(page).toHaveURL(/\/login$/);
});

test("unauthenticated API calls get 401", async ({ request }) => {
  const res = await request.get("/api/runs");
  expect(res.status()).toBe(401);
});

test("wrong password shows an error and stays on login", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Admin email").fill(ADMIN_EMAIL);
  await page.getByPlaceholder("Admin password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("wrong email or password")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("right password lands on the dashboard", async ({ page }) => {
  await login(page);
  // The dashboard is now the Plan screen — the eval-runs trigger UI is gone.
  await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();
  await expect(page.getByText("Feedback sources")).toBeVisible();
});
