import type { ChatMessage, ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Gemini n'a pas de role "tool" ni d'id d'appel : un resultat d'outil est un
// message "user" avec une part functionResponse identifiee par le NOM de
// l'outil (pas un id), et un appel demande par le modele est une part
// functionCall dans un message "model".
function toGeminiContents(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "tool") {
        return {
          role: "user",
          parts: [{ functionResponse: { name: m.toolName, response: { content: m.content } } }],
        };
      }
      if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: "model",
          parts: m.toolCalls.map((tc) => ({ functionCall: { name: tc.name, args: tc.args } })),
        };
      }
      return {
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      };
    });
}

interface GeminiModel {
  name: string; // "models/gemini-2.5-pro"
  displayName: string;
  supportedGenerationMethods?: string[];
}

export const geminiProvider: ChatProvider = {
  id: "gemini",
  label: "Google Gemini",
  requiresApiKey: true,

  // Vrai appel GET /v1beta/models : seuls les modeles reellement
  // disponibles pour cette cle et compatibles chat apparaissent.
  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    if (!apiKey) return [];
    const response = await fetch(`${API_BASE}/models?key=${encodeURIComponent(apiKey)}`);
    if (!response.ok) throw new Error(`Gemini a repondu ${response.status}`);
    const data = (await response.json()) as { models: GeminiModel[] };
    return data.models
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => ({ id: m.name.replace(/^models\//, ""), label: m.displayName }));
  },

  async testKey(apiKey: string): Promise<KeyTestResult> {
    const response = await fetch(`${API_BASE}/models?key=${encodeURIComponent(apiKey)}`);
    if (response.status === 400 || response.status === 403) {
      return { ok: false, reason: "Cle invalide" };
    }
    if (!response.ok) return { ok: false, reason: `Erreur ${response.status}` };
    return { ok: true };
  },

  async chatStream(
    params: ChatStreamParams,
    apiKey: string | undefined,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    if (!apiKey) throw new Error("Cle API Gemini manquante");
    const url = `${API_BASE}/models/${params.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: params.signal,
      body: JSON.stringify({
        systemInstruction: params.systemPrompt
          ? { parts: [{ text: params.systemPrompt }] }
          : undefined,
        contents: toGeminiContents(params.messages),
        tools: params.tools?.length
          ? [
              {
                functionDeclarations: params.tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.inputSchema,
                })),
              },
            ]
          : undefined,
      }),
    });
    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => "");
      throw new Error(`Gemini a repondu ${response.status}: ${body}`);
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
        for (const part of json.candidates?.[0]?.content?.parts ?? []) {
          if (part.text) onChunk({ type: "text", delta: part.text });
          if (part.functionCall) {
            onChunk({
              type: "tool_call",
              call: { id: crypto.randomUUID(), name: part.functionCall.name, args: part.functionCall.args },
            });
          }
        }
      }
    }
  },
};
