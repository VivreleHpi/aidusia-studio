import { expect, test } from "@playwright/test";
import { prepareApp } from "./helpers/app";

test("serves the production shell offline", async ({ page, context }) => {
  test.skip(test.info().project.name !== "chromium", "Service worker desktop test");
  await prepareApp(page);
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service worker unavailable");
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  try {
    await context.setOffline(true);
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByPlaceholder("Write a message…")).toBeVisible();
    await expect(page.getByText("Réponse locale simulée par Ollama.")).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
});
