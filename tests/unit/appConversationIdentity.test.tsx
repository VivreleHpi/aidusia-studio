import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "@/lib/db";
import App from "@/App";

const CONVERSATION_A: Conversation = {
  id: "conversation-a",
  title: "Conversation A",
  createdAt: 1,
  updatedAt: 1,
  messages: [{ id: "a-user", role: "user", content: "Message A", createdAt: 1 }],
};

const CONVERSATION_B: Conversation = {
  id: "conversation-b",
  title: "Conversation B",
  createdAt: 2,
  updatedAt: 2,
  messages: [{ id: "b-user", role: "user", content: "Message B", createdAt: 2 }],
};

const db = vi.hoisted(() => ({
  listConversations: vi.fn(),
  getConversation: vi.fn(),
  saveConversation: vi.fn(),
  deleteConversation: vi.fn(),
  purgeAll: vi.fn(),
  newConversationId: vi.fn(() => "conversation-new"),
}));

const chat = vi.hoisted(() => ({
  onUpdated: null as ((conversation: Conversation) => void) | null,
  sendMessage: vi.fn(async () => {}),
  regenerate: vi.fn(async () => {}),
  stop: vi.fn(),
}));

vi.mock("@/lib/db", () => db);
vi.mock("@/lib/deviceDetect", () => ({
  isMobile: () => false,
  shouldShowOnboarding: () => false,
}));
vi.mock("@/lib/i18n", () => ({
  useLang: () => ({ lang: "fr" }),
  newConversationTitle: () => "Nouvelle conversation",
}));
vi.mock("@/hooks/useChat", () => ({
  useChat: (onUpdated: (conversation: Conversation) => void) => {
    chat.onUpdated = onUpdated;
    return {
      sendMessage: chat.sendMessage,
      regenerate: chat.regenerate,
      stop: chat.stop,
      streaming: true,
      error: null,
    };
  },
}));
vi.mock("@/components/Sidebar", () => ({
  FOCUS_SEARCH_EVENT: "aidusia:test-focus-search",
  SIDEBAR_ID: "aidusia-sidebar",
  Sidebar: ({
    onSelect,
    onDelete,
  }: {
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
  }) => (
    <nav aria-label="Conversations de test">
      <button type="button" onClick={() => onSelect("conversation-a")}>
        Ouvrir A
      </button>
      <button type="button" onClick={() => onSelect("conversation-b")}>
        Ouvrir B
      </button>
      <button type="button" onClick={() => onDelete("conversation-a")}>
        Supprimer A
      </button>
    </nav>
  ),
}));
vi.mock("@/components/ChatView", () => ({
  ChatView: ({
    conversation,
    onSend,
  }: {
    conversation: Conversation | null;
    onSend: (content: string) => void | Promise<void>;
  }) => (
    <section aria-label="Conversation affichée">
      {conversation ? `${conversation.id} — ${conversation.messages.at(-1)?.content}` : "Nouveau chat"}
      <button type="button" onClick={() => void onSend("Message en cours")}>
        Envoyer test
      </button>
    </section>
  ),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("App — identité de la conversation active", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    chat.onUpdated = null;
    chat.sendMessage.mockReset();
    chat.sendMessage.mockResolvedValue(undefined);
    db.listConversations.mockReset();
    db.listConversations.mockResolvedValue([CONVERSATION_A, CONVERSATION_B]);
    db.saveConversation.mockResolvedValue(undefined);
    db.deleteConversation.mockResolvedValue(undefined);
    db.purgeAll.mockResolvedValue(undefined);
  });

  it("masque A pendant le chargement de B et ignore les derniers snapshots du stream A", async () => {
    const pendingB = deferred<Conversation | null>();
    db.getConversation.mockImplementation((id: string) =>
      id === "conversation-a" ? Promise.resolve(CONVERSATION_A) : pendingB.promise,
    );

    render(<App />);
    expect(await screen.findByText(/conversation-a — Message A/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir B" }));

    expect(screen.queryByText(/conversation-a/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Chargement de la conversation…");

    act(() => {
      chat.onUpdated?.({
        ...CONVERSATION_A,
        messages: [
          ...CONVERSATION_A.messages,
          { id: "a-assistant", role: "assistant", content: "Dernier chunk A", createdAt: 3 },
        ],
      });
    });
    expect(screen.getByRole("status")).toHaveTextContent("Chargement de la conversation…");
    expect(screen.queryByText(/Dernier chunk A/)).not.toBeInTheDocument();

    await act(async () => {
      pendingB.resolve(CONVERSATION_B);
      await pendingB.promise;
    });
    expect(await screen.findByText(/conversation-b — Message B/)).toBeInTheDocument();

    act(() => {
      chat.onUpdated?.({
        ...CONVERSATION_A,
        messages: [
          ...CONVERSATION_A.messages,
          { id: "a-late", role: "assistant", content: "Chunk A très tardif", createdAt: 4 },
        ],
      });
    });

    await waitFor(() =>
      expect(screen.getByText(/conversation-b — Message B/)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Chunk A très tardif/)).not.toBeInTheDocument();
  });

  it("attend la sauvegarde finale du stream avant de supprimer sa conversation", async () => {
    const activeRun = deferred<void>();
    chat.sendMessage.mockReturnValue(activeRun.promise);
    db.listConversations
      .mockResolvedValueOnce([CONVERSATION_A, CONVERSATION_B])
      .mockResolvedValue([CONVERSATION_B]);
    db.getConversation.mockResolvedValue(CONVERSATION_A);

    render(<App />);
    expect(await screen.findByText(/conversation-a — Message A/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Envoyer test" }));
    await waitFor(() => expect(chat.sendMessage).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Supprimer A" }));
    await waitFor(() => expect(chat.stop).toHaveBeenCalledTimes(1));
    expect(db.deleteConversation).not.toHaveBeenCalled();

    await act(async () => {
      activeRun.resolve();
      await activeRun.promise;
    });
    await waitFor(() => expect(db.deleteConversation).toHaveBeenCalledWith("conversation-a"));
  });
});
