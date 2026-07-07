import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";

const API_BASE = "https://openrouter.ai/api/v1";

interface OpenRouterModel {
  id: string;
  name: string;
}

export const openrouterProvider: ChatProvider = {
  id: "openrouter",
  label: "OpenRouter",
  requiresApiKey: true,

  // Catalogue reel, public (aucune cle requise pour le lister) - jamais de
  // liste figee en dur : ce sont les modeles reellement proposes par
  // OpenRouter au moment de l'appel.
  async listModels(): Promise<ProviderModel[]> {
    const response = await fetch(`${API_BASE}/models`);
    if (!response.ok) throw new Error(`OpenRouter a repondu ${response.status}`);
    const data = (await response.json()) as { data: OpenRouterModel[] };
    return data.data.map((m) => ({ id: m.id, label: m.name }));
  },

  async testKey(apiKey: string): Promise<KeyTestResult> {
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
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
    if (!apiKey) throw new Error("Cle API OpenRouter manquante");
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
      throw new Error(`OpenRouter a repondu ${response.status}: ${body}`);
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
