import { useCallback, useRef, useState } from "react";
import { getConversation, saveConversation, type Conversation, type StoredMessage } from "@/lib/db";
import { getProvider } from "@/providers";
import { getApiKey } from "@/lib/apiKeys";

function titleFromFirstMessage(content: string): string {
  const trimmed = content.trim().slice(0, 60);
  return trimmed.length > 0 ? trimmed : "Nouvelle conversation";
}

export function useChat(onUpdated: () => void) {
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
    ) => {
      setError(null);
      const conversation = await getConversation(conversationId);
      if (!conversation) return;

      const userMessage: StoredMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        createdAt: Date.now(),
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
      onUpdated();

      const provider = getProvider(providerId);
      const apiKey = getApiKey(providerId);
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);

      let accumulated = "";
      try {
        await provider.chatStream(
          {
            model,
            systemPrompt,
            signal: controller.signal,
            messages: updated.messages
              .slice(0, -1)
              .map((m) => ({ role: m.role, content: m.content })),
          },
          apiKey,
          ({ delta }) => {
            accumulated += delta;
            assistantMessage.content = accumulated;
            saveConversation({ ...updated, updatedAt: Date.now() });
            onUpdated();
          },
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        await saveConversation({ ...updated, updatedAt: Date.now() });
        onUpdated();
      }
    },
    [onUpdated],
  );

  return { sendMessage, stop, streaming, error };
}
