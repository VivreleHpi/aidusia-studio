import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalAiCatalogEntry } from "@/lib/localAiCatalog";
import { assessCatalogEntryFit, buildDeviceSnapshot, type DeviceSnapshot } from "@/lib/localAiFit";

vi.mock("@/lib/providerReachability", () => ({
  getProviderReachability: vi.fn(async (id: string) => (id === "ollama" ? "unavailable" : "ready")),
}));

const entry: LocalAiCatalogEntry = {
  id: "browser-llama-3.2-1b",
  runtime: "webllm",
  providerId: "browser",
  modelId: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  name: { fr: "Test", en: "Test" },
  family: "Llama",
  parametersB: 1,
  quantization: "q4",
  sizeGb: { f16: 0.7, f32: 1.1 },
  vramGbMin: 2,
  ramGbMin: 4,
  contextTokens: 8192,
  license: "Test",
  capabilities: ["chat"],
  releasedAt: "2024-01-01",
  compatibility: { webgpu: true, ollamaTag: null, mobile: "ok_light" },
};

function device(partial: Partial<DeviceSnapshot>): DeviceSnapshot {
  return {
    mobile: false,
    webgpuSupported: true,
    webgpuDetail: "ok",
    deviceMemoryGb: 8,
    cpuCores: 8,
    ...partial,
  };
}

describe("assessCatalogEntryFit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks webllm unsupported without WebGPU", async () => {
    const fit = await assessCatalogEntryFit(
      entry,
      device({ webgpuSupported: false }),
      "fr",
    );
    expect(fit.level).toBe("unsupported");
    expect(fit.reason).toMatch(/WebGPU/i);
  });

  it("marks ollama unsupported when provider is unreachable", async () => {
    const ollamaEntry = { ...entry, id: "ollama-x", runtime: "ollama" as const, providerId: "ollama" };
    const fit = await assessCatalogEntryFit(ollamaEntry, device({}), "fr");
    expect(fit.level).toBe("unsupported");
    expect(fit.reason).toMatch(/Ollama/i);
  });

  it("buildDeviceSnapshot copies probe fields", () => {
    const snap = buildDeviceSnapshot(
      { supported: true, verdict: "optimal", detail: "GPU ok" },
      { deviceMemoryGb: 4, cpuCores: 4, connectionType: null },
    );
    expect(snap.webgpuSupported).toBe(true);
    expect(snap.deviceMemoryGb).toBe(4);
  });
});
