// Client MCP fait main (transport "Streamable HTTP" du spec MCP) : juste du
// JSON-RPC 2.0 sur fetch(), pas le SDK officiel @modelcontextprotocol/sdk
// (~4 Mo, depend d'express/hono/cross-spawn cote serveur, inutile et risque
// pour un bundle navigateur). Ne fonctionne qu'avec des serveurs MCP HTTP
// distants qui autorisent CORS depuis cette origine - un serveur MCP "stdio"
// (le plus courant, ex. via npx) est injoignable depuis un navigateur, point
// dur de la plateforme, pas une limite qu'on choisit.
// La CSP doit conserver connect-src https:/http: pour ces URL utilisateur
// arbitraires : une allowlist statique casserait cette fonction. La sécurité
// repose donc ici sur l'ajout explicite du serveur et l'approbation par appel.
import type { McpServer, McpTool, McpToolResult } from "./types";

const PROTOCOL_VERSION = "2024-11-05";
const RPC_TIMEOUT_MS = 15_000;
const TOOL_TIMEOUT_MS = 45_000;
const MAX_RPC_RESPONSE_BYTES = 512 * 1024;
const MAX_TOOL_TEXT_CHARS = 64 * 1024;

let requestId = 0;

async function readTextLimited(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RPC_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Réponse MCP trop volumineuse");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function rpcCall(server: McpServer, method: string, params?: unknown): Promise<unknown> {
  const response = await fetch(server.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...server.headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    signal: AbortSignal.timeout(method === "tools/call" ? TOOL_TIMEOUT_MS : RPC_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Serveur MCP "${server.name}" a repondu ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  let payload: { result?: unknown; error?: { message: string } };
  const text = await readTextLimited(response);
  if (contentType.includes("text/event-stream")) {
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) throw new Error(`Reponse SSE vide de "${server.name}"`);
    payload = JSON.parse(dataLine.slice(5).trim());
  } else {
    payload = JSON.parse(text);
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
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
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
  const boundedText =
    text.length > MAX_TOOL_TEXT_CHARS
      ? `${text.slice(0, MAX_TOOL_TEXT_CHARS)}\n[Résultat MCP tronqué pour sécurité]`
      : text;
  return { content: boundedText, isError: Boolean(result.isError) };
}
