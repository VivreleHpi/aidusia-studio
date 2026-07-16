import { expect, test } from "@playwright/test";
import { getMockStats, openProviders, prepareApp, resetMocks } from "./helpers/app";

test("keeps the mobile composer usable without probing Ollama", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Mobile-only journey");
  await resetMocks(page);
  await prepareApp(page);
  await openProviders(page);
  await page.waitForTimeout(500);

  expect((await getMockStats(page)).ollama).toEqual({
    version: 0, tags: 0, show: 0, ps: 0, chat: 0, aborted: 0,
  });
  await expect(page.getByText("Computer only — unavailable on phone")).toBeVisible();
  await expect(page.getByText(/On your phone/)).toBeVisible();
  await expect(page.getByText(/localhost.*PC/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByPlaceholder("Write a message…")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
