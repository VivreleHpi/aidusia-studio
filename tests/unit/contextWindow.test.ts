import { describe, expect, it } from "vitest";
import { selectMessagesForContext } from "@/lib/contextWindow";
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
});
