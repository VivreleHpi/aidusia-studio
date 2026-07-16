import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";
import { buildOpenAiCompatibleBody } from "./openaiCompatibleStream";
import { detectOs, isLocalOrigin, ollamaOriginsCommand, ollamaOriginsRestartNote } from "@/lib/deviceDetect";

export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

const INITIAL_CONNECTION_TIMEOUT_MS = 20_000;

const OLLAMA_APPROVED_URL_KEY = "aidusia_ollama_approved_url";

export function normalizeOllamaBaseUrl(input: string): string {
  const raw = input.trim() || DEFAULT_OLLAMA_BASE_URL;
  const url = new URL(raw);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("L’URL Ollama doit utiliser HTTP ou HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("Les identifiants intégrés dans l’URL Ollama sont interdits.");
  }

  return url.origin;
}

export function isOllamaApproved(baseUrl = getOllamaBaseUrl()): boolean {
  return sessionStorage.getItem(OLLAMA_APPROVED_URL_KEY) === baseUrl;
}

function approveOllama(baseUrl: string): void {
  sessionStorage.setItem(OLLAMA_APPROVED_URL_KEY, baseUrl);
}

function revokeOllamaApproval(): void {
  sessionStorage.removeItem(OLLAMA_APPROVED_URL_KEY);
}

function requireOllamaApproval(baseUrl: string): void {
  if (!isOllamaApproved(baseUrl)) {
    throw new Error("Connectez d’abord Ollama depuis le panneau Fournisseurs.");
  }
}

/* Message contextuel : la cause d'un Ollama injoignable n'est pas la meme
   selon qu'on est en local, sur un domaine deploye, ou sur un autre appareil
   que celui qui heberge Ollama. */
export function ollamaUnreachableMessage(baseUrl: string): string {
  const targetIsLocalhost = /localhost|127\.0\.0\.1/.test(baseUrl);
  if (isLocalOrigin()) {
    return (
      `Ollama injoignable sur ${baseUrl}. Vérifiez qu'il est installé et lancé ` +
      `(ollama serve) — en local, aucune configuration n'est nécessaire. ` +
      `Pas encore installé ? ollama.com/download`
    );
  }
  const origin = window.location.origin;
  if (targetIsLocalhost) {
    const os = detectOs();
    const restartNote = ollamaOriginsRestartNote(os, "fr");
    return (
      `Ollama injoignable depuis ${origin}. Deux causes possibles : ` +
      `1) Ollama tourne sur CE PC (l'appli de bureau) mais n'autorise pas ce site — ` +
      `définissez la variable : ${ollamaOriginsCommand(os)}` +
      `${restartNote ? ` · ${restartNote}` : ""} · ` +
      `2) vous êtes sur un téléphone — utilisez plutôt le fournisseur ` +
      `« Sur cet appareil » (IA directement dans le navigateur, rien à installer), ` +
      `ou Termux sur Android (voir docs/ia-locale-mobile.md).`
    );
  }
  return (
    `Ollama injoignable sur ${baseUrl} depuis ${origin}. Vérifiez que l'appareil qui ` +
    `héberge Ollama est allumé, sur le même réseau, et qu'Ollama y est lancé avec ` +
    `OLLAMA_HOST=0.0.0.0 et OLLAMA_ORIGINS=${origin}. Attention : depuis un site en ` +
    `https, le navigateur bloque les adresses http locales (mixed content) — cette ` +
    `option ne marche que si le Studio est servi en local/http ou Ollama derrière https.`
  );
}

export function getOllamaBaseUrl(): string {
  const stored = localStorage.getItem("aidusia_ollama_url");

  if (!stored) {
    return DEFAULT_OLLAMA_BASE_URL;
  }

  try {
    return normalizeOllamaBaseUrl(stored);
  } catch {
    return DEFAULT_OLLAMA_BASE_URL;
  }
}
const getBaseUrl = getOllamaBaseUrl;

export function setOllamaBaseUrl(input: string): void {
  const normalized = normalizeOllamaBaseUrl(input);

  localStorage.setItem("aidusia_ollama_url", normalized);

  revokeOllamaApproval();
}

