import type { Lang } from "@/lib/i18n";
import { cosineSimilarity, embedTexts, type EmbeddingImpl } from "@/lib/rag/embeddings";
import { listRagChunksForSpace, listRagDocuments } from "@/lib/rag/store";
import type { RagCitation } from "@/lib/rag/types";

export interface RagContextResult {
  citations: RagCitation[];
  /** Extra system instructions + sources block */
  systemAppendix: string;
}

export async function retrieveRagContext(
  spaceId: string,
  query: string,
  lang: Lang,
  topK = 5,
  embeddingImpl: EmbeddingImpl = "transformers",
): Promise<RagContextResult | null> {
  const chunks = await listRagChunksForSpace(spaceId);
  if (chunks.length === 0) return null;

  const [queryVec] = await embedTexts([query], embeddingImpl);
  const scored = chunks
    .map((chunk) => ({ chunk, score: cosineSimilarity(queryVec, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((entry) => entry.score > 0.05);

  if (scored.length === 0) return null;

  const docs = await listRagDocuments(spaceId);
  const docById = new Map(docs.map((d) => [d.id, d]));

  const citations: RagCitation[] = scored.map(({ chunk }, idx) => {
    const doc = docById.get(chunk.documentId);
    return {
      chunkId: chunk.id,
      documentId: chunk.documentId,
      fileName: doc?.fileName ?? "document",
      excerpt: chunk.text.slice(0, 280),
      label: idx + 1,
    };
  });

  const sourceBlocks = scored
    .map(({ chunk }, idx) => {
      const label = idx + 1;
      const doc = docById.get(chunk.documentId);
      const name = doc?.fileName ?? "document";
      return `[${label}] (${name})\n${chunk.text}`;
    })
    .join("\n\n---\n\n");

  const rulesFr =
    "Utilise uniquement les extraits numérotés ci-dessous pour les faits. Cite chaque affirmation issue d'un extrait avec [1], [2], etc. Si la réponse n'est pas couverte, dis-le clairement.";
  const rulesEn =
    "Use only the numbered excerpts below for factual claims. Cite each excerpt with [1], [2], etc. If the answer is not covered, say so clearly.";

  const systemAppendix = `${lang === "fr" ? rulesFr : rulesEn}\n\n### Sources\n${sourceBlocks}`;

  return { citations, systemAppendix };
}
