import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";
import { probeWebGpu } from "@/lib/hardwareGovernor";
import { isMobile } from "@/lib/deviceDetect";
import { getStoredLang } from "@/lib/i18n";
import { heavyOnMobileReason } from "@/lib/providerTaglines";

/* IA locale DANS le navigateur (WebGPU, moteur web-llm/MLC) : aucune
   installation, fonctionne aussi sur mobile (Chrome Android 121+, Safari 26).
   Les poids sont telecharges une fois depuis HuggingFace A LA DEMANDE de
   l'utilisateur, puis mis en cache par le navigateur (Cache Storage). Le
   moteur lui-meme est charge dynamiquement : zero cout tant qu'on ne s'en
   sert pas. */

export const LOCAL_AI_PROGRESS_EVENT = "aidusia:local-ai-progress";

export interface LocalAiProgress {
  text: string;
  progress: number; // 0..1
}

// Identifiants du catalogue prebuilt de web-llm (MLC). Petits modeles
// quantises q4f16 : choisis pour tenir sur un telephone recent.
const MODELS: ProviderModel[] = [
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B — léger (~0,7 Go)" },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen 2.5 1.5B — équilibré (~1 Go)" },
  { id: "gemma-2-2b-it-q4f16_1-MLC", label: "Gemma 2 2B — qualité (~1,4 Go)" },
];

// Tailles approximatives du telechargement selon la variante servie a cet
// appareil (f16 si le GPU expose shader-f16, sinon f32 — voir supportsF16).
const MODEL_SIZES_GB: Record<string, { f16: number; f32: number }> = {
  "Llama-3.2-1B-Instruct-q4f16_1-MLC": { f16: 0.7, f32: 1.1 },
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC": { f16: 1.0, f32: 1.5 },
  "gemma-2-2b-it-q4f16_1-MLC": { f16: 1.4, f32: 2.0 },
};

const WEBGPU_MISSING =
  "WebGPU indisponible sur ce navigateur. Il faut Chrome/Edge 121+ (y compris Android) " +
  "ou Safari 26 (iOS/macOS), avec l'accélération matérielle activée — voir le Gouverneur " +
  "Matériel dans le panneau Fournisseurs.";

/* Le remede depend du navigateur : dire exactement quoi faire vaut mieux
   qu'un constat generique. */
function webgpuMissingMessage(): string {
  const ua = navigator.userAgent;
  if (/SamsungBrowser/i.test(ua)) {
    return (
      "Samsung Internet ne supporte pas encore WebGPU : ouvrez le Studio dans Chrome " +
      "sur ce téléphone pour utiliser l'IA locale."
    );
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return (
      "L'IA locale dans le navigateur exige Safari 26 (iOS 26) ou plus récent. " +
      "Mettez iOS à jour, puis rouvrez le Studio dans Safari."
    );
  }
  if (/Firefox/i.test(ua)) {
    return (
      "WebGPU n'est pas encore activé dans Firefox : ouvrez le Studio dans Chrome " +
      "ou Edge pour utiliser l'IA locale."
    );
  }
  return WEBGPU_MISSING;
}

type Engine = import("@mlc-ai/web-llm").MLCEngineInterface;

let engine: Engine | null = null;
let engineModel: string | null = null;
// Serialise init/reload/destruction : deux envois rapproches (ou un envoi
// pendant un changement de modele) ne doivent jamais creer deux moteurs.
let engineOp: Promise<Engine> | null = null;
let f16Supported: boolean | null = null;

/* Beaucoup de GPU mobiles (et quelques desktops) n'exposent pas shader-f16 :
   les variantes q4f16 telechargent puis echouent a la compilation, sans
   message utile. On bascule alors sur les variantes q4f32 du meme modele
   (memes poids logiques, ~30% plus lourdes en VRAM). */
