import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";
import { buildOpenAiCompatibleBody, readOpenAiCompatibleStream } from "./openaiCompatibleStream";

// OpenAI bloque volontairement les requetes CORS directes depuis un navigateur
// (verifie empiriquement : aucun header Access-Control-Allow-Origin sur la
// vraie reponse POST, contrairement au preflight OPTIONS). Ce provider passe
// donc par notre proxy Edge same-origin (api/openai/[...path].ts), stateless
// et sans log - voir README "Pourquoi un proxy pour OpenAI".
const PROXY_BASE = "/api/openai";

interface OpenAIModel {
  id: string;
}

export const openaiProvider: ChatProvider = {
  id: "openai",
  label: "OpenAI (via proxy)",
  requiresApiKey: true,

  // Vrai appel GET /v1/models (via proxy) : seuls les modeles reellement
  // accessibles avec cette cle apparaissent.
  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    if (!apiKey) return [];
    const response = await fetch(`${PROXY_BASE}/models`, {
      headers: { "X-OpenAI-Key": apiKey },
    });
    if (!response.ok) throw new Error(`OpenAI a repondu ${response.status}`);
    const data = (await response.json()) as { data: OpenAIModel[] };
    return data.data
      .filter((m) => m.id.startsWith("gpt-") || m.id.startsWith("o1") || m.id.startsWith("o3"))
      .map((m) => ({ id: m.id, label: m.id }));
  },

  async testKey(apiKey: string): Promise<KeyTestResult> {
    const response = await fetch(`${PROXY_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-OpenAI-Key": apiKey },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    if (response.status === 401) return { ok: false, reason: "Cle invalide" };
    if (!response.ok && response.status !== 400) {
      return { ok: false, reason: `Erreur ${response.status}` };
    }
    return { ok: true };
  },

  async chatStream(
    params: ChatStreamParams,
    apiKey: string | undefined,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    if (!apiKey) throw new Error("Cle API OpenAI manquante");
    const response = await fetch(`${PROXY_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-OpenAI-Key": apiKey },
      signal: params.signal,
      body: JSON.stringify(buildOpenAiCompatibleBody(params)),
    });
    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => "");
      throw new Error(`Proxy OpenAI a repondu ${response.status}: ${body}`);
    }
    await readOpenAiCompatibleStream(response, onChunk);
  },
};
