import { missingKeyError } from "./types";
import type { ChatMessage, ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";

const API_BASE = "https://api.anthropic.com/v1";

// Anthropic n'a pas de role "tool" : le resultat d'un appel d'outil est un
// message "user" avec un bloc content de type tool_result, et un appel
// d'outil demande par le modele est un bloc "tool_use" dans un message
// assistant. Traduction depuis notre modele interne neutre.
function toAnthropicMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "tool") {
        return {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content }],
        };
      }
      if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: "assistant",
          content: [
            ...(m.content ? [{ type: "text", text: m.content }] : []),
            ...m.toolCalls.map((tc) => ({ type: "tool_use", id: tc.id, name: tc.name, input: tc.args })),
          ],
        };
      }
      return { role: m.role, content: m.content };
    });
}
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
    if (!apiKey) throw missingKeyError("Anthropic");
    const response = await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: headers(apiKey),
      signal: params.signal,
      body: JSON.stringify({
        model: params.model,
        max_tokens: 4096,
        stream: true,
        system: params.systemPrompt,
        messages: toAnthropicMessages(params.messages),
        tools: params.tools?.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema,
        })),
      }),
    });
    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => "");
      throw new Error(`Anthropic a repondu ${response.status}: ${body}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const pendingToolUse = new Map<number, { id: string; name: string; argsJson: string }>();
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
          onChunk({ type: "text", delta: json.delta.text });
        } else if (json.type === "content_block_delta" && json.delta?.type === "input_json_delta") {
          const pending = pendingToolUse.get(json.index);
          if (pending) pending.argsJson += json.delta.partial_json ?? "";
        } else if (json.type === "content_block_start" && json.content_block?.type === "tool_use") {
          pendingToolUse.set(json.index, {
            id: json.content_block.id,
            name: json.content_block.name,
            argsJson: "",
          });
        } else if (json.type === "content_block_stop") {
          const pending = pendingToolUse.get(json.index);
          if (pending) {
            let args: unknown = {};
            try {
              args = pending.argsJson ? JSON.parse(pending.argsJson) : {};
            } catch {
              args = {};
            }
            onChunk({ type: "tool_call", call: { id: pending.id, name: pending.name, args } });
            pendingToolUse.delete(json.index);
          }
        }
      }
    }
  },
};
