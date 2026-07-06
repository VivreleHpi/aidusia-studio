// Stockage 100% local : IndexedDB pour les conversations, jamais de serveur.
// Voir README/SECURITY : aucune donnee ne quitte le navigateur (sauf appel
// direct au fournisseur choisi par l'utilisateur, avec sa propre cle).
import type { ChatMessage } from "@/providers/types";

const DB_NAME = "aidusia-studio";
const DB_VERSION = 1;
const STORE_CONVERSATIONS = "conversations";

export interface StoredMessage extends ChatMessage {
  id: string;
  createdAt: number;
  providerId?: string;
  model?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        db.createObjectStore(STORE_CONVERSATIONS, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CONVERSATIONS, mode);
    const store = tx.objectStore(STORE_CONVERSATIONS);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}

export async function listConversations(): Promise<Conversation[]> {
  const all = await withStore<Conversation[]>("readonly", (store) => store.getAll());
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  return withStore<Conversation | undefined>("readonly", (store) => store.get(id));
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  await withStore("readwrite", (store) => store.put(conversation));
}

export async function deleteConversation(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function purgeAll(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CONVERSATIONS, "readwrite");
    tx.objectStore(STORE_CONVERSATIONS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function newConversationId(): string {
  return crypto.randomUUID();
}
