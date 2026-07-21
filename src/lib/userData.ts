import { clearAllApiKeys, isApiKeyStorageKey } from "@/lib/apiKeys";
import { deleteLocalDatabase, listConversations, type Conversation } from "@/lib/db";
import {
  isMcpSecretStorageKey,
  listMcpServers,
  MCP_SERVERS_STORAGE_KEY,
} from "@/lib/mcp/servers";

const APP_KEY_PREFIX = "aidusia_";
export const AIDUSIA_CACHE_PREFIX = "aidusia-shell-";
const AIDUSIA_SERVICE_WORKER_PATH = "/sw.js";
const AIDUSIA_SERVICE_WORKER_SCOPE_PATH = "/";

interface ExportedStorage {
  local: Record<string, string>;
  session: Record<string, string>;
}

interface ExportedMcpServer {
  id: string;
  name: string;
  url: string;
  headersRedacted: string[];
}

interface ExportedUserDataV1 {
  version: 1;
  app: "aidusia-studio";
  exportedAt: string;
  notes: string[];
  conversations: Conversation[];
  storage: ExportedStorage;
  mcpServers: ExportedMcpServer[];
}

function isAppKey(key: string): boolean {
  return key.startsWith(APP_KEY_PREFIX);
}

function isSecretKey(key: string): boolean {
  return (
    isApiKeyStorageKey(key) ||
    isMcpSecretStorageKey(key) ||
    key === MCP_SERVERS_STORAGE_KEY
  );
}

function collectStorage(storage: Storage): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of Object.keys(storage)) {
    if (isAppKey(key) && !isSecretKey(key)) data[key] = storage.getItem(key) ?? "";
  }
  return data;
}

function sanitizedMcpServers(): ExportedMcpServer[] {
  return listMcpServers().map((server) => ({
    id: server.id,
    name: server.name,
    url: server.url,
    headersRedacted: Object.keys(server.headers ?? {}),
  }));
}

export async function exportUserData(): Promise<Blob> {
  const payload: ExportedUserDataV1 = {
    version: 1,
    app: "aidusia-studio",
    exportedAt: new Date().toISOString(),
    notes: [
      "This archive excludes API keys and MCP header values.",
      "Use Providers > Export for encrypted provider secrets.",
    ],
    conversations: await listConversations(),
    storage: {
      local: collectStorage(localStorage),
      session: collectStorage(sessionStorage),
    },
    mcpServers: sanitizedMcpServers(),
  };

  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

function clearAppStorage(storage: Storage): void {
  for (const key of Object.keys(storage)) {
    if (isAppKey(key)) storage.removeItem(key);
  }
}

export function isAidusiaCacheName(cacheName: string): boolean {
  return cacheName.startsWith(AIDUSIA_CACHE_PREFIX);
}

type ServiceWorkerRegistrationIdentity = Pick<
  ServiceWorkerRegistration,
  "scope" | "active" | "waiting" | "installing"
>;

/**
 * Identifie strictement l'enregistrement cree par registerServiceWorker().
 * Une registration ambigue (scope different, script etranger en attente ou
 * URL non canonique) est preservee : l'effacement ne doit jamais revendiquer
 * une ressource qui pourrait appartenir a une autre application de l'origine.
 */
export function isAidusiaServiceWorkerRegistration(
  registration: ServiceWorkerRegistrationIdentity,
  origin = window.location.origin,
): boolean {
  try {
    const expectedScope = new URL(AIDUSIA_SERVICE_WORKER_SCOPE_PATH, origin).href;
    if (new URL(registration.scope).href !== expectedScope) return false;

    const expectedScript = new URL(AIDUSIA_SERVICE_WORKER_PATH, origin).href;
    const workers = [registration.active, registration.waiting, registration.installing].filter(
      (worker): worker is ServiceWorker => worker !== null,
    );

    return (
      workers.length > 0 &&
      workers.every((worker) => new URL(worker.scriptURL).href === expectedScript)
    );
  } catch {
    // Une URL mal formee ou incomplete n'est jamais une raison suffisante
    // pour supprimer un enregistrement potentiellement etranger.
    return false;
  }
}

async function clearAidusiaCaches(): Promise<void> {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter(isAidusiaCacheName).map((key) => caches.delete(key)));
}

async function unregisterAidusiaServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => isAidusiaServiceWorkerRegistration(registration))
      .map((registration) => registration.unregister()),
  );
}

export async function deleteAllUserData(): Promise<void> {
  await deleteLocalDatabase();
  clearAllApiKeys();
  clearAppStorage(localStorage);
  clearAppStorage(sessionStorage);
  await Promise.all([clearAidusiaCaches(), unregisterAidusiaServiceWorker()]);
}
