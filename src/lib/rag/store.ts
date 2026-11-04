import {
  openAidusiaDatabase,
  STORE_RAG_CHUNKS,
  STORE_RAG_DOCUMENTS,
  STORE_RAG_SPACES,
} from "@/lib/db";
import type { RagChunk, RagDocument, RagSpace } from "@/lib/rag/types";

async function tx<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  run: (stores: Record<string, IDBObjectStore>) => Promise<T>,
): Promise<T> {
  const db = await openAidusiaDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const stores: Record<string, IDBObjectStore> = {};
    for (const name of storeNames) stores[name] = tx.objectStore(name);
    run(stores).then(resolve).catch(reject);
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export async function listRagSpaces(): Promise<RagSpace[]> {
  return tx([STORE_RAG_SPACES], "readonly", async (s) => {
    return new Promise((resolve, reject) => {
      const req = s[STORE_RAG_SPACES].getAll();
      req.onsuccess = () => resolve((req.result as RagSpace[]).sort((a, b) => b.updatedAt - a.updatedAt));
      req.onerror = () => reject(req.error);
    });
  });
}

export async function saveRagSpace(space: RagSpace): Promise<void> {
  await tx([STORE_RAG_SPACES], "readwrite", async (s) => {
    s[STORE_RAG_SPACES].put(space);
  });
}

export async function deleteRagSpace(id: string): Promise<void> {
  const docs = await listRagDocuments(id);
  for (const doc of docs) await deleteRagDocument(doc.id);
  await tx([STORE_RAG_SPACES], "readwrite", async (s) => {
    s[STORE_RAG_SPACES].delete(id);
  });
}

export async function listRagDocuments(spaceId: string): Promise<RagDocument[]> {
  return tx([STORE_RAG_DOCUMENTS], "readonly", async (s) => {
    return new Promise((resolve, reject) => {
      const req = s[STORE_RAG_DOCUMENTS].getAll();
      req.onsuccess = () => {
        const all = req.result as RagDocument[];
        resolve(all.filter((d) => d.spaceId === spaceId).sort((a, b) => b.createdAt - a.createdAt));
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function saveRagDocument(doc: RagDocument): Promise<void> {
  await tx([STORE_RAG_DOCUMENTS], "readwrite", async (s) => {
    s[STORE_RAG_DOCUMENTS].put(doc);
  });
}

export async function deleteRagDocument(documentId: string): Promise<void> {
  const chunks = await listRagChunksForDocument(documentId);
  await tx([STORE_RAG_CHUNKS, STORE_RAG_DOCUMENTS], "readwrite", async (s) => {
    for (const chunk of chunks) s[STORE_RAG_CHUNKS].delete(chunk.id);
    s[STORE_RAG_DOCUMENTS].delete(documentId);
  });
}

export async function listRagChunksForSpace(spaceId: string): Promise<RagChunk[]> {
  return tx([STORE_RAG_CHUNKS], "readonly", async (s) => {
    return new Promise((resolve, reject) => {
      const req = s[STORE_RAG_CHUNKS].getAll();
      req.onsuccess = () => {
        const all = req.result as RagChunk[];
        resolve(all.filter((c) => c.spaceId === spaceId));
      };
      req.onerror = () => reject(req.error);
    });
  });
}

async function listRagChunksForDocument(documentId: string): Promise<RagChunk[]> {
  return tx([STORE_RAG_CHUNKS], "readonly", async (s) => {
    return new Promise((resolve, reject) => {
      const req = s[STORE_RAG_CHUNKS].getAll();
      req.onsuccess = () => {
        const all = req.result as RagChunk[];
        resolve(all.filter((c) => c.documentId === documentId));
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function putRagChunks(chunks: RagChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  await tx([STORE_RAG_CHUNKS], "readwrite", async (s) => {
    for (const chunk of chunks) s[STORE_RAG_CHUNKS].put(chunk);
  });
}

export async function purgeAllRagData(): Promise<void> {
  await tx([STORE_RAG_CHUNKS, STORE_RAG_DOCUMENTS, STORE_RAG_SPACES], "readwrite", async (s) => {
    s[STORE_RAG_CHUNKS].clear();
    s[STORE_RAG_DOCUMENTS].clear();
    s[STORE_RAG_SPACES].clear();
  });
}

export async function createRagSpace(name: string): Promise<RagSpace> {
  const now = Date.now();
  const space: RagSpace = { id: crypto.randomUUID(), name: name.trim() || "Documents", createdAt: now, updatedAt: now };
  await saveRagSpace(space);
  return space;
}
