import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StreamChunk } from "@/providers/types";

type OnData = (chunk: unknown) => void;

const runtime = vi.hoisted(() => ({
  cachedSize: 0,
  load: vi.fn(async () => {}),
  exit: vi.fn(async () => {}),
  generate: vi.fn(async (options: { onData: OnData }) => {
    options.onData({ choices: [{ delta: { content: "Bonjour" }, finish_reason: null }] });
    options.onData({
      choices: [{ delta: {}, finish_reason: "stop" }],
      timings: { predicted_n: 12, predicted_per_second: 17.5 },
    });
  }),
  confirm: vi.fn(async () => true),
}));

vi.mock("@wllama/wllama/esm/index.js", () => ({
  Wllama: class {
    loadModelFromUrl = runtime.load;
    createChatCompletion = runtime.generate;
    exit = runtime.exit;
    setCompat() {}
  },
  ModelManager: class {
    async getModels() {
      return runtime.cachedSize > 0
        ? [{ url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf", size: runtime.cachedSize, remove: async () => {} }]
        : [];
    }
  },
  LoggerWithoutDebug: console,
}));

vi.mock("@/lib/confirm", () => ({ requestConfirm: runtime.confirm }));

async function loadModule() {
  vi.resetModules();
  return import("@/providers/portable");
}

async function run(
  provider: Awaited<ReturnType<typeof loadModule>>["portableProvider"],
  model: string,
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt?: string,
) {
  const chunks: StreamChunk[] = [];
  await provider.chatStream({ model, messages, systemPrompt }, undefined, (chunk) => chunks.push(chunk));
  return chunks;
}

describe("portable Qwen", () => {
  beforeEach(() => {
    runtime.cachedSize = 0;
    runtime.load.mockClear();
    runtime.exit.mockClear();
    runtime.generate.mockClear();
    runtime.confirm.mockReset();
    runtime.confirm.mockResolvedValue(true);
    localStorage.clear();
    localStorage.setItem("aidusia_lang", "fr");
  });

  it("lists the model without fetching it and reports whether it is downloaded", async () => {
    const { portableProvider, PORTABLE_MODEL_ID } = await loadModule();
    const models = await portableProvider.listModels();
    expect(models[0]).toMatchObject({ id: PORTABLE_MODEL_ID, downloaded: false });
    expect(runtime.load).not.toHaveBeenCalled();
  });

  it("asks before the first 1 GB download and never downloads when refused", async () => {
    runtime.confirm.mockResolvedValue(false);
    const { portableProvider, PORTABLE_MODEL_ID } = await loadModule();
    await expect(run(portableProvider, PORTABLE_MODEL_ID, [{ role: "user", content: "Salut" }]))
      .rejects.toThrow("Téléchargement du modèle portable annulé.");
    expect(runtime.confirm).toHaveBeenCalledTimes(1);
    expect(runtime.load).not.toHaveBeenCalled();
  });

  it("does not ask again once the weights are cached", async () => {
    runtime.cachedSize = 1_020_000_000;
    const { portableProvider, PORTABLE_MODEL_ID } = await loadModule();
    await run(portableProvider, PORTABLE_MODEL_ID, [{ role: "user", content: "Salut" }]);
    expect(runtime.confirm).not.toHaveBeenCalled();
    expect(runtime.load).toHaveBeenCalledTimes(1);
  });

  it("streams locally with the published sampling and reports engine throughput", async () => {
    const { portableProvider, PORTABLE_GGUF_URL, PORTABLE_MODEL_ID } = await loadModule();
    const chunks = await run(portableProvider, PORTABLE_MODEL_ID, [{ role: "user", content: "Salut" }], "Contexte app");

    expect(runtime.load).toHaveBeenCalledWith(
      PORTABLE_GGUF_URL,
      expect.objectContaining({ n_ctx: 4096, n_gpu_layers: 0, jinja: true }),
    );
    const request = runtime.generate.mock.calls[0][0] as unknown as {
      messages: { role: string; content: string }[];
      temperature: number;
      top_p: number;
    };
    expect(request).toMatchObject({ temperature: 0.7, top_p: 0.8, top_k: 20, penalty_repeat: 1.05 });
    expect(request.messages[0].role).toBe("system");
    expect(request.messages[0].content).toContain("You are Qwen, created by Alibaba Cloud.");
    expect(request.messages[0].content).toContain("Contexte app");
    expect(chunks).toEqual([
      { type: "text", delta: "Bonjour" },
      { type: "usage", outputTokens: 12, tokensPerSecond: 17.5 },
    ]);
  });

  it("keeps the conversation inside the context window", async () => {
    const { portableProvider, PORTABLE_MODEL_ID, portableHistoryBudget } = await loadModule();
    const long = "x".repeat(4_000);
    const messages = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `${index} ${long}`,
    }));
    messages.push({ role: "user", content: "dernière question" });
    await run(portableProvider, PORTABLE_MODEL_ID, messages);

    const request = runtime.generate.mock.calls[0][0] as unknown as { messages: { role: string; content: string }[] };
    const [system, ...history] = request.messages;
    const used = history.reduce((total, message) => total + message.content.length, 0);
    expect(used).toBeLessThanOrEqual(portableHistoryBudget(4096, system.content));
    expect(history.at(-1)?.content).toBe("dernière question");
  });

  it("refuses a single message larger than the context instead of failing in the engine", async () => {
    const { portableProvider, PORTABLE_MODEL_ID } = await loadModule();
    await expect(run(portableProvider, PORTABLE_MODEL_ID, [{ role: "user", content: "y".repeat(20_000) }]))
      .rejects.toThrow(/Message trop long/);
    expect(runtime.generate).not.toHaveBeenCalled();
  });

  it("marks answers cut by the length limit", async () => {
    runtime.generate.mockImplementationOnce(async (options: { onData: OnData }) => {
      options.onData({ choices: [{ delta: { content: "Début" }, finish_reason: "length" }] });
    });
    const { portableProvider, PORTABLE_MODEL_ID } = await loadModule();
    const chunks = await run(portableProvider, PORTABLE_MODEL_ID, [{ role: "user", content: "Salut" }]);
    const text = chunks.filter((chunk) => chunk.type === "text").map((chunk) => chunk.delta).join("");
    expect(text).toContain("Réponse coupée");
  });

  it("resets the engine after a generation failure and explains how to recover", async () => {
    runtime.generate.mockRejectedValueOnce(new Error("wasm trap"));
    const { portableProvider, PORTABLE_MODEL_ID } = await loadModule();
    await expect(run(portableProvider, PORTABLE_MODEL_ID, [{ role: "user", content: "Salut" }]))
      .rejects.toThrow(/Processeur/);
    expect(runtime.exit).toHaveBeenCalled();

    await run(portableProvider, PORTABLE_MODEL_ID, [{ role: "user", content: "Salut" }]);
    expect(runtime.load).toHaveBeenCalledTimes(2);
  });

  it("can be forced onto the processor", async () => {
    const { portableProvider, PORTABLE_MODEL_ID, getPortableBackend, setPortableBackend } = await loadModule();
    await setPortableBackend("cpu");
    expect(getPortableBackend()).toBe("cpu");
    await run(portableProvider, PORTABLE_MODEL_ID, [{ role: "user", content: "Salut" }]);
    expect(runtime.load).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ n_gpu_layers: 0 }));
  });
});
