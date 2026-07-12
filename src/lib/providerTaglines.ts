import type { Lang } from "@/lib/i18n";
import { isMobile } from "@/lib/deviceDetect";

/* Metadonnees d'affichage des fournisseurs LOCAUX, selon l'appareil — pour que
   personne ne cherche Ollama sur son telephone ni ne choisisse un modele trop
   lourd pour un mobile. Les fournisseurs cloud n'ont pas de metadonnee ici. */

// Libelle clair et bilingue. Pour l'IA navigateur, « Navigateur (local) » etait
// trop technique : on adopte le terme FAANG « sur l'appareil / on-device ». Les
// marques (Ollama, Groq…) gardent leur nom : renvoyer null = utiliser p.label.
const DISPLAY_LABELS: Record<string, { fr: string; en: string }> = {
  browser: { fr: "Sur cet appareil", en: "On-device" },
};

export function providerDisplayLabel(providerId: string, lang: Lang): string | null {
  return DISPLAY_LABELS[providerId]?.[lang] ?? null;
}

// Sous-titre sous le nom du fournisseur : sur quel type d'appareil il marche.
const TAGLINES: Record<string, { fr: string; en: string }> = {
  ollama: {
    fr: "Ordinateur uniquement — application à installer",
    en: "Computer only — desktop app required",
  },
  browser: {
    fr: "PC & mobile — sans installation, marche hors connexion",
    en: "PC & mobile — no install, works offline",
  },
};

export function providerTagline(providerId: string, lang: Lang): string | null {
  return TAGLINES[providerId]?.[lang] ?? null;
}

// Raison affichee quand un modele local est grise sur mobile (trop lourd).
export function heavyOnMobileReason(lang: Lang): string {
  return lang === "fr"
    ? "Trop lourd pour la plupart des téléphones — PC recommandé"
    : "Too heavy for most phones — PC recommended";
}

// Fournisseur indisponible sur CET appareil (grise dans les selecteurs) :
// Ollama exige une appli de bureau, donc impossible sur telephone.
export function providerDisabledOnDevice(
  providerId: string,
  lang: Lang,
): { disabled: boolean; reason?: string } {
  if (providerId === "ollama" && isMobile()) {
    return {
      disabled: true,
      reason:
        lang === "fr"
          ? "Ordinateur uniquement — indisponible sur téléphone"
          : "Computer only — unavailable on phone",
    };
  }
  return { disabled: false };
}
