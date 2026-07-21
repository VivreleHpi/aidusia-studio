import { newConversationId, saveConversation, type Conversation } from "@/lib/db";
import type { Lang } from "@/lib/i18n";
import type { ComparisonResult } from "@/hooks/useComparison";

function validationError(lang: Lang, field: "prompt" | "content"): Error {
  if (lang === "en") {
    return new Error(field === "prompt" ? "The prompt cannot be empty." : "The response cannot be empty.");
  }

  return new Error(field === "prompt" ? "La question ne peut pas être vide." : "La réponse ne peut pas être vide.");
}

/**
 * Persiste une réponse du comparateur comme une conversation locale autonome.
 * Le texte est conservé tel quel afin de ne pas altérer son éventuel Markdown.
 */
export async function createConversationFromComparison(
  prompt: string,
  result: ComparisonResult,
  lang: Lang,
): Promise<Conversation> {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) throw validationError(lang, "prompt");
  if (!result.content.trim()) throw validationError(lang, "content");

  const now = Date.now();
  const conversation: Conversation = {
    id: newConversationId(),
    title: trimmedPrompt.slice(0, 60),
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.content,
        createdAt: now,
        providerId: result.target.providerId,
        model: result.target.model,
      },
    ],
  };

  await saveConversation(conversation);
  return conversation;
}
