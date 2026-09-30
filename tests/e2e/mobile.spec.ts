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

// Ce projet Playwright n'a pas de vrai GPU : `navigator.gpu` existe (secure
// context) mais `requestAdapter()` renvoie null. Ces deux tests verifient,
// dans un vrai navigateur, le chemin d'echec reellement atteignable en CI pour
// l'IA locale sur mobile.
test("lists every on-device model without blocking, flagging the heavier ones for mobile", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Mobile-only journey");
  await resetMocks(page);
  await prepareApp(page);

  await page.getByRole("button", { name: "Choose provider and model" }).click();
  await page.getByRole("button", { name: "On your phone", exact: true }).click();

  // Le catalogue reste instantane (aucune sonde WebGPU au listing) : les 3
  // modeles apparaissent, avec un avertissement NON bloquant sur les 2 plus
  // lourds (le 1B leger n'en a pas).
  await expect(page.getByRole("button", { name: "Llama 3.2 1B — light (~0.7 GB)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Qwen 2.5 1.5B — balanced (~1 GB) ⚠" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gemma 2 2B — quality (~1.4 GB) ⚠" })).toBeVisible();
  await expect(page.getByText("May exceed this phone's memory")).toBeVisible();
});

test("shows an actionable WebGPU reason when testing the on-device provider without a real adapter", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Mobile-only journey");
  await resetMocks(page);
  await prepareApp(page);
  await openProviders(page);

  await page.getByRole("button", { name: "Test On your phone" }).click();
  await expect(
    page.getByText(/WebGPU is unavailable in this browser/),
  ).toBeVisible();
});

test("offers Luciole on mobile without downloading it on selection", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Mobile-only journey");
  let huggingFaceRequests = 0;
  await page.route("https://huggingface.co/**", async (route) => {
    huggingFaceRequests += 1;
    await route.abort();
  });
  await resetMocks(page);
  await prepareApp(page);

  await page.getByRole("button", { name: "Choose provider and model" }).click();
  await page.getByRole("button", { name: "Luciole 1B", exact: true }).click();
  await expect(page.getByRole("button", { name: "Luciole 1B — French (~1.02 GB)" })).toBeVisible();
  expect(huggingFaceRequests).toBe(0);
  await page.locator('button[aria-label="Close"].fixed.inset-0').click({ position: { x: 1, y: 1 } });
  await openProviders(page);
  await page.getByRole("button", { name: "Models", exact: true }).last().click();
  await expect(page.getByText("Not downloaded — about 1.02 GB on first message.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
