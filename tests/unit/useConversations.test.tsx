import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConversations } from "@/hooks/useConversations";
import { loadChatDrafts, saveChatDrafts } from "@/lib/chatDrafts";

const db = vi.hoisted(() => ({
  listConversations: vi.fn(),
  saveConversation: vi.fn(),
  deleteConversation: vi.fn(),
  newConversationId: vi.fn(() => "conversation-1"),
}));

vi.mock("@/lib/db", () => db);
vi.mock("@/lib/i18n", () => ({
  useLang: () => ({ lang: "fr" }),
  newConversationTitle: () => "Nouvelle conversation",
}));

describe("useConversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("quitte le chargement et expose une erreur recuperable si IndexedDB echoue", async () => {
    db.listConversations.mockRejectedValueOnce(new Error("IndexedDB bloquee"));
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.storageError).toBe("IndexedDB bloquee");
    expect(result.current.conversations).toEqual([]);

    db.listConversations.mockResolvedValueOnce([]);
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.storageError).toBeNull();
  });

  it("supprime le brouillon local avec sa conversation", async () => {
    const stored = {
      id: "conversation-1",
      title: "Discussion",
      createdAt: 1,
      updatedAt: 2,
      messages: [],
    };
    db.listConversations.mockResolvedValueOnce([stored]).mockResolvedValueOnce([]);
    db.deleteConversation.mockResolvedValueOnce(undefined);
    saveChatDrafts({ "conversation-1": "texte sensible non envoye" });

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.removeConversation("conversation-1");
    });

    expect(db.deleteConversation).toHaveBeenCalledWith("conversation-1");
    expect(loadChatDrafts()).toEqual({});
  });
});
