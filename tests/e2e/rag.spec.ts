import { expect, test } from "@playwright/test";
import { dismissOnboardingExplore, openMobileMenuIfNeeded, prepareFreshVisit } from "./helpers/app";

test("documents workspace opens from sidebar", async ({ page }) => {
  await prepareFreshVisit(page);
  await dismissOnboardingExplore(page);
  await openMobileMenuIfNeeded(page);

  await page.getByRole("button", { name: /Documents/i }).click();
  await expect(page.getByRole("heading", { name: /Espaces de documents|Document spaces/i })).toBeVisible();
});
