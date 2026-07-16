// Liste des serveurs MCP configures par l'utilisateur - stockee uniquement
// dans ce navigateur (localStorage), jamais envoyee ailleurs qu'au serveur
// MCP lui-meme (voir client.ts).
import type { McpServer } from "./types";

export const MCP_SERVERS_STORAGE_KEY = "aidusia_mcp_servers";

export function listMcpServers(): McpServer[] {
  try {
    return JSON.parse(localStorage.getItem(MCP_SERVERS_STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveAll(servers: McpServer[]) {
  localStorage.setItem(MCP_SERVERS_STORAGE_KEY, JSON.stringify(servers));
}

export function addMcpServer(server: Omit<McpServer, "id">): McpServer {
  const withId: McpServer = { ...server, id: crypto.randomUUID() };
  saveAll([...listMcpServers(), withId]);
  return withId;
}

export function removeMcpServer(id: string): void {
  saveAll(listMcpServers().filter((s) => s.id !== id));
}
