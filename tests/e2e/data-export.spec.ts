import { expect, test } from "@playwright/test";
import { openSettings } from "./helpers/app";

test("exports user data without browser secrets", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("aidusia_onboarded", "true");
    localStorage.setItem("aidusia_lang", "en");
    localStorage.setItem("aidusia_key_openai", "sk-e2e-local-secret");
    sessionStorage.setItem("aidusia_key_mistral", "sk-e2e-session-secret");
    sessionStorage.setItem(
      "aidusia_mcp_secret_e2e",
      JSON.stringify({ Authorization: "Bearer e2e-mcp-secret" }),
    );
  });
  await page.goto("/");
  await openSettings(page);
  await page.getByRole("button", { name: "Data" }).click();
  await expect(page.getByRole("dialog", { name: "Data" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export my data" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let content = "";
  for await (const chunk of stream) content += chunk.toString("utf8");

  expect(content).not.toContain("aidusia_key_openai");
  expect(content).not.toContain("sk-e2e-local-secret");
  expect(content).not.toContain("aidusia_key_mistral");
  expect(content).not.toContain("sk-e2e-session-secret");
  expect(content).not.toContain("aidusia_mcp_secret_e2e");
  expect(content).not.toContain("Bearer e2e-mcp-secret");
  expect(content).toContain("aidusia-studio");
  expect(JSON.parse(content)).toHaveProperty("conversations");
});
