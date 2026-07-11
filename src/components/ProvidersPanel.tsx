import { useEffect, useState } from "react";
import { providers } from "@/providers";
import { getOllamaBaseUrl, setOllamaBaseUrl } from "@/providers/ollama";
import { clearAllApiKeys, clearApiKey, getApiKey, isPersistEnabled, setApiKey, setPersistEnabled } from "@/lib/apiKeys";
import { PROVIDER_LINKS } from "@/lib/providerLinks";
import type { KeyTestResult } from "@/providers/types";
import { HardwareGovernor } from "@/components/HardwareGovernor";
import { IconX } from "@/components/Icons";
import { useLang } from "@/lib/i18n";
import { describeFetchError } from "@/lib/fetchError";

const STRINGS = {
  fr: {
    dialogLabel: "Fournisseurs",
    title: "Fournisseurs",
    close: "Fermer",
    intro:
      "Vos clés restent dans ce navigateur — jamais sur un serveur (sauf les proxys OpenAI et Ollama Cloud, stateless, voir README). Le statut ci-dessous reflète un vrai appel au fournisseur, pas juste la présence d'une clé.",
    test: "Tester",
    configure: "Configurer",
    remove: "Supprimer",
    save: "Enregistrer",
    statusTesting: "Test en cours…",
    statusReachable: "Joignable",
    statusConfigured: "Configuré",
    statusNotConfigured: "Non configuré",
    keyPlaceholder: "Clé API",
    ollamaUrlPlaceholder: "URL d'Ollama (ex. http://192.168.1.20:11434)",
    getKey: "Obtenir une clé ↗",
    download: "Télécharger ↗",
    persistLabel: "Garder mes clés après fermeture du navigateur",
    clearAll: "Tout effacer",
  },
  en: {
    dialogLabel: "Providers",
    title: "Providers",
    close: "Close",
    intro:
      "Your keys stay in this browser — never on a server (except the stateless OpenAI and Ollama Cloud proxies, see the README). The status below reflects an actual call to the provider, not just the presence of a key.",
    test: "Test",
    configure: "Configure",
    remove: "Remove",
    save: "Save",
    statusTesting: "Testing…",
    statusReachable: "Reachable",
    statusConfigured: "Configured",
    statusNotConfigured: "Not configured",
    keyPlaceholder: "API key",
    ollamaUrlPlaceholder: "Ollama URL (e.g. http://192.168.1.20:11434)",
    getKey: "Get a key ↗",
    download: "Download ↗",
    persistLabel: "Keep my keys after closing the browser",
    clearAll: "Clear all",
  },
} as const;

interface ProviderRowState {
  draft: string;
  editing: boolean;
  testing: boolean;
  result: KeyTestResult | null;
}

function initialRowState(providerId: string): ProviderRowState {
  return {
    // Pour Ollama, le champ configurable est son URL, pas une cle.
    draft: providerId === "ollama" ? getOllamaBaseUrl() : (getApiKey(providerId) ?? ""),
    editing: false,
    testing: false,
    result: null,
  };
}

interface ProvidersPanelProps {
  onClose: () => void;
}

