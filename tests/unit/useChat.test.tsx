import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChat } from "@/hooks/useChat";
import type { Conversation } from "@/lib/db";

const db = vi.hoisted(() => ({
  getConversation: vi.fn(),
  saveConversation: vi.fn(),
}));

const provider = vi.hoisted(() => ({
  chatStream: vi.fn(),
}));

vi.mock("@/lib/db", () => db);
vi.mock("@/providers", () => ({ getProvider: () => provider }));
vi.mock("@/lib/apiKeys", () => ({ getApiKey: () => undefined }));
vi.mock("@/lib/i18n", () => ({
  useLang: () => ({ lang: "fr" }),
  newConversationTitle: () => "Nouvelle conversation",
}));
vi.mock("@/lib/mcp/servers", () => ({ listMcpServers: () => [] }));

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emet des snapshots immutables pendant le streaming", async () => {
    const conversation: Conversation = {
      id: "conversation-1",
      title: "Nouvelle conversation",
      createdAt: 1,
      updatedAt: 1,
      messages: [],
    };
    db.getConversation.mockResolvedValue(conversation);
    db.saveConversation.mockResolvedValue(undefined);
    provider.chatStream.mockImplementation(async (_params, _key, onChunk) => {
      onChunk({ type: "text", delta: "A" });
      await new Promise((resolve) => setTimeout(resolve, 25));
      onChunk({ type: "text", delta: "B" });
      await new Promise((resolve) => setTimeout(resolve, 25));
      onChunk({ type: "text", delta: "C" });
    });

    const updates: Conversation[] = [];
    const { result } = renderHook(() => useChat((value) => updates.push(value), vi.fn()));

    await act(async () => {
      await result.current.sendMessage("conversation-1", "Bonjour", "fake", "model-1");
    });

    const streamed = updates
      .map((value) => value.messages.findLast((message) => message.role === "assistant")?.content)
      .filter(Boolean);
    expect(streamed).toContain("A");
    expect(streamed).toContain("AB");
    expect(streamed.at(-1)).toBe("ABC");
    expect(new Set(updates).size).toBe(updates.length);
  });
});
