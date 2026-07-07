import { useCallback, useRef, useState } from "react";
import { getConversation, saveConversation, type Conversation, type StoredMessage } from "@/lib/db";
import { getProvider } from "@/providers";
import { getApiKey } from "@/lib/apiKeys";

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

      let accumulated = "";
      let lastPersist = 0;
      try {
        await provider.chatStream(
          {
            model,
            systemPrompt,
            signal: controller.signal,
            messages: updated.messages
              .slice(0, -1)
              .map((m) => ({ role: m.role, content: m.content, images: m.images })),
          },
          apiKey,
          ({ delta }) => {
            accumulated += delta;
            assistantMessage.content = accumulated;
            // Rendu immediat, en memoire - aucune lecture IndexedDB.
            onUpdated(updated);
            // Persistance throttlee : la version finale est de toute facon
            // ecrite dans le `finally` ci-dessous.
            const now = Date.now();
            if (now - lastPersist > PERSIST_INTERVAL_MS) {
              lastPersist = now;
              void saveConversation({ ...updated, updatedAt: now });
            }
          },
        );
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
