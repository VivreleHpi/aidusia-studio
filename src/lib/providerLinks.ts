// Liens verifies empiriquement (curl, statut HTTP reel) le 2026-07-07 — pas
// devines. Redirigent vers une page de login legitime pour les consoles qui
// en necessitent une ; c'est attendu, ce n'est pas un lien casse.
export interface ProviderLink {
  keyUrl: string;
  note: string;
}

export const PROVIDER_LINKS: Record<string, ProviderLink> = {
  groq: {
    keyUrl: "https://console.groq.com/keys",
    note: "Compte gratuit, inférence très rapide, sans carte bancaire pour démarrer.",
  },
  xai: {
    keyUrl: "https://console.x.ai",
    note: "Console développeur xAI — clé pour les modèles Grok.",
  },
  openrouter: {
    keyUrl: "https://openrouter.ai/keys",
    note: "Un seul compte, accès à des dizaines de modèles (dont ceux d'autres fournisseurs).",
  },
  anthropic: {
    keyUrl: "https://platform.claude.com/settings/keys",
    note: "Console développeur Anthropic (Claude).",
  },
  gemini: {
    keyUrl: "https://aistudio.google.com/app/apikey",
    note: "Clé gratuite via Google AI Studio, compte Google requis.",
  },
  mistral: {
    keyUrl: "https://console.mistral.ai/api-keys",
    note: "Console développeur Mistral AI.",
  },
  openai: {
    keyUrl: "https://platform.openai.com/api-keys",
    note: "Console développeur OpenAI — carte bancaire généralement requise.",
  },
  ollama: {
    keyUrl: "https://ollama.com/download",
    note: "Pas de clé : téléchargez et lancez Ollama, tout tourne en local.",
  },
  "ollama-cloud": {
    keyUrl: "https://ollama.com/settings/keys",
    note: "Compte Ollama requis pour générer une clé Ollama Cloud.",
  },
};
