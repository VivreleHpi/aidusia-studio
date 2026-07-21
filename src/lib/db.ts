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
  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let rejected = false;
    const rejectOpen = (error: unknown) => {
      rejected = true;
      reject(error);
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        db.createObjectStore(STORE_CONVERSATIONS, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // `blocked` peut etre suivi plus tard d'un succes lorsque l'autre onglet
      // libere sa connexion. L'appelant a deja recu l'erreur recuperable : ne
      // pas laisser cette connexion tardive ouverte en arriere-plan.
      if (rejected) {
        db.close();
        return;
      }
      // Une migration ou suppression lancee depuis un autre onglet ne doit
      // pas rester bloquee par cette connexion. Le prochain acces rouvrira
      // automatiquement la base a la bonne version.
      db.onversionchange = () => {
        db.close();
        if (dbPromise === pending) dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => rejectOpen(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => rejectOpen(new Error("IndexedDB open blocked"));
  });
  dbPromise = pending;
  // Ne pas memoriser une promesse rejetee : le bouton « Reessayer » doit
  // pouvoir retenter l'ouverture apres une permission ou un blocage transitoire.
  void pending.catch(() => {
    if (dbPromise === pending) dbPromise = null;
  });
  return pending;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let settled = false;
    let result: T;

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error ?? new Error("IndexedDB transaction failed"));
    };

    try {
      const tx = db.transaction(STORE_CONVERSATIONS, mode);
      const store = tx.objectStore(STORE_CONVERSATIONS);
      const request = fn(store);
      request.onsuccess = () => {
        result = request.result as T;
      };
      request.onerror = () => fail(request.error);
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      tx.onerror = () => fail(tx.error);
      tx.onabort = () => fail(tx.error ?? new Error("IndexedDB transaction aborted"));
    } catch (error) {
      fail(error);
    }
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

export async function deleteLocalDatabase(): Promise<void> {
  const db = await dbPromise?.catch(() => null);
  db?.close();
  dbPromise = null;

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB deletion blocked"));
  });
}

export function newConversationId(): string {
  return crypto.randomUUID();
}
