import { missingKeyError } from "./types";
import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";
import { buildOpenAiCompatibleBody } from "./openaiCompatibleStream";

// ollama.com ne renvoie pas de header CORS sur ses vraies reponses (verifie
// empiriquement, comme OpenAI) -> passe par le proxy Edge same-origin.
const PROXY_BASE = "/api/ollama-cloud";

interface OllamaTagsResponse {
  models: { name: string }[];
}

export const ollamaCloudProvider: ChatProvider = {
  id: "ollama-cloud",
  label: "Ollama Cloud",
  requiresApiKey: true,

  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    if (!apiKey) return [];
    const response = await fetch(`${PROXY_BASE}/tags`, {
      headers: { "X-Ollama-Key": apiKey },
    });
    if (!response.ok) throw new Error(`Ollama Cloud a repondu ${response.status}`);
    const data = (await response.json()) as OllamaTagsResponse;
    return data.models.map((m) => ({ id: m.name, label: m.name }));
  },

  async testKey(apiKey: string): Promise<KeyTestResult> {
    const response = await fetch(`${PROXY_BASE}/tags`, {
      headers: { "X-Ollama-Key": apiKey },
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
    if (!apiKey) throw missingKeyError("Ollama Cloud");
    const response = await fetch(`${PROXY_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Ollama-Key": apiKey },
      signal: params.signal,
      body: JSON.stringify(buildOpenAiCompatibleBody(params, true)),
    });
    if (!response.ok || !response.body) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Clé Ollama Cloud invalide ou expirée — vérifiez-la dans le panneau Fournisseurs " +
            "(le listing des modèles est public : seul l'envoi d'un message vérifie vraiment la clé).",
        );
      }
      throw new Error(`Ollama Cloud a repondu ${response.status}`);
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
        };
        if (json.message?.content) onChunk({ type: "text", delta: json.message.content });
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
