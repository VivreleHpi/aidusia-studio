import { describe, expect, it } from "vitest";
import { conversationToMarkdown } from "@/lib/conversationExport";
import type { Conversation } from "@/lib/db";

describe("conversationExport", () => {
  it("renders markdown with roles and rag citations", () => {
    const conv: Conversation = {
      id: "1",
      title: "Test",
      createdAt: 0,
      updatedAt: 0,
      messages: [
        { id: "u1", role: "user", content: "Bonjour", createdAt: 0 },
        {
          id: "a1",
          role: "assistant",
          content: "Salut",
          createdAt: 1,
          ragCitations: [{ label: "1", fileName: "doc.md", excerpt: "extrait" }],
        },
      ],
    };
    const md = conversationToMarkdown(conv, "fr");
    expect(md).toContain("# Test");
    expect(md).toContain("## Utilisateur");
    expect(md).toContain("doc.md");
  });
});
