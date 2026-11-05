import { describe, expect, it } from "vitest";
import { listAssistantTemplates } from "@/lib/assistantTemplates";

describe("assistantTemplates", () => {
  it("returns localized labels", () => {
    const fr = listAssistantTemplates("fr");
    expect(fr.some((t) => t.id === "summarize" && t.label === "Résumer")).toBe(true);
    const en = listAssistantTemplates("en");
    expect(en.some((t) => t.id === "code" && t.label === "Code")).toBe(true);
  });
});