async function fetchTags(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/tags`, {
    signal: AbortSignal.timeout(INITIAL_CONNECTION_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw await createOllamaHttpError(response);
  }
  return response.clone().json() as Promise<{ models: { name: string }[] }>;
}

async function createOllamaHttpError(response: Response): Promise<Error> {
  let detail = "";

  try {
    const body = (await response.json()) as { error?: unknown };

    if (typeof body.error === "string") {
      detail = body.error.trim();
    }
  } catch {
    // La réponse peut être vide ou non JSON.
  }

  return new Error(
    `Ollama a répondu ${response.status}${detail ? ` : ${detail}` : ""}`,
  );
}

function processOllamaLine(
  line: string,
  onChunk: (chunk: StreamChunk) => void,
): void {
  const trimmed = line.trim();

  if (!trimmed) return;

  let event: {
    error?: unknown;
    message?: {
      content?: unknown;
      thinking?: unknown;
      tool_calls?: Array<{
        function?: { name?: unknown; arguments?: unknown };
      }>;
    };
  };

  try {
    event = JSON.parse(trimmed);
  } catch {
    throw new Error("Flux Ollama invalide : événement NDJSON non JSON.");
  }

  if (typeof event.error === "string") {
    throw new Error(`Ollama : ${event.error}`);
  }

  if (typeof event.message?.content === "string") {
    onChunk({ type: "text", delta: event.message.content });
  }

  for (const toolCall of event.message?.tool_calls ?? []) {
    const name = toolCall.function?.name;
    const args = toolCall.function?.arguments;

    if (typeof name !== "string" || !name.trim()) {
      throw new Error("Appel d’outil Ollama refusé : nom absent.");
    }

    if (args === null || typeof args !== "object" || Array.isArray(args)) {
      throw new Error(`Appel de l’outil "${name}" refusé : arguments invalides.`);
    }

    onChunk({
      type: "tool_call",
      call: { id: crypto.randomUUID(), name, args },
    });
  }
}

export const ollamaProvider: ChatProvider = {
  id: "ollama",
  label: "Ollama (local)",
  requiresApiKey: false,

  async listModels(): Promise<ProviderModel[]> {
    const baseUrl = getBaseUrl();
    requireOllamaApproval(baseUrl);
    try {
      const data = await fetchTags(baseUrl);
      return data.models.map((model) => ({
        id: model.name,
        label: model.name,
      }));
    } catch (err) {
      if (err instanceof Error && /^Ollama a répondu/.test(err.message)) throw err;
      throw new Error(ollamaUnreachableMessage(baseUrl));
    }
  },

  async testKey(): Promise<KeyTestResult> {
    const baseUrl = getBaseUrl();
    try {
      await fetchTags(baseUrl);
      approveOllama(baseUrl);
      return { ok: true };
    } catch (err) {
      revokeOllamaApproval();
      const raw = err instanceof Error ? err.message : String(err);
      // "Ollama a répondu 4xx" = il tourne mais refuse ; sinon, injoignable.
      return { ok: false, reason: /répondu/.test(raw) ? raw : ollamaUnreachableMessage(baseUrl) };
    }
  },

  async chatStream(
    params: ChatStreamParams,
    _apiKey: string | undefined,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    const baseUrl = getBaseUrl();
    requireOllamaApproval(baseUrl);
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: params.signal,
      body: JSON.stringify(buildOpenAiCompatibleBody(params, true)),
    }).catch((err: unknown) => {
      // "Failed to fetch" brut n'aide personne ; on garde l'abandon volontaire
      // (bouton Arreter) intact pour que useChat le reconnaisse.
      if (err instanceof Error && err.name === "AbortError") throw err;
      throw new Error(ollamaUnreachableMessage(baseUrl));
    });
    if (!response.ok) {
      throw await createOllamaHttpError(response);
    }
    if (!response.body) {
      throw new Error("Réponse Ollama sans corps.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        processOllamaLine(line, onChunk);
      }
    }
    buffer += decoder.decode();

    if (buffer.trim()) {
      processOllamaLine(buffer, onChunk);
    }
  },
};
