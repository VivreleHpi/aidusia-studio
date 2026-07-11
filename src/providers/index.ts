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
];

export function getProvider(id: string): ChatProvider {
  const provider = providers.find((p) => p.id === id);
  if (!provider) throw new Error(`Fournisseur inconnu: ${id}`);
  return provider;
}

export * from "./types";
