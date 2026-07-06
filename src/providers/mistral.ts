import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";

const API_BASE = "https://api.mistral.ai/v1";

const KNOWN_MODELS: ProviderModel[] = [
  { id: "mistral-large-latest", label: "Mistral Large" },
  { id: "mistral-small-latest", label: "Mistral Small" },
];

export const mistralProvider: ChatProvider = {
  id: "mistral",
  label: "Mistral",
  requiresApiKey: true,

  async listModels(): Promise<ProviderModel[]> {
    return KNOWN_MODELS;
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
    if (!apiKey) throw new Error("Cle API Mistral manquante");
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: params.signal,
      body: JSON.stringify({
        model: params.model,
        stream: true,
        messages: params.systemPrompt
          ? [{ role: "system", content: params.systemPrompt }, ...params.messages]
          : params.messages,
      }),
    });
    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => "");
      throw new Error(`Mistral a repondu ${response.status}: ${body}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        const dataLine = event.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (payload === "[DONE]") continue;
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) onChunk({ delta });
      }
    }
  },
};