export function ProvidersPanel({ onClose }: ProvidersPanelProps) {
  const { lang } = useLang();
  const s = STRINGS[lang];
  const [rows, setRows] = useState<Record<string, ProviderRowState>>(() =>
    Object.fromEntries(providers.map((p) => [p.id, initialRowState(p.id)])),
  );
  const [persist, setPersist] = useState(isPersistEnabled());

  useEffect(() => {
    // Ollama ne demande pas de cle : on teste sa joignabilite reelle au montage.
    const ollama = providers.find((p) => !p.requiresApiKey);
    if (ollama) void runTest(ollama.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateRow(id: string, patch: Partial<ProviderRowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function runTest(providerId: string) {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;
    updateRow(providerId, { testing: true, result: null });
    const key = getApiKey(providerId) ?? "";
    const baseUrl = providerId === "ollama" ? getOllamaBaseUrl() : undefined;
    const result = await provider.testKey(key).catch(
      (err): KeyTestResult => ({ ok: false, reason: describeFetchError(err, provider.label, baseUrl) }),
    );
    // Certains testKey attrapent eux-memes l'erreur et renvoient le message
    // brut du navigateur dans reason : on le rend actionnable ici aussi.
    if (!result.ok && result.reason && /failed to fetch|networkerror|load failed/i.test(result.reason)) {
      result.reason = describeFetchError(new TypeError(result.reason), provider.label, baseUrl);
    }
    updateRow(providerId, { testing: false, result });
  }

  function saveKey(providerId: string) {
    const draft = rows[providerId].draft.trim();
    if (providerId === "ollama") {
      setOllamaBaseUrl(draft || "http://localhost:11434");
    } else {
      setApiKey(providerId, draft);
    }
    updateRow(providerId, { editing: false });
    void runTest(providerId);
  }

  function removeKey(providerId: string) {
    clearApiKey(providerId);
    updateRow(providerId, { draft: "", editing: false, result: null });
  }

  function togglePersist() {
    const next = !persist;
    setPersistEnabled(next);
    setPersist(next);
  }

  return (
    <div className="overlay-in fixed inset-0 z-50 flex items-start justify-center bg-background/60 p-3 backdrop-blur-sm sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={s.dialogLabel}
        className="modal-in glass flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-card text-card-foreground shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-4 pt-6">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.close}
            className="rounded-lg p-2 text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground active:scale-[0.98]"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          <p className="mb-4 text-sm text-muted-foreground">{s.intro}</p>

          <div className="mb-4">
            <HardwareGovernor ollamaBaseUrl={getOllamaBaseUrl()} />
          </div>

          <div className="mb-6 rounded-xl border border-border divide-y divide-border">
            {providers.map((provider) => {
              const row = rows[provider.id];
              const configured = provider.requiresApiKey
                ? Boolean(getApiKey(provider.id))
                : true;

              const statusDotClass = row.testing
                ? "bg-warning animate-pulse"
                : row.result
                  ? row.result.ok
                    ? "bg-success"
                    : "bg-destructive"
                  : configured
                    ? "bg-success"
                    : "bg-muted-foreground/30";

              const statusText = row.testing
                ? s.statusTesting
                : row.result
                  ? row.result.ok
                    ? s.statusReachable
                    : row.result.reason
                  : configured
                    ? s.statusConfigured
                    : s.statusNotConfigured;

              const statusTextClass =
                !row.testing && row.result && !row.result.ok
                  ? "text-destructive"
                  : "text-muted-foreground";

              return (
                <div key={provider.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass}`} />
                      <span className="text-sm font-medium">{provider.label}</span>
                      {PROVIDER_LINKS[provider.id] && (
                        <a
                          href={PROVIDER_LINKS[provider.id].keyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={PROVIDER_LINKS[provider.id].note}
                          className="text-xs text-primary hover:underline"
                        >
                          {provider.requiresApiKey ? s.getKey : s.download}
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => runTest(provider.id)}
                        className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground active:scale-[0.98]"
                      >
                        {s.test}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRow(provider.id, { editing: !row.editing })}
                        className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground active:scale-[0.98]"
                      >
                        {s.configure}
                      </button>
                      {provider.requiresApiKey && configured && (
                        <button
                          type="button"
                          onClick={() => removeKey(provider.id)}
                          className="rounded-lg px-2.5 py-1.5 text-xs text-destructive transition duration-150 hover:bg-destructive/10 active:scale-[0.98]"
                        >
                          {s.remove}
                        </button>
                      )}
                    </div>
                  </div>

                  <p className={`mt-0.5 wrap-break-word pl-4 text-xs ${statusTextClass}`}>{statusText}</p>

                  {row.editing && (
                    <div className="mt-2 flex gap-2 pl-4">
                      <input
                        type={provider.requiresApiKey ? "password" : "text"}
                        value={row.draft}
                        onChange={(e) => updateRow(provider.id, { draft: e.target.value })}
                        placeholder={provider.requiresApiKey ? s.keyPlaceholder : s.ollamaUrlPlaceholder}
                        className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => saveKey(provider.id)}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition duration-150 active:scale-[0.98]"
                      >
                        {s.save}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={persist}
              onChange={togglePersist}
              style={{ accentColor: "hsl(var(--primary))" }}
            />
            {s.persistLabel}
          </label>
          <button
            type="button"
            onClick={() => {
              clearAllApiKeys();
              setRows(Object.fromEntries(providers.map((p) => [p.id, initialRowState(p.id)])));
            }}
            className="rounded-lg px-2.5 py-1.5 text-xs text-destructive transition duration-150 hover:bg-destructive/10 active:scale-[0.98]"
          >
            {s.clearAll}
          </button>
        </div>
      </div>
    </div>
  );
}
