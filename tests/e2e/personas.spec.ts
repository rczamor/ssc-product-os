import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("personas page documents all three personas with corpus", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Personas" }).click();
  await expect(page.getByRole("heading", { name: "Personas & knowledge corpus" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "The Enterprise CISO" })).toBeVisible();
  await expect(page.getByText("Jobs to be done").first()).toBeVisible();

  // Corpus docs are present and expandable, with sources.
  const corpusHeadings = page.getByText(/Knowledge corpus \(\d+ docs\)/);
  await expect(corpusHeadings.first()).toBeVisible();
  const firstDoc = page.locator("details").nth(0);
  await firstDoc.locator("summary").click();

  // Shared corpus section exists.
  await expect(page.getByRole("heading", { name: "Shared corpus" })).toBeVisible();
});
