import type { ChatProvider, ChatStreamParams, ProviderModel, StreamChunk } from "./types";
import { requestConfirm } from "@/lib/confirm";
import {
  PORTABLE_MAX_OUTPUT_TOKENS,
  portableContextTokens,
  portablePrepareMessages,
} from "@/lib/portableContext";
import { getStoredLang, type Lang } from "@/lib/i18n";
import { LOCAL_AI_PROGRESS_EVENT, type LocalAiProgress } from "./browserLocal";
import wasmUrl from "@wllama/wllama/esm/wasm/wllama.wasm?url";

// GGUF officiel Qwen, chargé depuis Hugging Face et gardé dans le navigateur.
// Aucun serveur d'inférence. Choisi pour un téléphone : 0,5B, ~0,5 Go, français inclus.
export { portableHistoryBudget } from "@/lib/portableContext";
export const PORTABLE_MODEL_ID = "Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M";
export const PORTABLE_GGUF_URL =
  "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf";
const RETIRED_LUCIOLE_GGUF_URL =
  "https://huggingface.co/OpenLLM-France/Luciole-1B-Instruct-1.1-GGUF/resolve/main/Luciole-1B-Instruct-1.1-Q4_K_M.gguf";

// q4_k_m ≈ 491 Mo + marge navigateur.
const REQUIRED_FREE_BYTES = 650_000_000;

// Réglages conseillés Qwen2.5 Instruct (pas ceux de Luciole).
const SAMPLING = { temperature: 0.7, top_p: 0.8, top_k: 20, penalty_repeat: 1.05 } as const;

export type PortableBackend = "auto" | "cpu";
const BACKEND_STORAGE_KEY = "aidusia_portable_backend";

export function getPortableBackend(): PortableBackend {
  try {
    return localStorage.getItem(BACKEND_STORAGE_KEY) === "cpu" ? "cpu" : "auto";
  } catch {
    return "auto";
  }
}

export async function setPortableBackend(backend: PortableBackend): Promise<void> {
  if (backend === "cpu") localStorage.setItem(BACKEND_STORAGE_KEY, "cpu");
  else localStorage.removeItem(BACKEND_STORAGE_KEY);
  // Le moteur chargé avec l'autre mode sera recréé au prochain message.
  if (engine && !loadPromise && engine.gpu !== (backend === "auto" && (await hasWebGpuAdapter()))) {
    await unloadEngine();
  }
}

/** Mode de calcul réellement utilisé par le moteur chargé (null = pas chargé). */
export function getPortableRuntime(): { gpu: boolean } | null {
  return engine ? { gpu: engine.gpu } : null;
}

async function hasWebGpuAdapter(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return Boolean(gpu && (await gpu.requestAdapter()));
  } catch {
    return false;
  }
}

async function freeStorageBytes(): Promise<number | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate?.quota) return null;
    return estimate.quota - (estimate.usage ?? 0);
  } catch {
    return null;
  }
}

function formatGb(bytes: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 1 }).format(bytes / 1e9);
}

export async function getPortableCacheSize(): Promise<number> {
  const { ModelManager } = await import("@wllama/wllama/esm/index.js");
  const models = await new ModelManager({ allowOffline: true }).getModels();
  return models.find((model) => model.url === PORTABLE_GGUF_URL)?.size ?? 0;
}

async function removeCachedWeights(url: string): Promise<void> {
  const { ModelManager } = await import("@wllama/wllama/esm/index.js");
  const models = await new ModelManager({ allowOffline: true }).getModels();
  await models.find((model) => model.url === url)?.remove();
}

export async function deletePortableModel(): Promise<void> {
  if (loadPromise) throw new Error(getStoredLang() === "fr" ? "Le modèle portable est en cours de chargement." : "The portable model is loading.");
  await unloadEngine();
  await removeCachedWeights(PORTABLE_GGUF_URL);
  await removeCachedWeights(RETIRED_LUCIOLE_GGUF_URL);
}

// Erreur déjà formulée pour l'utilisateur : relayée telle quelle.
class PortableError extends Error {}

type Wllama = import("@wllama/wllama/esm/index.js").Wllama;
interface LoadedEngine {
  wllama: Wllama;
  gpu: boolean;
  nCtx: number;
}
let engine: LoadedEngine | null = null;
let loadPromise: Promise<LoadedEngine> | null = null;
let generationChain: Promise<void> = Promise.resolve();

