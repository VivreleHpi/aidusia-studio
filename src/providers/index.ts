import type { ChatProvider } from "./types";
import { ollamaProvider } from "./ollama";
import { browserLocalProvider } from "./browserLocal";
import { ollamaCloudProvider } from "./ollamaCloud";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { mistralProvider } from "./mistral";
import { openaiProvider } from "./openai";
import { openrouterProvider } from "./openrouter";
import { groqProvider } from "./groq";
import { xaiProvider } from "./xai";
import { createCustomProvider, isCustomProviderId, listCustomProviderConfigs } from "./custom";

// Fournisseurs intégrés, dans l'ordre d'affichage des sélecteurs.
export const providers: ChatProvider[] = [
  ollamaProvider,
  browserLocalProvider,
  ollamaCloudProvider,
  anthropicProvider,
  geminiProvider,
  mistralProvider,
  openaiProvider,
  openrouterProvider,
  groqProvider,
  xaiProvider,
];

// Liste complète à l'instant T : intégrés + fournisseurs personnalisés
// (compatibles OpenAI) déclarés par l'utilisateur. À préférer à `providers`
// partout où la liste est montrée ou parcourue dynamiquement.
export function listProviders(): ChatProvider[] {
  return [...providers, ...listCustomProviderConfigs().map(createCustomProvider)];
}

export function getProvider(id: string): ChatProvider {
  const provider = providers.find((p) => p.id === id);
  if (provider) return provider;
  if (isCustomProviderId(id)) {
    const config = listCustomProviderConfigs().find((c) => c.id === id);
    if (config) return createCustomProvider(config);
  }
  throw new Error(`Fournisseur inconnu: ${id}`);
}

export * from "./types";
