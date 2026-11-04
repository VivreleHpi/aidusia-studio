import type { Lang } from "@/lib/i18n";
import type { McpServer } from "@/lib/mcp/types";

export type McpToolPolicy = "ask" | "allow" | "deny";

const STORAGE_KEY = "aidusia_mcp_tool_policies_v1"; // gitleaks:allow — clé localStorage

export interface McpToolPolicyKey {
  serverId: string;
  toolName: string;
}

function policyKey(serverId: string, toolName: string): string {
  return `${serverId}::${toolName}`;
}

export function listMcpToolPolicies(): Record<string, McpToolPolicy> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, McpToolPolicy>;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function setMcpToolPolicy(serverId: string, toolName: string, policy: McpToolPolicy): void {
  const all = listMcpToolPolicies();
  all[policyKey(serverId, toolName)] = policy;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getMcpToolPolicy(serverId: string, toolName: string): McpToolPolicy {
  return listMcpToolPolicies()[policyKey(serverId, toolName)] ?? "ask";
}

export interface McpJournalEntry {
  id: string;
  at: number;
  serverName: string;
  toolName: string;
  decision: "allowed" | "denied" | "blocked";
  preview: string;
}

const JOURNAL_STORAGE = "aidusia_mcp_journal_v1"; // gitleaks:allow — clé localStorage
const MAX_ENTRIES = 200;

export function appendMcpJournal(entry: Omit<McpJournalEntry, "id">): void {
  const list = readMcpJournal();
  list.unshift({ ...entry, id: crypto.randomUUID() });
  localStorage.setItem(JOURNAL_STORAGE, JSON.stringify(list.slice(0, MAX_ENTRIES)));
}

export function readMcpJournal(): McpJournalEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(JOURNAL_STORAGE) ?? "[]");
    return Array.isArray(raw) ? (raw as McpJournalEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearMcpJournal(): void {
  localStorage.removeItem(JOURNAL_STORAGE);
}

export function formatJournalDecision(decision: McpJournalEntry["decision"], lang: Lang): string {
  if (lang === "fr") {
    switch (decision) {
      case "allowed":
        return "Autorisé";
      case "denied":
        return "Refusé";
      default:
        return "Bloqué (politique)";
    }
  }
  switch (decision) {
    case "allowed":
      return "Allowed";
    case "denied":
      return "Denied";
    default:
      return "Blocked (policy)";
  }
}

export function serverLabel(server: McpServer): string {
  return server.name;
}
