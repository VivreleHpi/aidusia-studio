import { describe, expect, it, vi } from "vitest";

import {
  formatSummaryMarkdown,
  hasCatalogChanges,
  mergeCatalog,
  mergeDiscoveredIntoEntry,
  slugifyId,
  syncPatchFromDiscovery,
} from "../../scripts/sync-local-ai-catalog/merge.mjs";
import { discoverOllamaModels, discoverWebllmModels } from "../../scripts/sync-local-ai-catalog/sources.mjs";
import { HttpError, fetchJson } from "../../scripts/sync-local-ai-catalog/fetch.mjs";

const baseCatalog = {
  schemaVersion: 1,
  catalogVersion: "2026.11.04",
  updatedAt: "2026-11-04",
  entries: [
    {
      id: "browser-llama-3.2-1b",
      runtime: "webllm",
      providerId: "browser",
      modelId: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      name: { fr: "Libellé manuel FR", en: "Manual EN label" },
      family: "Llama 3.2",
      parametersB: 1,
      quantization: "q4f16_1 / q4f32_1",
      sizeGb: { f16: 0.7, f32: 1.1 },
      vramGbMin: 2,
      ramGbMin: 4,
      contextTokens: 8192,
      license: "Llama 3.2 Community",
      capabilities: ["chat"],
      releasedAt: "2024-09-23",
      compatibility: { webgpu: true, ollamaTag: null, mobile: "ok_light" },
    },
  ],
};

describe("syncLocalAiCatalog merge", () => {
  it("slugifyId normalise les identifiants", () => {
    expect(slugifyId("Llama 3.2 1B (WebGPU)")).toBe("llama-3-2-1b-webgpu");
  });

  it("ne remplace pas les champs éditoriaux protégés", () => {
    const discovered = {
      suggestedId: "browser-llama-3.2-1b",
      runtime: "webllm" as const,
      providerId: "browser",
      modelId: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      name: { fr: "Auto FR", en: "Auto EN" },
      family: "Llama",
      parametersB: 1,
      quantization: "q4f16_1 / q4f32_1",
      sizeGb: { f16: 0.8, f32: 1.2 },
      license: "Apache-2.0",
      compatibility: { webgpu: true, ollamaTag: null, mobile: "desktop_only" },
      source: "test",
      observedAt: "2026-11-04T12:00:00.000Z",
      allowAutoAdd: false,
    };

    const merged = mergeDiscoveredIntoEntry(baseCatalog.entries[0], discovered, [
      "name",
      "vramGbMin",
      "ramGbMin",
      "compatibility",
      "capabilities",
      "id",
    ]);

    expect(merged.name).toEqual({ fr: "Libellé manuel FR", en: "Manual EN label" });
    expect(merged.compatibility).toEqual(baseCatalog.entries[0].compatibility);
    expect(merged.sizeGb).toEqual({ f16: 0.8, f32: 1.2 });
    expect(merged.license).toBe("Apache-2.0");
    expect(merged.sync).toMatchObject({ source: "test" });
  });

  it("ajoute une entrée découverte avec allowAutoAdd", () => {
    const discovered = {
      suggestedId: "browser-phi-3-mini",
      runtime: "webllm" as const,
      providerId: "browser",
      modelId: "Phi-3-mini-Instruct-q4f16_1-MLC",
      name: { fr: "Phi (WebGPU)", en: "Phi (WebGPU)" },
      family: "Phi",
      parametersB: 3,
      quantization: "q4f16_1 / q4f32_1",
      sizeGb: { f16: 1.5, f32: 2.2 },
      compatibility: { webgpu: true, ollamaTag: null, mobile: "heavy" },
      source: "test",
      observedAt: "2026-11-04T12:00:00.000Z",
      allowAutoAdd: true,
    };

    const { catalog, summary } = mergeCatalog(baseCatalog, [discovered]);
    expect(summary.added).toContain("browser-phi-3-mini");
    expect(catalog.entries).toHaveLength(2);
    expect(hasCatalogChanges(summary)).toBe(true);
    expect(formatSummaryMarkdown(summary)).toContain("browser-phi-3-mini");
  });

  it("syncPatchFromDiscovery exclut les métadonnées", () => {
    const patch = syncPatchFromDiscovery({
      suggestedId: "x",
      source: "webllm-prebuilt",
      allowAutoAdd: true,
      modelId: "m",
      providerId: "browser",
      runtime: "webllm",
      name: { fr: "a", en: "b" },
      family: "F",
      parametersB: 1,
      quantization: "q",
      sizeGb: { f16: 1, f32: 1 },
      compatibility: {},
    });
    expect(patch).not.toHaveProperty("suggestedId");
    expect(patch).not.toHaveProperty("allowAutoAdd");
    expect(patch.modelId).toBe("m");
  });
});

describe("syncLocalAiCatalog sources (mocked HTTP)", () => {
  it("découvre Ollama via manifest public simulé", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/library/llama3.2/tags")) {
        return new Response(JSON.stringify({ tags: ["3b", "1b"] }), { status: 200 });
      }
      if (url.includes("/manifests/3b")) {
        return new Response(
          JSON.stringify({
            config: { digest: "sha256:abc" },
            layers: [{ size: 2_000_000_000 }],
          }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const { defaultSyncConfig } = await import("../../scripts/sync-local-ai-catalog/config.mjs");
    const models = await discoverOllamaModels({
      fetchImpl,
      config: {
        ...defaultSyncConfig,
        ollama: {
          enabled: true,
          watch: [{ library: "llama3.2", tag: "3b", id: "ollama-llama3.2-3b" }],
        },
      },
    });

    expect(models).toHaveLength(1);
    expect(models[0].sizeGb.f16).toBe(2);
    expect(models[0].modelId).toBe("llama3.2:3b");
  });

  it("fetchJson relance proprement sur HTTP 429", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("slow down", { status: 429, headers: { "retry-after": "0" } });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const data = await fetchJson("https://example.com/test", { fetchImpl, minIntervalMs: 0 });
    expect(data).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it("fetchJson échoue avec HttpError sur 404", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 404 }));
    await expect(fetchJson("https://example.com/missing", { fetchImpl, minIntervalMs: 0 })).rejects.toBeInstanceOf(
      HttpError,
    );
  });
});

describe("syncLocalAiCatalog webllm prebuilt", () => {
  it("inclut les modèles Instruct q4f16_1 du paquet web-llm", async () => {
    const models = await discoverWebllmModels();
    const ids = models.map((m) => m.modelId);
    expect(ids).toContain("Llama-3.2-1B-Instruct-q4f16_1-MLC");
    expect(ids).toContain("Qwen2.5-1.5B-Instruct-q4f16_1-MLC");
  });
});
