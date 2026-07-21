import { useCallback, useEffect, useState } from "react";
import {
  type Conversation,
  deleteConversation,
  listConversations,
  newConversationId,
  saveConversation,
} from "@/lib/db";
import { newConversationTitle, useLang } from "@/lib/i18n";
import { deleteChatDraft } from "@/lib/chatDrafts";

export function useConversations() {
  const { lang } = useLang();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const all = await listConversations();
      setConversations(all);
      setStorageError(null);
      return all;
    } catch (error) {
      setConversations([]);
      setStorageError(error instanceof Error ? error.message : String(error));
      return [];
    }
  }, []);

  useEffect(() => {
    void refresh()
      .then((all) => {
        if (all.length > 0) setCurrentId(all[0].id);
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  const createConversation = useCallback(async (): Promise<Conversation> => {
    const now = Date.now();
    const conversation: Conversation = {
      id: newConversationId(),
      title: newConversationTitle(lang),
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    await saveConversation(conversation);
    await refresh();
    setCurrentId(conversation.id);
    return conversation;
  }, [refresh, lang]);

  const removeConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      deleteChatDraft(id);
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
    storageError,
    refresh,
    createConversation,
    removeConversation,
  };
}
