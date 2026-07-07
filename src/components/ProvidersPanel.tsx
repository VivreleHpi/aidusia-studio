import { useEffect, useState } from "react";
import { providers } from "@/providers";
import { clearAllApiKeys, clearApiKey, getApiKey, isPersistEnabled, setApiKey, setPersistEnabled } from "@/lib/apiKeys";
import type { KeyTestResult } from "@/providers/types";

interface ProviderRowState {
  draft: string;
  editing: boolean;
  testing: boolean;
  result: KeyTestResult | null;
}

function initialRowState(providerId: string): ProviderRowState {
  return { draft: getApiKey(providerId) ?? "", editing: false, testing: false, result: null };
}

interface ProvidersPanelProps {
  onClose: () => void;
}

export function ProvidersPanel({ onClose }: ProvidersPanelProps) {
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
    const result = await provider.testKey(key).catch(
      (err): KeyTestResult => ({ ok: false, reason: err instanceof Error ? err.message : String(err) }),
    );
    updateRow(providerId, { testing: false, result });
  }

  function saveKey(providerId: string) {
    const draft = rows[providerId].draft.trim();
    setApiKey(providerId, draft);
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/60 p-6 backdrop-blur-sm">
      <div className="glass w-full max-w-2xl rounded-lg bg-card p-6 text-card-foreground shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Fournisseurs</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Vos clés restent dans ce navigateur — jamais sur un serveur (sauf le proxy
          OpenAI, stateless, voir README). Le statut ci-dessous reflète un vrai
          appel au fournisseur, pas juste la présence d'une clé.
        </p>

        <div className="flex flex-col gap-2">
          {providers.map((provider) => {
            const row = rows[provider.id];
            const configured = provider.requiresApiKey
              ? Boolean(getApiKey(provider.id))
              : true;
            return (
              <div
                key={provider.id}
                className="rounded-md border border-border bg-background/40 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{provider.label}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      {row.testing ? (
                        <span className="text-muted-foreground">Test en cours…</span>
                      ) : row.result ? (
                        row.result.ok ? (
                          <span className="text-success">✓ Joignable</span>
                        ) : (
                          <span className="text-destructive">✗ {row.result.reason}</span>
                        )
                      ) : configured ? (
                        <span className="text-success">Configuré</span>
                      ) : (
                        <span className="text-muted-foreground">Non configuré</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => runTest(provider.id)}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/10"
                    >
                      Tester
                    </button>
                    {provider.requiresApiKey && (
                      <>
                        <button
                          type="button"
                          onClick={() => updateRow(provider.id, { editing: !row.editing })}
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/10"
                        >
                          Configurer
                        </button>
                        {configured && (
                          <button
                            type="button"
                            onClick={() => removeKey(provider.id)}
                            className="rounded-md border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                          >
                            Supprimer
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {row.editing && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="password"
                      value={row.draft}
                      onChange={(e) => updateRow(provider.id, { draft: e.target.value })}
                      placeholder="Cle API"
                      className="flex-1 rounded-md border border-border bg-card px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => saveKey(provider.id)}
                      className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                    >
                      Enregistrer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={persist} onChange={togglePersist} />
            Garder mes clés après fermeture du navigateur
          </label>
          <button
            type="button"
            onClick={() => {
              clearAllApiKeys();
              setRows(Object.fromEntries(providers.map((p) => [p.id, initialRowState(p.id)])));
            }}
            className="text-xs text-destructive hover:underline"
          >
            Tout effacer
          </button>
        </div>
      </div>
    </div>
  );
}
