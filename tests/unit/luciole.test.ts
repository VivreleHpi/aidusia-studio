import { describe, expect, it, vi } from "vitest";
import { LUCIOLE_GGUF_URL, LUCIOLE_MODEL_ID, lucioleProvider } from "@/providers/luciole";

const runtime = vi.hoisted(() => ({
  load: vi.fn(async () => {}),
  generate: vi.fn(async (options: { onData: (chunk: unknown) => void }) => {
    options.onData({ choices: [{ delta: { content: "Bonjour" } }] });
  }),
}));

vi.mock("@wllama/wllama/esm/index.js", () => ({
  Wllama: class {
    loadModelFromUrl = runtime.load;
    createChatCompletion = runtime.generate;
    isSupportWebGPU() { return false; }
    setCompat() {}
  },
  LoggerWithoutDebug: console,
}));

describe("Luciole local", () => {
  it("lists the model without fetching it and streams a local response on first use", async () => {
    const models = await lucioleProvider.listModels();
    expect(models[0].id).toBe(LUCIOLE_MODEL_ID);
    expect(runtime.load).not.toHaveBeenCalled();

    const chunks: string[] = [];
    await lucioleProvider.chatStream(
      {
        model: LUCIOLE_MODEL_ID,
        messages: [{ role: "user", content: "Salut" }],
      },
      undefined,
      (chunk) => { if (chunk.type === "text") chunks.push(chunk.delta); },
    );

    expect(runtime.load).toHaveBeenCalledWith(
      LUCIOLE_GGUF_URL,
      expect.objectContaining({ n_ctx: 2048, n_gpu_layers: 0, jinja: true }),
    );
    expect(chunks).toEqual(["Bonjour"]);
  });
});
