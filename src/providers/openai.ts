import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";

// OpenAI bloque volontairement les requetes CORS directes depuis un navigateur
// (verifie empiriquement : aucun header Access-Control-Allow-Origin sur la
// vraie reponse POST, contrairement au preflight OPTIONS). Ce provider passe
// donc par notre proxy Edge same-origin (api/openai-proxy.ts), stateless et
// sans log - voir README "Pourquoi un proxy pour OpenAI".
const PROXY_PATH = "/api/openai-proxy";

const KNOWN_MODELS: ProviderModel[] = [
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
];

export const openaiProvider: ChatProvider = {
  id: "openai",
  label: "OpenAI (via proxy)",
  requiresApiKey: true,

  async listModels(): Promise<ProviderModel[]> {
    return KNOWN_MODELS;
  },

  async testKey(apiKey: string): Promise<KeyTestResult> {
    const response = await fetch(PROXY_PATH, {
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
    const response = await fetch(PROXY_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-OpenAI-Key": apiKey },
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
      throw new Error(`Proxy OpenAI a repondu ${response.status}: ${body}`);
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
