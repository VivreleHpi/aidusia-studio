// Client MCP fait main (transport "Streamable HTTP" du spec MCP) : juste du
// JSON-RPC 2.0 sur fetch(), pas le SDK officiel @modelcontextprotocol/sdk
// (~4 Mo, depend d'express/hono/cross-spawn cote serveur, inutile et risque
// pour un bundle navigateur). Ne fonctionne qu'avec des serveurs MCP HTTP
// distants qui autorisent CORS depuis cette origine - un serveur MCP "stdio"
// (le plus courant, ex. via npx) est injoignable depuis un navigateur, point
// dur de la plateforme, pas une limite qu'on choisit.
import type { McpServer, McpTool, McpToolResult } from "./types";

const PROTOCOL_VERSION = "2024-11-05";

let requestId = 0;

async function rpcCall(server: McpServer, method: string, params?: unknown): Promise<unknown> {
  const response = await fetch(server.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...server.headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
  });
  if (!response.ok) {
    throw new Error(`Serveur MCP "${server.name}" a repondu ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  let payload: { result?: unknown; error?: { message: string } };
  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) throw new Error(`Reponse SSE vide de "${server.name}"`);
    payload = JSON.parse(dataLine.slice(5).trim());
  } else {
    payload = await response.json();
  }

  if (payload.error) throw new Error(payload.error.message);
  return payload.result;
}

export async function initialize(server: McpServer): Promise<void> {
  await rpcCall(server, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "AIDUSIA Studio", version: "0.0.0" },
  });
  // Notification "initialized" : pas de reponse attendue, best-effort.
  await fetch(server.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...server.headers },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }).catch(() => {});
}

export async function listTools(server: McpServer): Promise<McpTool[]> {
  const result = (await rpcCall(server, "tools/list")) as { tools: McpTool[] };
  return result.tools;
}

export async function callTool(
  server: McpServer,
  name: string,
  args: unknown,
): Promise<McpToolResult> {
  const result = (await rpcCall(server, "tools/call", { name, arguments: args })) as {
    content?: { type: string; text?: string }[];
    isError?: boolean;
  };
  const text = (result.content ?? [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n");
  return { content: text, isError: Boolean(result.isError) };
}
