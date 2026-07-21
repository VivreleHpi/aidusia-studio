import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { prepareApp } from "./helpers/app";

test("mobile drawer exposes its state, traps focus and restores the trigger", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Mobile drawer keyboard journey");
  await prepareApp(page);

  const toggle = page.getByRole("button", { name: "Toggle menu" });
  const drawer = page.locator("#aidusia-sidebar");
  await expect(toggle).toHaveAttribute("aria-controls", "aidusia-sidebar");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(drawer).toHaveAttribute("inert", "");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");

  await toggle.click();
  const close = page.getByRole("button", { name: "Close menu" });
  await expect(close).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(drawer).not.toHaveAttribute("inert", "");
  await expect(drawer).not.toHaveAttribute("aria-hidden", "true");

  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "Privacy" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  const accessibility = await new AxeBuilder({ page })
    .include("#aidusia-sidebar")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(drawer).toHaveAttribute("inert", "");
});
