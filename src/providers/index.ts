import type { ChatProvider } from "./types";
import { ollamaProvider } from "./ollama";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { mistralProvider } from "./mistral";
import { openaiProvider } from "./openai";

export const providers: ChatProvider[] = [
  ollamaProvider,
  anthropicProvider,
  geminiProvider,
  mistralProvider,
  openaiProvider,
];

export function getProvider(id: string): ChatProvider {
  const provider = providers.find((p) => p.id === id);
  if (!provider) throw new Error(`Fournisseur inconnu: ${id}`);
  return provider;
}

export * from "./types";
