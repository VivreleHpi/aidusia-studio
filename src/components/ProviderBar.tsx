import { useEffect, useState } from "react";
import { providers } from "@/providers";
import type { ProviderModel } from "@/providers/types";
import { getApiKey, setApiKey } from "@/lib/apiKeys";

interface ProviderBarProps {
  providerId: string;
  model: string;
  onChangeProvider: (providerId: string, model: string) => void;
}

export function ProviderBar({ providerId, model, onChangeProvider }: ProviderBarProps) {
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [keyDraft, setKeyDraft] = useState(getApiKey(providerId) ?? "");
  const [modelsError, setModelsError] = useState<string | null>(null);

  const provider = providers.find((p) => p.id === providerId) ?? providers[0];

  useEffect(() => {
    setKeyDraft(getApiKey(providerId) ?? "");
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
    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950">
      <select
        value={providerId}
        onChange={(e) => onChangeProvider(e.target.value, "")}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
      >
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      <select
        value={model}
        onChange={(e) => onChangeProvider(providerId, e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        disabled={models.length === 0}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>

      {provider.requiresApiKey && (
        <input
          type="password"
          placeholder="Cle API"
          value={keyDraft}
          onChange={(e) => {
            setKeyDraft(e.target.value);
            setApiKey(providerId, e.target.value);
          }}
          className="w-40 rounded-md border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        />
      )}

      {modelsError && <span className="text-red-500">{modelsError}</span>}
    </div>
  );
}
