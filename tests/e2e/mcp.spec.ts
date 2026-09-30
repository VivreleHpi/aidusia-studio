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

  const approval = page.getByRole("alertdialog", { name: "Allow this external action?" });

  await sendMessage(page, "E2E_TOOL");
  await expect(approval).toBeVisible();
  await expect(approval).toContainText("Aidusia E2E MCP");
  await expect(approval).toContainText("read_e2e_note");
  await expect(approval).toContainText("noteId");
  await expect(approval).toContainText("42");
  // Focus initial sur le refus : Entrée par réflexe ne déclenche jamais l'action.
  await expect(approval.getByRole("button", { name: "Deny" })).toBeFocused();
  await approval.getByRole("button", { name: "Deny" }).click();
  await expect(approval).toBeHidden();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  expect((await getMockStats(page)).mcp.callTool).toBe(0);
  await expect(page.getByText(
    "L’appel MCP a été refusé. Aucun résultat externe n’a été reçu.",
  )).toHaveCount(1);

  await sendMessage(page, "E2E_TOOL");
  await approval.getByRole("button", { name: "Allow" }).click();
  await expect.poll(async () => (await getMockStats(page)).mcp.callTool).toBe(1);
  await expect(page.getByText("Le résultat MCP a été reçu.").last()).toBeVisible();
  await page.getByText(/Result from/).last().click();
  await expect(page.getByText("Contenu de la note E2E 42.")).toBeVisible();

  await sendMessage(page, "E2E_TOOL");
  await expect(approval).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(approval).toBeHidden();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  expect((await getMockStats(page)).mcp.callTool).toBe(1);
  await expect(page.getByText(
    "L’appel MCP a été refusé. Aucun résultat externe n’a été reçu.",
  )).toHaveCount(2);
});
