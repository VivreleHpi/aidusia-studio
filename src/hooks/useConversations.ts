import { useCallback, useEffect, useState } from "react";
import {
  type Conversation,
  deleteConversation,
  listConversations,
  newConversationId,
  saveConversation,
} from "@/lib/db";

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await listConversations();
    setConversations(all);
    return all;
  }, []);

  useEffect(() => {
    refresh().then((all) => {
      if (all.length > 0) setCurrentId(all[0].id);
      setLoading(false);
    });
  }, [refresh]);

  const createConversation = useCallback(async (): Promise<Conversation> => {
    const now = Date.now();
    const conversation: Conversation = {
      id: newConversationId(),
      title: "Nouvelle conversation",
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    await saveConversation(conversation);
    await refresh();
    setCurrentId(conversation.id);
    return conversation;
  }, [refresh]);

  const removeConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      const all = await refresh();
      if (currentId === id) {
        setCurrentId(all[0]?.id ?? null);
      }
    },
    [currentId, refresh],
  );

  return {
    conversations,
    currentId,
    setCurrentId,
    loading,
    refresh,
    createConversation,
    removeConversation,
  };
}
