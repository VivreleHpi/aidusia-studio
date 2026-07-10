import { useCallback, useRef, useState } from "react";
import { getConversation, saveConversation, type Conversation, type StoredMessage } from "@/lib/db";
import { getProvider } from "@/providers";
import type { ToolCall, ToolDefinition } from "@/providers/types";
import { getApiKey } from "@/lib/apiKeys";
import { listMcpServers } from "@/lib/mcp/servers";
import { callTool, initialize as initializeMcp, listTools } from "@/lib/mcp/client";
import type { McpServer } from "@/lib/mcp/types";

function titleFromFirstMessage(content: string): string {
  const trimmed = content.trim().slice(0, 60);
  return trimmed.length > 0 ? trimmed : "Nouvelle conversation";
}

// IMPORTANT : le rendu pendant le streaming se fait EXCLUSIVEMENT depuis
// l'objet `updated` tenu en memoire ici (deja mute en place a chaque jeton),
// jamais en relisant IndexedDB. Une reponse longue (~150 jetons observe en
// test reel) declenchait auparavant une ecriture+relecture IndexedDB par
// jeton : les lectures concurrentes pouvaient resoudre dans le desordre et
// ecraser l'etat affiche par une version perimee (silencieux - "je vois
// rien" sur une longue reponse). IndexedDB ne sert plus qu'a la persistance,
// en arriere-plan, throttlee - jamais comme source du rendu live.
const PERSIST_INTERVAL_MS = 500;

// Nombre max d'aller-retours modele <-> outil pour une seule reponse - filet
// de securite si un modele boucle sur des appels d'outils sans jamais
// conclure par une reponse texte.
const MAX_TOOL_HOPS = 4;

// Index {nom d'outil -> serveur qui l'expose}, construit une fois par envoi
// de message (pas par hop) - au prix d'un tools/list par serveur configure.
// Best-effort : un serveur injoignable est ignore, pas fatal pour l'envoi.
async function buildToolIndex(
  servers: McpServer[],
): Promise<Map<string, { server: McpServer; tool: ToolDefinition }>> {
  const index = new Map<string, { server: McpServer; tool: ToolDefinition }>();
  await Promise.all(
    servers.map(async (server) => {
      try {
        await initializeMcp(server);
        const tools = await listTools(server);
        for (const tool of tools) {
          index.set(tool.name, {
            server,
            tool: { name: tool.name, description: tool.description, inputSchema: tool.inputSchema },
          });
        }
      } catch (err) {
        console.warn(`Serveur MCP "${server.name}" injoignable :`, err);
      }
    }),
  );
  return index;
}

export function useChat(onUpdated: (conversation: Conversation) => void, onListChanged: () => void) {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (
      conversationId: string,
      content: string,
      providerId: string,
      model: string,
      systemPrompt?: string,
      images?: string[],
    ) => {
      setError(null);
      const conversation = await getConversation(conversationId);
      if (!conversation) return;

      const userMessage: StoredMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        createdAt: Date.now(),
        images,
      };
      let assistantMessage: StoredMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        providerId,
        model,
      };

      const isFirstMessage = conversation.messages.length === 0;
      const updated: Conversation = {
        ...conversation,
        title: isFirstMessage ? titleFromFirstMessage(content) : conversation.title,
        messages: [...conversation.messages, userMessage, assistantMessage],
        updatedAt: Date.now(),
      };
      await saveConversation(updated);
      onUpdated(updated);
      onListChanged();

      const provider = getProvider(providerId);
      const apiKey = getApiKey(providerId);
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);

      let lastPersist = 0;
      function persistThrottled() {
        const now = Date.now();
        if (now - lastPersist > PERSIST_INTERVAL_MS) {
          lastPersist = now;
          void saveConversation({ ...updated, updatedAt: now });
        }
      }

      try {
        const mcpServers = listMcpServers();
        const toolIndex = mcpServers.length > 0 ? await buildToolIndex(mcpServers) : new Map();
        const toolDefs = [...toolIndex.values()].map((entry) => entry.tool);

        for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
          let accumulated = "";
          const toolCalls: ToolCall[] = [];

          await provider.chatStream(
            {
              model,
              systemPrompt,
              signal: controller.signal,
              tools: toolDefs.length > 0 ? toolDefs : undefined,
              messages: updated.messages.slice(0, -1).map((m) => ({
                role: m.role,
                content: m.content,
                images: m.images,
                toolCallId: m.toolCallId,
                toolName: m.toolName,
                toolCalls: m.toolCalls,
              })),
            },
            apiKey,
            (chunk) => {
              if (chunk.type === "text") {
                accumulated += chunk.delta;
                assistantMessage.content = accumulated;
              } else {
                toolCalls.push(chunk.call);
              }
              // Rendu immediat, en memoire - aucune lecture IndexedDB.
              onUpdated(updated);
              // Persistance throttlee : la version finale est de toute facon
              // ecrite dans le `finally` ci-dessous.
              persistThrottled();
            },
          );

          if (toolCalls.length === 0) break; // reponse finale, texte seul

          assistantMessage.toolCalls = toolCalls;

          for (const call of toolCalls) {
            const entry = toolIndex.get(call.name);
            let resultText: string;
            if (!entry) {
              resultText = `Outil "${call.name}" introuvable (aucun serveur MCP configure ne l'expose).`;
            } else {
              try {
                const result = await callTool(entry.server, call.name, call.args);
                resultText = result.content || (result.isError ? "Erreur sans detail." : "(reponse vide)");
              } catch (err) {
                resultText = `Erreur : ${err instanceof Error ? err.message : String(err)}`;
              }
            }
            const toolMessage: StoredMessage = {
              id: crypto.randomUUID(),
              role: "tool",
              content: resultText,
              toolCallId: call.id,
              toolName: call.name,
              createdAt: Date.now(),
            };
            updated.messages.push(toolMessage);
          }

          assistantMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "",
            createdAt: Date.now(),
            providerId,
            model,
          };
          updated.messages.push(assistantMessage);
          onUpdated(updated);
          persistThrottled();
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        const finalConversation = { ...updated, updatedAt: Date.now() };
        await saveConversation(finalConversation);
        onUpdated(finalConversation);
        onListChanged();
      }
    },
    [onUpdated, onListChanged],
  );

  return { sendMessage, stop, streaming, error };
}
