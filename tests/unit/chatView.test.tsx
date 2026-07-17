import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatView } from "@/components/ChatView";
import type { Conversation } from "@/lib/db";

const provider = vi.hoisted(() => ({
  id: "fake",
  label: "Fake",
  requiresApiKey: false,
  listModels: vi.fn(async () => [{ id: "model-1", label: "Model 1" }]),
}));

vi.mock("@/providers", () => ({ providers: [provider] }));
vi.mock("@/providers/browserLocal", () => ({
  LOCAL_AI_PROGRESS_EVENT: "aidusia:test-local-ai",
}));
vi.mock("@/hooks/useVisionCapability", () => ({ useVisionCapability: () => false }));
vi.mock("@/hooks/useDictation", () => ({
  useDictation: () => ({ supported: false, listening: false, start: vi.fn(), stop: vi.fn() }),
}));
vi.mock("@/lib/ocr", () => ({ extractTextFromImage: vi.fn() }));
vi.mock("@/lib/imageSafety", () => ({
  prepareVisionImage: vi.fn(),
  validateImageFile: vi.fn(),
}));

function conversation(id: string): Conversation {
  return { id, title: id, createdAt: 1, updatedAt: 1, messages: [] };
}

function Harness({
  current,
  fail = false,
  onRegenerate,
}: {
  current: Conversation | null;
  fail?: boolean;
  onRegenerate?: () => void | Promise<void>;
}) {
  const [model, setModel] = useState("model-1");
  const [error, setError] = useState<string | null>(null);
  return (
    <ChatView
      conversation={current}
      streaming={false}
      error={error}
      onSend={() => {
        if (fail) setError("Echec reseau");
      }}
      onStop={vi.fn()}
      onRegenerate={onRegenerate ?? vi.fn()}
      providerId="fake"
      model={model}
      onChangeProvider={(_providerId, nextModel) => setModel(nextModel)}
      onOpenProviders={vi.fn()}
      onOpenFaq={vi.fn()}
      keysVersion={0}
    />
  );
}

describe("ChatView recovery", () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    provider.listModels.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("isole et restaure les brouillons de chaque conversation", async () => {
    const { rerender } = render(<Harness current={conversation("a")} />);
    const input = screen.getByPlaceholderText("Écrivez un message…");
    fireEvent.change(input, { target: { value: "Brouillon A" } });

    rerender(<Harness current={conversation("b")} />);
    expect(screen.getByPlaceholderText("Écrivez un message…")).toHaveValue("");
    fireEvent.change(screen.getByPlaceholderText("Écrivez un message…"), {
      target: { value: "Brouillon B" },
    });

    rerender(<Harness current={conversation("a")} />);
    expect(screen.getByPlaceholderText("Écrivez un message…")).toHaveValue("Brouillon A");
  });

  it("restaure le message et propose une relance apres une erreur", async () => {
    const current = conversation("a");
    current.messages.push({ id: "existing", role: "user", content: "Avant", createdAt: 1 });
    render(<Harness current={current} fail />);
    const input = screen.getByPlaceholderText("Écrivez un message…");
    fireEvent.change(input, { target: { value: "Message important" } });

    const send = screen.getByRole("button", { name: "Envoyer" });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Echec reseau"));
    expect(input).toHaveValue("Message important");
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeEnabled();
  });
});

describe("ChatView actions sur les réponses", () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    provider.listModels.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("affiche les boutons copier et partager sous une réponse assistant", () => {
    const current = conversation("a");
    current.messages.push(
      { id: "u1", role: "user", content: "Question", createdAt: 1 },
      {
        id: "a1",
        role: "assistant",
        content: "Réponse",
        createdAt: 2,
        providerId: "fake",
        model: "model-1",
      },
    );
    render(<Harness current={current} />);

    expect(screen.getByRole("button", { name: "Copier la réponse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Partager la réponse" })).toBeInTheDocument();
  });

  it("n'affiche le bouton régénérer que sous le dernier message assistant", () => {
    const current = conversation("a");
    current.messages.push(
      { id: "u1", role: "user", content: "Q1", createdAt: 1 },
      {
        id: "a1",
        role: "assistant",
        content: "R1",
        createdAt: 2,
        providerId: "fake",
        model: "model-1",
      },
      { id: "u2", role: "user", content: "Q2", createdAt: 3 },
      {
        id: "a2",
        role: "assistant",
        content: "R2",
        createdAt: 4,
        providerId: "fake",
        model: "model-1",
      },
    );
    render(<Harness current={current} />);

    expect(screen.getAllByRole("button", { name: "Copier la réponse" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Partager la réponse" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Régénérer la réponse" })).toHaveLength(1);
  });

  it("le clic sur régénérer appelle onRegenerate une fois le modèle prêt", async () => {
    const current = conversation("a");
    current.messages.push(
      { id: "u1", role: "user", content: "Question", createdAt: 1 },
      {
        id: "a1",
        role: "assistant",
        content: "Réponse",
        createdAt: 2,
        providerId: "fake",
        model: "model-1",
      },
    );
    const onRegenerate = vi.fn();
    render(<Harness current={current} onRegenerate={onRegenerate} />);

    const regenerateButton = screen.getByRole("button", { name: "Régénérer la réponse" });
    // Le bouton reste desactive tant que modelReadiness (pilote par ModelMenu,
    // ici avec le fournisseur "fake" mocke) n'a pas resolu a "ready".
    await waitFor(() => expect(regenerateButton).toBeEnabled());
    fireEvent.click(regenerateButton);

    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("le partage sans navigator.share telecharge la reponse via URL.createObjectURL", () => {
    const current = conversation("a");
    current.messages.push(
      { id: "u1", role: "user", content: "Question", createdAt: 1 },
      {
        id: "a1",
        role: "assistant",
        content: "Réponse à partager",
        createdAt: 2,
        providerId: "fake",
        model: "model-1",
      },
    );
    // jsdom ne fournit pas navigator.share : ShareButton doit tomber sur le
    // fallback telechargement. URL.createObjectURL/revokeObjectURL existent
    // deja dans ce jsdom (verifie), on les espionne juste (meme pattern que
    // les vi.spyOn de fetch/crypto.randomUUID ailleurs dans ces tests).
    expect(navigator.share).toBeUndefined();
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    try {
      render(<Harness current={current} />);
      fireEvent.click(screen.getByRole("button", { name: "Partager la réponse" }));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    } finally {
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
      clickSpy.mockRestore();
    }
  });
});
