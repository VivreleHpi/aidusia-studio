import { listProviders } from "@/providers";

// Dernier fournisseur/modèle choisi, repris à la réouverture. Sans lui, un
// téléphone revenait toujours sur l'IA du navigateur par défaut : le message
// suivant partait vers un autre modèle que celui choisi la veille (et pouvait
// déclencher un téléchargement que l'utilisateur n'avait pas demandé).
const STORAGE_KEY = "aidusia_last_model";

export interface ModelSelection {
  providerId: string;
  model: string;
}

export function readLastModel(fallbackProviderId: string): ModelSelection {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (
      raw &&
      typeof raw === "object" &&
      typeof (raw as ModelSelection).providerId === "string" &&
      typeof (raw as ModelSelection).model === "string" &&
      listProviders().some((provider) => provider.id === (raw as ModelSelection).providerId)
    ) {
      return { providerId: (raw as ModelSelection).providerId, model: (raw as ModelSelection).model };
    }
  } catch {
    // stockage illisible ou indisponible : on repart du défaut
  }
  return { providerId: fallbackProviderId, model: "" };
}

export function saveLastModel(selection: ModelSelection): void {
  if (!selection.model) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // navigation privée / quota : simple confort, sans conséquence
  }
}
