import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";

const API_BASE = "https://api.anthropic.com/v1";
const API_VERSION = "2023-06-01";

// Liste statique : l'API Anthropic n'expose pas d'endpoint /models public
// stable et documente pour un usage direct-navigateur en v1.
const KNOWN_MODELS: ProviderModel[] = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

function headers(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": API_VERSION,
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

export const anthropicProvider: ChatProvider = {
  id: "anthropic",
  label: "Anthropic (Claude)",
  requiresApiKey: true,

  async listModels(): Promise<ProviderModel[]> {
    return KNOWN_MODELS;
  },

  async testKey(apiKey: string): Promise<KeyTestResult> {
    const response = await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
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
    if (!apiKey) throw new Error("Cle API Anthropic manquante");
    const response = await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: headers(apiKey),
      signal: params.signal,
      body: JSON.stringify({
        model: params.model,
        max_tokens: 4096,
        stream: true,
        system: params.systemPrompt,
        messages: params.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => "");
      throw new Error(`Anthropic a repondu ${response.status}: ${body}`);
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
        const json = JSON.parse(dataLine.slice(5).trim());
        if (json.type === "content_block_delta" && json.delta?.text) {
          onChunk({ delta: json.delta.text });
        }
      }
    }
  },
};
