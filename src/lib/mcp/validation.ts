import type { McpHeaders, McpServerMetadata, McpTool, McpToolResult } from "./types";

const MAX_SERVER_NAME_LENGTH = 100;
const MAX_URL_LENGTH = 2_048;

const MAX_HEADERS = 32;
const MAX_HEADER_NAME_LENGTH = 128;
const MAX_HEADER_VALUE_LENGTH = 8_192;

const MAX_TOOLS = 128;
const MAX_TOOL_NAME_LENGTH = 128;
const MAX_TOOL_DESCRIPTION_LENGTH = 4_000;
const MAX_TOOL_SCHEMA_BYTES = 64 * 1024;

const MAX_TOOL_ARGUMENT_BYTES = 64 * 1024;
const MAX_JSON_DEPTH = 12;
const MAX_JSON_NODES = 10_000;

const MAX_RESULT_ITEMS = 64;
const MAX_TOOL_TEXT_CHARS = 64 * 1024;

const MANAGED_HEADERS = new Set([
  "accept",
  "connection",
  "content-length",
  "content-type",
  "cookie",
  "host",
  "origin",
  "set-cookie",
  "transfer-encoding",
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, label: string, maximumLength: number): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximumLength
  ) {
    throw new Error(`${label} invalide.`);
  }

  return value;
}

function jsonByteLength(value: unknown): number {
  let serialized: string;

  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("Valeur JSON non sérialisable.");
  }

  if (typeof serialized !== "string") {
    throw new Error("Valeur JSON non sérialisable.");
  }

  return new TextEncoder().encode(serialized).byteLength;
}

function assertBoundedJson(value: unknown, maximumBytes: number): void {
  if (jsonByteLength(value) > maximumBytes) {
    throw new Error("Valeur JSON trop volumineuse.");
  }

  const seen = new WeakSet<object>();
  let nodeCount = 0;

  function visit(current: unknown, depth: number): void {
    nodeCount += 1;

    if (nodeCount > MAX_JSON_NODES) {
      throw new Error("Structure JSON trop complexe.");
    }

    if (depth > MAX_JSON_DEPTH) {
      throw new Error("Structure JSON trop profonde.");
    }

    if (
      current === null ||
      typeof current === "string" ||
      typeof current === "boolean"
    ) {
      return;
    }

    if (typeof current === "number") {
      if (!Number.isFinite(current)) {
        throw new Error("Nombre JSON invalide.");
      }

      return;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item, depth + 1);
      }

      return;
    }

    if (!isRecord(current)) {
      throw new Error("Type non autorisé dans une valeur JSON.");
    }

    if (seen.has(current)) {
      throw new Error("Référence circulaire interdite.");
    }

    seen.add(current);

    for (const item of Object.values(current)) {
      visit(item, depth + 1);
    }
  }

  visit(value, 0);
}

export function validateMcpHeaders(value: unknown): McpHeaders | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error("Headers MCP invalides.");
  }

  const entries = Object.entries(value);

  if (entries.length > MAX_HEADERS) {
    throw new Error("Trop de headers MCP.");
  }

  const headers: McpHeaders = {};

  for (const [rawName, rawValue] of entries) {
    const name = rawName.trim();
    const normalizedName = name.toLowerCase();

    if (
      name.length === 0 ||
      name.length > MAX_HEADER_NAME_LENGTH ||
      !/^[A-Za-z0-9-]+$/.test(name)
    ) {
      throw new Error("Nom de header MCP invalide.");
    }

    if (MANAGED_HEADERS.has(normalizedName)) {
      throw new Error(`Le header "${name}" est géré par l’application.`);
    }

    if (
      typeof rawValue !== "string" ||
      rawValue.length === 0 ||
      rawValue.length > MAX_HEADER_VALUE_LENGTH ||
      rawValue.includes("\r") ||
      rawValue.includes("\n")
    ) {
      throw new Error(`Valeur invalide pour le header "${name}".`);
    }

    headers[name] = rawValue;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

export function validateMcpServerMetadata(value: unknown): McpServerMetadata {
  if (!isRecord(value)) {
    throw new Error("Configuration MCP invalide.");
  }

  const id = requireString(value.id, "Identifiant MCP", 128);
  const name = requireString(value.name, "Nom du serveur MCP", MAX_SERVER_NAME_LENGTH).trim();
  const rawUrl = requireString(value.url, "URL MCP", MAX_URL_LENGTH).trim();

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL MCP invalide.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("L’URL MCP doit utiliser HTTP ou HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("Les identifiants intégrés dans l’URL MCP sont interdits.");
  }

  if (url.hash) {
    throw new Error("Les fragments sont interdits dans une URL MCP.");
  }

  if (url.search) {
    throw new Error(
      "Les secrets et paramètres dans l’URL MCP sont interdits. Utilisez un header d’authentification.",
    );
  }

  const requiresSecret = value.requiresSecret === true;

  return { id, name, url: url.toString(), requiresSecret };
}

function validateToolSchema(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Le schéma d’entrée d’un outil MCP doit être un objet.");
  }

  assertBoundedJson(value, MAX_TOOL_SCHEMA_BYTES);

  return value;
}

