import { useEffect, useState } from "react";
import { listMcpServers, addMcpServer, removeMcpServer } from "@/lib/mcp/servers";
import { initialize, listTools } from "@/lib/mcp/client";
import type { McpServer, McpTool } from "@/lib/mcp/types";
import { useLang } from "@/lib/i18n";
import { IconPlug, IconX } from "@/components/Icons";
import {
  LogoFacebook,
  LogoGmail,
  LogoGoogleDrive,
  LogoN8n,
  LogoX,
} from "@/components/ConnectorLogos";

interface McpPanelProps {
  onClose: () => void;
}

type ConnectorId = "gmail" | "gdrive" | "facebook" | "x" | "n8n";

const CATALOG: { id: ConnectorId; name: string; Logo: (p: { className?: string }) => React.JSX.Element }[] = [
  { id: "gmail", name: "Gmail", Logo: LogoGmail },
  { id: "gdrive", name: "Google Drive", Logo: LogoGoogleDrive },
  { id: "facebook", name: "Facebook", Logo: LogoFacebook },
  { id: "x", name: "X", Logo: LogoX },
  { id: "n8n", name: "n8n", Logo: LogoN8n },
];

const STRINGS = {
  fr: {
    dialogLabel: "Connecteurs",
    title: "Connecteurs",
    close: "Fermer",
    intro:
      "Connectez le Studio à des services et des serveurs d'outils (MCP) que l'IA peut appeler pendant la conversation.",
    popular: "Populaire",
    connected: "Connecté",
    customName: "Connecteur personnalisé",
    customDesc: "N'importe quel serveur MCP HTTP distant.",
    catalog: {
      gmail: {
        desc: "Recherchez et gérez vos e-mails depuis la conversation.",
        hint: "Gmail n'expose pas de serveur MCP public : utilisez une passerelle MCP distante connectée à votre compte (ex. Composio, Zapier MCP), puis collez ici l'URL qu'elle fournit.",
      },
      gdrive: {
        desc: "Interrogez vos documents Google Drive.",
        hint: "Google Drive n'expose pas de serveur MCP public : utilisez une passerelle MCP distante connectée à votre compte (ex. Composio, Zapier MCP), puis collez ici l'URL qu'elle fournit.",
      },
      facebook: {
        desc: "Gérez vos pages et vos publications.",
        hint: "Facebook n'expose pas de serveur MCP public : utilisez une passerelle MCP distante connectée à votre compte, puis collez ici l'URL qu'elle fournit.",
      },
      x: {
        desc: "Recherchez et publiez sur X.",
        hint: "X n'expose pas de serveur MCP public : utilisez une passerelle MCP distante connectée à votre compte, puis collez ici l'URL qu'elle fournit.",
      },
      n8n: {
        desc: "Déclenchez vos workflows n8n comme des outils.",
        hint: "Dans n8n : ajoutez un nœud « MCP Server Trigger » à un workflow, activez-le, puis collez ici l'URL MCP générée (et le jeton Bearer si vous en avez configuré un).",
      },
    } as Record<ConnectorId, { desc: string; hint: string }>,
    connectTitle: (name: string) => `Connecter ${name}`,
    addCustomTitle: "Ajouter un connecteur personnalisé",
    corsNote:
      "Seuls les serveurs MCP HTTP distants autorisant CORS fonctionnent depuis un navigateur. Les serveurs MCP « stdio » (lancés via npx en local) sont hors de portée d'une page web — limite de la plateforme, pas de ce Studio.",
    namePlaceholder: "Nom (ex. Recherche web)",
    urlPlaceholder: "URL MCP — https://…",
    tokenPlaceholder: "Jeton d'authentification (optionnel)",
    unreachable: "Serveur injoignable",
    connecting: "Connexion…",
    add: "Connecter",
    cancel: "Annuler",
    checking: "Vérification…",
    toolsAvailable: (count: number) =>
      `${count} outil${count > 1 ? "s" : ""} disponible${count > 1 ? "s" : ""}`,
    remove: "Supprimer",
    noServers: "Aucun connecteur configuré pour l'instant.",
  },
  en: {
    dialogLabel: "Connectors",
    title: "Connectors",
    close: "Close",
    intro:
      "Connect the Studio to services and tool servers (MCP) that the AI can call during a conversation.",
    popular: "Popular",
    connected: "Connected",
    customName: "Custom connector",
    customDesc: "Any remote HTTP MCP server.",
    catalog: {
      gmail: {
        desc: "Search and manage your email from the conversation.",
        hint: "Gmail doesn't expose a public MCP server: use a remote MCP gateway connected to your account (e.g. Composio, Zapier MCP), then paste the URL it provides here.",
      },
      gdrive: {
        desc: "Query your Google Drive documents.",
        hint: "Google Drive doesn't expose a public MCP server: use a remote MCP gateway connected to your account (e.g. Composio, Zapier MCP), then paste the URL it provides here.",
      },
      facebook: {
        desc: "Manage your pages and posts.",
        hint: "Facebook doesn't expose a public MCP server: use a remote MCP gateway connected to your account, then paste the URL it provides here.",
      },
      x: {
        desc: "Search and post on X.",
        hint: "X doesn't expose a public MCP server: use a remote MCP gateway connected to your account, then paste the URL it provides here.",
      },
      n8n: {
        desc: "Trigger your n8n workflows as tools.",
        hint: "In n8n: add an \"MCP Server Trigger\" node to a workflow, activate it, then paste the generated MCP URL here (plus the Bearer token if you configured one).",
      },
    } as Record<ConnectorId, { desc: string; hint: string }>,
    connectTitle: (name: string) => `Connect ${name}`,
    addCustomTitle: "Add a custom connector",
    corsNote:
      "Only remote HTTP MCP servers that allow CORS work from a browser. \"stdio\" MCP servers (launched locally via npx) are out of reach of a web page — a platform limitation, not this Studio's.",
    namePlaceholder: "Name (e.g. Web search)",
    urlPlaceholder: "MCP URL — https://…",
    tokenPlaceholder: "Authentication token (optional)",
    unreachable: "Server unreachable",
    connecting: "Connecting…",
    add: "Connect",
    cancel: "Cancel",
    checking: "Checking…",
    toolsAvailable: (count: number) => `${count} tool${count > 1 ? "s" : ""} available`,
    remove: "Remove",
    noServers: "No connector configured yet.",
  },
} as const;

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

