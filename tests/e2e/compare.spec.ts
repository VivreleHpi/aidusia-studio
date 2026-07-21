import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  connectOllama,
  getMockStats,
  prepareApp,
  resetMocks,
} from "./helpers/app";

test("compares two model streams and returns to the regular chat", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "Desktop comparison journey");

  await resetMocks(page);
  await prepareApp(page);
  await connectOllama(page);

  await page.getByRole("button", { name: "Compare AIs" }).click();
  await expect(page.getByRole("heading", { name: "Compare AI models" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compare AIs" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Le second emplacement démarre sur l'IA navigateur. Pour cet E2E sans
  // WebGPU, on sélectionne une seconde fois le fournisseur Ollama simulé.
  const modelMenus = page.getByRole("button", { name: "Choose provider and model" });
  await modelMenus.nth(1).click();
  await page.getByRole("button", { name: "PC (Ollama)", exact: true }).click();
  const secondModel = page.getByRole("button", { name: "aidusia-e2e:latest", exact: true });
  await expect(secondModel).toBeVisible();
  await secondModel.click();

  await page.getByPlaceholder("Ask both models a question…").fill("Compare this E2E prompt");
  await page.getByRole("button", { name: "Compare", exact: true }).click();

  await expect(page.getByText(/Réponse locale simulée par Ollama\./)).toHaveCount(2);
  await expect.poll(async () => (await getMockStats(page)).ollama.chat).toBe(2);
  await expect(
    page.getByText("AI can make mistakes. Verify important information."),
  ).toBeVisible();

  const downloadStarted = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export as Markdown" }).click();
  expect((await downloadStarted).suggestedFilename()).toMatch(/^aidusia-comparaison-.*\.md$/);

  await page.getByRole("button", { name: "Synthesize with A" }).click();
  await expect(page.getByRole("heading", { name: "Synthesis" })).toBeVisible();
  await expect.poll(async () => (await getMockStats(page)).ollama.chat).toBe(3);
  const synthesisCard = page.getByRole("article", { name: "Synthesis" });
  await expect(synthesisCard.getByText(/Réponse locale simulée par Ollama\./)).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);

  await synthesisCard.getByRole("button", { name: "Continue in chat" }).click();
  await expect(page.getByPlaceholder("Write a message…")).toBeVisible();
  await expect(page.getByText("Compare this E2E prompt", { exact: true }).first()).toBeVisible();
});

test("opens the comparison workspace from the mobile drawer without overflow", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Mobile comparison navigation");

  await prepareApp(page);
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page.getByRole("button", { name: "Compare AIs" }).click();

  await expect(page.getByRole("heading", { name: "Compare AI models" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole("button", { name: "Back to chat" }).click();
  await expect(page.getByPlaceholder("Write a message…")).toBeVisible();
});
