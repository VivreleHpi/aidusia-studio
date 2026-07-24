import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatStreamParams, StreamChunk } from "@/providers/types";

const { hasModelInCache, deleteModelAllInfoInCache, CreateMLCEngine, webLlmModuleLoads } = vi.hoisted(
  () => ({
    hasModelInCache: vi.fn(async () => false),
    deleteModelAllInfoInCache: vi.fn(async () => {}),
    CreateMLCEngine: vi.fn(),
    webLlmModuleLoads: { count: 0 },
  }),
);

vi.mock("@mlc-ai/web-llm", () => {
  webLlmModuleLoads.count += 1;
  return { hasModelInCache, deleteModelAllInfoInCache, CreateMLCEngine };
});

const LIGHTEST_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const OTHER_MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
const MEMORY_ERROR = "Buffer was unmapped before mapping was resolved";

function enableWebGpu(features: string[] = ["shader-f16"]) {
  Object.defineProperty(navigator, "gpu", {
    configurable: true,
    value: {
      requestAdapter: vi.fn(async () => ({ features: new Set(features) })),
    },
  });
}

function disableWebGpu() {
  Reflect.deleteProperty(navigator, "gpu");
}

// browserLocal.ts garde `engine`/`engineModel`/`f16Supported`/`generationChain`
// en variables de module : on repart d'une instance fraiche a chaque test
// pour qu'un test ne contamine jamais le suivant (support f16 mis en cache,
// moteur deja charge, etc.).
async function freshModule() {
  vi.resetModules();
  return import("@/providers/browserLocal");
}

function textChunk(content: string) {
  return { choices: [{ delta: { content } }] };
}

async function* chunksThenThrow(chunks: string[], error?: Error) {
  for (const c of chunks) yield textChunk(c);
  if (error) throw error;
}

function fakeEngine(create: () => unknown) {
  return {
    chat: { completions: { create: vi.fn(create) } },
    unload: vi.fn(async () => {}),
    interruptGenerate: vi.fn(async () => {}),
  };
}

function baseParams(overrides: Partial<ChatStreamParams> = {}): ChatStreamParams {
  return {
    model: LIGHTEST_MODEL_ID,
    messages: [{ role: "user", content: "Bonjour" }],
    ...overrides,
  };
}

function collectText(chunks: string[]) {
  return (chunk: StreamChunk) => {
    if (chunk.type === "text") chunks.push(chunk.delta);
  };
}

beforeEach(() => {
  hasModelInCache.mockReset();
  hasModelInCache.mockImplementation(async () => false);
  deleteModelAllInfoInCache.mockReset();
  deleteModelAllInfoInCache.mockImplementation(async () => {});
  CreateMLCEngine.mockReset();
  // Langue fixee pour des assertions deterministes (sinon dependante de la
  // langue par defaut du navigateur jsdom).
  localStorage.setItem("aidusia_lang", "fr");
});

afterEach(() => {
  webLlmModuleLoads.count = 0;
  disableWebGpu();
  localStorage.clear();
});

describe("browserLocalProvider model discovery", () => {
  it("lists the static catalog without probing the WebLLM cache", async () => {
    enableWebGpu();
    const { browserLocalProvider } = await freshModule();

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
    const { getLocalModelsStatus } = await freshModule();

    const statuses = await getLocalModelsStatus();

    expect(statuses).toHaveLength(3);
    expect(webLlmModuleLoads.count).toBe(1);
    expect(hasModelInCache).toHaveBeenCalledTimes(6);
  });

  it("rejects immediately when WebGPU isn't exposed by the browser", async () => {
    disableWebGpu();
    const { browserLocalProvider } = await freshModule();

    await expect(browserLocalProvider.listModels()).rejects.toThrow(/WebGPU/);
  });
});

