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

function Harness({ current, fail = false }: { current: Conversation | null; fail?: boolean }) {
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
