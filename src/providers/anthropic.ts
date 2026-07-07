import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";

const API_BASE = "https://api.anthropic.com/v1";
const API_VERSION = "2023-06-01";

interface AnthropicModel {
  id: string;
  display_name: string;
}

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

  // Vrai appel GET /v1/models : seuls les modeles reellement accessibles
  // avec cette cle apparaissent, jamais une liste figee en dur.
  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    if (!apiKey) return [];
    const response = await fetch(`${API_BASE}/models`, { headers: headers(apiKey) });
    if (!response.ok) throw new Error(`Anthropic a repondu ${response.status}`);
    const data = (await response.json()) as { data: AnthropicModel[] };
    return data.data.map((m) => ({ id: m.id, label: m.display_name }));
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
