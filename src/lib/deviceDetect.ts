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

export function ollamaOriginsCommand(os: DetectedOs): string {
  const origin = window.location.origin;
  switch (os) {
    case "windows":
      return `$env:OLLAMA_ORIGINS="${origin}"; ollama serve`;
    case "macos":
    case "linux":
      return `OLLAMA_ORIGINS=${origin} ollama serve`;
    default:
      return `OLLAMA_ORIGINS=${origin} ollama serve`;
  }
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