function logoForServer(serverName: string) {
  const lower = serverName.toLowerCase();
  return CATALOG.find((c) => lower.includes(c.name.toLowerCase()))?.Logo ?? null;
}

export function McpPanel({ onClose }: McpPanelProps) {
  const [servers, setServers] = useState<ServerState[]>([]);
  const [selected, setSelected] = useState<ConnectorId | "custom" | null>(null);
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
      setServers((prev) => prev.map((st) => (st.server.id === server.id ? { server, ...result } : st)));
    }
  }

  function selectConnector(id: ConnectorId | "custom") {
    setSelected(id);
    setName(id === "custom" ? "" : CATALOG.find((c) => c.id === id)?.name ?? "");
    setUrl("");
    setToken("");
    setAddError(null);
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
    if (result.status === "ok") setSelected(null);
  }

  function handleRemove(id: string) {
    removeMcpServer(id);
    setServers((prev) => prev.filter((st) => st.server.id !== id));
  }

  const selectedCatalog = selected && selected !== "custom" ? CATALOG.find((c) => c.id === selected) : null;

  return (
    <div className="overlay-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/60 p-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={s.dialogLabel}
        className="modal-in glass flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-card text-card-foreground shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-1 pt-6">
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

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <p className="mb-1 text-sm text-muted-foreground">{s.intro}</p>
          <p className="mb-5 text-xs text-muted-foreground/70">{s.corsNote}</p>

          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {s.popular}
          </p>
          <div className="mb-5 grid gap-2 sm:grid-cols-2">
            {CATALOG.map(({ id, name: connectorName, Logo }) => (
              <button
                key={id}
                type="button"
                onClick={() => selectConnector(id)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition duration-150 hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.98] ${
                  selected === id ? "border-primary/60 bg-accent/10" : "border-border bg-background/40"
                }`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-foreground/5">
                  <Logo className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{connectorName}</span>
                  <span className="block text-xs text-muted-foreground">{s.catalog[id].desc}</span>
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => selectConnector("custom")}
              className={`flex items-center gap-3 rounded-xl border border-dashed p-3 text-left transition duration-150 hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.98] ${
                selected === "custom" ? "border-primary/60 bg-accent/10" : "border-border bg-background/40"
              }`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-foreground/5 text-muted-foreground">
                <IconPlug className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.customName}</span>
                <span className="block text-xs text-muted-foreground">{s.customDesc}</span>
              </span>
            </button>
          </div>

          {selected && (
            <div className="mb-5 flex flex-col gap-2 rounded-xl border border-border bg-background/40 p-4">
              <p className="text-sm font-medium">
                {selectedCatalog ? s.connectTitle(selectedCatalog.name) : s.addCustomTitle}
              </p>
              {selectedCatalog && (
                <p className="text-xs text-muted-foreground">{s.catalog[selectedCatalog.id].hint}</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={s.namePlaceholder}
                  className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={s.urlPlaceholder}
                  className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={s.tokenPlaceholder}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {addError && <p className="text-xs text-destructive">{addError}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleAdd()}
                  disabled={adding || !name.trim() || !url.trim()}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                >
                  {adding ? s.connecting : s.add}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground"
                >
                  {s.cancel}
                </button>
              </div>
            </div>
          )}

          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {s.connected}
          </p>
          <div className="flex flex-col gap-2">
            {servers.map(({ server, status, tools, error }) => {
              const Logo = logoForServer(server.name);
              return (
                <div key={server.id} className="rounded-xl border border-border bg-background/40 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-foreground/5 text-muted-foreground">
                        {Logo ? <Logo className="h-4 w-4" /> : <IconPlug className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{server.name}</div>
                        <div className="mt-0.5 text-xs">
                          {status === "checking" && (
                            <span className="text-muted-foreground">{s.checking}</span>
                          )}
                          {status === "ok" && (
                            <span className="text-success">{s.toolsAvailable(tools.length)}</span>
                          )}
                          {status === "error" && <span className="text-destructive">{error}</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(server.id)}
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-destructive transition duration-150 hover:bg-destructive/10"
                    >
                      {s.remove}
                    </button>
                  </div>
                  {tools.length > 0 && (
                    <p className="mt-1.5 truncate pl-11 text-xs text-muted-foreground">
                      {tools.map((t) => t.name).join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
            {servers.length === 0 && (
              <p className="px-1 py-3 text-center text-sm text-muted-foreground">{s.noServers}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
