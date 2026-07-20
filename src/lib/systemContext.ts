import type { Lang } from "@/lib/i18n";

// Fournisseurs qui tournent entierement sur cet appareil (aucun appel reseau
// vers un tiers pour l'inference) - le reste part vers une API cloud.
const LOCAL_PROVIDER_IDS = new Set(["ollama", "browser"]);

export function isLocalProvider(providerId: string): boolean {
  return LOCAL_PROVIDER_IDS.has(providerId);
}

// Petit rappel de contexte injecte devant le system prompt de l'utilisateur :
// que le modele sache qu'il tourne dans Aidusia Studio (une vitrine minimale,
// pas le produit complet) et si l'inference se fait localement ou via une
// API cloud - certains modeles adaptent leur ton/comportement selon ce point.
function baseContext(providerId: string, lang: Lang): string {
  const local = isLocalProvider(providerId);
  if (lang === "fr") {
    return local
      ? "Tu es invoque depuis Aidusia Studio, une vitrine minimale et open source. Tu tournes en local sur l'appareil de l'utilisateur (aucune donnee ne quitte cette machine)."
      : "Tu es invoque depuis Aidusia Studio, une vitrine minimale et open source. Tu es un modele cloud, appele via la cle API de l'utilisateur (BYOK).";
  }
  return local
    ? "You are invoked from Aidusia Studio, a minimal open-source showcase. You are running locally on the user's device (nothing leaves this machine)."
    : "You are invoked from Aidusia Studio, a minimal open-source showcase. You are a cloud model, called via the user's own API key (BYOK).";
}

export function buildSystemPrompt(providerId: string, lang: Lang, custom?: string): string {
  const base = baseContext(providerId, lang);
  return custom ? `${base}\n\n${custom}` : base;
}
