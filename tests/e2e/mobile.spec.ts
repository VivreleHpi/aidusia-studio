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

// Sans adaptateur WebGPU en CI : les modeles du catalogue « Sur cet appareil »
// restent visibles mais non selectionnables (PR #20).
test("lists on-device models as incompatible when WebGPU has no adapter", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Mobile-only journey");
  await resetMocks(page);
  await prepareApp(page);

  await page.getByRole("button", { name: "Choose provider and model" }).click();
  await page.getByRole("button", { name: "On your phone", exact: true }).click();

  await expect(page.getByText("Not compatible with this browser")).toBeVisible();
  const llama = page.getByRole("button", { name: /Llama 3.2 1B — light/i });
  await expect(llama).toBeVisible();
  await expect(llama).toBeDisabled();
  const qwen = page.getByRole("button", { name: /Qwen 2.5 1.5B — balanced/i });
  await expect(qwen).toBeDisabled();
  const gemma = page.getByRole("button", { name: /Gemma 2 2B — quality/i });
  await expect(gemma).toBeDisabled();
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

test("offers the portable model on mobile without downloading it on selection", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Mobile-only journey");
  let huggingFaceRequests = 0;
  await page.route("https://huggingface.co/**", async (route) => {
    huggingFaceRequests += 1;
    await route.abort();
  });
  await resetMocks(page);
  await prepareApp(page);

  await page.getByRole("button", { name: "Choose provider and model" }).click();
  await page.getByRole("button", { name: "Portable (Qwen 0.5B)", exact: true }).click();
  await expect(page.getByRole("button", { name: "Qwen 2.5 0.5B — phone (~0.49 GB)" })).toBeVisible();
  expect(huggingFaceRequests).toBe(0);
  await page.locator('button[aria-label="Close"].fixed.inset-0').click({ position: { x: 1, y: 1 } });
  await openProviders(page);
  await page.getByRole("button", { name: "Models", exact: true }).last().click();
  await expect(page.getByText("Not downloaded — about 0.49 GB, confirmed before downloading.")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Automatic/ })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("asks before downloading the portable model and sends nothing when the user cancels", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Mobile-only journey");
  let huggingFaceRequests = 0;
  await page.route("https://huggingface.co/**", async (route) => {
    huggingFaceRequests += 1;
    await route.abort();
  });
  await resetMocks(page);
  await prepareApp(page);

  await page.getByRole("button", { name: "Choose provider and model" }).click();
  await page.getByRole("button", { name: "Portable (Qwen 0.5B)", exact: true }).click();
  await page.getByRole("button", { name: "Qwen 2.5 0.5B — phone (~0.49 GB)" }).click();
  await page.getByPlaceholder("Write a message…").fill("Bonjour");
  await page.getByRole("button", { name: "Send" }).click();

  const consent = page.getByRole("alertdialog", { name: "Download Qwen 0.5B (0.49 GB)?" });
  await expect(consent).toBeVisible();
  await expect(consent).toContainText("Wi-Fi recommended");
  // Boîte ancrée en bas et entièrement visible sur un écran de téléphone.
  const box = await consent.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(box!.width).toBeLessThanOrEqual(viewport.width);
  await consent.getByRole("button", { name: "Cancel" }).click();

  await expect(consent).toBeHidden();
  await expect(page.getByText("Portable model download cancelled.")).toBeVisible();
  // Le brouillon est rendu pour pouvoir réessayer ou changer de modèle.
  await expect(page.getByPlaceholder("Write a message…")).toHaveValue("Bonjour");
  expect(huggingFaceRequests).toBe(0);
});
