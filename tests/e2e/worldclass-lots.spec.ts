import { expect, test } from "@playwright/test";
import {
  dismissOnboardingExplore,
  openMobileMenuIfNeeded,
  openSettings,
  prepareApp,
  prepareFreshVisit,
  resetMocks,
} from "./helpers/app";

test.beforeEach(async ({ page }) => {
  await resetMocks(page);
});

test("local AI hub opens from sidebar", async ({ page }) => {
  await prepareApp(page);
  await openMobileMenuIfNeeded(page);
  await page.getByRole("button", { name: /Local AI|IA locales/i }).click();
  await expect(page.getByRole("heading", { name: /Local AI hub|Espace IA locales/i })).toBeVisible();
});

test("document spaces view opens", async ({ page }) => {
  await prepareApp(page);
  await openMobileMenuIfNeeded(page);
  await page.getByRole("button", { name: /^Documents$/i }).click();
  await expect(page.getByRole("heading", { name: /Document spaces|Espaces de documents/i })).toBeVisible();
});

test("known limits doc link from about", async ({ page }) => {
  await prepareApp(page);
  await openMobileMenuIfNeeded(page);
  await openSettings(page);
  await page.getByRole("button", { name: /^About$/i }).click();
  const dialog = page.getByRole("dialog", { name: /About AIDUSIA Studio/i });
  await expect(dialog).toBeVisible();
  const limits = dialog.getByRole("link", { name: /Known limitations|Limites connues/i });
  await expect(limits).toHaveAttribute("href", /limites-connues/);
});

test("fresh visit onboarding visual (desktop)", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "Visual baseline desktop only");
  await prepareFreshVisit(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveScreenshot("onboarding-choice.png", {
    maxDiffPixelRatio: 0.04,
    animations: "disabled",
  });
});

test("main chat shell after onboarding (desktop)", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "Visual baseline desktop only");
  await prepareFreshVisit(page);
  await dismissOnboardingExplore(page);
  await expect(page.getByRole("main")).toHaveScreenshot("chat-home.png", {
    maxDiffPixelRatio: 0.04,
    animations: "disabled",
  });
});
