import type { Lang } from "@/lib/i18n";

/* Sur quel type d'appareil chaque fournisseur local fonctionne : Ollama exige
   une application de bureau (donc PC), l'IA navigateur marche partout ou
   WebGPU existe (PC ET mobile). Affiche dans le selecteur de modele et le
   panneau Fournisseurs pour que personne ne cherche Ollama sur son telephone. */
const TAGLINES: Record<string, { fr: string; en: string }> = {
  ollama: {
    fr: "Ordinateur uniquement — application à installer",
    en: "Computer only — desktop app required",
  },
  browser: {
    fr: "PC & mobile — IA locale, sans installation, marche hors connexion",
    en: "PC & mobile — local AI, no install, works offline",
  },
};

export function providerTagline(providerId: string, lang: Lang): string | null {
  return TAGLINES[providerId]?.[lang] ?? null;
}
