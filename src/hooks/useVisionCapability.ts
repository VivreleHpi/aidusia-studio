import { useEffect, useState } from "react";
import { getProvider } from "@/providers";
import { getApiKey } from "@/lib/apiKeys";

// Verifie la capacite vision REELLE du modele selectionne (via l'API du
// fournisseur), jamais supposee. Absence de reponse = pas de vision proposee
// (fail-closed : mieux vaut ne pas montrer le bouton que promettre une
// analyse d'image qui echouera silencieusement).
export function useVisionCapability(providerId: string, model: string): boolean {
  const [visionCapable, setVisionCapable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!model) {
      setVisionCapable(false);
      return;
    }
    const provider = getProvider(providerId);
    provider
      .listModels(getApiKey(providerId))
      .then((models) => {
        if (cancelled) return;
        const current = models.find((m) => m.id === model);
        setVisionCapable(current?.visionCapable ?? false);
      })
      .catch(() => {
        if (!cancelled) setVisionCapable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [providerId, model]);

  return visionCapable;
}
