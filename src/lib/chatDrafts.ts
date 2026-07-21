// Brouillons locaux du composer. Ils ne quittent jamais le navigateur et sont
// supprimes lorsqu'ils sont envoyes, lorsque leur conversation est supprimee,
// ou lors d'une remise a zero globale.
export const CHAT_DRAFT_STORAGE_KEY = "aidusia_chat_drafts_v1";
export const NEW_CONVERSATION_DRAFT_KEY = "__new_conversation__";

export function loadChatDrafts(): Record<string, string> {
  try {
    const value = JSON.parse(localStorage.getItem(CHAT_DRAFT_STORAGE_KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

export function saveChatDrafts(drafts: Record<string, string>): void {
  try {
    if (Object.keys(drafts).length === 0) {
      localStorage.removeItem(CHAT_DRAFT_STORAGE_KEY);
    } else {
      localStorage.setItem(CHAT_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    }
  } catch {
    // Le composer reste utilisable si le stockage prive/quota est indisponible.
  }
}

export function deleteChatDraft(conversationId: string): void {
  const drafts = loadChatDrafts();
  if (!(conversationId in drafts)) return;
  delete drafts[conversationId];
  saveChatDrafts(drafts);
}

export function clearChatDrafts(): void {
  try {
    localStorage.removeItem(CHAT_DRAFT_STORAGE_KEY);
  } catch {
    // Best effort : IndexedDB reste tout de meme supprimee par l'appelant.
  }
}
