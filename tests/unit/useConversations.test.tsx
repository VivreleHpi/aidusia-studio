import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConversations } from "@/hooks/useConversations";

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
});
