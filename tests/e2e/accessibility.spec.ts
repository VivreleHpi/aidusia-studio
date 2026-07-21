import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openSettings } from "./helpers/app";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("aidusia_onboarded", "true");
    localStorage.setItem("aidusia_lang", "en");
    localStorage.setItem("aidusia_theme", "light");
  });
  await page.goto("/");
});

test("home has a main landmark and no serious WCAG violations", async ({ page }) => {
  await expect(page.getByRole("main")).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")))
    .toEqual([]);
});

test("providers dialog and dark theme pass automated WCAG checks", async ({ page }) => {
  await openSettings(page);
  await page.getByRole("button", { name: "Providers" }).click();
  await expect(page.getByRole("dialog", { name: "Providers" })).toBeVisible();
  let results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Providers" })).toBeHidden();
  await expect(page.locator("#application-shell")).not.toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  // Let the 150 ms color transitions settle before measuring final contrast.
  await page.waitForTimeout(200);
  results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("dialog traps focus, closes with Escape and restores focus", async ({ page }) => {
  const settings = await openSettings(page);
  await page.getByRole("button", { name: "About" }).click();
  const dialog = page.getByRole("dialog", { name: "About AIDUSIA Studio" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("#application-shell")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(settings).toBeFocused();
});

test("guided tour traps focus, follows the viewport and restores focus", async ({ page }) => {
  const settings = await openSettings(page);
  await page.getByRole("button", { name: "Guided tour" }).click();
  const dialog = page.getByRole("dialog", { name: "Start a conversation" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Next" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(settings).toBeFocused();
});
