export type DetectedOs = "windows" | "macos" | "linux" | "inconnu";

const ONBOARDING_STORAGE_KEY = "aidusia_onboarded";

export function shouldShowOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "true";
}

export function markOnboarded(): void {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
}

export function isMobile(): boolean {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod/i.test(ua) || navigator.maxTouchPoints > 2;
}

export function detectOs(): DetectedOs {
  const platform = navigator.userAgent;
  if (/Windows/i.test(platform)) return "windows";
  if (/Mac OS X|Macintosh/i.test(platform)) return "macos";
  if (/Linux/i.test(platform)) return "linux";
  return "inconnu";
}

// Ollama autorise localhost/127.0.0.1 sur n'importe quel port par defaut
// (verifie empiriquement : OPTIONS -> 204 sans configuration). Seule une
// vraie origine deployee (ex. https://studio.aidusia.com) exige
// OLLAMA_ORIGINS. Evite de faire configurer une variable inutile en local.
export function isLocalOrigin(): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
}

// L'installation standard (Windows/macOS) lance Ollama comme application de
// fond (tray/barre de menus) qui occupe deja le port 11434 : relancer
// "ollama serve" a la main dans un terminal echoue (port deja pris) et ne
// change rien pour l'appli deja demarree. La variable doit donc etre posee de
// facon persistante (registre utilisateur / session de connexion), puis
// l'appli doit etre quittee et relancee pour en tenir compte - verifie sur
// Windows (ollama app.exe + ollama.exe deja lances par l'installeur officiel).
// Sur Linux, ou Ollama tourne le plus souvent lance a la main ou via systemd,
// la commande directe reste la reference officielle du projet.
export function ollamaOriginsCommand(os: DetectedOs): string {
  const origin = window.location.origin;
  switch (os) {
    case "windows":
      return `setx OLLAMA_ORIGINS "${origin}"`;
    case "macos":
      return `launchctl setenv OLLAMA_ORIGINS "${origin}"`;
    case "linux":
    default:
      return `OLLAMA_ORIGINS=${origin} ollama serve`;
  }
}

// Precision affichee a cote de la commande : sur Windows/macOS, poser la
// variable ne suffit pas tant que l'appli de bureau deja lancee n'est pas
// redemarree pour la relire.
export function ollamaOriginsRestartNote(os: DetectedOs, lang: "fr" | "en"): string | null {
  if (os !== "windows" && os !== "macos") return null;
  const where =
    lang === "fr"
      ? os === "windows"
        ? "icône dans la zone de notification"
        : "icône dans la barre de menus"
      : os === "windows"
        ? "notification area icon"
        : "menu bar icon";
  return lang === "fr"
    ? `Puis quittez complètement Ollama (${where} → Quitter) et relancez-le : la variable n'est lue qu'au démarrage.`
    : `Then fully quit Ollama (${where} → Quit) and relaunch it: the variable is only read on startup.`;
}

// Affiche le raccourci dans la convention de la plateforme reelle : le
// symbole pomme n'a de sens que sur macOS, Windows/Linux utilisent "Ctrl+".
export function shortcutLabel(key: string): string {
  return detectOs() === "macos" ? `⌘${key}` : `Ctrl+${key}`;
}

export function ollamaDownloadUrl(os: DetectedOs): string {
  switch (os) {
    case "windows":
      return "https://ollama.com/download/windows";
    case "macos":
      return "https://ollama.com/download/mac";
    case "linux":
      return "https://ollama.com/download/linux";
    default:
      return "https://ollama.com/download";
  }
}
