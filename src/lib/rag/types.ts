export interface RagSpace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface RagDocument {
  id: string;
  spaceId: string;
  fileName: string;
  mimeType: string;
  charCount: number;
  createdAt: number;
}

export interface RagChunk {
  id: string;
  spaceId: string;
  documentId: string;
  index: number;
  text: string;
  /** L2-normalized embedding vector (browser-computed). */
  embedding: number[];
}

export interface RagCitation {
  chunkId: string;
  documentId: string;
  fileName: string;
  excerpt: string;
  /** 1-based index shown in the model answer as [1], [2], … */
  label: number;
}

export const RAG_EMBEDDING_DIM = 384;
