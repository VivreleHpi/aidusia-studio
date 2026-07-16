import { expect, test } from "@playwright/test";
import {
  connectOllama,
  getMockStats,
  openProviders,
  prepareApp,
  resetMocks,
  sendMessage,
} from "./helpers/app";

async function persistedMessageCount(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open("aidusia-studio", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const getAll = database
        .transaction("conversations", "readonly")
        .objectStore("conversations")
        .getAll();
      getAll.onerror = () => reject(getAll.error);
      getAll.onsuccess = () => {
        database.close();
        resolve(getAll.result.reduce(
          (count, conversation) => count + (conversation.messages?.length ?? 0),
          0,
        ));
      };
    };
  }));
}

test.beforeEach(async ({ page }) => {
  await resetMocks(page);
  await prepareApp(page);
});

test("does not probe Ollama before explicit consent", async ({ page }) => {
  await openProviders(page);
  await page.waitForTimeout(500);
  expect((await getMockStats(page)).ollama).toEqual({
    version: 0,
    tags: 0,
    show: 0,
    ps: 0,
    chat: 0,
    aborted: 0,
  });
});

test("connects explicitly, chats and restores the conversation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "PC Ollama is desktop-only");
  await connectOllama(page);
  await sendMessage(page, "Réponds au test E2E");
  await expect(page.getByText("Réponse locale simulée par Ollama.")).toBeVisible();
  await expect(page.getByText(/AI-generated.*Ollama/)).toBeVisible();
  await expect(page.getByText("· aidusia-e2e:latest", { exact: true })).toBeVisible();
  await expect.poll(() => persistedMessageCount(page)).toBeGreaterThanOrEqual(2);

  await page.reload();
  await expect(page.getByText("Réponse locale simulée par Ollama.")).toBeVisible();
});

test("stops a slow stream and remains usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "PC Ollama is desktop-only");
  await connectOllama(page);
  await sendMessage(page, "E2E_SLOW");
  await expect(page.getByText(/fragment-1/)).toBeVisible();
  await page.getByRole("button", { name: "Stop generating" }).click();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await expect.poll(async () => (await getMockStats(page)).ollama.aborted).toBeGreaterThanOrEqual(1);

  await sendMessage(page, "Still usable");
  await expect(page.getByText("Réponse locale simulée par Ollama.")).toBeVisible();
});
