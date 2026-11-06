import { describe, expect, it } from "vitest";
import {
  computeProviderContextStats,
  lucioleFlattenHistoryForTextModel,
  lucioleFullSystemPrompt,
  lucioleHistoryCharBudget,
  luciolePrepareMessagesForChat,
} from "@/lib/lucioleContext";
import type { ChatMessage } from "@/providers/types";

const user = (content: string): ChatMessage => ({ role: "user", content });
const assistant = (content: string, toolCalls?: ChatMessage["toolCalls"]): ChatMessage => ({
  role: "assistant",
  content,
  toolCalls,
});
const tool = (content: string, toolName: string): ChatMessage => ({
  role: "tool",
  content,
  toolName,
});

describe("lucioleFlattenHistoryForTextModel", () => {
  it("folds assistant tool_calls and following tool messages into one assistant text", () => {
    const messages: ChatMessage[] = [
      user("Quelle heure à Paris ?"),
      assistant("", [{ id: "1", name: "get_time", args: { zone: "Europe/Paris" } }]),
      tool("2026-11-06T12:00:00Z", "get_time"),
      assistant("Il est midi à Paris."),
    ];
    const flat = lucioleFlattenHistoryForTextModel(messages, "fr");
    expect(flat).toEqual([
      user("Quelle heure à Paris ?"),
      assistant(
        [
          "[Appel d’outil : get_time] {\"zone\":\"Europe/Paris\"}",
          "Résultat (get_time) : 2026-11-06T12:00:00Z",
        ].join("\n\n"),
      ),
      assistant("Il est midi à Paris."),
    ]);
  });

  it("attaches orphan tool result to the previous user turn", () => {
    const flat = lucioleFlattenHistoryForTextModel([tool("done", "x"), user("suite ?")], "fr");
    expect(flat[0]).toEqual(user("suite ?\n\n[Résultat d’outil (x)] done"));
  });
});

describe("luciolePrepareMessagesForChat", () => {
  it("uses the Luciole history char budget (not the global 48k cap)", () => {
    const studio = "x".repeat(500);
    const full = lucioleFullSystemPrompt("fr", studio);
    const expectedBudget = lucioleHistoryCharBudget(4096, full);
    const long = "y".repeat(800);
    const messages: ChatMessage[] = [
      user(long),
      assistant("ok"),
      user("fin"),
    ];
    const prep = luciolePrepareMessagesForChat(messages, 4096, "fr", studio);
    expect(prep.budgetChars).toBe(expectedBudget);
    expect(prep.forCompletion.map((m) => m.content)).toContain("fin");
  });
});

describe("computeProviderContextStats", () => {
  it("applies Luciole budget and flattening for providerId luciole", () => {
    const messages: ChatMessage[] = [
      user("a"),
      assistant("", [{ id: "1", name: "t", args: {} }]),
      tool("résultat", "t"),
    ];
    const stats = computeProviderContextStats({
      providerId: "luciole",
      lang: "fr",
      eligibleMessages: messages,
      studioSystemPrompt: "ctx",
      lucioleNCtx: 4096,
    });
    expect(stats.lucioleMcpFolded).toBe(true);
    expect(stats.flattenedEligibleCount).toBe(2);
    expect(stats.sentMessageCount).toBeLessThanOrEqual(stats.flattenedEligibleCount ?? 0);
  });

  it("uses global budget for non-luciole providers", () => {
    const messages: ChatMessage[] = [user("hi"), assistant("yo")];
    const stats = computeProviderContextStats({
      providerId: "openai",
      lang: "fr",
      eligibleMessages: messages,
      studioSystemPrompt: "s",
    });
    expect(stats.flattenedEligibleCount).toBeUndefined();
    expect(stats.sentMessageCount).toBe(2);
  });
});
