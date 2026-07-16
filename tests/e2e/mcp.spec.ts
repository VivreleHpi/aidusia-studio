import { expect, test } from "@playwright/test";
import {
  connectOllama,
  getMockStats,
  openSettings,
  prepareApp,
  resetMocks,
  sendMessage,
} from "./helpers/app";

test("requires approval for every MCP tool call", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "MCP tool execution uses desktop PC Ollama");
  await resetMocks(page);
  await page.addInitScript(() => {
    const state = window as typeof window & {
      __e2eConfirmDecision?: boolean;
      __e2eConfirmMessages?: string[];
    };
    state.__e2eConfirmDecision = false;
    state.__e2eConfirmMessages = [];
    window.confirm = (message?: string) => {
      state.__e2eConfirmMessages?.push(message ?? "");
      return state.__e2eConfirmDecision === true;
    };
  });
  await prepareApp(page);
  await openSettings(page);
  await page.getByRole("button", { name: "Connectors" }).click();
  await page.getByRole("button", { name: /Custom connector/i }).click();
  await page.getByPlaceholder(/Name \(e\.g\./i).fill("Aidusia E2E MCP");
  await page.getByPlaceholder(/MCP URL/i).fill("http://127.0.0.1:4174/mcp");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText("read_e2e_note", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await connectOllama(page);

  expect(await page.evaluate(() =>
    Array.isArray(
      (window as typeof window & { __e2eConfirmMessages?: string[] })
        .__e2eConfirmMessages,
    ),
  )).toBe(true);

  await sendMessage(page, "E2E_TOOL");
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { __e2eConfirmMessages?: string[] })
      .__e2eConfirmMessages?.length ?? 0,
  )).toBe(1);
  const firstPrompt = await page.evaluate(() =>
    (window as typeof window & { __e2eConfirmMessages?: string[] })
      .__e2eConfirmMessages?.[0] ?? "",
  );
  expect(firstPrompt).toContain("Aidusia E2E MCP");
  expect(firstPrompt).toContain("read_e2e_note");
  expect(firstPrompt).toContain("noteId");
  expect(firstPrompt).toContain("42");
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  expect((await getMockStats(page)).mcp.callTool).toBe(0);
  await expect(page.getByText(
    "L’appel MCP a été refusé. Aucun résultat externe n’a été reçu.",
  )).toHaveCount(1);

  await page.evaluate(() => {
    (window as typeof window & { __e2eConfirmDecision?: boolean })
      .__e2eConfirmDecision = true;
  });
  await sendMessage(page, "E2E_TOOL");
  await expect.poll(async () => (await getMockStats(page)).mcp.callTool).toBe(1);
  await expect(page.getByText("Le résultat MCP a été reçu.").last()).toBeVisible();
  await page.getByText(/Result from/).last().click();
  await expect(page.getByText("Contenu de la note E2E 42.")).toBeVisible();

  await page.evaluate(() => {
    (window as typeof window & { __e2eConfirmDecision?: boolean })
      .__e2eConfirmDecision = false;
  });
  await sendMessage(page, "E2E_TOOL");
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { __e2eConfirmMessages?: string[] })
      .__e2eConfirmMessages?.length ?? 0,
  )).toBe(3);
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  expect((await getMockStats(page)).mcp.callTool).toBe(1);
  await expect(page.getByText(
    "L’appel MCP a été refusé. Aucun résultat externe n’a été reçu.",
  )).toHaveCount(2);
});
