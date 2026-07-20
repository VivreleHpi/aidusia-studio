import { useCallback, useRef, useState } from "react";
import { getConversation, saveConversation, type Conversation, type StoredMessage } from "@/lib/db";
import { getProvider } from "@/providers";
import type { ToolCall, ToolDefinition } from "@/providers/types";
import { getApiKey } from "@/lib/apiKeys";
import { describeFetchError } from "@/lib/fetchError";
import { newConversationTitle, useLang } from "@/lib/i18n";
import { listMcpServers } from "@/lib/mcp/servers";
import { callTool, initialize as initializeMcp, listTools } from "@/lib/mcp/client";
import type { McpServer } from "@/lib/mcp/types";
import { requestToolApproval } from "@/lib/mcp/approval";
import { selectMessagesForContext } from "@/lib/contextWindow";
import { buildSystemPrompt } from "@/lib/systemContext";

function titleFromFirstMessage(content: string, lang: Parameters<typeof newConversationTitle>[0]): string {
  const trimmed = content.trim().slice(0, 60);
  return trimmed.length > 0 ? trimmed : newConversationTitle(lang);
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

function snapshotConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) => ({
      ...message,
      images: message.images ? [...message.images] : undefined,
      toolCalls: message.toolCalls ? message.toolCalls.map((call) => ({ ...call })) : undefined,
    })),
  };
}

// Index {nom d'outil -> serveur qui l'expose}, construit une fois par envoi
// de message (pas par hop) - au prix d'un tools/list par serveur configure.
// Best-effort : un serveur injoignable est ignore, pas fatal pour l'envoi.
async function buildToolIndex(
  servers: McpServer[],
): Promise<Map<string, { server: McpServer; actualName: string; tool: ToolDefinition }>> {
  const index = new Map<string, { server: McpServer; actualName: string; tool: ToolDefinition }>();
  await Promise.all(
    servers.map(async (server) => {
      try {
        await initializeMcp(server);
        const tools = await listTools(server);
        for (const tool of tools) {
          const serverKey = server.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
          const safeName = tool.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 45);
          let publicName = `mcp_${serverKey}_${safeName}`;
          let suffix = 2;
          while (index.has(publicName)) publicName = `mcp_${serverKey}_${safeName.slice(0, 42)}_${suffix++}`;
          index.set(publicName, {
            server,
            actualName: tool.name,
            tool: {
              name: publicName,
              description: `[MCP: ${server.name} / ${tool.name}] ${tool.description ?? ""}`.trim(),
              inputSchema: tool.inputSchema,
            },
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
  const { lang } = useLang();
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Coeur du streaming, partage entre l'envoi d'un message et la
  // regeneration : `updated` doit deja se terminer par `assistantMessage`
  // (vide), persiste et affiche par l'appelant.
  const runAssistantTurn = useCallback(
    async (
      updated: Conversation,
      assistantMessage: StoredMessage,
      providerId: string,
      model: string,
      systemPrompt?: string,
    ) => {
      const provider = getProvider(providerId);
      const apiKey = getApiKey(providerId);
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);

      let lastPersist = 0;
      let pendingRender: number | null = null;
      const scheduleFrame =
        typeof requestAnimationFrame === "function"
          ? requestAnimationFrame
          : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16);
      const cancelFrame =
        typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : window.clearTimeout;

      function renderThrottled() {
        if (pendingRender !== null) return;
        pendingRender = scheduleFrame(() => {
          pendingRender = null;
          // React ignore un setState qui recoit la meme reference. Le moteur
          // conserve son objet mutable pour le streaming, mais l'UI recoit un
          // snapshot immutable au maximum une fois par frame.
          onUpdated(snapshotConversation(updated));
        });
      }

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
              systemPrompt: buildSystemPrompt(providerId, lang, systemPrompt),
              signal: controller.signal,
              tools: toolDefs.length > 0 ? toolDefs : undefined,
              // Les assistants vides (laisses par une generation echouee ou
              // interrompue) font rejeter la requete par Mistral & co
              // ("Assistant message must have either content or tool_calls").
              messages: selectMessagesForContext(
                updated.messages.slice(0, -1).filter(
                  (m) =>
                    m.role !== "assistant" ||
                    Boolean(m.content) ||
                    (m.toolCalls?.length ?? 0) > 0,
                ),
              ).map((m) => ({
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
              renderThrottled();
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
                const approved = requestToolApproval({
                  server: entry.server,
                  toolName: entry.actualName,
                  args: call.args,
                  lang,
                });
                if (!approved) {
                  resultText = "Action refusée par l'utilisateur. Aucun appel MCP n'a été envoyé.";
                } else {
                  const result = await callTool(entry.server, entry.actualName, call.args);
                  resultText = result.content || (result.isError ? "Erreur sans detail." : "(reponse vide)");
                }
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
          renderThrottled();
          persistThrottled();
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(describeFetchError(err, "Le fournisseur sélectionné"));
        }
      } finally {
        if (pendingRender !== null) {
          cancelFrame(pendingRender);
          pendingRender = null;
        }
        setStreaming(false);
        abortRef.current = null;
        // Ne jamais persister un assistant reste vide (echec/interruption) -
        // et purger ceux que d'anciennes versions ont laisses.
        const finalConversation = {
          ...updated,
          messages: updated.messages.filter(
            (m) =>
              m.role !== "assistant" || Boolean(m.content) || (m.toolCalls?.length ?? 0) > 0,
          ),
          updatedAt: Date.now(),
        };
        await saveConversation(finalConversation);
        onUpdated(finalConversation);
        onListChanged();
      }
    },
    [onUpdated, onListChanged, lang],
  );

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
      const assistantMessage: StoredMessage = {
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
        title: isFirstMessage ? titleFromFirstMessage(content, lang) : conversation.title,
        messages: [...conversation.messages, userMessage, assistantMessage],
        updatedAt: Date.now(),
      };
      await saveConversation(updated);
      onUpdated(updated);
      onListChanged();

      await runAssistantTurn(updated, assistantMessage, providerId, model, systemPrompt);
    },
    [runAssistantTurn, onUpdated, onListChanged, lang],
  );

  // Regenere la reponse : rejoue la generation a partir du dernier message
  // utilisateur, avec le fournisseur/modele actuellement selectionnes. Les
  // messages posterieurs (ancienne reponse, resultats d'outils) sont
  // remplaces - meme semantique que le "Regenerer" des chats classiques.
  const regenerate = useCallback(
    async (conversationId: string, providerId: string, model: string, systemPrompt?: string) => {
      setError(null);
      const conversation = await getConversation(conversationId);
      if (!conversation) return;

      let lastUserIndex = -1;
      for (let i = conversation.messages.length - 1; i >= 0; i--) {
        if (conversation.messages[i].role === "user") {
          lastUserIndex = i;
          break;
        }
      }
      if (lastUserIndex === -1) return;

      const assistantMessage: StoredMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        providerId,
        model,
      };
      const updated: Conversation = {
        ...conversation,
        messages: [...conversation.messages.slice(0, lastUserIndex + 1), assistantMessage],
        updatedAt: Date.now(),
      };
      await saveConversation(updated);
      onUpdated(updated);
      onListChanged();

      await runAssistantTurn(updated, assistantMessage, providerId, model, systemPrompt);
    },
    [runAssistantTurn, onUpdated, onListChanged],
  );

  return { sendMessage, regenerate, stop, streaming, error };
}
