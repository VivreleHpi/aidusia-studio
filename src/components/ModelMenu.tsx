import { useEffect, useMemo, useRef, useState } from "react";
import { providers } from "@/providers";
import type { ProviderModel } from "@/providers/types";
import { getApiKey } from "@/lib/apiKeys";
import { describeFetchError } from "@/lib/fetchError";
import { getOllamaBaseUrl } from "@/providers/ollama";
import { useLang } from "@/lib/i18n";
import { providerTagline } from "@/lib/providerTaglines";
import { IconCheck, IconChevronDown, IconGear } from "@/components/Icons";

const STRINGS = {
  fr: {
    buttonLabel: "Choisir le fournisseur et le modèle",
    chooseModel: "Choisir un modèle",
    close: "Fermer",
    providerSection: "Fournisseur",
    modelSection: "Modèle",
    keyRequired: (label: string) => `Une clé API est requise pour ${label}.`,
    configureKey: "Configurer la clé",
    loading: "Chargement des modèles…",
    noModels: "Aucun modèle disponible.",
    searchPlaceholder: (count: number) => `Rechercher parmi ${count} modèles…`,
    noResults: "Aucun résultat.",
    manageProviders: "Gérer les fournisseurs",
    onDevice: "sur l'appareil",
  },
  en: {
    buttonLabel: "Choose provider and model",
    chooseModel: "Choose a model",
    close: "Close",
    providerSection: "Provider",
    modelSection: "Model",
    keyRequired: (label: string) => `An API key is required for ${label}.`,
    configureKey: "Set up the key",
    loading: "Loading models…",
    noModels: "No models available.",
    searchPlaceholder: (count: number) => `Search ${count} models…`,
    noResults: "No results.",
    manageProviders: "Manage providers",
    onDevice: "on device",
  },
} as const;

interface ModelMenuProps {
  providerId: string;
  model: string;
  onChangeProvider: (providerId: string, model: string) => void;
  onOpenProviders: () => void;
}

/* Sélecteur fournisseur + modèle intégré au composer (pattern Claude/
   Perplexity) : un bouton discret qui ouvre un menu vers le haut. Reprend la
   logique de chargement/auto-sélection de l'ancienne ProviderBar. */
export function ModelMenu({ providerId, model, onChangeProvider, onOpenProviders }: ModelMenuProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { lang } = useLang();
  const s = STRINGS[lang];

  const provider = providers.find((p) => p.id === providerId) ?? providers[0];
  const missingKey = provider.requiresApiKey && !getApiKey(providerId);
  const selected = models.find((m) => m.id === model);

  useEffect(() => {
    let cancelled = false;
    setModels([]);
    setModelsError(null);
    if (provider.requiresApiKey && !getApiKey(providerId)) return;
    setLoading(true);
    provider
      .listModels(getApiKey(providerId))
      .then((list) => {
        if (cancelled) return;
        setModels(list);
        if (list.length > 0 && !list.some((m) => m.id === model)) {
          onChangeProvider(providerId, list[0].id);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setModelsError(
            describeFetchError(
              err,
              provider.label,
              provider.id === "ollama" ? getOllamaBaseUrl() : undefined,
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    );
  }, [models, query]);

  function openProvidersPanel() {
    setOpen(false);
    onOpenProviders();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={s.buttonLabel}
        aria-expanded={open ? "true" : "false"}
        data-tour="provider-bar"
        className="flex h-9 max-w-52 items-center gap-1.5 rounded-xl px-2.5 text-xs text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground"
      >
        {(missingKey || modelsError) && (
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              modelsError ? "bg-destructive" : "bg-warning"
            }`}
          />
        )}
        <span className="truncate">
          {selected?.label ?? (missingKey ? provider.label : s.chooseModel)}
        </span>
        <IconChevronDown
          className={`h-3 w-3 shrink-0 opacity-60 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={s.close}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="modal-in absolute bottom-full right-0 z-50 mb-2 flex w-80 flex-col overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-xl backdrop-blur-xl">
            <div className="p-1.5">
              <p className="px-2 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                {s.providerSection}
              </p>
              <div className="grid grid-cols-2 gap-1">
              {providers.map((p) => {
                const active = p.id === providerId;
                const ready = !p.requiresApiKey || Boolean(getApiKey(p.id));
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onChangeProvider(p.id, "")}
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition duration-150 ${
                      active
                        ? "bg-accent/15 text-foreground"
                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        ready ? "bg-success" : "bg-muted-foreground/30"
                      }`}
                    />
                    <span className="truncate">{p.label}</span>
                  </button>
                );
              })}
              </div>
              {providerTagline(providerId, lang) && (
                <p className="px-2 pb-0.5 pt-1.5 text-[10px] text-muted-foreground/70">
                  {providerTagline(providerId, lang)}
                </p>
              )}
            </div>

            <div className="border-t border-border p-1.5">
              <p className="px-2 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                {s.modelSection}
              </p>
              {missingKey ? (
                <div className="flex flex-col items-center gap-2 px-3 py-3 text-center">
                  <p className="text-xs text-muted-foreground">{s.keyRequired(provider.label)}</p>
                  <button
                    type="button"
                    onClick={openProvidersPanel}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition duration-150 hover:opacity-90 active:scale-[0.98]"
                  >
                    {s.configureKey}
                  </button>
                </div>
              ) : loading ? (
                <p className="px-3 py-3 text-center text-xs text-muted-foreground">{s.loading}</p>
              ) : modelsError ? (
                <p className="px-3 py-2 text-xs text-destructive">{modelsError}</p>
              ) : models.length === 0 ? (
                <p className="px-3 py-3 text-center text-xs text-muted-foreground">{s.noModels}</p>
              ) : (
                <>
                  {models.length > 8 && (
                    <input
                      ref={searchRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setOpen(false);
                        if (e.key === "Enter" && filtered.length > 0) {
                          onChangeProvider(providerId, filtered[0].id);
                          setOpen(false);
                        }
                      }}
                      placeholder={s.searchPlaceholder(models.length)}
                      className="mb-1 w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  )}
                  <div className="max-h-56 overflow-y-auto">
                    {filtered.length === 0 && (
                      <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                        {s.noResults}
                      </p>
                    )}
                    {filtered.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onChangeProvider(providerId, m.id);
                          setOpen(false);
                        }}
                        title={m.label}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition duration-150 ${
                          m.id === model
                            ? "bg-accent/15 text-foreground"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{m.label}</span>
                        {m.downloaded && (
                          <span className="shrink-0 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] text-success">
                            ✓ {s.onDevice}
                          </span>
                        )}
                        {m.id === model && (
                          <IconCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-border p-1.5">
              <button
                type="button"
                onClick={openProvidersPanel}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground"
              >
                <IconGear className="h-3.5 w-3.5" />
                {s.manageProviders}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