export function validateMcpToolListResult(value: unknown): McpTool[] {
  if (!isRecord(value) || !Array.isArray(value.tools)) {
    throw new Error("Réponse tools/list MCP invalide.");
  }

  if (value.tools.length > MAX_TOOLS) {
    throw new Error("Le serveur MCP expose trop d’outils.");
  }

  return value.tools.map((rawTool) => {
    if (!isRecord(rawTool)) {
      throw new Error("Outil MCP invalide.");
    }

    const name = requireString(rawTool.name, "Nom de l’outil MCP", MAX_TOOL_NAME_LENGTH);
    let description: string | undefined;

    if (rawTool.description !== undefined) {
      if (
        typeof rawTool.description !== "string" ||
        rawTool.description.length > MAX_TOOL_DESCRIPTION_LENGTH
      ) {
        throw new Error(`Description invalide pour l’outil "${name}".`);
      }

      description = rawTool.description;
    }

    const inputSchema = validateToolSchema(rawTool.inputSchema);

    return {
      name,
      ...(description !== undefined ? { description } : {}),
      inputSchema,
    };
  });
}

export function validateMcpToolArguments(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Les arguments MCP doivent être un objet JSON.");
  }

  assertBoundedJson(value, MAX_TOOL_ARGUMENT_BYTES);

  return value;
}

export function validateMcpToolResult(value: unknown): McpToolResult {
  if (!isRecord(value)) {
    throw new Error("Résultat tools/call MCP invalide.");
  }

  const rawContent = value.content === undefined ? [] : value.content;

  if (!Array.isArray(rawContent)) {
    throw new Error("Contenu du résultat MCP invalide.");
  }

  if (rawContent.length > MAX_RESULT_ITEMS) {
    throw new Error("Le résultat MCP contient trop d’éléments.");
  }

  const textParts: string[] = [];

  for (const item of rawContent) {
    if (!isRecord(item)) {
      throw new Error("Élément de résultat MCP invalide.");
    }

    if (item.type !== "text") continue;

    if (typeof item.text !== "string") {
      throw new Error("Texte de résultat MCP invalide.");
    }

    textParts.push(item.text);
  }

  const text = textParts.join("\n");
  const content =
    text.length > MAX_TOOL_TEXT_CHARS
      ? `${text.slice(0, MAX_TOOL_TEXT_CHARS)}\n[Résultat MCP tronqué pour sécurité]`
      : text;

  if (value.isError !== undefined && typeof value.isError !== "boolean") {
    throw new Error("Indicateur d’erreur MCP invalide.");
  }

  return { content, isError: value.isError === true };
}

export function unwrapJsonRpcResult(value: unknown): unknown {
  if (!isRecord(value)) {
    throw new Error("Réponse JSON-RPC invalide.");
  }

  if (value.jsonrpc !== "2.0") {
    throw new Error("Version JSON-RPC invalide.");
  }

  if (value.error !== undefined) {
    if (
      !isRecord(value.error) ||
      typeof value.error.message !== "string" ||
      value.error.message.length === 0 ||
      value.error.message.length > 4_000
    ) {
      throw new Error("Erreur JSON-RPC invalide.");
    }

    throw new Error(value.error.message);
  }

  if (!Object.hasOwn(value, "result")) {
    throw new Error("Réponse JSON-RPC sans résultat.");
  }

  return value.result;
}