describe("browserLocalProvider.testKey", () => {
  it("reports an actionable reason when navigator.gpu is entirely absent", async () => {
    disableWebGpu();
    const { browserLocalProvider } = await freshModule();

    const result = await browserLocalProvider.testKey("");
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/WebGPU/) });
  });

  it("reports the same actionable reason when navigator.gpu exists but no adapter responds", async () => {
    // Cas reel en CI (Playwright sans vrai GPU) : navigator.gpu est present
    // (secure context) mais requestAdapter() resout null.
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: { requestAdapter: vi.fn(async () => null) },
    });
    const { browserLocalProvider } = await freshModule();

    const result = await browserLocalProvider.testKey("");
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/WebGPU/) });
  });

  it("succeeds when an adapter is available", async () => {
    enableWebGpu();
    const { browserLocalProvider } = await freshModule();

    await expect(browserLocalProvider.testKey("")).resolves.toEqual({ ok: true });
  });
});

describe("f16/f32 variant resolution", () => {
  it("keeps the f16 model id when the GPU exposes shader-f16", async () => {
    enableWebGpu(["shader-f16"]);
    const { resolveModelId } = await freshModule();

    await expect(resolveModelId(LIGHTEST_MODEL_ID)).resolves.toBe(LIGHTEST_MODEL_ID);
  });

  it("falls back to the f32 variant when shader-f16 is absent", async () => {
    enableWebGpu([]);
    const { resolveModelId, f32VariantOf } = await freshModule();

    await expect(resolveModelId(LIGHTEST_MODEL_ID)).resolves.toBe(f32VariantOf(LIGHTEST_MODEL_ID));
  });

  it("treats a rejected requestAdapter as f16-unsupported", async () => {
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: {
        requestAdapter: vi.fn(async () => {
          throw new Error("no adapter");
        }),
      },
    });
    const { supportsF16 } = await freshModule();

    await expect(supportsF16()).resolves.toBe(false);
  });

  it("f32VariantOf swaps only the quantization suffix", async () => {
    const { f32VariantOf } = await freshModule();
    expect(f32VariantOf(LIGHTEST_MODEL_ID)).toBe("Llama-3.2-1B-Instruct-q4f32_1-MLC");
  });
});

describe("getLocalModelsStatus variant/size reporting", () => {
  it("reports the cached f16 variant and its size", async () => {
    enableWebGpu();
    hasModelInCache.mockImplementation(async (id: string) => id === LIGHTEST_MODEL_ID);
    const { getLocalModelsStatus } = await freshModule();

    const [status] = await getLocalModelsStatus();
    expect(status.variant).toBe("f16");
    expect(status.cached).toBe(true);
    expect(status.sizeGb).toBeCloseTo(0.7);
  });

  it("reports the cached f32 variant and its size when only f32 is downloaded", async () => {
    enableWebGpu();
    const f32Id = "Llama-3.2-1B-Instruct-q4f32_1-MLC";
    hasModelInCache.mockImplementation(async (id: string) => id === f32Id);
    const { getLocalModelsStatus } = await freshModule();

    const [status] = await getLocalModelsStatus();
    expect(status.variant).toBe("f32");
    expect(status.cached).toBe(true);
    expect(status.sizeGb).toBeCloseTo(1.1);
  });

  it("projects the f32 download size on a device without shader-f16 when nothing is cached", async () => {
    enableWebGpu([]);
    const { getLocalModelsStatus } = await freshModule();

    const [status] = await getLocalModelsStatus();
    expect(status.cached).toBe(false);
    expect(status.variant).toBeNull();
    expect(status.sizeGb).toBeCloseTo(1.1);
  });
});

