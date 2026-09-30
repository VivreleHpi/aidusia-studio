import type { ChatProvider, ChatStreamParams, ProviderModel, StreamChunk } from "./types";
import { getStoredLang } from "@/lib/i18n";
import { LOCAL_AI_PROGRESS_EVENT, type LocalAiProgress } from "./browserLocal";
import wasmUrl from "@wllama/wllama/esm/wasm/wllama.wasm?url";

// Le GGUF officiel est chargé directement depuis Hugging Face et gardé dans
// le stockage du navigateur par wllama. Aucun serveur d'inférence n'intervient.
export const LUCIOLE_MODEL_ID = "OpenLLM-France/Luciole-1B-Instruct-1.1-GGUF:Q4_K_M";
export const LUCIOLE_GGUF_URL =
  "https://huggingface.co/OpenLLM-France/Luciole-1B-Instruct-1.1-GGUF/resolve/main/Luciole-1B-Instruct-1.1-Q4_K_M.gguf";

export async function getLucioleCacheSize(): Promise<number> {
  const { ModelManager } = await import("@wllama/wllama/esm/index.js");
  const models = await new ModelManager({ allowOffline: true }).getModels();
  return models.find((model) => model.url === LUCIOLE_GGUF_URL)?.size ?? 0;
}

export async function deleteLucioleModel(): Promise<void> {
  if (loadPromise) throw new Error("Luciole est en cours de chargement.");
  if (engine) {
    await engine.exit().catch(() => {});
    engine = null;
  }
  const { ModelManager } = await import("@wllama/wllama/esm/index.js");
  const models = await new ModelManager({ allowOffline: true }).getModels();
  await models.find((model) => model.url === LUCIOLE_GGUF_URL)?.remove();
}

type Engine = import("@wllama/wllama/esm/index.js").Wllama;
let engine: Engine | null = null;
let loadPromise: Promise<Engine> | null = null;
let generationChain: Promise<void> = Promise.resolve();

function progress(progress: number, text = ""): void {
  window.dispatchEvent(
    new CustomEvent<LocalAiProgress>(LOCAL_AI_PROGRESS_EVENT, {
      detail: { text, progress },
    }),
  );
}

async function getEngine(signal?: AbortSignal): Promise<Engine> {
  if (engine) return engine;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { Wllama, LoggerWithoutDebug } = await import("@wllama/wllama/esm/index.js");
    const candidate = new Wllama({ default: wasmUrl }, {
      allowOffline: true,
      logger: LoggerWithoutDebug,
    });
    try {
      const { compatResources } = await import("./lucioleCompat");
      candidate.setCompat(compatResources);
      progress(0);
      await candidate.loadModelFromUrl(LUCIOLE_GGUF_URL, {
        n_ctx: 2048,
        n_parallel: 1,
        n_gpu_layers: candidate.isSupportWebGPU() ? 999 : 0,
        jinja: true,
        signal,
        progressCallback: ({ loaded, total }) => {
          if (total > 0) progress(Math.min(0.85, (loaded / total) * 0.85));
        },
      });
      engine = candidate;
      progress(1);
      return candidate;
    } catch (error) {
      progress(1);
      await candidate.exit().catch(() => {});
      throw error;
    }
  })();
  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

export const lucioleProvider: ChatProvider = {
  id: "luciole",
  label: "Luciole 1B (local)",
  requiresApiKey: false,

  async listModels(): Promise<ProviderModel[]> {
    return [{
      id: LUCIOLE_MODEL_ID,
      label: getStoredLang() === "fr"
        ? "Luciole 1B — français (~1,02 Go)"
        : "Luciole 1B — French (~1.02 GB)",
    }];
  },

  async testKey() {
    return typeof WebAssembly === "object"
      ? { ok: true as const }
      : { ok: false as const, reason: "WebAssembly indisponible sur ce navigateur." };
  },

  async chatStream(
    params: ChatStreamParams,
    _apiKey: string | undefined,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    if (params.model !== LUCIOLE_MODEL_ID) throw new Error("Modèle Luciole inconnu.");
    const previous = generationChain;
    let release!: () => void;
    generationChain = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      if (params.signal?.aborted) return;
      const localEngine = await getEngine(params.signal);
      if (params.signal?.aborted) return;

      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
      if (params.systemPrompt) messages.push({ role: "system", content: params.systemPrompt });
      for (const message of params.messages) {
        if (message.role === "user" || message.role === "assistant" || message.role === "system") {
          messages.push({ role: message.role, content: message.content });
        }
      }

      await localEngine.createChatCompletion({
        messages,
        max_tokens: 256,
        stream: true,
        abortSignal: params.signal,
        onData: (chunk) => {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) onChunk({ type: "text", delta });
        },
      });
    } catch (error) {
      if (params.signal?.aborted) return;
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        getStoredLang() === "fr"
          ? `Luciole n'a pas pu démarrer sur cet appareil (stockage ou mémoire insuffisants, ou téléchargement interrompu). Détail : ${detail}`
          : `Luciole could not start on this device (insufficient storage or memory, or interrupted download). Detail: ${detail}`,
      );
    } finally {
      release();
    }
  },
};
