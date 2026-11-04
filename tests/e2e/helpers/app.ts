import { expect, type Locator, type Page } from "@playwright/test";

export const MOCK_SERVICES_URL =
  process.env.AIDUSIA_E2E_MOCK_URL ?? "http://127.0.0.1:4174";

export async function prepareApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("aidusia_onboarded", "true");
    localStorage.setItem("aidusia_lang", "en");
    localStorage.setItem("aidusia_theme", "light");
  });
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
}

/** Visite neuve : onboarding affiché, langue et thème configurables. */
export async function prepareFreshVisit(
  page: Page,
  options: { lang?: "en" | "fr"; queryLang?: "fr" | "en"; theme?: "light" | "dark" } = {},
): Promise<void> {
  await page.addInitScript(({ lang, theme }) => {
    localStorage.removeItem("aidusia_onboarded");
    localStorage.removeItem("aidusia_lang");
    if (lang) localStorage.setItem("aidusia_lang", lang);
    if (theme) localStorage.setItem("aidusia_theme", theme);
    else localStorage.setItem("aidusia_theme", "light");
  }, options);
  const query = options.queryLang ? `?lang=${options.queryLang}` : "";
  await page.goto(`/${query}`);
  await expect(page.getByRole("dialog")).toBeVisible();
}

export async function dismissOnboardingExplore(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Try without installing anything|Essayer sans rien installer/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("main")).toBeVisible();
}

async function waitForMobileDrawerToSettle(page: Page): Promise<void> {
  const drawer = page.locator("#aidusia-sidebar");
  await expect
    .poll(async () => (await drawer.boundingBox())?.x ?? Number.NEGATIVE_INFINITY)
    .toBeGreaterThanOrEqual(-1);
}

export async function openMobileMenuIfNeeded(page: Page): Promise<void> {
  const mobileMenu = page.getByRole("button", { name: "Toggle menu" });
  if (await mobileMenu.isVisible()) {
    if ((await mobileMenu.getAttribute("aria-expanded")) !== "true") {
      await mobileMenu.click();
    }
    await waitForMobileDrawerToSettle(page);
  }
}

export async function openSettings(page: Page): Promise<Locator> {
  const mobileMenu = page.getByRole("button", { name: "Toggle menu" });
  const closeMenu = page.getByRole("button", { name: "Close menu" });
  if (await mobileMenu.isVisible()) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if ((await mobileMenu.getAttribute("aria-expanded")) === "true") break;
      await mobileMenu.click();
      await waitForMobileDrawerToSettle(page);
    }
    await expect(closeMenu).toBeVisible();
  }
  const settings = page.getByRole("button", { name: "Settings" });
  await expect(settings).toBeVisible({ timeout: 10_000 });
  await settings.click();
  return settings;
}

export async function openProviders(page: Page): Promise<void> {
  await openSettings(page);
  await page.getByRole("button", { name: "Providers" }).click();
  await expect(page.getByRole("dialog", { name: "Providers" })).toBeVisible();
}

export async function resetMocks(page: Page): Promise<void> {
  await page.request.post(`${MOCK_SERVICES_URL}/__e2e/reset`);
}

export async function getMockStats(page: Page) {
  const response = await page.request.get(`${MOCK_SERVICES_URL}/__e2e/stats`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{
    ollama: {
      version: number;
      tags: number;
      show: number;
      ps: number;
      chat: number;
      aborted: number;
    };
    mcp: { initialize: number; listTools: number; callTool: number };
  }>;
}

export async function connectOllama(page: Page): Promise<void> {
  await openProviders(page);
  await page.getByRole("button", { name: "Configure PC (Ollama)", exact: true }).click();
  await page.getByPlaceholder(/Ollama URL/i).fill(MOCK_SERVICES_URL);
  await page.getByRole("button", { name: "Save PC (Ollama)", exact: true }).click();
  await expect(page.getByText("Reachable", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "Choose provider and model" }).click();
  await page.getByRole("button", { name: "PC (Ollama)", exact: true }).click();
  await expect(page.getByText("aidusia-e2e:latest", { exact: true })).toBeVisible();
  await page.getByText("aidusia-e2e:latest", { exact: true }).click();
}

export async function sendMessage(page: Page, message: string): Promise<void> {
  await page.getByPlaceholder("Write a message…").fill(message);
  await page.getByRole("button", { name: "Send" }).click();
}
