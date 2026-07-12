import { useEffect, useMemo, useRef, useState } from "react";
import { providers } from "@/providers";
import type { ProviderModel } from "@/providers/types";
import { getApiKey } from "@/lib/apiKeys";
import { describeFetchError } from "@/lib/fetchError";
import { getOllamaBaseUrl } from "@/providers/ollama";
import { useLang } from "@/lib/i18n";
import {
  providerDisabledOnDevice,
  providerDisplayLabel,
  providerTagline,
  switchModelWarning,
} from "@/lib/providerTaglines";
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
  // Modele local auquel la conversation en cours est deja liee (le 1er modele
  // "browser" qu'elle a utilise). Non-null => on verrouille le choix du modele
  // local sur celui-ci, pour eviter les changements de modele en cours de
  // conversation (bugs GPU / incoherence). Pour en changer : nouvelle conv.
  lockedLocalModel: string | null;
}

/* Sélecteur fournisseur + modèle intégré au composer (pattern Claude/
   Perplexity) : un bouton discret qui ouvre un menu vers le haut. Reprend la
   logique de chargement/auto-sélection de l'ancienne ProviderBar. */
export function ModelMenu({
  providerId,
  model,
  onChangeProvider,
  onOpenProviders,
  lockedLocalModel,
}: ModelMenuProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { lang } = useLang();
  const s = STRINGS[lang];

  // La conversation est deja liee a un modele local (fournisseur browser) : on
  // ne bloque PAS le changement, mais on avertit (le moteur se rechargera).
  const localBound = providerId === "browser" && Boolean(lockedLocalModel);

  const provider = providers.find((p) => p.id === providerId) ?? providers[0];
  const missingKey = provider.requiresApiKey && !getApiKey(providerId);
  const selected = models.find((m) => m.id === model);
  const providerName = (id: string, fallback: string) => providerDisplayLabel(id, lang) ?? fallback;

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
        // Auto-selection : si la conversation est deja liee a un modele local,
        // on le reprend (continuite) ; sinon le 1er du catalogue. Aucun modele
        // n'est bloque — les avertissements sont non bloquants.
        const boundTarget =
          providerId === "browser" && lockedLocalModel
            ? list.find((m) => m.id === lockedLocalModel)
            : undefined;
        const target = boundTarget ?? list[0];
        if (target && !list.some((m) => m.id === model)) {
          onChangeProvider(providerId, target.id);
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
  }, [providerId, lockedLocalModel]);

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
        className="flex h-9 max-w-52 items-center gap-1.5 rounded-xl px-2.5 text-xs text-foreground transition duration-150 hover:bg-foreground/5 active:scale-95"
      >
        {(missingKey || modelsError) && (
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              modelsError ? "bg-destructive" : "bg-warning"
            }`}
          />
        )}
        <span className="truncate">
          {selected?.label ?? (missingKey ? providerName(provider.id, provider.label) : s.chooseModel)}
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
                const off = providerDisabledOnDevice(p.id, lang);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={off.disabled}
                    title={off.disabled ? off.reason : undefined}
                    onClick={() => onChangeProvider(p.id, "")}
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition duration-150 ${
                      off.disabled
                        ? "cursor-not-allowed text-muted-foreground/40"
                        : active
                          ? "bg-accent/15 text-foreground"
                          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        off.disabled ? "bg-muted-foreground/20" : ready ? "bg-success" : "bg-muted-foreground/30"
                      }`}
                    />
                    <span className="truncate">{providerName(p.id, p.label)}</span>
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
                  <p className="text-xs text-muted-foreground">{s.keyRequired(providerName(provider.id, provider.label))}</p>
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
                    {filtered.map((m) => {
                      // Avertissements NON bloquants : modele lourd (mobile) ou
                      // changement de modele en cours de conversation liee.
                      const switchWarn = localBound && m.id !== lockedLocalModel;
                      const warn = m.warning ?? (switchWarn ? switchModelWarning(lang) : undefined);
                      return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onChangeProvider(providerId, m.id);
                          setOpen(false);
                        }}
                        title={warn ?? m.label}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition duration-150 ${
                          m.id === model
                            ? "bg-accent/15 text-foreground"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{m.label}</span>
                        {warn ? (
                          <span className="shrink-0 text-[11px] text-warning" title={warn}>
                            ⚠
                          </span>
                        ) : m.downloaded ? (
                          <span className="shrink-0 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] text-success">
                            ✓ {s.onDevice}
                          </span>
                        ) : null}
                        {m.id === model && (
                          <IconCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                        )}
                      </button>
                      );
                    })}
                  </div>
                  {(() => {
                    const note =
                      models.find((m) => m.warning)?.warning ??
                      (localBound ? switchModelWarning(lang) : undefined);
                    return note ? (
                      <p className="flex items-start gap-1 px-2 pb-0.5 pt-1.5 text-[10px] text-muted-foreground/70">
                        <span className="text-warning">⚠</span>
                        <span>{note}</span>
                      </p>
                    ) : null;
                  })()}
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
