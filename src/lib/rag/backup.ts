import {
  listRagChunksForSpace,
  listRagDocuments,
  listRagSpaces,
  putRagChunks,
  purgeAllRagData,
  saveRagDocument,
  saveRagSpace,
} from "@/lib/rag/store";
import type { RagChunk, RagDocument, RagSpace } from "@/lib/rag/types";
import {
  getDefaultRagSpaceId,
  RAG_SPACE_GLOBAL_KEY,
  setDefaultRagSpaceId,
} from "@/lib/rag/conversationLink";

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const WRONG_PASSPHRASE = "Phrase secrète incorrecte ou fichier corrompu.";

interface RagArchiveV1 {
  version: 1;
  exportedAt: string;
  defaultSpaceId: string | null;
  spaces: RagSpace[];
  documents: RagDocument[];
  chunks: RagChunk[];
}

interface EncryptedEnvelope {
  v: 1;
  kind: "aidusia-rag";
  kdf: "PBKDF2";
  iter: number;
  salt: string;
  iv: string;
  data: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function buildRagArchive(): Promise<RagArchiveV1> {
  const spaces = await listRagSpaces();
  const documents: RagDocument[] = [];
  const chunks: RagChunk[] = [];
  for (const space of spaces) {
    documents.push(...(await listRagDocuments(space.id)));
    chunks.push(...(await listRagChunksForSpace(space.id)));
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    defaultSpaceId: getDefaultRagSpaceId(),
    spaces,
    documents,
    chunks,
  };
}

export async function exportRagArchivePlain(): Promise<Blob> {
  const archive = await buildRagArchive();
  return new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" });
}

export async function exportRagArchiveEncrypted(passphrase: string): Promise<Blob> {
  const archive = await buildRagArchive();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(archive));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plaintext);
  const envelope: EncryptedEnvelope = {
    v: 1,
    kind: "aidusia-rag",
    kdf: "PBKDF2",
    iter: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext)),
  };
  return new Blob([JSON.stringify(envelope)], { type: "application/json" });
}

function validateArchive(value: unknown): RagArchiveV1 {
  if (!value || typeof value !== "object") throw new Error("Invalid archive");
  const v = value as RagArchiveV1;
  if (v.version !== 1 || !Array.isArray(v.spaces) || !Array.isArray(v.documents) || !Array.isArray(v.chunks)) {
    throw new Error("Invalid archive");
  }
  return v;
}

export async function importRagArchiveFromPlain(file: File, replaceExisting: boolean): Promise<void> {
  if (file.size === 0 || file.size > MAX_IMPORT_BYTES) throw new Error("Fichier trop volumineux");
  const archive = validateArchive(JSON.parse(await file.text()));
  await applyArchive(archive, replaceExisting);
}

export async function importRagArchiveFromEncrypted(
  file: File,
  passphrase: string,
  replaceExisting: boolean,
): Promise<void> {
  if (file.size === 0 || file.size > MAX_IMPORT_BYTES) throw new Error(WRONG_PASSPHRASE);
  let envelope: EncryptedEnvelope;
  try {
    envelope = JSON.parse(await file.text());
  } catch {
    throw new Error(WRONG_PASSPHRASE);
  }
  if (envelope?.kind !== "aidusia-rag" || envelope.v !== 1) throw new Error(WRONG_PASSPHRASE);
  try {
    const salt = fromBase64(envelope.salt);
    const iv = fromBase64(envelope.iv);
    const ciphertext = fromBase64(envelope.data);
    const key = await deriveKey(passphrase, salt, envelope.iter);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    const archive = validateArchive(JSON.parse(new TextDecoder().decode(plaintext)));
    await applyArchive(archive, replaceExisting);
  } catch {
    throw new Error(WRONG_PASSPHRASE);
  }
}

async function applyArchive(archive: RagArchiveV1, replaceExisting: boolean): Promise<void> {
  if (replaceExisting) await purgeAllRagData();
  for (const space of archive.spaces) await saveRagSpace(space);
  for (const doc of archive.documents) await saveRagDocument(doc);
  await putRagChunks(archive.chunks);
  if (archive.defaultSpaceId) {
    localStorage.setItem(RAG_SPACE_GLOBAL_KEY, archive.defaultSpaceId);
    setDefaultRagSpaceId(archive.defaultSpaceId);
  }
}

export function downloadRagBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