describe("error classification", () => {
  it("classifies GPU memory/device-lost errors as memory errors", async () => {
    const { isMemoryError } = await freshModule();
    for (const detail of [
      "Buffer was unmapped before mapping was resolved",
      "out of memory",
      "Device was lost",
      "allocation failed",
    ]) {
      expect(isMemoryError(detail)).toBe(true);
    }
    expect(isMemoryError("Unexpected token < in JSON")).toBe(false);
  });

  it("also retries on a lost/destroyed model instance, in addition to memory errors", async () => {
    const { shouldRetry } = await freshModule();
    expect(shouldRetry("model not loaded")).toBe(true);
    expect(shouldRetry("instance was destroyed")).toBe(true);
    expect(shouldRetry(MEMORY_ERROR)).toBe(true);
    expect(shouldRetry("Unexpected token < in JSON")).toBe(false);
  });

  it("suggests the lightest model only when a heavier model ran out of memory", async () => {
    const { wrapGenerationError } = await freshModule();

    expect(wrapGenerationError(MEMORY_ERROR, OTHER_MODEL_ID, "fr").message).toMatch(/le plus léger/);
    expect(wrapGenerationError(MEMORY_ERROR, LIGHTEST_MODEL_ID, "fr").message).not.toMatch(/le plus léger/);
    expect(
      wrapGenerationError("Unexpected token < in JSON", OTHER_MODEL_ID, "fr").message,
    ).not.toMatch(/le plus léger/);
  });

  it("localizes the generation error message in English", async () => {
    const { wrapGenerationError } = await freshModule();
    const message = wrapGenerationError(MEMORY_ERROR, OTHER_MODEL_ID, "en").message;
    expect(message).toMatch(/lightest model/);
    expect(message).not.toMatch(/léger/);
  });
});

