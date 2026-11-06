import { describe, expect, it } from "vitest";
import {
  computeContextSelectionStats,
  filterEligibleProviderHistory,
  selectMessagesForContext,
} from "@/lib/contextWindow";
import type { ChatMessage } from "@/providers/types";

const message = (role: ChatMessage["role"], content: string): ChatMessage => ({ role, content });

describe("selectMessagesForContext", () => {
  it("keeps recent complete user turns", () => {
    const messages = [
      message("user", "old"),
      message("assistant", "old response"),
      message("user", "latest"),
      message("assistant", "latest response"),
    ];
    expect(selectMessagesForContext(messages, 100)).toEqual(messages.slice(2));
  });

  it("never returns a partial latest turn and rejects invalid budgets", () => {
    const messages = [message("user", "question"), message("assistant", "answer")];
    expect(selectMessagesForContext(messages, 1)).toEqual(messages);
    expect(selectMessagesForContext(messages, 0)).toEqual([]);
  });

  it("filterEligibleProviderHistory drops empty assistant placeholders", () => {
    const messages = [
      message("user", "hi"),
      message("assistant", ""),
      message("user", "again"),
    ];
    expect(filterEligibleProviderHistory(messages)).toEqual([message("user", "hi"), message("user", "again")]);
  });

  it("computeContextSelectionStats reports truncation", () => {
    const messages = [
      message("user", "a"),
      message("assistant", "b"),
      message("user", "c"),
      message("assistant", "d"),
    ];
    const small = computeContextSelectionStats(messages, 10);
    expect(small.eligibleMessageCount).toBe(4);
    expect(small.sentMessageCount).toBeLessThan(4);
    expect(small.truncated).toBe(true);
    const full = computeContextSelectionStats(messages, 10_000);
    expect(full.sentMessageCount).toBe(4);
    expect(full.truncated).toBe(false);
  });
});
