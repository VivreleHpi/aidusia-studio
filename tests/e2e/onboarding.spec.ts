import { expect, test } from "@playwright/test";
import { dismissOnboardingExplore, prepareFreshVisit, resetMocks } from "./helpers/app";

test.beforeEach(async ({ page }) => {
  await resetMocks(page);
});

test("shows choice screen first without Ollama troubleshooting", async ({ page }) => {
  await prepareFreshVisit(page);

  const dialog = page.getByRole("dialog", { name: /Welcome to AIDUSIA studio/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Where would you like to start?")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Try without installing anything/i })).toBeVisible();
  await expect(dialog.getByText(/blocked by its network origin/i)).toHaveCount(0);
  await expect(dialog.getByText(/OLLAMA_ORIGINS/i)).toHaveCount(0);
  await expect(dialog.getByText(/Download Ollama/i)).toHaveCount(0);
});

test("explore path closes onboarding without Ollama error banner", async ({ page }) => {
  await prepareFreshVisit(page);
  await dismissOnboardingExplore(page);

  await expect(page.getByText(/blocked by its network origin/i)).toHaveCount(0);
  await expect(page.getByText(/OLLAMA_ORIGINS/i)).toHaveCount(0);
  await expect(page.getByPlaceholder("Write a message…")).toBeVisible();
});

test("Ollama troubleshooting appears only after choosing the PC path", async ({ page }) => {
  test.skip(test.info().project.name === "mobile", "Ollama onboarding path is desktop-only");
  await prepareFreshVisit(page);

  await page.getByRole("button", { name: /I have Ollama on my PC/i }).click();
  await expect(page.getByText(/blocked by its network origin|Ollama detected/i)).toBeVisible();
});

test("?lang=fr sets French onboarding copy", async ({ page }) => {
  await prepareFreshVisit(page, { queryLang: "fr" });

  await expect(page.getByRole("dialog", { name: /Bienvenue dans AIDUSIA studio/i })).toBeVisible();
  await expect(page.getByText("Par où commencer ?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Essayer sans rien installer" })).toBeVisible();

  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem("aidusia_lang")))
    .toBe("fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("mobile onboarding hides Ollama PC path and initial error", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Mobile-only journey");
  await prepareFreshVisit(page);

  await expect(page.getByRole("button", { name: /I have Ollama on my PC/i })).toHaveCount(0);
  await expect(page.getByText(/blocked by its network origin/i)).toHaveCount(0);
  await expect(page.getByText("Where would you like to start?")).toBeVisible();
});
