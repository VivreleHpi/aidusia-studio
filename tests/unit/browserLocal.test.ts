import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browserLocalProvider,
  getLocalModelsStatus,
} from "@/providers/browserLocal";

const { hasModelInCache, webLlmModuleLoads } = vi.hoisted(() => ({
  hasModelInCache: vi.fn(async () => false),
  webLlmModuleLoads: { count: 0 },
}));

vi.mock("@mlc-ai/web-llm", () => {
  webLlmModuleLoads.count += 1;
  return { hasModelInCache };
});

function enableWebGpu() {
  Object.defineProperty(navigator, "gpu", {
    configurable: true,
    value: {
      requestAdapter: vi.fn(async () => ({ features: new Set(["shader-f16"]) })),
    },
  });
}

afterEach(() => {
  vi.clearAllMocks();
  webLlmModuleLoads.count = 0;
  Reflect.deleteProperty(navigator, "gpu");
});

describe("browserLocalProvider model discovery", () => {
  it("lists the static catalog without probing the WebLLM cache", async () => {
    enableWebGpu();

    const models = await browserLocalProvider.listModels();

    expect(models).toHaveLength(3);
    expect(models.map((model) => model.id)).toEqual([
      "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      "gemma-2-2b-it-q4f16_1-MLC",
    ]);
    expect(models.every((model) => model.downloaded === undefined)).toBe(true);
    expect(webLlmModuleLoads.count).toBe(0);
    expect(hasModelInCache).not.toHaveBeenCalled();
  });

  it("probes the cache only through the explicit local-model status action", async () => {
    enableWebGpu();

    const statuses = await getLocalModelsStatus();

    expect(statuses).toHaveLength(3);
    expect(webLlmModuleLoads.count).toBe(1);
    expect(hasModelInCache).toHaveBeenCalledTimes(6);
  });
});
