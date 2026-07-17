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

  it("regenere depuis le dernier message user et remplace l'ancienne reponse", async () => {
    const conversation: Conversation = {
      id: "conversation-1",
      title: "Discussion",
      createdAt: 1,
      updatedAt: 1,
      messages: [
        { id: "u1", role: "user", content: "Bonjour", createdAt: 1 },
        {
          id: "a1",
          role: "assistant",
          content: "Ancienne reponse",
          createdAt: 2,
          providerId: "fake",
          model: "model-1",
        },
      ],
    };
    db.getConversation.mockResolvedValue(conversation);
    db.saveConversation.mockResolvedValue(undefined);

    let capturedMessages: { role: string; content: string }[] = [];
    provider.chatStream.mockImplementation(async (params, _key, onChunk) => {
      capturedMessages = params.messages;
      onChunk({ type: "text", delta: "Nouvelle" });
      onChunk({ type: "text", delta: " reponse" });
    });

    const updates: Conversation[] = [];
    const { result } = renderHook(() => useChat((value) => updates.push(value), vi.fn()));

    await act(async () => {
      await result.current.regenerate("conversation-1", "fake", "model-2");
    });

    expect(provider.chatStream).toHaveBeenCalledTimes(1);
    expect(capturedMessages).toHaveLength(1);
    expect(capturedMessages[0]).toMatchObject({ role: "user", content: "Bonjour" });
    expect(capturedMessages.some((m) => m.content.includes("Ancienne reponse"))).toBe(false);

    const final = updates.at(-1)!;
    expect(final.messages).toHaveLength(2);
    const assistant = final.messages.find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("Nouvelle reponse");
    expect(assistant?.providerId).toBe("fake");
    expect(assistant?.model).toBe("model-2");
  });

  it("retire la reponse et les messages outils posterieurs au dernier message user avant de regenerer", async () => {
    const conversation: Conversation = {
      id: "conversation-1",
      title: "Discussion",
      createdAt: 1,
      updatedAt: 1,
      messages: [
        { id: "u1", role: "user", content: "Bonjour", createdAt: 1 },
        {
          id: "a1",
          role: "assistant",
          content: "",
          createdAt: 2,
          providerId: "fake",
          model: "model-1",
          toolCalls: [{ id: "call-1", name: "outil", args: {} }],
        },
        {
          id: "t1",
          role: "tool",
          content: "resultat outil",
          toolCallId: "call-1",
          toolName: "outil",
          createdAt: 3,
        },
        {
          id: "a2",
          role: "assistant",
          content: "Reponse finale",
          createdAt: 4,
          providerId: "fake",
          model: "model-1",
        },
      ],
    };
    db.getConversation.mockResolvedValue(conversation);
    db.saveConversation.mockResolvedValue(undefined);
    provider.chatStream.mockImplementation(async (_params, _key, onChunk) => {
      onChunk({ type: "text", delta: "Nouvelle reponse" });
    });

    const updates: Conversation[] = [];
    const { result } = renderHook(() => useChat((value) => updates.push(value), vi.fn()));

    await act(async () => {
      await result.current.regenerate("conversation-1", "fake", "model-2");
    });

    const final = updates.at(-1)!;
    expect(final.messages).toHaveLength(2);
    expect(final.messages[0]).toMatchObject({ role: "user", content: "Bonjour" });
    expect(final.messages[1]).toMatchObject({ role: "assistant", content: "Nouvelle reponse" });
    expect(final.messages.some((m) => m.role === "tool")).toBe(false);
  });

  it("ne fait rien si la conversation ne contient aucun message utilisateur", async () => {
    const conversation: Conversation = {
      id: "conversation-1",
      title: "Discussion",
      createdAt: 1,
      updatedAt: 1,
      messages: [
        {
          id: "a1",
          role: "assistant",
          content: "Bonjour, comment puis-je vous aider ?",
          createdAt: 1,
          providerId: "fake",
          model: "model-1",
        },
      ],
    };
    db.getConversation.mockResolvedValue(conversation);

    const updates: Conversation[] = [];
    const onListChanged = vi.fn();
    const { result } = renderHook(() => useChat((value) => updates.push(value), onListChanged));

    await act(async () => {
      await result.current.regenerate("conversation-1", "fake", "model-2");
    });

    expect(provider.chatStream).not.toHaveBeenCalled();
    expect(db.saveConversation).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
    expect(onListChanged).not.toHaveBeenCalled();
  });
});
