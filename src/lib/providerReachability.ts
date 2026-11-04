import { getApiKey } from "@/lib/apiKeys";
import { isMobile } from "@/lib/deviceDetect";
import { probeOllama } from "@/lib/hardwareGovernor";
import { getStoredLang } from "@/lib/i18n";
import { providerDisabledOnDevice } from "@/lib/providerTaglines";
import { getProvider, listProviders } from "@/providers";
import { getOllamaBaseUrl } from "@/providers/ollama";

export type ProviderReachability = "unknown" | "ready" | "unavailable";

const cache = new Map<string, ProviderReachability>();

export function invalidateProviderReachability(): void {
  cache.clear();
}

export async function probeProviderReachability(providerId: string): Promise<ProviderReachability> {
  const lang = getStoredLang();
  if (providerDisabledOnDevice(providerId, lang).disabled) return "unavailable";

  const provider = getProvider(providerId);
  if (provider.requiresApiKey && !getApiKey(providerId)) return "unavailable";

  if (providerId === "ollama") {
    const probe = await probeOllama(getOllamaBaseUrl());
    return probe.reachable ? "ready" : "unavailable";
  }

  try {
    const result = await provider.testKey(getApiKey(providerId));
    return result.ok ? "ready" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function getProviderReachability(providerId: string): Promise<ProviderReachability> {
  const cached = cache.get(providerId);
  if (cached !== undefined) return cached;
  const next = await probeProviderReachability(providerId);
  cache.set(providerId, next);
  return next;
}

/** Premier fournisseur réellement utilisable (clé + ping ou local OK). */
export async function pickFirstWorkingProvider(preferredId?: string): Promise<string | null> {
  const ids = listProviders().map((p) => p.id);
  const ordered =
    preferredId && ids.includes(preferredId)
      ? [preferredId, ...ids.filter((id) => id !== preferredId)]
      : ids;

  for (const id of ordered) {
    if ((await getProviderReachability(id)) === "ready") return id;
  }
  return null;
}

/** Quand aucun fournisseur ne répond : éviter Ollama / WebGPU par défaut. */
export function neutralFallbackProviderId(): string {
  const withKey = listProviders().find((p) => p.requiresApiKey && getApiKey(p.id));
  if (withKey) return withKey.id;

  const firstCloud = listProviders().find((p) => p.requiresApiKey);
  if (firstCloud) return firstCloud.id;

  return isMobile() ? "luciole" : "luciole";
}

export async function resolveComparisonTargets(): Promise<
  [{ providerId: string; model: string }, { providerId: string; model: string }]
> {
  const working = await pickFirstWorkingProvider();
  const second = await pickFirstWorkingProvider(working ?? undefined);

  const sideA = working ?? neutralFallbackProviderId();
  let sideB = second && second !== sideA ? second : null;

  if (!sideB) {
    const cloudWithKey = listProviders().find((p) => p.requiresApiKey && getApiKey(p.id));
    sideB =
      cloudWithKey && cloudWithKey.id !== sideA
        ? cloudWithKey.id
        : listProviders().find((p) => p.id !== sideA && !providerDisabledOnDevice(p.id, getStoredLang()).disabled)
            ?.id ?? sideA;
  }

  if (sideB === sideA) {
    const alt = listProviders().find(
      (p) => p.id !== sideA && !providerDisabledOnDevice(p.id, getStoredLang()).disabled,
    );
    if (alt) sideB = alt.id;
  }

  return [
    { providerId: sideA, model: "" },
    { providerId: sideB, model: "" },
  ];
}
