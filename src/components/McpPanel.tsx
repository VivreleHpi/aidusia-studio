import { useEffect, useState } from "react";
import { listMcpServers, addMcpServer, removeMcpServer } from "@/lib/mcp/servers";
import { initialize, listTools } from "@/lib/mcp/client";
import type { McpServer, McpTool } from "@/lib/mcp/types";
import { useLang } from "@/lib/i18n";
import { IconX } from "@/components/Icons";

const STRINGS = {
  fr: {
    dialogLabel: "Serveurs MCP",
    title: "Serveurs MCP",
    close: "Fermer",
    intro:
      "Connectez le Studio à des serveurs d'outils (Model Context Protocol) que l'IA peut appeler pendant la conversation.",
    corsWarningStart: "Seuls les serveurs MCP ",
    corsWarningStrong: "HTTP distants",
    corsWarningMid:
      ", qui autorisent CORS depuis ce navigateur, fonctionnent ici. Les serveurs MCP \"stdio\" (le plus courant, ex. lancés via ",
    corsWarningEnd:
      ") tournent en process local — un navigateur ne peut pas les joindre, ce n'est pas une limite de ce Studio mais de la plateforme.",
    namePlaceholder: "Nom (ex. Recherche web)",
    urlPlaceholder: "https://...",
    tokenPlaceholder: "Jeton d'authentification (optionnel)",
    unreachable: "Serveur injoignable",
    connecting: "Connexion…",
    add: "Ajouter",
    checking: "Vérification…",
    toolsAvailable: (count: number) =>
      `${count} outil${count > 1 ? "s" : ""} disponible${count > 1 ? "s" : ""}`,
    remove: "Supprimer",
    noServers: "Aucun serveur MCP configuré.",
  },
  en: {
    dialogLabel: "MCP servers",
    title: "MCP servers",
    close: "Close",
    intro:
      "Connect the Studio to tool servers (Model Context Protocol) that the AI can call during a conversation.",
    corsWarningStart: "Only ",
    corsWarningStrong: "remote HTTP",
    corsWarningMid:
      " MCP servers that allow CORS from this browser work here. \"stdio\" MCP servers (the most common kind, e.g. launched via ",
    corsWarningEnd:
      ") run as a local process — a browser can't reach them; that's a platform limitation, not a limitation of this Studio.",
    namePlaceholder: "Name (e.g. Web search)",
    urlPlaceholder: "https://...",
    tokenPlaceholder: "Authentication token (optional)",
    unreachable: "Server unreachable",
    connecting: "Connecting…",
    add: "Add",
    checking: "Checking…",
    toolsAvailable: (count: number) => `${count} tool${count > 1 ? "s" : ""} available`,
    remove: "Remove",
    noServers: "No MCP server configured.",
  },
} as const;

interface McpPanelProps {
  onClose: () => void;
}

interface ServerState {
  server: McpServer;
  status: "checking" | "ok" | "error";
  tools: McpTool[];
  error?: string;
}

async function probe(server: McpServer): Promise<Omit<ServerState, "server">> {
  try {
    await initialize(server);
    const tools = await listTools(server);
    return { status: "ok", tools };
  } catch (err) {
    return { status: "error", tools: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export function McpPanel({ onClose }: McpPanelProps) {
  const [servers, setServers] = useState<ServerState[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const { lang } = useLang();
  const s = STRINGS[lang];

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const list = listMcpServers();
    setServers(list.map((server) => ({ server, status: "checking", tools: [] })));
    for (const server of list) {
      const result = await probe(server);
      setServers((prev) => prev.map((s) => (s.server.id === server.id ? { server, ...result } : s)));
    }
  }

  async function handleAdd() {
    if (!name.trim() || !url.trim()) return;
    setAdding(true);
    setAddError(null);
    const server = addMcpServer({
      name: name.trim(),
      url: url.trim(),
      headers: token.trim() ? { Authorization: `Bearer ${token.trim()}` } : undefined,
    });
    const result = await probe(server);
    if (result.status === "error") {
      setAddError(result.error ?? s.unreachable);
    }
    setServers((prev) => [...prev, { server, ...result }]);
    setName("");
    setUrl("");
    setToken("");
    setAdding(false);
  }

  function handleRemove(id: string) {
    removeMcpServer(id);
    setServers((prev) => prev.filter((s) => s.server.id !== id));
  }

  return (
    <div className="overlay-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/60 p-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={s.dialogLabel}
        className="modal-in glass w-full max-w-2xl rounded-lg bg-card p-6 text-card-foreground shadow-xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.close}
            className="rounded-lg p-2 text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{s.intro}</p>

        <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          {s.corsWarningStart}
          <strong>{s.corsWarningStrong}</strong>
          {s.corsWarningMid}
          <span className="font-mono">npx</span>
          {s.corsWarningEnd}
        </div>

        <div className="mb-4 flex flex-col gap-2 rounded-md border border-border bg-background/40 p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={s.namePlaceholder}
              className="flex-1 rounded-md border border-border bg-card px-2 py-1 text-xs"
            />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 rounded-md border border-border bg-card px-2 py-1 text-xs"
            />
          </div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={s.tokenPlaceholder}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs"
          />
          {addError && <p className="text-xs text-destructive">{addError}</p>}
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={adding || !name.trim() || !url.trim()}
            className="self-start rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
          >
            {adding ? s.connecting : s.add}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {servers.map(({ server, status, tools, error }) => (
            <div key={server.id} className="rounded-md border border-border bg-background/40 px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{server.name}</div>
                  <div className="mt-0.5 text-xs">
                    {status === "checking" && <span className="text-muted-foreground">{s.checking}</span>}
                    {status === "ok" && (
                      <span className="text-success">{s.toolsAvailable(tools.length)}</span>
                    )}
                    {status === "error" && <span className="text-destructive">{error}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(server.id)}
                  className="rounded-md border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  {s.remove}
                </button>
              </div>
              {tools.length > 0 && (
                <p className="mt-1.5 truncate text-xs text-muted-foreground">
                  {tools.map((t) => t.name).join(", ")}
                </p>
              )}
            </div>
          ))}
          {servers.length === 0 && (
            <p className="px-1 py-3 text-center text-sm text-muted-foreground">
              {s.noServers}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
