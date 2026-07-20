import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("persona detail route documents the CISO persona", async ({ page }) => {
  await login(page);
  // There is no "Personas" nav link anymore (3-tab nav) — navigate directly to
  // the persona detail view reached from the Plan persona chips.
  await page.goto("/personas/ciso");

  await expect(page.getByRole("heading", { name: "The Enterprise CISO" })).toBeVisible();

  // The JTBD switching equation.
  await expect(page.getByRole("heading", { name: "Forces of Progress" })).toBeVisible();

  // The matrix findings tied to this persona, and the grounding corpus.
  await expect(page.getByText("Matrix findings impacting this persona")).toBeVisible();
  await expect(page.getByText("Reference documents")).toBeVisible();
});

test("the /personas index still loads", async ({ page }) => {
  await login(page);
  await page.goto("/personas");
  await expect(
    page.getByRole("heading", { name: "Personas & knowledge corpus" }),
  ).toBeVisible();
});