async function unloadEngine(): Promise<void> {
  const old = engine;
  engine = null;
  await old?.wllama.exit().catch(() => {});
}

function progress(value: number, text = ""): void {
  window.dispatchEvent(
    new CustomEvent<LocalAiProgress>(LOCAL_AI_PROGRESS_EVENT, {
      detail: { text, progress: value, source: "portable" },
    }),
  );
}

/* Premier téléchargement : ~1 Go, souvent sur réseau mobile. On vérifie
   l'espace libre puis on demande l'accord explicite avant d'envoyer la
   moindre requête vers Hugging Face. */
async function ensureDownloadAllowed(lang: Lang): Promise<void> {
  if ((await getPortableCacheSize().catch(() => 0)) > 0) return;

  const free = await freeStorageBytes();
  if (free !== null && free < REQUIRED_FREE_BYTES) {
    throw new PortableError(
      lang === "fr"
        ? `Espace insuffisant pour l'IA portable : il faut environ 0,7 Go libres, ${formatGb(free, lang)} Go disponibles dans le stockage du navigateur.`
        : `Not enough space for the portable model: about 0.7 GB free is needed, ${formatGb(free, lang)} GB available in browser storage.`,
    );
  }

  const freeLine = free === null
    ? ""
    : lang === "fr"
      ? `\n\nEspace disponible : ${formatGb(free, lang)} Go.`
      : `\n\nAvailable space: ${formatGb(free, lang)} GB.`;
  const confirmed = await requestConfirm(
    lang === "fr"
      ? {
          title: "Télécharger Qwen 0.5B (0,49 Go) ?",
          message:
            "Modèle local pour téléphone : Qwen2.5 0.5B, téléchargé une fois depuis Hugging Face, puis hors connexion. Wi-Fi recommandé.\n\n" +
            "C'est un petit modèle : il peut se tromper. Il comprend le français, sans WebGPU." +
            freeLine,
          confirmLabel: "Télécharger",
          cancelLabel: "Annuler",
        }
      : {
          title: "Download Qwen 0.5B (0.49 GB)?",
          message:
            "On-phone local model: Qwen2.5 0.5B downloads once from Hugging Face, then works offline. Wi-Fi recommended.\n\n" +
            "It is a small model and can be wrong. It understands French and does not need WebGPU." +
            freeLine,
          confirmLabel: "Download",
          cancelLabel: "Cancel",
        },
  );
  if (!confirmed) {
    throw new PortableError(lang === "fr" ? "Téléchargement du modèle portable annulé." : "Portable model download cancelled.");
  }
  // Sans stockage persistant, un navigateur mobile peut évincer le GGUF sans prévenir.
  await navigator.storage?.persist?.().catch(() => false);
}

async function getEngine(lang: Lang, signal?: AbortSignal): Promise<LoadedEngine> {
  const gpu = getPortableBackend() === "auto" && (await hasWebGpuAdapter());
  if (engine && engine.gpu === gpu) return engine;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    await unloadEngine();
    await ensureDownloadAllowed(lang);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const { Wllama, LoggerWithoutDebug } = await import("@wllama/wllama/esm/index.js");
    const candidate = new Wllama({ default: wasmUrl }, {
      allowOffline: true,
      logger: LoggerWithoutDebug,
    });
    const nCtx = portableContextTokens();
    try {
      const { compatResources } = await import("./lucioleCompat");
      candidate.setCompat(compatResources);
      progress(0);
      await candidate.loadModelFromUrl(PORTABLE_GGUF_URL, {
        n_ctx: nCtx,
        n_parallel: 1,
        n_gpu_layers: gpu ? 999 : 0,
        jinja: true,
        signal,
        progressCallback: ({ loaded, total }) => {
          if (total > 0) progress(Math.min(0.85, (loaded / total) * 0.85));
        },
      });
      const loaded = { wllama: candidate, gpu, nCtx };
      engine = loaded;
      progress(1);
      return loaded;
    } catch (error) {
      progress(1);
      await candidate.exit().catch(() => {});
      if (signal?.aborted) throw error;
      const detail = error instanceof Error ? error.message : String(error);
      throw new PortableError(
        lang === "fr"
          ? `Le modèle portable n'a pas pu se charger (mémoire, stockage ou téléchargement interrompu). Détail : ${detail}`
          : `The portable model could not load (memory, storage, or interrupted download). Detail: ${detail}`,
      );
    }
  })();
  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

