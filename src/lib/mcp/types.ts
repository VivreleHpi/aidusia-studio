export type McpHeaders = Record<string, string>;

export interface McpServerMetadata {
  id: string;
  name: string;
  url: string;

  /**
   * Indique que le connecteur attend normalement un secret.
   * La valeur du secret n’est jamais stockée avec les métadonnées.
   */
  requiresSecret: boolean;
}

export interface McpServer extends McpServerMetadata {
  /**
   * Headers reconstruits depuis le stockage de session.
   * Ils ne doivent jamais être écrits dans localStorage.
   */
  headers?: McpHeaders;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content: string;
  isError: boolean;
}

export type McpToolRisk = "high" | "unknown";
