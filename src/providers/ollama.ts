import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";
import { buildOpenAiCompatibleBody } from "./openaiCompatibleStream";
import { detectOs, isLocalOrigin, ollamaOriginsCommand } from "@/lib/deviceDetect";

const DEFAULT_BASE_URL = "http://localhost:11434";

/* Message contextuel : la cause d'un Ollama injoignable n'est pas la meme
   selon qu'on est en local, sur un domaine deploye, ou sur un autre appareil
   que celui qui heberge Ollama. */
export function ollamaUnreachableMessage(baseUrl: string): string {
  const targetIsLocalhost = /localhost|127\.0\.0\.1/.test(baseUrl);
  if (isLocalOrigin()) {
    return (
      `Ollama injoignable sur ${baseUrl}. Vérifiez qu'il est installé et lancé ` +
      `(ollama serve) — en local, aucune configuration n'est nécessaire. ` +
      `Pas encore installé ? ollama.com/download`
    );
  }
  const origin = window.location.origin;
  if (targetIsLocalhost) {
    return (
      `Ollama injoignable depuis ${origin}. Deux causes possibles : ` +
      `1) Ollama tourne sur CE PC mais n'autorise pas ce site — relancez-le avec : ` +
      `${ollamaOriginsCommand(detectOs())} · ` +
      `2) vous êtes sur un téléphone — utilisez plutôt le fournisseur ` +
      `« Navigateur (local) » (IA directement dans le navigateur, rien à installer), ` +
      `ou Termux sur Android (voir docs/ia-locale-mobile.md).`
    );
  }
  return (
    `Ollama injoignable sur ${baseUrl} depuis ${origin}. Vérifiez que l'appareil qui ` +
    `héberge Ollama est allumé, sur le même réseau, et qu'Ollama y est lancé avec ` +
    `OLLAMA_HOST=0.0.0.0 et OLLAMA_ORIGINS=${origin}. Attention : depuis un site en ` +
    `https, le navigateur bloque les adresses http locales (mixed content) — cette ` +
    `option ne marche que si le Studio est servi en local/http ou Ollama derrière https.`
  );
}

export function getOllamaBaseUrl(): string {
  return localStorage.getItem("aidusia_ollama_url") || DEFAULT_BASE_URL;
}
const getBaseUrl = getOllamaBaseUrl;

export function setOllamaBaseUrl(url: string) {
  localStorage.setItem("aidusia_ollama_url", url.replace(/\/+$/, ""));
}

async function fetchTags(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`Ollama a repondu ${response.status}`);
  return response.json() as Promise<{ models: { name: string; capabilities?: string[] }[] }>;
}

export const ollamaProvider: ChatProvider = {
  id: "ollama",
  label: "Ollama (local)",
  requiresApiKey: false,

  async listModels(): Promise<ProviderModel[]> {
    const baseUrl = getBaseUrl();
    try {
      const data = await fetchTags(baseUrl);
      return data.models.map((m) => ({
        id: m.name,
        label: m.name,
        visionCapable: m.capabilities?.includes("vision") ?? false,
      }));
    } catch {
      throw new Error(ollamaUnreachableMessage(baseUrl));
    }
  },

  async testKey(): Promise<KeyTestResult> {
    const baseUrl = getBaseUrl();
    try {
      await fetchTags(baseUrl);
      return { ok: true };
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      // "Ollama a repondu 4xx" = il tourne mais refuse ; sinon, injoignable.
      return { ok: false, reason: /repondu/.test(raw) ? raw : ollamaUnreachableMessage(baseUrl) };
    }
  },

  async chatStream(
    params: ChatStreamParams,
    _apiKey: string | undefined,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: params.signal,
      body: JSON.stringify(buildOpenAiCompatibleBody(params, true)),
    }).catch((err: unknown) => {
      // "Failed to fetch" brut n'aide personne ; on garde l'abandon volontaire
      // (bouton Arreter) intact pour que useChat le reconnaisse.
      if (err instanceof Error && err.name === "AbortError") throw err;
      throw new Error(ollamaUnreachableMessage(baseUrl));
    });
    if (!response.ok || !response.body) {
      throw new Error(`Ollama a repondu ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const json = JSON.parse(line) as {
          message?: {
            content?: string;
            tool_calls?: { function: { name: string; arguments: unknown } }[];
          };
          done?: boolean;
        };
        if (json.message?.content) {
          onChunk({ type: "text", delta: json.message.content });
        }
        // Ollama renvoie les tool_calls complets (arguments deja un objet
        // JSON, jamais fragmentes) - pas d'accumulation necessaire.
        for (const tc of json.message?.tool_calls ?? []) {
          onChunk({
            type: "tool_call",
            call: { id: crypto.randomUUID(), name: tc.function.name, args: tc.function.arguments },
          });
        }
      }
    }
  },
};
