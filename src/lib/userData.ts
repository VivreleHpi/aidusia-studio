import { clearAllApiKeys } from "@/lib/apiKeys";
import { deleteLocalDatabase, listConversations, type Conversation } from "@/lib/db";
import { listMcpServers } from "@/lib/mcp/servers";

const APP_KEY_PREFIX = "aidusia";
const API_KEY_PREFIX = "aidusia_api_key_";
const MCP_SERVERS_KEY = "aidusia_mcp_servers";

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
  return key.startsWith(API_KEY_PREFIX) || key === MCP_SERVERS_KEY;
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

async function clearOriginCaches(): Promise<void> {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

async function unregisterServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

export async function deleteAllUserData(): Promise<void> {
  await deleteLocalDatabase();
  clearAllApiKeys();
  clearAppStorage(localStorage);
  clearAppStorage(sessionStorage);
  await Promise.all([clearOriginCaches(), unregisterServiceWorkers()]);
}
