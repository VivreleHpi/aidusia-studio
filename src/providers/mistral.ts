import { missingKeyError } from "./types";
import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";
import { buildOpenAiCompatibleBody, readOpenAiCompatibleStream } from "./openaiCompatibleStream";

const API_BASE = "https://api.mistral.ai/v1";

interface MistralModel {
  id: string;
  name?: string;
}

export const mistralProvider: ChatProvider = {
  id: "mistral",
  label: "Mistral",
  requiresApiKey: true,

  // Vrai appel GET /v1/models : seuls les modeles reellement accessibles
  // avec cette cle apparaissent.
  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    if (!apiKey) return [];
    const response = await fetch(`${API_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error(`Mistral a repondu ${response.status}`);
    const data = (await response.json()) as { data: MistralModel[] };
    return data.data.map((m) => ({ id: m.id, label: m.name ?? m.id }));
  },

  async testKey(apiKey: string): Promise<KeyTestResult> {
    const response = await fetch(`${API_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.status === 401) return { ok: false, reason: "Cle invalide" };
    if (!response.ok) return { ok: false, reason: `Erreur ${response.status}` };
    return { ok: true };
  },

  async chatStream(
    params: ChatStreamParams,
    apiKey: string | undefined,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    if (!apiKey) throw missingKeyError("Mistral");
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
      const body = await response.text().catch(() => "");
      throw new Error(`Mistral a repondu ${response.status}: ${body}`);
    }
    await readOpenAiCompatibleStream(response, onChunk);
  },
};
