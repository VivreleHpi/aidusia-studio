import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";

const DEFAULT_BASE_URL = "http://localhost:11434";

export function getOllamaBaseUrl(): string {
  return localStorage.getItem("aidusia_ollama_url") || DEFAULT_BASE_URL;
}
const getBaseUrl = getOllamaBaseUrl;

export function setOllamaBaseUrl(url: string) {
  localStorage.setItem("aidusia_ollama_url", url.replace(/\/+$/, ""));
}

async function fetchTags(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`Ollama a repondu ${response.status}`);
  return response.json() as Promise<{ models: { name: string; capabilities?: string[] }[] }>;
}

export const ollamaProvider: ChatProvider = {
  id: "ollama",
  label: "Ollama (local)",
  requiresApiKey: false,

  async listModels(): Promise<ProviderModel[]> {
    const baseUrl = getBaseUrl();
    try {
      const data = await fetchTags(baseUrl);
      return data.models.map((m) => ({
        id: m.name,
        label: m.name,
        visionCapable: m.capabilities?.includes("vision") ?? false,
      }));
    } catch {
      throw new Error(
        `Ollama injoignable sur ${baseUrl}. Verifiez qu'Ollama tourne et que ` +
          `OLLAMA_ORIGINS autorise cette origine (voir Reglages > Fournisseurs).`,
      );
    }
  },

  async testKey(): Promise<KeyTestResult> {
    try {
      await fetchTags(getBaseUrl());
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  },

  async chatStream(
    params: ChatStreamParams,
    _apiKey: string | undefined,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      throw new Error(`Ollama a repondu ${response.status}`);
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
        const json = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
        if (json.message?.content) {
          onChunk({ delta: json.message.content });
        }
      }
    }
  },
};
