import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";
import { probeWebGpu } from "@/lib/hardwareGovernor";

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
let enginePromise: Promise<Engine> | null = null;

function emitProgress(detail: LocalAiProgress) {
  window.dispatchEvent(new CustomEvent<LocalAiProgress>(LOCAL_AI_PROGRESS_EVENT, { detail }));
}

async function getEngine(model: string): Promise<Engine> {
  if (engine) {
    if (engineModel !== model) {
      emitProgress({ text: "", progress: 0 });
      await engine.reload(model);
      engineModel = model;
      emitProgress({ text: "", progress: 1 });
    }
    return engine;
  }
  if (enginePromise && engineModel === model) return enginePromise;
  engineModel = model;
  enginePromise = (async () => {
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
    const created = await CreateMLCEngine(model, {
      initProgressCallback: (report) => {
        emitProgress({ text: report.text, progress: report.progress });
      },
    });
    engine = created;
    return created;
  })();
  try {
    return await enginePromise;
  } catch (err) {
    engine = null;
    engineModel = null;
    enginePromise = null;
    emitProgress({ text: "", progress: 1 });
    throw err;
  }
}

export const browserLocalProvider: ChatProvider = {
  id: "browser",
  label: "Navigateur (local)",
  requiresApiKey: false,

  async listModels(): Promise<ProviderModel[]> {
    if (!("gpu" in navigator)) throw new Error(webgpuMissingMessage());
    return MODELS;
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
    try {
      const stream = await eng.chat.completions.create({ messages, stream: true });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) onChunk({ type: "text", delta });
      }
    } finally {
      params.signal?.removeEventListener("abort", abort);
    }
  },
};
