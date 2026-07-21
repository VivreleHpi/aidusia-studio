import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  deleteLocalDatabase: vi.fn(),
  listConversations: vi.fn(),
}));

const apiKeys = vi.hoisted(() => ({
  clearAllApiKeys: vi.fn(),
  isApiKeyStorageKey: (key: string) => key.startsWith("aidusia_key_"),
}));

const mcp = vi.hoisted(() => ({
  isMcpSecretStorageKey: (key: string) => key.startsWith("aidusia_mcp_secret_"),
  listMcpServers: vi.fn(),
  MCP_SERVERS_STORAGE_KEY: "aidusia_mcp_servers",
}));

vi.mock("@/lib/db", () => db);
vi.mock("@/lib/apiKeys", () => apiKeys);
vi.mock("@/lib/mcp/servers", () => mcp);

const originalCachesDescriptor = Object.getOwnPropertyDescriptor(window, "caches");
const originalServiceWorkerDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "serviceWorker",
);

function restoreProperty(
  object: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) Object.defineProperty(object, key, descriptor);
  else Reflect.deleteProperty(object, key);
}

function mockRegistration({
  scope = `${window.location.origin}/`,
  activeScript,
  waitingScript,
  installingScript,
}: {
  scope?: string;
  activeScript?: string;
  waitingScript?: string;
  installingScript?: string;
}) {
  const worker = (scriptURL: string | undefined) =>
    scriptURL ? ({ scriptURL } as ServiceWorker) : null;
  return {
    scope,
    active: worker(activeScript),
    waiting: worker(waitingScript),
    installing: worker(installingScript),
    unregister: vi.fn(async () => true),
  } as unknown as ServiceWorkerRegistration;
}

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

  afterEach(() => {
    restoreProperty(window, "caches", originalCachesDescriptor);
    restoreProperty(navigator, "serviceWorker", originalServiceWorkerDescriptor);
  });

  it("exports conversations and app preferences without API keys or MCP header values", async () => {
    localStorage.setItem("aidusia_lang", "fr");
    localStorage.setItem("aidusia_key_openai", "sk-secret-local");
    localStorage.setItem("aidusia_mcp_servers", JSON.stringify(mcp.listMcpServers()));
    sessionStorage.setItem("aidusia_chat_drafts_v1", "{\"c1\":\"draft\"}");
    sessionStorage.setItem("aidusia_key_mistral", "sk-secret-session");
    sessionStorage.setItem(
      "aidusia_mcp_secret_test-server",
      JSON.stringify({ Authorization: "Bearer mcp-secret" }),
    );

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
    expect(serialized).not.toContain("aidusia_mcp_secret_test-server");
    expect(serialized).not.toContain("Bearer mcp-secret");
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

  it("deletes only AIDUSIA caches and preserves foreign caches", async () => {
    const cacheStorage = {
      keys: vi.fn(async () => [
        "aidusia-shell-current",
        "aidusia-shell-v4",
        "aidusia-shellfish-foreign",
        "webllm/model-cache",
        "shared-product-cache",
      ]),
      delete: vi.fn(async () => true),
    };
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: cacheStorage,
    });

    const { deleteAllUserData } = await import("@/lib/userData");
    await deleteAllUserData();

    expect(cacheStorage.delete.mock.calls).toEqual([
      ["aidusia-shell-current"],
      ["aidusia-shell-v4"],
    ]);
  });

  it("unregisters only the canonical same-origin AIDUSIA service worker", async () => {
    const origin = window.location.origin;
    const aidusia = mockRegistration({ activeScript: `${origin}/sw.js` });
    const foreignScript = mockRegistration({ activeScript: `${origin}/other-sw.js` });
    const foreignScope = mockRegistration({
      scope: `${origin}/other-app/`,
      activeScript: `${origin}/sw.js`,
    });
    const foreignOrigin = mockRegistration({
      scope: "https://foreign.test/",
      activeScript: "https://foreign.test/sw.js",
    });
    const mixedUpdate = mockRegistration({
      activeScript: `${origin}/sw.js`,
      waitingScript: `${origin}/other-sw.js`,
    });
    const unidentified = mockRegistration({});
    const registrations = [
      aidusia,
      foreignScript,
      foreignScope,
      foreignOrigin,
      mixedUpdate,
      unidentified,
    ];
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations: vi.fn(async () => registrations) },
    });

    const { deleteAllUserData } = await import("@/lib/userData");
    await deleteAllUserData();

    expect(aidusia.unregister).toHaveBeenCalledOnce();
    for (const registration of registrations.slice(1)) {
      expect(registration.unregister).not.toHaveBeenCalled();
    }
  });
});
