// Partage par les 4 fournisseurs qui parlent le dialecte SSE "OpenAI
// Chat Completions" (openai, mistral, openrouter, groq) : avant, ce parsing
// etait duplique 4 fois quasi a l'identique. L'ajout du tool-calling est
// l'occasion de factoriser plutot que de dupliquer une 5e fois.
import type { ChatMessage, ChatStreamParams, StreamChunk, ToolDefinition } from "./types";

export function toOpenAiTools(tools?: ToolDefinition[]) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
}

// Ollama attend `function.arguments` comme un objet JSON brut ; la vraie API
// OpenAI (et Mistral/OpenRouter/Groq, qui suivent son spec a la lettre)
// attend une STRING JSON-encodee. Melanger les deux fait echouer Ollama avec
// "Value looks like object, but can't find closing '}' symbol" - verifie
// empiriquement (curl + Playwright contre un vrai Ollama local).
function toApiMessages(messages: ChatMessage[], rawToolArguments: boolean) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    }
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: rawToolArguments ? tc.args : JSON.stringify(tc.args),
          },
        })),
      };
    }
    return { role: m.role, content: m.content, images: m.images };
  });
}

export function buildOpenAiCompatibleBody(params: ChatStreamParams, rawToolArguments = false) {
  const messages = toApiMessages(params.messages, rawToolArguments);
  return {
    model: params.model,
    stream: true,
    messages: params.systemPrompt ? [{ role: "system", content: params.systemPrompt }, ...messages] : messages,
    tools: toOpenAiTools(params.tools),
  };
}

interface PendingToolCall {
  id?: string;
  name?: string;
  args: string;
}

// Accumule les deltas SSE "OpenAI Chat Completions" (texte + tool_calls
// fragmentes par index) et emet des StreamChunk neutres.
export async function readOpenAiCompatibleStream(
  response: Response,
  onChunk: (chunk: StreamChunk) => void,
): Promise<void> {
  if (!response.body) throw new Error("Reponse sans corps");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const pendingCalls = new Map<number, PendingToolCall>();

  function flushToolCalls() {
    for (const call of pendingCalls.values()) {
      if (!call.name) continue;
      let args: unknown = {};
      try {
        args = call.args ? JSON.parse(call.args) : {};
      } catch {
        args = {};
      }
      onChunk({ type: "tool_call", call: { id: call.id ?? crypto.randomUUID(), name: call.name, args } });
    }
    pendingCalls.clear();
  }

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
      const choice = json.choices?.[0];
      const delta = choice?.delta;
      if (delta?.content) onChunk({ type: "text", delta: delta.content });
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls as {
          index: number;
          id?: string;
          function?: { name?: string; arguments?: string };
        }[]) {
          const existing = pendingCalls.get(tc.index) ?? { args: "" };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.args += tc.function.arguments;
          pendingCalls.set(tc.index, existing);
        }
      }
      if (choice?.finish_reason === "tool_calls") flushToolCalls();
    }
  }
  flushToolCalls();
}
