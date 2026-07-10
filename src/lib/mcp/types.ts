export interface McpServer {
  id: string;
  name: string;
  url: string;
  // En-tetes optionnels (ex. Authorization) envoyes a chaque appel.
  headers?: Record<string, string>;
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