async function supportsF16(): Promise<boolean> {
  if (f16Supported !== null) return f16Supported;
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
    const adapter = await gpu?.requestAdapter();
    f16Supported = adapter?.features?.has("shader-f16") ?? false;
  } catch {
    f16Supported = false;
  }
  return f16Supported;
}

function f32VariantOf(modelId: string): string {
  return modelId.replace("q4f16_1", "q4f32_1");
}

async function resolveModelId(modelId: string): Promise<string> {
  if (await supportsF16()) return modelId;
  return f32VariantOf(modelId);
}

function emitProgress(detail: LocalAiProgress) {
  window.dispatchEvent(new CustomEvent<LocalAiProgress>(LOCAL_AI_PROGRESS_EVENT, { detail }));
}

/* Libere le moteur meme s'il est deja mort (device GPU perdu) : l'objectif
   est de remettre les singletons a zero pour que le prochain getEngine
   reparte d'un etat propre. */
async function destroyEngine(): Promise<void> {
  const old = engine;
  engine = null;
  engineModel = null;
  try {
    await old?.unload();
  } catch {
    // device deja perdu : rien a liberer
  }
}

async function loadEngine(actualModel: string): Promise<Engine> {
  if (engine && engineModel === actualModel) return engine;
  // Changement de modele : on DETRUIT l'ancien moteur avant d'en creer un neuf,
  // au lieu d'un reload() en place. reload() laissait des buffers / un cache KV
  // GPU de l'ancien modele -> erreurs quand on changeait d'IA locale EN COURS de
  // conversation (alors qu'un demarrage a froid, lui, marche). Repartir de zero
  // fait emprunter au changement exactement le meme chemin fiable que le 1er
  // chargement.
  if (engine) {
    emitProgress({ text: "", progress: 0 });
    await destroyEngine();
  }
  const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
  const created = await CreateMLCEngine(actualModel, {
    initProgressCallback: (report) => {
      emitProgress({ text: report.text, progress: report.progress });
    },
  });
  engine = created;
  engineModel = actualModel;
  // La compilation GPU peut reussir sans jamais emettre progress=1.
  emitProgress({ text: "", progress: 1 });
  return created;
}

async function getEngine(model: string): Promise<Engine> {
  const actualModel = await resolveModelId(model);
  const previous = engineOp;
  const op = (async () => {
    try {
      await previous;
    } catch {
      // l'echec precedent a deja ete signale a son appelant
    }
    return loadEngine(actualModel);
  })();
  engineOp = op;
  try {
    return await op;
  } catch (err) {
    await destroyEngine();
    emitProgress({ text: "", progress: 1 });
    throw err;
  }
}

// Le modele le plus leger du catalogue : le refuge quand un plus gros ne tient
// pas dans la memoire GPU du telephone.
const LIGHTEST_MODEL_ID = MODELS[0].id;
const LIGHTEST_MODEL_LABEL = "Llama 3.2 1B";

function isMemoryError(detail: string): boolean {
  return /out of memory|oom|mapasync|unmapped|gpubuffer|buffer was unmapped|device.*(lost|destroyed)|allocation failed/i.test(
    detail,
  );
}

/* Erreurs qui valent une reconstruction du moteur + une nouvelle tentative :
   modele perdu (onglet gele, device repris) ou buffer/allocation GPU rate de
   facon transitoire. Une seule reprise — si ca echoue encore, c'est
   probablement que le modele est trop lourd pour cet appareil. */
function shouldRetry(detail: string): boolean {
  return (
    /model not loaded|instance.*destroyed/i.test(detail) || isMemoryError(detail)
  );
}

