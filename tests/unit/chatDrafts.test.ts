import { beforeEach, describe, expect, it } from "vitest";
import {
  CHAT_DRAFT_STORAGE_KEY,
  clearChatDrafts,
  deleteChatDraft,
  loadChatDrafts,
  saveChatDrafts,
} from "@/lib/chatDrafts";

beforeEach(() => localStorage.clear());

describe("chat drafts lifecycle", () => {
  it("loads only valid string drafts", () => {
    localStorage.setItem(
      CHAT_DRAFT_STORAGE_KEY,
      JSON.stringify({ valid: "texte", ignored: 42 }),
    );

    expect(loadChatDrafts()).toEqual({ valid: "texte" });
  });

  it("removes only the draft belonging to a deleted conversation", () => {
    saveChatDrafts({ first: "A", second: "B" });

    deleteChatDraft("first");

    expect(loadChatDrafts()).toEqual({ second: "B" });
  });

  it("removes the storage entry when no draft remains", () => {
    saveChatDrafts({ only: "secret non envoye" });
    deleteChatDraft("only");
    expect(localStorage.getItem(CHAT_DRAFT_STORAGE_KEY)).toBeNull();

    saveChatDrafts({ another: "draft" });
    clearChatDrafts();
    expect(localStorage.getItem(CHAT_DRAFT_STORAGE_KEY)).toBeNull();
  });
});
