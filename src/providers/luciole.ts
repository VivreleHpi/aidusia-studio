import type { ChatProvider, ChatStreamParams, ProviderModel, StreamChunk } from "./types";
import { requestConfirm } from "@/lib/confirm";
import { selectMessagesForContext } from "@/lib/contextWindow";
import { isMobile } from "@/lib/deviceDetect";
import { getStoredLang, type Lang } from "@/lib/i18n";
import { LOCAL_AI_PROGRESS_EVENT, type LocalAiProgress } from "./browserLocal";
import wasmUrl from "@wllama/wllama/esm/wasm/wllama.wasm?url";

// Le GGUF officiel est chargé directement depuis Hugging Face et gardé dans
// le stockage du navigateur par wllama. Aucun serveur d'inférence n'intervient.
export const LUCIOLE_MODEL_ID = "OpenLLM-France/Luciole-1B-Instruct-1.1-GGUF:Q4_K_M";
export const LUCIOLE_GGUF_URL =
  "https://huggingface.co/OpenLLM-France/Luciole-1B-Instruct-1.1-GGUF/resolve/main/Luciole-1B-Instruct-1.1-Q4_K_M.gguf";

// Poids ~1,02 Go + marge pour le cache du navigateur et les métadonnées.
const REQUIRED_FREE_BYTES = 1_150_000_000;

// Cache KV de ce modèle : ~48 Ko par token (24 couches × 8 têtes KV × 64 × K+V
// en f16). 2048 tokens (~100 Mo) sur téléphone, 4096 (~200 Mo) ailleurs.
export function lucioleContextTokens(): number {
  return isMobile() ? 2048 : 4096;
}
export const LUCIOLE_MAX_OUTPUT_TOKENS = 640;
// ~5 caractères/token mesurés en français courant ; 3 par prudence (code,
// chiffres, autres langues) pour ne jamais déborder du contexte.
const CHARS_PER_TOKEN = 3;
const PROMPT_OVERHEAD_TOKENS = 64;

export function lucioleHistoryBudget(nCtx: number, systemPrompt: string): number {
  return (nCtx - LUCIOLE_MAX_OUTPUT_TOKENS - PROMPT_OVERHEAD_TOKENS) * CHARS_PER_TOKEN - systemPrompt.length;
}

// Réglages publiés dans le GGUF (general.sampling.*).
const SAMPLING = { temperature: 0.7, top_p: 0.9 } as const;

// Le template du modèle n'injecte son identité que sans message système ;
// l'app en fournit toujours un, on la remet donc en tête.
const IDENTITY: Record<Lang, string> = {
  fr: "Tu es Luciole, un assistant IA utile, entraîné par LINAGORA et OpenLLM France.",
  en: "You are a helpful AI assistant named Luciole, trained by LINAGORA and OpenLLM France.",
};

/* Calcul : "auto" = carte graphique (WebGPU) si un adaptateur répond, sinon
   processeur. "cpu" force le processeur : plus lent, mais contourne les
   pilotes GPU mobiles qui produisent des réponses incohérentes. */
export type LucioleBackend = "auto" | "cpu";
const BACKEND_STORAGE_KEY = "aidusia_luciole_backend";

export function getLucioleBackend(): LucioleBackend {
  try {
    return localStorage.getItem(BACKEND_STORAGE_KEY) === "cpu" ? "cpu" : "auto";
  } catch {
    return "auto";
  }
}

export async function setLucioleBackend(backend: LucioleBackend): Promise<void> {
  if (backend === "cpu") localStorage.setItem(BACKEND_STORAGE_KEY, "cpu");
  else localStorage.removeItem(BACKEND_STORAGE_KEY);
  // Le moteur chargé avec l'autre mode sera recréé au prochain message.
  if (engine && !loadPromise && engine.gpu !== (backend === "auto" && (await hasWebGpuAdapter()))) {
    await unloadEngine();
  }
}

/** Mode de calcul réellement utilisé par le moteur chargé (null = pas chargé). */
export function getLucioleRuntime(): { gpu: boolean } | null {
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

export async function getLucioleCacheSize(): Promise<number> {
  const { ModelManager } = await import("@wllama/wllama/esm/index.js");
  const models = await new ModelManager({ allowOffline: true }).getModels();
  return models.find((model) => model.url === LUCIOLE_GGUF_URL)?.size ?? 0;
}

export async function deleteLucioleModel(): Promise<void> {
  if (loadPromise) throw new Error(getStoredLang() === "fr" ? "Luciole est en cours de chargement." : "Luciole is loading.");
  await unloadEngine();
  const { ModelManager } = await import("@wllama/wllama/esm/index.js");
  const models = await new ModelManager({ allowOffline: true }).getModels();
  await models.find((model) => model.url === LUCIOLE_GGUF_URL)?.remove();
}

// Erreur déjà formulée pour l'utilisateur : relayée telle quelle.
class LucioleError extends Error {}

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
      detail: { text, progress: value, source: "luciole" },
    }),
  );
}

/* Premier téléchargement : ~1 Go, souvent sur réseau mobile. On vérifie
   l'espace libre puis on demande l'accord explicite avant d'envoyer la
   moindre requête vers Hugging Face. */