function truncatedNotice(lang: Lang): string {
  return lang === "fr"
    ? "\n\n*[Réponse coupée : limite de longueur atteinte. Écrivez « continue » pour la suite.]*"
    : "\n\n*[Answer cut off: length limit reached. Type “continue” for the rest.]*";
}

export const portableProvider: ChatProvider = {
  id: "portable",
  label: "Qwen 0.5B (portable)",
  requiresApiKey: false,

  async listModels(): Promise<ProviderModel[]> {
    // Ancien GGUF Luciole : retiré du produit, effacé dès que ce fournisseur est listé.
    await removeCachedWeights(RETIRED_LUCIOLE_GGUF_URL).catch(() => {});
    const size = await getPortableCacheSize().catch(() => 0);
    return [{
      id: PORTABLE_MODEL_ID,
      label: getStoredLang() === "fr"
        ? "Qwen 2.5 0.5B — téléphone (~0,49 Go)"
        : "Qwen 2.5 0.5B — phone (~0.49 GB)",
      downloaded: size > 0,
    }];
  },

  async testKey() {
    return typeof WebAssembly === "object"
      ? { ok: true as const }
      : { ok: false as const, reason: getStoredLang() === "fr" ? "WebAssembly indisponible sur ce navigateur." : "WebAssembly is unavailable in this browser." };
  },

  async chatStream(
    params: ChatStreamParams,
    _apiKey: string | undefined,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    const lang = getStoredLang();
    if (params.model !== PORTABLE_MODEL_ID) throw new Error(lang === "fr" ? "Modèle portable inconnu." : "Unknown portable model.");
    const previous = generationChain;
    let release!: () => void;
    generationChain = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      if (params.signal?.aborted) return;
      const loaded = await getEngine(lang, params.signal);
      if (params.signal?.aborted) return;

      const prepared = portablePrepareMessages(params.messages, loaded.nCtx, lang, params.systemPrompt);
      const { budget, history, system } = prepared;
      const lastUser = history.filter((message) => message.role === "user").at(-1);
      if (lastUser && lastUser.content.length > budget) {
        throw new PortableError(
          lang === "fr"
            ? `Message trop long pour ce téléphone (environ ${budget.toLocaleString("fr-FR")} caractères maximum). Raccourcissez-le ou utilisez un autre modèle.`
            : `Message too long for this phone (about ${budget.toLocaleString("en-US")} characters max). Shorten it or use another model.`,
        );
      }

      const messages = [
        { role: "system" as const, content: system },
        ...history.map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
      ];

      let truncated = false;
      try {
        await loaded.wllama.createChatCompletion({
          messages,
          max_tokens: PORTABLE_MAX_OUTPUT_TOKENS,
          ...SAMPLING,
          stream: true,
          abortSignal: params.signal,
          onData: (chunk) => {
            const choice = chunk.choices[0];
            const delta = choice?.delta?.content;
            if (delta) onChunk({ type: "text", delta });
            if (choice?.finish_reason === "length") truncated = true;
            if (chunk.timings?.predicted_n) {
              onChunk({
                type: "usage",
                outputTokens: chunk.timings.predicted_n,
                tokensPerSecond: chunk.timings.predicted_per_second,
              });
            }
          },
        });
      } catch (error) {
        if (params.signal?.aborted) return;
        // Un moteur WASM en échec peut rester incohérent : on repart à neuf.
        await unloadEngine();
        const detail = error instanceof Error ? error.message : String(error);
        throw new PortableError(
          lang === "fr"
            ? `Le modèle portable s'est interrompu. Réessayez ; si cela se reproduit, passez le calcul sur « Processeur » dans Fournisseurs → Qwen 0.5B → Modèles. Détail : ${detail}`
            : `The portable model stopped while answering. Try again; if it happens again, switch computation to “Processor” under Providers → Qwen 0.5B → Models. Detail: ${detail}`,
        );
      }
      if (truncated && !params.signal?.aborted) onChunk({ type: "text", delta: truncatedNotice(lang) });
    } catch (error) {
      if (params.signal?.aborted) return;
      if (error instanceof PortableError) throw error;
      throw new Error(error instanceof Error ? error.message : String(error));
    } finally {
      release();
    }
  },
};
