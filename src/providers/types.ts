export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  // Base64 brut (sans prefixe data:), pour les modeles vision. Support
  // actuel : Ollama uniquement (verifie) - voir README pour le perimetre.
  images?: string[];
}

export interface ProviderModel {
  id: string;
  label: string;
  // true si ce modele sait analyser une image (verifie via l'API du
  // fournisseur, jamais suppose). Absent = capacite inconnue/non verifiee.
  visionCapable?: boolean;
}

export interface StreamChunk {
  delta: string;
}

export interface ChatStreamParams {
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  signal?: AbortSignal;
}

export type KeyTestResult =
  | { ok: true }
  | { ok: false; reason: string };

// Contrat commun a tous les fournisseurs (cloud direct-navigateur, cloud via
// proxy, ou local). Aucune implementation ne doit stocker la cle ailleurs
// qu'en memoire/localStorage cote appelant - ce module ne persiste rien.
export interface ChatProvider {
  id: string;
  label: string;
  // true si ce fournisseur necessite une cle API fournie par l'utilisateur.
  requiresApiKey: boolean;
  listModels(apiKey?: string): Promise<ProviderModel[]>;
  testKey(apiKey: string): Promise<KeyTestResult>;
  chatStream(
    params: ChatStreamParams,
    apiKey: string | undefined,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void>;
}
