import type { Lang } from "@/lib/i18n";
import { isMobile } from "@/lib/deviceDetect";

/* Metadonnees d'affichage des fournisseurs LOCAUX, selon l'appareil — pour que
   personne ne cherche Ollama sur son telephone ni ne choisisse un modele trop
   lourd pour un mobile. Les fournisseurs cloud n'ont pas de metadonnee ici. */

// Libelle clair et bilingue, adaptatif :
//  - IA navigateur : « Sur votre mobile » sur telephone, « Sur cet appareil »
//    sur PC (le meme moteur, mais on parle le langage de l'appareil) ;
//  - Ollama : toujours marque « PC » (appli de bureau).
// Les autres (cloud) gardent leur nom -> renvoyer null = utiliser p.label.
export function providerDisplayLabel(providerId: string, lang: Lang): string | null {
  if (providerId === "browser") {
    if (isMobile()) return lang === "fr" ? "Sur votre mobile" : "On your phone";
    return lang === "fr" ? "Sur cet appareil" : "On-device";
  }
  if (providerId === "ollama") return lang === "fr" ? "PC (Ollama)" : "PC (Ollama)";
  return null;
}

// Sous-titre sous le nom du fournisseur : sur quel type d'appareil il marche,
// avec avertissement sur mobile pour l'IA navigateur (bêta, modele leger).
export function providerTagline(providerId: string, lang: Lang): string | null {
  if (providerId === "ollama") {
    return lang === "fr"
      ? "Ordinateur uniquement — application à installer"
      : "Computer only — desktop app required";
  }
  if (providerId === "browser") {
    if (isMobile()) {
      return lang === "fr"
        ? "⚠ Bêta sur mobile — modèle léger conseillé, sans installation"
        : "⚠ Beta on mobile — light model advised, no install";
    }
    return lang === "fr"
      ? "PC & mobile — sans installation, marche hors connexion"
      : "PC & mobile — no install, works offline";
  }
  return null;
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

// Raison affichee quand un modele local est grise sur mobile (trop lourd).
export function heavyOnMobileReason(lang: Lang): string {
  return lang === "fr"
    ? "Trop lourd pour la plupart des téléphones — PC recommandé"
    : "Too heavy for most phones — PC recommended";
}

// Raison affichee quand un modele local est verrouille pour la conversation en
// cours (evite les changements de modele local en cours de route, source de
// bugs GPU / d'incoherence). Pour en changer : nouvelle conversation.
export function lockedModelReason(lang: Lang): string {
  return lang === "fr"
    ? "Modèle fixé pour cette conversation — nouvelle conversation pour en changer"
    : "Model fixed for this conversation — start a new one to change";
}
