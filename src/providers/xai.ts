import { missingKeyError } from "./types";
import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";
import { buildOpenAiCompatibleBody, readOpenAiCompatibleStream } from "./openaiCompatibleStream";

// xAI (Grok) expose une API compatible OpenAI. On l'appelle en direct depuis le
// navigateur, comme Groq. Le support CORS d'api.x.ai depuis un navigateur n'a
// PAS ete re-verifie empiriquement dans cet environnement (contrairement a Groq)
// : si un appel echoue avec une erreur reseau/CORS, la solution est de router ce
// fournisseur via une fonction Edge, comme api/openai/. Le message d'erreur
// remonte tel quel a l'utilisateur pour rendre ce cas diagnostiquable.
const API_BASE = "https://api.x.ai/v1";

// Modeles non conversationnels exposes par la meme API (embeddings, image).
const NON_CHAT_PATTERNS = ["embedding", "image"];

interface XaiModel {
  id: string;
}

export const xaiProvider: ChatProvider = {
  id: "xai",
  label: "xAI (Grok)",
  requiresApiKey: true,

  // Vrai appel GET /v1/models : seuls les modeles reellement accessibles avec
  // cette cle apparaissent.
  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    if (!apiKey) return [];
    const response = await fetch(`${API_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.status === 401) {
      throw new Error("Clé xAI invalide ou expirée — vérifiez-la dans le panneau Fournisseurs.");
    }
    if (!response.ok) throw new Error(`xAI a repondu ${response.status}`);
    const data = (await response.json()) as { data: XaiModel[] };
    return data.data
      .filter((m) => !NON_CHAT_PATTERNS.some((p) => m.id.toLowerCase().includes(p)))
      .map((m) => ({ id: m.id, label: m.id }));
  },

  async testKey(apiKey: string): Promise<KeyTestResult> {
    const response = await fetch(`${API_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.status === 401) {
      return { ok: false, reason: "Clé invalide ou expirée — recopiez-la depuis console.x.ai." };
    }
    if (response.status === 429) {
      return { ok: false, reason: "Quota atteint (429) — la clé est valide, réessayez dans quelques instants." };
    }
    if (!response.ok) return { ok: false, reason: `xAI a répondu ${response.status}` };
    return { ok: true };
  },

  async chatStream(
    params: ChatStreamParams,
    apiKey: string | undefined,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    if (!apiKey) throw missingKeyError("xAI");
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: params.signal,
      body: JSON.stringify(buildOpenAiCompatibleBody(params)),
    });
    if (!response.ok || !response.body) {
      if (response.status === 401) {
        throw new Error("Clé xAI invalide ou expirée — vérifiez-la dans le panneau Fournisseurs.");
      }
      if (response.status === 429) {
        throw new Error("Quota xAI atteint (429) — réessayez dans quelques instants.");
      }
      const body = await response.text().catch(() => "");
      throw new Error(`xAI a repondu ${response.status}: ${body}`);
    }
    await readOpenAiCompatibleStream(response, onChunk);
  },
};
