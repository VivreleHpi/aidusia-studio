import { RAG_EMBEDDING_DIM } from "@/lib/rag/types";

export type EmbeddingImpl = "hash" | "transformers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transformersPipeline: any = null;
let transformersLoad: Promise<void> | null = null;

async function loadTransformersPipeline() {
  if (transformersPipeline) return transformersPipeline;
  if (!transformersLoad) {
    transformersLoad = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      transformersPipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    })();
  }
  await transformersLoad;
  return transformersPipeline;
}

/** Deterministic lightweight embedding for tests and fallback (no model download). */
export function hashEmbed(text: string, dim = RAG_EMBEDDING_DIM): number[] {
  const vec = new Float64Array(dim);
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (tokens.length === 0) return Array.from(vec);

  for (const token of tokens) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
  }

  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec, (v) => v / norm);
}

export async function embedTexts(
  texts: string[],
  impl: EmbeddingImpl = "transformers",
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (impl === "hash") return texts.map((t) => hashEmbed(t));

  try {
    const extractor = await loadTransformersPipeline();
    if (!extractor) return texts.map((t) => hashEmbed(t));
    const out: number[][] = [];
    for (const text of texts) {
      const result = await extractor(text, { pooling: "mean", normalize: true });
      out.push(Array.from(result.data));
    }
    return out;
  } catch {
    return texts.map((t) => hashEmbed(t));
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot;
}
