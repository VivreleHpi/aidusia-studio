import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  deleteLocalDatabase: vi.fn(),
  listConversations: vi.fn(),
}));

const apiKeys = vi.hoisted(() => ({
  clearAllApiKeys: vi.fn(),
  isApiKeyStorageKey: (key: string) => key.startsWith("aidusia_key_"),
}));

const mcp = vi.hoisted(() => ({
  listMcpServers: vi.fn(),
  MCP_SERVERS_STORAGE_KEY: "aidusia_mcp_servers",
}));

vi.mock("@/lib/db", () => db);
vi.mock("@/lib/apiKeys", () => apiKeys);
vi.mock("@/lib/mcp/servers", () => mcp);

describe("userData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    db.deleteLocalDatabase.mockResolvedValue(undefined);
    db.listConversations.mockResolvedValue([
      {
        id: "c1",
        title: "Conversation",
        createdAt: 1,
        updatedAt: 2,
        messages: [],
      },
    ]);
    mcp.listMcpServers.mockReturnValue([
      {
        id: "mcp-1",
        name: "Private MCP",
        url: "https://example.test/mcp",
        headers: { Authorization: "Bearer secret", "X-Team": "core" },
      },
    ]);
  });

  it("exports conversations and app preferences without API keys or MCP header values", async () => {
    localStorage.setItem("aidusia_lang", "fr");
    localStorage.setItem("aidusia_key_openai", "sk-secret-local");
    localStorage.setItem("aidusia_mcp_servers", JSON.stringify(mcp.listMcpServers()));
    sessionStorage.setItem("aidusia_chat_drafts_v1", "{\"c1\":\"draft\"}");
    sessionStorage.setItem("aidusia_key_mistral", "sk-secret-session");

    const { exportUserData } = await import("@/lib/userData");
    const payload = JSON.parse(await (await exportUserData()).text());

    expect(payload.conversations).toHaveLength(1);
    expect(payload.storage.local.aidusia_lang).toBe("fr");
    expect(payload.storage.local.aidusia_key_openai).toBeUndefined();
    expect(payload.storage.local.aidusia_mcp_servers).toBeUndefined();
    expect(payload.storage.session.aidusia_chat_drafts_v1).toBe("{\"c1\":\"draft\"}");
    expect(payload.storage.session.aidusia_key_mistral).toBeUndefined();
    expect(payload.mcpServers[0]).toEqual({
      id: "mcp-1",
      name: "Private MCP",
      url: "https://example.test/mcp",
      headersRedacted: ["Authorization", "X-Team"],
    });
    const serialized = JSON.stringify(payload);

    expect(serialized).not.toContain("aidusia_key_openai");
    expect(serialized).not.toContain("aidusia_key_mistral");
    expect(serialized).not.toContain("sk-secret-local");
    expect(serialized).not.toContain("sk-secret-session");
    expect(serialized).not.toContain("Bearer secret");
  });

  it("deletes IndexedDB, API keys and AIDUSIA browser storage", async () => {
    localStorage.setItem("aidusia_lang", "en");
    localStorage.setItem("other_product", "keep");
    sessionStorage.setItem("aidusia_chat_drafts_v1", "{}");

    const { deleteAllUserData } = await import("@/lib/userData");
    await deleteAllUserData();

    expect(db.deleteLocalDatabase).toHaveBeenCalledOnce();
    expect(apiKeys.clearAllApiKeys).toHaveBeenCalledOnce();
    expect(localStorage.getItem("aidusia_lang")).toBeNull();
    expect(localStorage.getItem("other_product")).toBe("keep");
    expect(sessionStorage.getItem("aidusia_chat_drafts_v1")).toBeNull();
  });
});
