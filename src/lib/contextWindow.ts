import type { ChatMessage } from "@/providers/types";

// Conservative provider-agnostic budget (~12k text tokens). It prevents an
// unbounded conversation or a stored base64 image from being resent forever.
export const DEFAULT_CONTEXT_CHARACTER_BUDGET = 48_000;

function messageCost(message: ChatMessage): number {
  const imageCost = message.images?.reduce((total, image) => total + image.length, 0) ?? 0;
  const toolCost = message.toolCalls ? JSON.stringify(message.toolCalls).length : 0;
  return message.content.length + imageCost + toolCost + 32;
}

/** Keep complete user turns so tool-call/result sequences are never cut apart. */
export function selectMessagesForContext(
  messages: ChatMessage[],
  budget = DEFAULT_CONTEXT_CHARACTER_BUDGET,
): ChatMessage[] {
  if (!Number.isFinite(budget) || budget < 1) return [];

  const turns: ChatMessage[][] = [];
  for (const message of messages) {
    if (message.role === "user" || turns.length === 0) turns.push([]);
    turns.at(-1)!.push(message);
  }

  const selected: ChatMessage[][] = [];
  let used = 0;
  for (let index = turns.length - 1; index >= 0; index--) {
    const turn = turns[index];
    const cost = turn.reduce((total, message) => total + messageCost(message), 0);
    if (selected.length > 0 && used + cost > budget) break;
    selected.unshift(turn);
    used += cost;
  }
  return selected.flat();
}