function wrapGenerationError(detail: string, model: string): Error {
  const isLightest = model === LIGHTEST_MODEL_ID || model === f32VariantOf(LIGHTEST_MODEL_ID);
  if (isMemoryError(detail) && !isLightest) {
    return new Error(
      `Ce modèle est trop lourd pour la mémoire GPU de cet appareil. Choisissez le ` +
        `modèle le plus léger (« ${LIGHTEST_MODEL_LABEL} — léger ») dans le sélecteur ` +
        `en bas, il est fait pour les téléphones. Détail : ${detail}`,
    );
  }
  return new Error(
    "L'IA locale a échoué pendant la génération (mémoire GPU insuffisante ou onglet " +
      "déchargé par le système). Rechargez la page, et si besoin fermez d'autres onglets " +
      `pour libérer la mémoire. Détail : ${detail}`,
  );
}

/* ---- Gestion du stockage (panneau Fournisseurs) ---------------------- */

export interface LocalModelStatus {
  id: string;
  label: string;
  // present dans le Cache Storage du navigateur (telechargement deja fait)
  cached: boolean;
  // variante reellement en cache (f32 = GPU sans shader-f16)
  variant: "f16" | "f32" | null;
  // taille approx. (Go) de la variante en cache, ou de celle qui serait
  // telechargee sur CET appareil
  sizeGb: number;
  // actuellement charge en memoire GPU, pret a repondre sans attente
  loaded: boolean;
}

export async function getLocalModelsStatus(): Promise<LocalModelStatus[]> {
  const { hasModelInCache } = await import("@mlc-ai/web-llm");
  const deviceF16 = await supportsF16();
  return Promise.all(
    MODELS.map(async (m) => {
      const f32Id = f32VariantOf(m.id);
      const sizes = MODEL_SIZES_GB[m.id];
      // Le sondage du cache ne doit jamais faire disparaitre un modele de la
      // liste : en cas d'echec on le montre simplement comme non telecharge.
      let hasF16 = false;
      let hasF32 = false;
      try {
        [hasF16, hasF32] = await Promise.all([hasModelInCache(m.id), hasModelInCache(f32Id)]);
      } catch {
        /* cache illisible : statut "non telecharge" par defaut */
      }
      const variant = hasF16 ? ("f16" as const) : hasF32 ? ("f32" as const) : null;
      return {
        id: m.id,
        label: m.label,
        cached: hasF16 || hasF32,
        variant,
        sizeGb:
          variant === "f16" ? sizes.f16
          : variant === "f32" ? sizes.f32
          : deviceF16 ? sizes.f16
          : sizes.f32,
        loaded: engine !== null && (engineModel === m.id || engineModel === f32Id),
      };
    }),
  );
}

export async function deleteLocalModel(modelId: string): Promise<void> {
  const f32Id = f32VariantOf(modelId);
  // Si ce modele est celui en memoire, le decharger d'abord — sinon le cache
  // se reconstituerait partiellement et l'etat afficherait n'importe quoi.
  if (engineModel === modelId || engineModel === f32Id) await destroyEngine();
  const { deleteModelAllInfoInCache } = await import("@mlc-ai/web-llm");
  await deleteModelAllInfoInCache(modelId);
  await deleteModelAllInfoInCache(f32Id);
}

export function getLoadedLocalModel(): string | null {
  return engine ? engineModel : null;
}

/* ----------------------------------------------------------------------- */

