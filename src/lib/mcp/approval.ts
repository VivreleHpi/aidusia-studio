import type { McpServer, McpToolRisk } from "./types";

const SENSITIVE_KEY = /authorization|cookie|credential|password|secret|token|api[-_]?key/i;
const HIGH_RISK_ACTION = /delete|remove|destroy|revoke|send|email|publish|post|create|update|write|execute|run|trigger|pay|purchase|transfer/i;

export interface McpApprovalRequest {
  server: McpServer;
  toolName: string;
  args: unknown;
  lang: "fr" | "en";
}

export function classifyToolRisk(toolName: string): McpToolRisk {
  return HIGH_RISK_ACTION.test(toolName) ? "high" : "unknown";
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth limit]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 40)
        .map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(item, depth + 1)]),
    );
  }
  if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

function argsPreview(args: unknown): string {
  try {
    const serialized = JSON.stringify(redact(args), null, 2);
    return serialized.length > 4_000 ? `${serialized.slice(0, 4_000)}\n…` : serialized;
  } catch {
    return "[unavailable]";
  }
}

// MCP ne fournit pas encore de métadonnée d'autorisation universelle et
// fiable. Une confirmation par appel est donc volontairement requise, même
// pour un outil au nom apparemment inoffensif : son serveur reste externe et
// peut avoir des effets que son nom/sa description ne révèlent pas.
export function requestToolApproval(request: McpApprovalRequest): boolean {
  const risk = classifyToolRisk(request.toolName);
  const preview = argsPreview(request.args);
  const message = request.lang === "fr"
    ? [
        "Autoriser cette action externe ?",
        "",
        `Connecteur : ${request.server.name}`,
        `Outil : ${request.toolName}`,
        `Risque : ${risk === "high" ? "élevé (écriture/action possible)" : "inconnu"}`,
        "",
        "Les arguments suivants seront envoyés au serveur MCP :",
        preview,
        "",
        "Annulez si cette action n'est pas exactement celle que vous avez demandée.",
      ].join("\n")
    : [
        "Allow this external action?",
        "",
        `Connector: ${request.server.name}`,
        `Tool: ${request.toolName}`,
        `Risk: ${risk === "high" ? "high (possible write/action)" : "unknown"}`,
        "",
        "The following arguments will be sent to the MCP server:",
        preview,
        "",
        "Cancel unless this is exactly the action you requested.",
      ].join("\n");
  return window.confirm(message);
}
