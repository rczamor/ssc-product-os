import { expect, type Page } from "@playwright/test";

export const ADMIN_PASSWORD = "test-password";

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("Admin password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Evaluation runs" })).toBeVisible();
}
