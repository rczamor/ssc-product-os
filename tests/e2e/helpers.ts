import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@example.com";
export const ADMIN_PASSWORD = "test-password";

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("Admin email").fill(ADMIN_EMAIL);
  await page.getByPlaceholder("Admin password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  // After login the app lands on the Plan screen.
  await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();
}
