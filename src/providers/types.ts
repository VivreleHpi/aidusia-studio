export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  // Base64 brut (sans prefixe data:), pour les modeles vision. Support
  // actuel : Ollama uniquement (verifie) - voir README pour le perimetre.
  images?: string[];
  // Present uniquement sur role "tool" : resultat d'un appel d'outil MCP,
  // associe a l'appel qui l'a declenche (voir useChat.ts).
  toolCallId?: string;
  toolName?: string;
  // Present uniquement sur un message "assistant" qui a demande des appels
  // d'outils - necessaire pour rejouer l'historique vers le fournisseur
  // (chaque message "tool" qui suit doit correspondre a un appel ici).
  toolCalls?: ToolCall[];
}

export interface ProviderModel {
  id: string;
  label: string;
  // true si ce modele sait analyser une image (verifie via l'API du
  // fournisseur, jamais suppose). Absent = capacite inconnue/non verifiee.
  visionCapable?: boolean;
}

// Outil MCP traduit dans un format neutre - chaque provider le retraduit
// dans son propre schema de function-calling (voir chaque providers/*.ts).
export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

export type StreamChunk =
  | { type: "text"; delta: string }
  | { type: "tool_call"; call: ToolCall };

export interface ChatStreamParams {
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  signal?: AbortSignal;
  tools?: ToolDefinition[];
}

export type KeyTestResult =
  | { ok: true }
  | { ok: false; reason: string };

/* Cle absente : sur mobile c'est presque toujours parce que les cles ne se
   synchronisent pas entre appareils (choix souverain, pas de serveur) — le
   message doit l'expliquer et pointer vers la solution. */
export function missingKeyError(providerLabel: string): Error {
  return new Error(
    `Clé API ${providerLabel} manquante sur cet appareil. Les clés restent locales à ` +
      `chaque navigateur (jamais sur un serveur) : saisissez-la dans le panneau ` +
      `Fournisseurs, ou transférez vos réglages depuis votre autre appareil via ` +
      `Exporter / Importer.`,
  );
}

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
