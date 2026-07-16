import { expect, type Page } from "@playwright/test";

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

export async function openSettings(page: Page): Promise<void> {
  const settings = page.getByRole("button", { name: "Settings" });
  const mobileMenu = page.getByRole("button", { name: "Toggle menu" });
  const closeMenu = page.getByRole("button", { name: "Close menu" });
  if (await mobileMenu.isVisible() && !(await closeMenu.isVisible())) {
    await mobileMenu.click();
  }
  await settings.click();
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
