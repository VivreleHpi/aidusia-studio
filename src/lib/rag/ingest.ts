import { chunkPlainText } from "@/lib/rag/chunk";
import { embedTexts, type EmbeddingImpl } from "@/lib/rag/embeddings";
import {
  listRagSpaces,
  putRagChunks,
  saveRagDocument,
  saveRagSpace,
} from "@/lib/rag/store";
import type { RagDocument } from "@/lib/rag/types";
import type { RagChunk } from "@/lib/rag/types";

const TEXT_TYPES = new Set(["text/plain", "text/markdown", "text/x-markdown", "application/octet-stream"]);

function guessMime(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

async function extractPlainText(file: File, mime: string): Promise<string> {
  if (mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const buffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const parts: string[] = [];
    for (let page = 1; page <= doc.numPages; page++) {
      const pageContent = await doc.getPage(page);
      const textContent = await pageContent.getTextContent();
      const line = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      parts.push(line);
    }
    return parts.join("\n\n");
  }

  if (TEXT_TYPES.has(mime) || file.name.match(/\.(md|txt|markdown)$/i)) {
    return file.text();
  }

  throw new Error(`Type de fichier non pris en charge : ${file.name}`);
}

export interface IngestProgress {
  phase: "extract" | "chunk" | "embed" | "save";
  message: string;
}

export async function ingestFileIntoSpace(
  spaceId: string,
  file: File,
  onProgress?: (p: IngestProgress) => void,
  embeddingImpl: EmbeddingImpl = "transformers",
): Promise<RagDocument> {
  onProgress?.({ phase: "extract", message: file.name });
  const mime = guessMime(file);
  const plain = await extractPlainText(file, mime);
  const pieces = chunkPlainText(plain);
  if (pieces.length === 0) throw new Error("Aucun texte extractible dans ce fichier.");

  onProgress?.({ phase: "chunk", message: `${pieces.length} segments` });
  const embeddings = await embedTexts(pieces, embeddingImpl);

  const documentId = crypto.randomUUID();
  const doc: RagDocument = {
    id: documentId,
    spaceId,
    fileName: file.name,
    mimeType: mime,
    charCount: plain.length,
    createdAt: Date.now(),
  };

  const chunks: RagChunk[] = pieces.map((text, index) => ({
    id: crypto.randomUUID(),
    spaceId,
    documentId,
    index,
    text,
    embedding: embeddings[index] ?? [],
  }));

  onProgress?.({ phase: "save", message: file.name });
  await saveRagDocument(doc);
  await putRagChunks(chunks);

  const space = (await listRagSpaces()).find((s) => s.id === spaceId);
  if (space) {
    await saveRagSpace({ ...space, updatedAt: Date.now() });
  }

  return doc;
}