describe("chatStream engine lifecycle", () => {
  it("retries once after a transient memory error and succeeds", async () => {
    enableWebGpu();
    const failingEngine = fakeEngine(async () => chunksThenThrow([], new Error(MEMORY_ERROR)));
    const workingEngine = fakeEngine(async () => chunksThenThrow(["Bonjour"]));
    CreateMLCEngine.mockImplementationOnce(async () => failingEngine);
    CreateMLCEngine.mockImplementationOnce(async () => workingEngine);
    const { browserLocalProvider } = await freshModule();

    const chunks: string[] = [];
    await browserLocalProvider.chatStream(baseParams(), undefined, collectText(chunks));

    expect(chunks).toEqual(["Bonjour"]);
    expect(failingEngine.unload).toHaveBeenCalledTimes(1);
    expect(CreateMLCEngine).toHaveBeenCalledTimes(2);
  });

  it("fails with the lightest-model suggestion after a retry on a heavier model", async () => {
    enableWebGpu();
    CreateMLCEngine.mockImplementation(async () =>
      fakeEngine(async () => chunksThenThrow([], new Error(MEMORY_ERROR))),
    );
    const { browserLocalProvider } = await freshModule();

    await expect(
      browserLocalProvider.chatStream(baseParams({ model: OTHER_MODEL_ID }), undefined, () => {}),
    ).rejects.toThrow(/le plus léger/);
    expect(CreateMLCEngine).toHaveBeenCalledTimes(2);
  });

  it("fails with the generic message (no suggestion) when the lightest model itself runs out of memory", async () => {
    enableWebGpu();
    CreateMLCEngine.mockImplementation(async () =>
      fakeEngine(async () => chunksThenThrow([], new Error(MEMORY_ERROR))),
    );
    const { browserLocalProvider } = await freshModule();

    let caught: Error | undefined;
    try {
      await browserLocalProvider.chatStream(baseParams({ model: LIGHTEST_MODEL_ID }), undefined, () => {});
    } catch (err) {
      caught = err as Error;
    }
    expect(caught?.message).not.toMatch(/le plus léger/);
    expect(CreateMLCEngine).toHaveBeenCalledTimes(2);
  });

  it("does not retry on a non-transient error", async () => {
    enableWebGpu();
    CreateMLCEngine.mockImplementation(async () =>
      fakeEngine(async () => chunksThenThrow([], new Error("Unexpected token < in JSON"))),
    );
    const { browserLocalProvider } = await freshModule();

    await expect(browserLocalProvider.chatStream(baseParams(), undefined, () => {})).rejects.toThrow();
    expect(CreateMLCEngine).toHaveBeenCalledTimes(1);
  });

  it("does not retry once a chunk has already been streamed to the caller", async () => {
    enableWebGpu();
    CreateMLCEngine.mockImplementation(async () =>
      fakeEngine(async () => chunksThenThrow(["partial"], new Error(MEMORY_ERROR))),
    );
    const { browserLocalProvider } = await freshModule();

    const chunks: string[] = [];
    await expect(
      browserLocalProvider.chatStream(baseParams(), undefined, collectText(chunks)),
    ).rejects.toThrow();
    expect(chunks).toEqual(["partial"]);
    expect(CreateMLCEngine).toHaveBeenCalledTimes(1);
  });

  it("destroys and recreates the engine when switching models mid-conversation", async () => {
    enableWebGpu();
    const engineA = fakeEngine(async () => chunksThenThrow(["A"]));
    const engineB = fakeEngine(async () => chunksThenThrow(["B"]));
    CreateMLCEngine.mockImplementationOnce(async () => engineA);
    CreateMLCEngine.mockImplementationOnce(async () => engineB);
    const { browserLocalProvider } = await freshModule();

    await browserLocalProvider.chatStream(baseParams({ model: LIGHTEST_MODEL_ID }), undefined, () => {});
    await browserLocalProvider.chatStream(baseParams({ model: OTHER_MODEL_ID }), undefined, () => {});

    expect(engineA.unload).toHaveBeenCalledTimes(1);
    expect(CreateMLCEngine).toHaveBeenNthCalledWith(1, LIGHTEST_MODEL_ID, expect.anything());
    expect(CreateMLCEngine).toHaveBeenNthCalledWith(2, OTHER_MODEL_ID, expect.anything());
  });

  it("stops generation on abort without rejecting", async () => {
    enableWebGpu();
    let rejectGate!: (err: unknown) => void;
    const gate = new Promise<void>((_resolve, reject) => {
      rejectGate = reject;
    });
    const engine = fakeEngine(
      () =>
        (async function* () {
          await gate;
          yield textChunk("never");
        })(),
    );
    engine.interruptGenerate = vi.fn(async () => {
      rejectGate(new Error("aborted by user"));
    });
    CreateMLCEngine.mockImplementationOnce(async () => engine);
    const { browserLocalProvider } = await freshModule();

    const controller = new AbortController();
    const run = browserLocalProvider.chatStream(baseParams({ signal: controller.signal }), undefined, () => {});
    // Laisse getEngine()/CreateMLCEngine se resoudre et le listener "abort"
    // s'enregistrer avant de declencher l'abandon.
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();

    await expect(run).resolves.toBeUndefined();
    expect(engine.interruptGenerate).toHaveBeenCalledTimes(1);
  });

  it("serializes two overlapping generations so only one owns the GPU at a time", async () => {
    enableWebGpu();
    let releaseA!: () => void;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    const engineA = fakeEngine(
      () =>
        (async function* () {
          await gateA;
          yield textChunk("A");
        })(),
    );
    const engineB = fakeEngine(async () => chunksThenThrow(["B"]));
    CreateMLCEngine.mockImplementationOnce(async () => engineA);
    CreateMLCEngine.mockImplementationOnce(async () => engineB);
    const { browserLocalProvider } = await freshModule();

    const chunksA: string[] = [];
    const chunksB: string[] = [];
    const runA = browserLocalProvider.chatStream(baseParams(), undefined, collectText(chunksA));
    const runB = browserLocalProvider.chatStream(
      baseParams({ model: OTHER_MODEL_ID }),
      undefined,
      collectText(chunksB),
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(CreateMLCEngine).toHaveBeenCalledTimes(1);

    releaseA();
    await Promise.all([runA, runB]);

    expect(chunksA).toEqual(["A"]);
    expect(chunksB).toEqual(["B"]);
    expect(CreateMLCEngine).toHaveBeenCalledTimes(2);
  });
});
