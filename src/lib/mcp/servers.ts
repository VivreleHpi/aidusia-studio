import type { McpHeaders, McpServer, McpServerMetadata } from "./types";

import { isRecord, validateMcpHeaders, validateMcpServerMetadata } from "./validation";

export const MCP_SERVERS_STORAGE_KEY = "aidusia_mcp_servers";

export const MCP_SECRET_STORAGE_PREFIX = "aidusia_mcp_secret_";

const STORAGE_VERSION = 2;
const MAX_SERVERS = 20;

interface StoredMcpServersV2 {
  version: 2;
  servers: McpServerMetadata[];
}

function secretStorageKey(id: string): string {
  return `${MCP_SECRET_STORAGE_PREFIX}${id}`;
}

export function isMcpSecretStorageKey(key: string): boolean {
  return key.startsWith(MCP_SECRET_STORAGE_PREFIX);
}

function saveMetadata(servers: McpServerMetadata[]): void {
  const payload: StoredMcpServersV2 = {
    version: STORAGE_VERSION,
    servers,
  };

  localStorage.setItem(MCP_SERVERS_STORAGE_KEY, JSON.stringify(payload));
}

function saveSecret(id: string, headers: McpHeaders | undefined): void {
  const key = secretStorageKey(id);

  if (!headers) {
    sessionStorage.removeItem(key);
    return;
  }

  sessionStorage.setItem(key, JSON.stringify(headers));
}

function readSecret(id: string): McpHeaders | undefined {
  const raw = sessionStorage.getItem(secretStorageKey(id));

  if (!raw) return undefined;

  try {
    return validateMcpHeaders(JSON.parse(raw));
  } catch {
    sessionStorage.removeItem(secretStorageKey(id));
    return undefined;
  }
}

function migrateLegacyServers(value: unknown[]): McpServerMetadata[] {
  const migrated: McpServerMetadata[] = [];

  for (const candidate of value) {
    if (!isRecord(candidate)) continue;

    let headers: McpHeaders | undefined;

    try {
      headers = validateMcpHeaders(candidate.headers);
    } catch {
      headers = undefined;
    }

    try {
      const metadata = validateMcpServerMetadata({
        id: candidate.id,
        name: candidate.name,
        url: candidate.url,
        requiresSecret: Boolean(headers) || candidate.requiresSecret === true,
      });

      migrated.push(metadata);

      if (headers) saveSecret(metadata.id, headers);
    } catch {
      // Une entrée invalide est ignorée sans journaliser son contenu,
      // qui pourrait contenir un secret.
    }
  }

  saveMetadata(migrated);

  return migrated;
}

function readMetadata(): McpServerMetadata[] {
  const raw = localStorage.getItem(MCP_SERVERS_STORAGE_KEY);

  if (!raw) return [];

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    localStorage.removeItem(MCP_SERVERS_STORAGE_KEY);
    return [];
  }

  if (Array.isArray(parsed)) {
    return migrateLegacyServers(parsed);
  }

  if (
    !isRecord(parsed) ||
    parsed.version !== STORAGE_VERSION ||
    !Array.isArray(parsed.servers)
  ) {
    localStorage.removeItem(MCP_SERVERS_STORAGE_KEY);
    return [];
  }

  const validServers: McpServerMetadata[] = [];

  for (const candidate of parsed.servers) {
    try {
      validServers.push(validateMcpServerMetadata(candidate));
    } catch {
      // Ne jamais journaliser l’entrée invalide.
    }
  }

  if (validServers.length !== parsed.servers.length) {
    saveMetadata(validServers);
  }

  return validServers.slice(0, MAX_SERVERS);
}

function hydrateServer(metadata: McpServerMetadata): McpServer {
  const headers = readSecret(metadata.id);

  return {
    ...metadata,
    ...(headers ? { headers } : {}),
  };
}

export function listMcpServers(): McpServer[] {
  return readMetadata().map(hydrateServer);
}

export function hasMcpServerSecret(id: string): boolean {
  return Boolean(readSecret(id));
}

export function setMcpServerHeaders(id: string, headers: McpHeaders | undefined): void {
  const metadata = readMetadata();
  const index = metadata.findIndex((server) => server.id === id);

  if (index === -1) {
    throw new Error("Serveur MCP introuvable.");
  }

  const validatedHeaders = validateMcpHeaders(headers);

  metadata[index] = {
    ...metadata[index],
    requiresSecret: Boolean(validatedHeaders),
  };

  saveSecret(id, validatedHeaders);
  saveMetadata(metadata);
}

export function clearMcpServerSecrets(): void {
  for (const key of Object.keys(sessionStorage)) {
    if (isMcpSecretStorageKey(key)) {
      sessionStorage.removeItem(key);
    }
  }
}

export function addMcpServer(
  server: Omit<McpServer, "id" | "requiresSecret">,
): McpServer {
  const metadata = readMetadata();

  if (metadata.length >= MAX_SERVERS) {
    throw new Error("Nombre maximal de serveurs MCP atteint.");
  }

  const headers = validateMcpHeaders(server.headers);
  const newMetadata = validateMcpServerMetadata({
    id: crypto.randomUUID(),
    name: server.name,
    url: server.url,
    requiresSecret: Boolean(headers),
  });

  saveMetadata([...metadata, newMetadata]);

  try {
    saveSecret(newMetadata.id, headers);
  } catch (error) {
    saveMetadata(metadata);
    throw error;
  }

  return hydrateServer(newMetadata);
}

export function removeMcpServer(id: string): void {
  saveMetadata(readMetadata().filter((server) => server.id !== id));
  sessionStorage.removeItem(secretStorageKey(id));
}
