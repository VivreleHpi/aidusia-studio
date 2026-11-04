import { describe, expect, it } from "vitest";

import { chunkPlainText } from "@/lib/rag/chunk";
import { linkifyCitationMarkers } from "@/lib/rag/citations";
import { cosineSimilarity, hashEmbed } from "@/lib/rag/embeddings";

describe("rag chunk", () => {
  it("decoupe avec chevauchement", () => {
    const text = "a".repeat(1000);
    const parts = chunkPlainText(text, 400, 50);
    expect(parts.length).toBeGreaterThan(2);
    expect(parts[0].length).toBeLessThanOrEqual(400);
  });
});

describe("rag embeddings", () => {
  it("hashEmbed est normalise", () => {
    const v = hashEmbed("bonjour document test");
    const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("cosineSimilarity preferre texte proche", () => {
    const a = hashEmbed("chat local Ollama");
    const b = hashEmbed("Ollama local chat");
    const c = hashEmbed("recette de gateau");
    expect(cosineSimilarity(a, b)).toBeGreaterThan(cosineSimilarity(a, c));
  });
});

describe("rag citations", () => {
  it("linkifyCitationMarkers ne touche que les labels connus", () => {
    const out = linkifyCitationMarkers("Voir [1] et [9] fin.", [1]);
    expect(out).toContain("[1](#cite-1)");
    expect(out).toContain("[9]");
  });
});