async function ensureDownloadAllowed(lang: Lang): Promise<void> {
  if ((await getLucioleCacheSize().catch(() => 0)) > 0) return;

  const free = await freeStorageBytes();
  if (free !== null && free < REQUIRED_FREE_BYTES) {
    throw new LucioleError(
      lang === "fr"
        ? `Espace insuffisant pour Luciole : il faut environ 1,2 Go libres, ${formatGb(free, lang)} Go disponibles dans le stockage du navigateur.`
        : `Not enough space for Luciole: about 1.2 GB free is needed, ${formatGb(free, lang)} GB available in browser storage.`,
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
          title: "Télécharger Luciole (1,02 Go) ?",
          message:
            "Le modèle est téléchargé une seule fois depuis Hugging Face, puis reste sur cet appareil et fonctionne hors connexion. Wi-Fi recommandé.\n\n" +
            "Luciole est un petit modèle en bêta : ses réponses peuvent être lentes sur téléphone et parfois inexactes." +
            freeLine,
          confirmLabel: "Télécharger",
          cancelLabel: "Annuler",
        }
      : {
          title: "Download Luciole (1.02 GB)?",
          message:
            "The model downloads once from Hugging Face, then stays on this device and works offline. Wi-Fi recommended.\n\n" +
            "Luciole is a small beta model: answers can be slow on phones and sometimes inaccurate." +
            freeLine,
          confirmLabel: "Download",
          cancelLabel: "Cancel",
        },
  );
  if (!confirmed) {
    throw new LucioleError(lang === "fr" ? "Téléchargement de Luciole annulé." : "Luciole download cancelled.");
  }
  // Sans stockage persistant, un navigateur mobile peut évincer 1 Go sans prévenir.
  await navigator.storage?.persist?.().catch(() => false);
}

async function getEngine(lang: Lang, signal?: AbortSignal): Promise<LoadedEngine> {
  const gpu = getLucioleBackend() === "auto" && (await hasWebGpuAdapter());
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
    const nCtx = lucioleContextTokens();
    try {
      const { compatResources } = await import("./lucioleCompat");
      candidate.setCompat(compatResources);
      progress(0);
      await candidate.loadModelFromUrl(LUCIOLE_GGUF_URL, {
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
      throw new LucioleError(
        lang === "fr"
          ? `Luciole n'a pas pu se charger sur cet appareil (mémoire ou stockage insuffisants, ou téléchargement interrompu). Détail : ${detail}`
          : `Luciole could not load on this device (insufficient memory or storage, or interrupted download). Detail: ${detail}`,
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

export const lucioleProvider: ChatProvider = {
  id: "luciole",
  label: "Luciole 1B (local)",
  requiresApiKey: false,

  async listModels(): Promise<ProviderModel[]> {
    const size = await getLucioleCacheSize().catch(() => 0);
    return [{
      id: LUCIOLE_MODEL_ID,
      label: getStoredLang() === "fr"
        ? "Luciole 1B — français (~1,02 Go)"
        : "Luciole 1B — French (~1.02 GB)",
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
    if (params.model !== LUCIOLE_MODEL_ID) throw new Error(lang === "fr" ? "Modèle Luciole inconnu." : "Unknown Luciole model.");
    const previous = generationChain;
    let release!: () => void;
    generationChain = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      if (params.signal?.aborted) return;
      const loaded = await getEngine(lang, params.signal);
      if (params.signal?.aborted) return;

      const systemPrompt = params.systemPrompt ? `${IDENTITY[lang]}\n\n${params.systemPrompt}` : IDENTITY[lang];
      const budget = lucioleHistoryBudget(loaded.nCtx, systemPrompt);
      const history = selectMessagesForContext(
        params.messages.filter((message) => message.role === "user" || message.role === "assistant"),
        budget,
      );
      const lastUser = history.filter((message) => message.role === "user").at(-1);
      if (lastUser && lastUser.content.length > budget) {
        throw new LucioleError(
          lang === "fr"
            ? `Message trop long pour Luciole sur cet appareil (environ ${budget.toLocaleString("fr-FR")} caractères maximum). Raccourcissez-le ou utilisez un autre modèle.`
            : `Message too long for Luciole on this device (about ${budget.toLocaleString("en-US")} characters max). Shorten it or use another model.`,
        );
      }

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
      ];

      let truncated = false;
      try {
        await loaded.wllama.createChatCompletion({
          messages,
          max_tokens: LUCIOLE_MAX_OUTPUT_TOKENS,
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
        throw new LucioleError(
          lang === "fr"
            ? `Luciole s'est interrompu pendant la réponse. Réessayez ; si cela se reproduit, passez le calcul sur « Processeur » dans Fournisseurs → Luciole 1B → Modèles. Détail : ${detail}`
            : `Luciole stopped while answering. Try again; if it happens again, switch computation to “Processor” under Providers → Luciole 1B → Models. Detail: ${detail}`,
        );
      }
      if (truncated && !params.signal?.aborted) onChunk({ type: "text", delta: truncatedNotice(lang) });
    } catch (error) {
      if (params.signal?.aborted) return;
      if (error instanceof LucioleError) throw error;
      throw new Error(error instanceof Error ? error.message : String(error));
    } finally {
      release();
    }
  },
};
