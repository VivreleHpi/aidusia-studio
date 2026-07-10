import { useEffect, useState } from "react";
import { providers } from "@/providers";
import type { ProviderModel } from "@/providers/types";
import { getApiKey } from "@/lib/apiKeys";
import { ModelPicker } from "@/components/ModelPicker";

interface ProviderBarProps {
  providerId: string;
  model: string;
  onChangeProvider: (providerId: string, model: string) => void;
  onOpenProviders: () => void;
  onToggleSidebar: () => void;
}

const selectClass =
  "select-chevron appearance-none rounded-md border border-border bg-card pl-2 pr-6 py-1 text-foreground transition hover:border-ring/50 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40";

export function ProviderBar({
  providerId,
  model,
  onChangeProvider,
  onOpenProviders,
  onToggleSidebar,
}: ProviderBarProps) {
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const provider = providers.find((p) => p.id === providerId) ?? providers[0];
  const missingKey = provider.requiresApiKey && !getApiKey(providerId);

  useEffect(() => {
    setModelsError(null);
    provider
      .listModels(getApiKey(providerId))
      .then((list) => {
        setModels(list);
        if (list.length > 0 && !list.some((m) => m.id === model)) {
          onChangeProvider(providerId, list[0].id);
        }
      })
      .catch((err) => setModelsError(err instanceof Error ? err.message : String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border bg-card/60 px-4 py-2 text-sm backdrop-blur"
      data-tour="provider-bar"
    >
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Basculer le menu"
        className="rounded-md border border-border p-1.5 text-foreground hover:bg-accent/10 md:hidden"
      >
        <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4">
          <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <select
        aria-label="Fournisseur IA"
        value={providerId}
        onChange={(e) => onChangeProvider(e.target.value, "")}
        className={selectClass}
      >
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      <ModelPicker
        models={models}
        value={model}
        onChange={(id) => onChangeProvider(providerId, id)}
        disabled={models.length === 0}
      />

      {missingKey && (
        <button
          type="button"
          onClick={onOpenProviders}
          className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning hover:bg-warning/20"
        >
          Clé API manquante — configurer
        </button>
      )}

      {modelsError && <span className="text-destructive">{modelsError}</span>}

      <button
        type="button"
        onClick={onOpenProviders}
        className="ml-auto rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/10"
      >
        Fournisseurs
      </button>
    </div>
  );
}
