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

// Avertissement (NON bloquant) affiche sur un modele local un peu lourd pour un
// telephone : l'utilisateur peut quand meme l'essayer.
export function heavyOnMobileReason(lang: Lang): string {
  return lang === "fr"
    ? "Peut dépasser la mémoire de ce téléphone"
    : "May exceed this phone's memory";
}

// Avertissement (NON bloquant) affiche quand on change de modele local en cours
// de conversation : autorise, mais previent que le moteur va se recharger (et
// que la reponse changera de modele en milieu de fil).
export function switchModelWarning(lang: Lang): string {
  return lang === "fr"
    ? "Changer de modèle en cours de conversation recharge le moteur"
    : "Switching model mid-conversation reloads the engine";
}
