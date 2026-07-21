import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConversationFromComparison } from "@/lib/comparisonConversation";
import type { ComparisonResult } from "@/hooks/useComparison";

const db = vi.hoisted(() => ({
  newConversationId: vi.fn(() => "conversation-id"),
  saveConversation: vi.fn(),
}));

vi.mock("@/lib/db", () => db);

const result: ComparisonResult = {
  target: { providerId: "openai", model: "gpt-test" },
  status: "done",
  content: "Une **réponse** utile.  \n",
  durationMs: 123,
};

describe("createConversationFromComparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.saveConversation.mockResolvedValue(undefined);
  });

  it("enregistre la question et la réponse avec leur modèle dans une nouvelle conversation", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_234_567);
    const randomUuid = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");

    const conversation = await createConversationFromComparison("  Pourquoi le ciel est bleu ?  ", result, "fr");

    expect(conversation).toEqual({
      id: "conversation-id",
      title: "Pourquoi le ciel est bleu ?",
      createdAt: 1_234_567,
      updatedAt: 1_234_567,
      messages: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          role: "user",
          content: "  Pourquoi le ciel est bleu ?  ",
          createdAt: 1_234_567,
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          role: "assistant",
          content: "Une **réponse** utile.  \n",
          createdAt: 1_234_567,
          providerId: "openai",
          model: "gpt-test",
        },
      ],
    });
    expect(db.saveConversation).toHaveBeenCalledOnce();
    expect(db.saveConversation).toHaveBeenCalledWith(conversation);

    randomUuid.mockRestore();
    vi.restoreAllMocks();
  });

  it("limite le titre aux 60 premiers caractères de la question nettoyée", async () => {
    const prompt = `  ${"a".repeat(65)}  `;

    const conversation = await createConversationFromComparison(prompt, result, "fr");

    expect(conversation.title).toBe("a".repeat(60));
    expect(conversation.title).toHaveLength(60);
  });

  it.each([
    { prompt: "   \n", content: "Réponse", lang: "fr" as const, message: "La question ne peut pas être vide." },
    { prompt: "Question", content: " \t ", lang: "fr" as const, message: "La réponse ne peut pas être vide." },
    { prompt: "", content: "Answer", lang: "en" as const, message: "The prompt cannot be empty." },
  ])("refuse les valeurs vides sans rien persister", async ({ prompt, content, lang, message }) => {
    await expect(
      createConversationFromComparison(prompt, { ...result, content }, lang),
    ).rejects.toThrow(message);
    expect(db.saveConversation).not.toHaveBeenCalled();
  });

  it("ne retourne pas la conversation si sa persistance échoue", async () => {
    db.saveConversation.mockRejectedValueOnce(new Error("IndexedDB indisponible"));

    await expect(createConversationFromComparison("Question", result, "fr")).rejects.toThrow(
      "IndexedDB indisponible",
    );
  });
});
