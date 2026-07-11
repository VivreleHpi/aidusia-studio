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
    if (response.status === 401) {
      return { ok: false, reason: "Clé invalide ou expirée — recopiez-la depuis console.mistral.ai/api-keys." };
    }
    if (response.status === 429) {
      return { ok: false, reason: "Quota atteint (429) — la clé est valide, réessayez dans quelques instants." };
    }
    if (!response.ok) return { ok: false, reason: `Mistral a répondu ${response.status}` };
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
      if (response.status === 401) {
        throw new Error("Clé Mistral invalide ou expirée — vérifiez-la dans le panneau Fournisseurs.");
      }
      if (response.status === 429) {
        throw new Error("Quota Mistral atteint (429) — réessayez dans quelques instants.");
      }
      const body = await response.text().catch(() => "");
      throw new Error(`Mistral a repondu ${response.status}: ${body}`);
    }
    await readOpenAiCompatibleStream(response, onChunk);
  },
};
