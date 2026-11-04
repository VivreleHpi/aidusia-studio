const KEY_PREFIX = "aidusia_rag_space_";

export function getConversationRagSpaceId(conversationId: string): string | null {
  return localStorage.getItem(`${KEY_PREFIX}${conversationId}`);
}

export function setConversationRagSpaceId(conversationId: string, spaceId: string | null): void {
  const key = `${KEY_PREFIX}${conversationId}`;
  if (!spaceId) localStorage.removeItem(key);
  else localStorage.setItem(key, spaceId);
}

export const RAG_SPACE_GLOBAL_KEY = "aidusia_rag_default_space";

export function getDefaultRagSpaceId(): string | null {
  return localStorage.getItem(RAG_SPACE_GLOBAL_KEY);
}

export function setDefaultRagSpaceId(spaceId: string | null): void {
  if (!spaceId) localStorage.removeItem(RAG_SPACE_GLOBAL_KEY);
  else localStorage.setItem(RAG_SPACE_GLOBAL_KEY, spaceId);
}

export function resolveRagSpaceForConversation(conversationId: string): string | null {
  return getConversationRagSpaceId(conversationId) ?? getDefaultRagSpaceId();
}