export const browserLocalProvider: ChatProvider = {
  id: "browser",
  label: "Sur cet appareil",
  requiresApiKey: false,

  async listModels(): Promise<ProviderModel[]> {
    if (!("gpu" in navigator)) throw new Error(webgpuMissingMessage());
    // Sur mobile, seul le modele le plus leger (Llama 1B) tient dans la memoire
    // GPU d'un telephone ; les plus lourds sont grises (selectionnables sur PC).
    // Retour utilisateur : "ce modele est trop lourd" sur les 1.5B / 2B.
    const mobile = isMobile();
    const heavyReason = heavyOnMobileReason(getStoredLang());
    const gate = (m: ProviderModel): ProviderModel =>
      mobile && m.id !== MODELS[0].id
        ? { ...m, disabled: true, disabledReason: heavyReason }
        : m;
    // Statut "deja sur l'appareil" best-effort : si le cache est illisible,
    // la liste reste utilisable sans ce marquage.
    try {
      const { hasModelInCache } = await import("@mlc-ai/web-llm");
      return await Promise.all(
        MODELS.map(async (m) => ({
          ...gate(m),
          downloaded: (await hasModelInCache(m.id)) || (await hasModelInCache(f32VariantOf(m.id))),
        })),
      );
    } catch {
      return MODELS.map(gate);
    }
  },

  async testKey(): Promise<KeyTestResult> {
    const probe = await probeWebGpu();
    if (!probe.supported) {
      return {
        ok: false,
        reason:
          probe.detail === "WebGPU non expose par ce navigateur"
            ? webgpuMissingMessage()
            : probe.detail,
      };
    }
    return { ok: true };
  },

  async chatStream(
    params: ChatStreamParams,
    apiKey: string | undefined,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    // Une seule generation a la fois sur le GPU. Deux envois rapproches (ou un
    // retry qui chevauche) partageaient les memes buffers WebGPU -> erreur
    // "Buffer was unmapped before mapping was resolved". On serialise.
    const previous = generationChain;
    let release!: () => void;
    generationChain = new Promise<void>((r) => (release = r));
    try {
      await previous;
    } catch {
      /* l'echec precedent est deja remonte a son appelant */
    }
    try {
      await runGeneration(params, apiKey, onChunk);
    } finally {
      release();
    }
  },
};

// Verrou : chaine de promesses garantissant l'execution sequentielle des
// generations locales (une seule a la fois sur le GPU).
let generationChain: Promise<void> = Promise.resolve();

async function runGeneration(
  params: ChatStreamParams,
  _apiKey: string | undefined,
  onChunk: (chunk: StreamChunk) => void,
): Promise<void> {
    if (!("gpu" in navigator)) throw new Error(webgpuMissingMessage());
    let eng: Engine;
    try {
      eng = await getEngine(params.model);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        "Impossible d'initialiser l'IA locale sur cet appareil (téléchargement " +
          `interrompu, adaptateur WebGPU refusé ou mémoire insuffisante). Détail : ${detail}`,
      );
    }

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
    if (params.systemPrompt) messages.push({ role: "system", content: params.systemPrompt });
    for (const m of params.messages) {
      // Outils MCP et images non supportes par ce fournisseur (v1, texte seul).
      if (m.role === "tool") continue;
      if (m.role === "system" || m.role === "user" || m.role === "assistant") {
        messages.push({ role: m.role, content: m.content });
      }
    }

    const abort = () => {
      void eng.interruptGenerate();
    };
    params.signal?.addEventListener("abort", abort, { once: true });

    let emitted = false;
    const generate = async () => {
      const stream = await eng.chat.completions.create({ messages, stream: true });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          emitted = true;
          onChunk({ type: "text", delta });
        }
      }
    };

    try {
      await generate();
    } catch (err) {
      if (params.signal?.aborted) return;
      const detail = err instanceof Error ? err.message : String(err);
      // Modele perdu (onglet gele, device GPU repris) ou buffer/allocation GPU
      // rate de facon transitoire ("Buffer was unmapped..."). Les poids sont
      // deja en cache : on reconstruit le moteur et on reessaie UNE fois, sans
      // deranger l'utilisateur — seulement si rien n'a encore ete emis.
      if (!shouldRetry(detail) || emitted) throw wrapGenerationError(detail, params.model);
      await destroyEngine();
      try {
        eng = await getEngine(params.model);
        await generate();
      } catch (retryErr) {
        if (params.signal?.aborted) return;
        throw wrapGenerationError(
          retryErr instanceof Error ? retryErr.message : String(retryErr),
          params.model,
        );
      }
    } finally {
      params.signal?.removeEventListener("abort", abort);
    }
}
