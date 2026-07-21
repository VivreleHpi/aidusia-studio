import { act, renderHook, waitFor } from "@testing-library/react";
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

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function emptyConversation(): Conversation {
  return {
    id: "conversation-1",
    title: "Nouvelle conversation",
    createdAt: 1,
    updatedAt: 1,
    messages: [],
  };
}

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emet des snapshots immutables pendant le streaming", async () => {
    const conversation = emptyConversation();
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

  it("absorbe l'échec d'une persistance intermédiaire quand la sauvegarde finale réussit", async () => {
    db.getConversation.mockResolvedValue(emptyConversation());
    db.saveConversation
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Quota temporaire"))
      .mockResolvedValueOnce(undefined);
    provider.chatStream.mockImplementation(async (_params, _key, onChunk) => {
      onChunk({ type: "text", delta: "Réponse complète" });
    });

    const { result } = renderHook(() => useChat(vi.fn(), vi.fn()));
    await act(async () => {
      await expect(
        result.current.sendMessage("conversation-1", "Question", "fake", "model-1"),
      ).resolves.toBeUndefined();
    });

    expect(db.saveConversation).toHaveBeenCalledTimes(3);
    expect(result.current.streaming).toBe(false);
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

  it("verrouille synchroniquement un run et laisse stop viser son contrôleur", async () => {
    const read = deferred<Conversation | undefined>();
    db.getConversation.mockReturnValueOnce(read.promise);
    db.saveConversation.mockResolvedValue(undefined);

    let activeSignal!: AbortSignal;
    provider.chatStream.mockImplementation((params) => {
      activeSignal = params.signal!;
      return new Promise<void>((_resolve, reject) => {
        if (activeSignal.aborted) {
          reject(new DOMException("Arrêté", "AbortError"));
          return;
        }
        activeSignal.addEventListener(
          "abort",
          () => reject(new DOMException("Arrêté", "AbortError")),
          { once: true },
        );
      });
    });

    const updates: Conversation[] = [];
    const { result } = renderHook(() => useChat((value) => updates.push(value), vi.fn()));
    let firstRun!: Promise<void>;
    let overlappingRun!: Promise<void>;

    act(() => {
      firstRun = result.current.sendMessage(
        "conversation-1",
        "Premier message",
        "fake",
        "model-1",
      );
      // Le même verrou couvre aussi la régénération : cet appel ne doit même
      // pas effectuer une deuxième lecture IndexedDB.
      overlappingRun = result.current.regenerate("conversation-1", "fake", "model-2");
    });

    expect(db.getConversation).toHaveBeenCalledTimes(1);
    expect(db.saveConversation).not.toHaveBeenCalled();
    expect(provider.chatStream).not.toHaveBeenCalled();
    expect(result.current.streaming).toBe(true);

    read.resolve(emptyConversation());
    await waitFor(() => expect(provider.chatStream).toHaveBeenCalledTimes(1));

    act(() => result.current.stop());
    expect(activeSignal.aborted).toBe(true);
    await act(async () => {
      await Promise.all([firstRun, overlappingRun]);
    });
    expect(result.current.streaming).toBe(false);

    expect(db.getConversation).toHaveBeenCalledTimes(1);
    expect(provider.chatStream.mock.calls[0][0]).toMatchObject({ model: "model-1" });
    const firstSaved = db.saveConversation.mock.calls[0][0] as Conversation;
    expect(firstSaved.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(firstSaved.messages.find((message) => message.role === "user")?.content).toBe(
      "Premier message",
    );
    expect(updates).not.toHaveLength(0);
  });

  it("libère le verrou lorsque la conversation est absente", async () => {
    db.getConversation
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(emptyConversation());
    db.saveConversation.mockResolvedValue(undefined);
    provider.chatStream.mockImplementation(async (_params, _key, onChunk) => {
      onChunk({ type: "text", delta: "Réponse" });
    });

    const { result } = renderHook(() => useChat(vi.fn(), vi.fn()));
    await act(async () => {
      await result.current.sendMessage("absente", "Ignoré", "fake", "model-1");
      await result.current.sendMessage("conversation-1", "Accepté", "fake", "model-1");
    });

    expect(db.getConversation).toHaveBeenCalledTimes(2);
    expect(provider.chatStream).toHaveBeenCalledTimes(1);
  });

  it("libère le verrou après une erreur précédant le streaming", async () => {
    db.getConversation
      .mockRejectedValueOnce(new Error("IndexedDB indisponible"))
      .mockResolvedValueOnce(emptyConversation());
    db.saveConversation.mockResolvedValue(undefined);
    provider.chatStream.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChat(vi.fn(), vi.fn()));
    await act(async () => {
      await expect(
        result.current.sendMessage("conversation-1", "Premier", "fake", "model-1"),
      ).rejects.toThrow("IndexedDB indisponible");
    });
    await act(async () => {
      await result.current.sendMessage("conversation-1", "Second", "fake", "model-1");
    });

    expect(db.getConversation).toHaveBeenCalledTimes(2);
    expect(provider.chatStream).toHaveBeenCalledTimes(1);
  });
});
