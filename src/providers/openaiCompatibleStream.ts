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
  if (!response.body) {
    throw new Error("Réponse sans corps.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const pendingCalls = new Map<number, PendingToolCall>();

  let buffer = "";

  function flushToolCalls(): void {
    for (const call of pendingCalls.values()) {
      if (!call.name?.trim()) {
        throw new Error("Appel d’outil refusé : nom d’outil absent.");
      }

      let args: unknown = {};

      if (call.args.trim()) {
        try {
          args = JSON.parse(call.args);
        } catch {
          throw new Error(
            `Appel de l’outil "${call.name}" refusé : arguments JSON invalides.`,
          );
        }
      }

      if (args === null || typeof args !== "object" || Array.isArray(args)) {
        throw new Error(
          `Appel de l’outil "${call.name}" refusé : les arguments doivent être un objet JSON.`,
        );
      }

      onChunk({
        type: "tool_call",
        call: {
          id: call.id ?? crypto.randomUUID(),
          name: call.name,
          args,
        },
      });
    }

    pendingCalls.clear();
  }

  function processEvent(rawEvent: string): void {
    const event = rawEvent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    const dataLines = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) {
      return;
    }

    const payload = dataLines.join("\n").trim();

    if (!payload) {
      return;
    }

    if (payload === "[DONE]") {
      flushToolCalls();
      return;
    }

    let json: {
      choices?: Array<{
        delta?: {
          content?: string;
          tool_calls?: Array<{
            index: number;
            id?: string;
            function?: {
              name?: string;
              arguments?: string;
            };
          }>;
        };
        finish_reason?: string | null;
      }>;
    };

    try {
      json = JSON.parse(payload);
    } catch {
      throw new Error("Flux du fournisseur invalide : événement SSE non JSON.");
    }

    const choice = json.choices?.[0];
    const delta = choice?.delta;

    if (typeof delta?.content === "string") {
      onChunk({
        type: "text",
        delta: delta.content,
      });
    }

    for (const toolCall of delta?.tool_calls ?? []) {
      if (!Number.isInteger(toolCall.index) || toolCall.index < 0) {
        throw new Error(
          "Flux du fournisseur invalide : index d’appel d’outil incorrect.",
        );
      }

      const existing = pendingCalls.get(toolCall.index) ?? {
        args: "",
      };

      if (toolCall.id) {
        existing.id = toolCall.id;
      }

      if (toolCall.function?.name) {
        existing.name = toolCall.function.name;
      }

      if (toolCall.function?.arguments) {
        existing.args += toolCall.function.arguments;
      }

      pendingCalls.set(toolCall.index, existing);
    }

    if (choice?.finish_reason === "tool_calls") {
      flushToolCalls();
    }
  }

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      processEvent(event);
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    processEvent(buffer);
  }

  flushToolCalls();
}
