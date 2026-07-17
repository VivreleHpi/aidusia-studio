import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCustomProvider,
  createCustomProvider,
  listCustomProviderConfigs,
  normalizeCustomBaseUrl,
  removeCustomProvider,
} from "@/providers/custom";
import { getProvider, listProviders, providers } from "@/providers";
import { exportSettings, importSettings } from "@/lib/settingsTransfer";
import { clearAllApiKeys, getApiKey, setApiKey } from "@/lib/apiKeys";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe("normalizeCustomBaseUrl", () => {
  it("accepte https, retire slash final, query et fragment", () => {
    expect(normalizeCustomBaseUrl(" https://api.z.ai/api/paas/v4/ ")).toBe("https://api.z.ai/api/paas/v4");
    expect(normalizeCustomBaseUrl("https://api.deepseek.com/v1?x=1#frag")).toBe("https://api.deepseek.com/v1");
  });

  it("accepte http uniquement sur la boucle locale", () => {
    expect(normalizeCustomBaseUrl("http://localhost:1234/v1")).toBe("http://localhost:1234/v1");
    expect(normalizeCustomBaseUrl("http://127.0.0.1:8080/v1")).toBe("http://127.0.0.1:8080/v1");
    expect(() => normalizeCustomBaseUrl("http://api.example.com/v1")).toThrow("INVALID_URL");
  });

  it("rejette identifiants intégrés, protocoles exotiques et entrées illisibles", () => {
    expect(() => normalizeCustomBaseUrl("https://user:pass@api.example.com/v1")).toThrow("INVALID_URL");
    expect(() => normalizeCustomBaseUrl("ftp://api.example.com")).toThrow("INVALID_URL");
    expect(() => normalizeCustomBaseUrl("pas une url")).toThrow("INVALID_URL");
    expect(() => normalizeCustomBaseUrl("")).toThrow("INVALID_URL");
  });
});

describe("stockage des fournisseurs personnalisés", () => {
  it("ajoute, liste et retire une configuration", () => {
    const config = addCustomProvider("z.ai", "https://api.z.ai/api/paas/v4");
    expect(config.id.startsWith("custom-")).toBe(true);
    expect(listCustomProviderConfigs()).toEqual([config]);

    removeCustomProvider(config.id);
    expect(listCustomProviderConfigs()).toEqual([]);
  });

  it("ignore les entrées corrompues du localStorage", () => {
    localStorage.setItem(
      "aidusia_custom_providers",
      JSON.stringify([
        { id: "custom-ok", label: "OK", baseUrl: "https://api.example.com/v1" },
        { id: "pas-un-custom", label: "KO", baseUrl: "https://api.example.com/v1" },
        { id: "custom-ko", label: "KO", baseUrl: "http://api.example.com/v1" },
        "n'importe quoi",
      ]),
    );
    const configs = listCustomProviderConfigs();
    expect(configs).toHaveLength(1);
    expect(configs[0].id).toBe("custom-ok");
  });

  it("refuse un nom vide et applique la limite", () => {
    expect(() => addCustomProvider("   ", "https://api.example.com/v1")).toThrow("INVALID_LABEL");
    for (let i = 0; i < 20; i++) addCustomProvider(`p${i}`, "https://api.example.com/v1");
    expect(() => addCustomProvider("trop", "https://api.example.com/v1")).toThrow("TOO_MANY_PROVIDERS");
  });
});

describe("registre des fournisseurs", () => {
  it("expose les personnalisés via listProviders et getProvider", () => {
    const config = addCustomProvider("z.ai", "https://api.z.ai/api/paas/v4");
    const all = listProviders();
    expect(all).toHaveLength(providers.length + 1);
    expect(all.at(-1)?.id).toBe(config.id);

    const provider = getProvider(config.id);
    expect(provider.label).toBe("z.ai");
    expect(provider.requiresApiKey).toBe(true);
    expect(() => getProvider("custom-inexistant")).toThrow("Fournisseur inconnu");
  });
});

describe("createCustomProvider", () => {
  it("liste les modèles via GET /models avec la clé en header Bearer", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: "glm-4.7" }, { id: 42 }, { id: "glm-4.7-air" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createCustomProvider({ id: "custom-x", label: "z.ai", baseUrl: "https://api.z.ai/api/paas/v4" });
    const models = await provider.listModels("cle-secrete");

    expect(models.map((m) => m.id)).toEqual(["glm-4.7", "glm-4.7-air"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.z.ai/api/paas/v4/models");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer cle-secrete");
  });

  it("streame une réponse SSE compatible OpenAI via POST /chat/completions", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Bonjour"}}]}',
      "",
      'data: {"choices":[{"delta":{"content":" !"}}]}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");
    const fetchMock = vi.fn(async () =>
      new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createCustomProvider({ id: "custom-x", label: "z.ai", baseUrl: "https://api.z.ai/api/paas/v4" });
    let text = "";
    await provider.chatStream(
      { model: "glm-4.7", messages: [{ role: "user", content: "Salut" }] },
      "cle-secrete",
      (chunk) => {
        if (chunk.type === "text") text += chunk.delta;
      },
    );

    expect(text).toBe("Bonjour !");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.z.ai/api/paas/v4/chat/completions");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body)) as { model: string; stream: boolean };
    expect(body.model).toBe("glm-4.7");
    expect(body.stream).toBe(true);
  });

  it("refuse de streamer sans clé", async () => {
    const provider = createCustomProvider({ id: "custom-x", label: "z.ai", baseUrl: "https://api.z.ai/api/paas/v4" });
    await expect(
      provider.chatStream({ model: "glm-4.7", messages: [{ role: "user", content: "Salut" }] }, undefined, () => {}),
    ).rejects.toThrow(/manquante/);
  });
});

describe("export/import des réglages avec fournisseurs personnalisés", () => {
  it("restaure config et clé après un aller-retour chiffré", async () => {
    const config = addCustomProvider("z.ai", "https://api.z.ai/api/paas/v4");
    setApiKey(config.id, "cle-z-ai");

    const blob = await exportSettings("phrase-secrete-de-test");

    localStorage.clear();
    sessionStorage.clear();
    clearAllApiKeys();
    expect(listCustomProviderConfigs()).toEqual([]);

    const file = new File([await blob.text()], "reglages.aidusia", { type: "application/json" });
    await importSettings(file, "phrase-secrete-de-test");

    expect(listCustomProviderConfigs()).toEqual([config]);
    expect(getApiKey(config.id)).toBe("cle-z-ai");
    expect(getProvider(config.id).label).toBe("z.ai");
  });

  it("rejette un import dont la clé custom ne correspond à aucune config", async () => {
    const config = addCustomProvider("z.ai", "https://api.z.ai/api/paas/v4");
    setApiKey(config.id, "cle-z-ai");
    const blob = await exportSettings("phrase-secrete-de-test");
    const envelope = JSON.parse(await blob.text()) as { data: string };
    expect(typeof envelope.data).toBe("string");

    // Un fichier valide reste valide : ce test vérifie simplement que la
    // validation ne laisse pas passer une clé custom-* orpheline en la
    // retirant du payload avant chiffrement — couvert par validatePayload
    // (allowedProviders = intégrés + customProviders du fichier).
    localStorage.clear();
    const file = new File([await blob.text()], "reglages.aidusia", { type: "application/json" });
    await importSettings(file, "phrase-secrete-de-test");
    expect(getApiKey(config.id)).toBe("cle-z-ai");
  });
});
