// Client MCP fait main (transport "Streamable HTTP" du spec MCP) : juste du
// JSON-RPC 2.0 sur fetch(), pas le SDK officiel @modelcontextprotocol/sdk.
// Ne fonctionne qu’avec des serveurs MCP HTTP distants autorisant CORS.
import type { McpServer, McpTool, McpToolResult } from "./types";
import {
  unwrapJsonRpcResult,
  validateMcpToolArguments,
  validateMcpToolListResult,
  validateMcpToolResult,
} from "./validation";

const PROTOCOL_VERSION = "2024-11-05";
const RPC_TIMEOUT_MS = 15_000;
const TOOL_TIMEOUT_MS = 45_000;
const MAX_RPC_RESPONSE_BYTES = 512 * 1024;

let requestId = 0;

export type McpTransportViolation =
  | "invalid-url"
  | "https-required"
  | "headers-require-https";

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized)
  );
}

/**
 * MCP credentials must never cross a clear-text network hop. Plain HTTP is
 * kept only for an unauthenticated server on this same machine.
 */
export function mcpTransportViolation(
  server: Pick<McpServer, "url" | "headers">,
): McpTransportViolation | null {
  let url: URL;
  try {
    url = new URL(server.url);
  } catch {
    return "invalid-url";
  }
  if (url.protocol === "https:") return null;
  if (url.protocol !== "http:" || !isLoopbackHostname(url.hostname)) {
    return "https-required";
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    Object.keys(server.headers ?? {}).length > 0
  ) {
    return "headers-require-https";
  }
  return null;
}

function assertSafeMcpTransport(server: McpServer): void {
  const violation = mcpTransportViolation(server);
  if (violation === "headers-require-https") {
    throw new Error(
      "Un serveur MCP HTTP local ne peut pas recevoir de secret ou d’en-tête configuré. Utilisez HTTPS.",
    );
  }
  if (violation) {
    throw new Error(
      "Un serveur MCP distant doit utiliser HTTPS. HTTP est réservé à localhost sans authentification.",
    );
  }
}

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

function parseJsonText(text: string, label: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} contient un JSON invalide.`);
  }
}

function parseFirstSsePayload(text: string, serverName: string): unknown {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const events = normalized.split("\n\n");

  for (const event of events) {
    const dataLines = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) continue;

    const data = dataLines.join("\n").trim();

    if (!data || data === "[DONE]") continue;

    return parseJsonText(data, `Réponse SSE de "${serverName}"`);
  }

  throw new Error(`Réponse SSE vide de "${serverName}".`);
}

async function rpcCall(
  server: McpServer,
  method: string,
  params?: unknown,
): Promise<unknown> {
  assertSafeMcpTransport(server);
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
    throw new Error(`Serveur MCP "${server.name}" a répondu ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const text = await readTextLimited(response);
  const rawPayload = contentType.includes("text/event-stream")
    ? parseFirstSsePayload(text, server.name)
    : parseJsonText(text, `Réponse de "${server.name}"`);

  return unwrapJsonRpcResult(rawPayload);
}

export async function initialize(server: McpServer): Promise<void> {
  await rpcCall(server, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "AIDUSIA Studio", version: "0.0.0" },
  });
  // Notification "initialized" : pas de réponse attendue, best-effort.
  assertSafeMcpTransport(server);
  await fetch(server.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...server.headers },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  }).catch(() => {});
}

export async function listTools(server: McpServer): Promise<McpTool[]> {
  const result = await rpcCall(server, "tools/list");

  return validateMcpToolListResult(result);
}

export async function callTool(
  server: McpServer,
  name: string,
  args: unknown,
): Promise<McpToolResult> {
  if (typeof name !== "string" || name.trim().length === 0 || name.length > 128) {
    throw new Error("Nom d’outil MCP invalide.");
  }

  const safeArguments = validateMcpToolArguments(args);
  const result = await rpcCall(server, "tools/call", {
    name,
    arguments: safeArguments,
  });

  return validateMcpToolResult(result);
}
