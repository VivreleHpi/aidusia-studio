import { missingKeyError } from "./types";
import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";
import { buildOpenAiCompatibleBody, readOpenAiCompatibleStream } from "./openaiCompatibleStream";

/* Fournisseurs personnalisés « compatibles OpenAI » : l'utilisateur fournit un
   nom, une URL de base (ex. https://api.z.ai/api/paas/v4) et sa clé — de quoi
   brancher z.ai, DeepSeek, Together, Fireworks, LM Studio local, etc. sans
   attendre une intégration dédiée. L'appel part directement du navigateur,
   comme Groq/Mistral : le service doit donc autoriser le CORS ; aucun proxy
   n'est ajouté. La config (nom + URL) vit dans localStorage, la clé suit le
   régime commun de src/lib/apiKeys.ts (session par défaut). */

export const CUSTOM_PROVIDER_PREFIX = "custom-";
const STORAGE_KEY = "aidusia_custom_providers";
const MAX_CUSTOM_PROVIDERS = 20;
const MAX_LABEL_LENGTH = 40;
const MAX_URL_LENGTH = 2048;

export interface CustomProviderConfig {
  id: string;
  label: string;
  baseUrl: string;
}

export function isCustomProviderId(id: string): boolean {
  return id.startsWith(CUSTOM_PROVIDER_PREFIX);
}

// Même règle que les serveurs MCP : http toléré uniquement sur la boucle
// locale (LM Studio, llamafile…), https exigé partout ailleurs.
function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    /^127(\.\d{1,3}){3}$/.test(hostname)
  );
}

export function normalizeCustomBaseUrl(input: string): string {
  const raw = input.trim();
  if (!raw || raw.length > MAX_URL_LENGTH) throw new Error("INVALID_URL");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("INVALID_URL");
  }
  if (url.username || url.password) throw new Error("INVALID_URL");
  const httpsOk = url.protocol === "https:";
  const localHttpOk = url.protocol === "http:" && isLoopbackHost(url.hostname);
  if (!httpsOk && !localHttpOk) throw new Error("INVALID_URL");
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/+$/, "");
}

export function isValidCustomProviderConfig(value: unknown): value is CustomProviderConfig {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || !v.id.startsWith(CUSTOM_PROVIDER_PREFIX) || v.id.length > 80) {
    return false;
  }
  if (typeof v.label !== "string" || v.label.trim().length === 0 || v.label.length > MAX_LABEL_LENGTH) {
    return false;
  }
  if (typeof v.baseUrl !== "string") return false;
  try {
    normalizeCustomBaseUrl(v.baseUrl);
  } catch {
    return false;
  }
  return true;
}

export function listCustomProviderConfigs(): CustomProviderConfig[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidCustomProviderConfig).slice(0, MAX_CUSTOM_PROVIDERS);
  } catch {
    return [];
  }
}

function saveConfigs(configs: CustomProviderConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

export function addCustomProvider(label: string, baseUrl: string): CustomProviderConfig {
  const trimmed = label.trim();
  if (!trimmed || trimmed.length > MAX_LABEL_LENGTH) throw new Error("INVALID_LABEL");
  const configs = listCustomProviderConfigs();
  if (configs.length >= MAX_CUSTOM_PROVIDERS) throw new Error("TOO_MANY_PROVIDERS");
  const config: CustomProviderConfig = {
    id: CUSTOM_PROVIDER_PREFIX + crypto.randomUUID(),
    label: trimmed,
    baseUrl: normalizeCustomBaseUrl(baseUrl),
  };
  saveConfigs([...configs, config]);
  return config;
}

// Import de réglages : réinsère une config exportée (écrase par id, sans
// jamais dépasser la limite). Une config invalide est ignorée silencieusement
// plutôt que de faire échouer tout l'import.
export function restoreCustomProvider(config: CustomProviderConfig): void {
  if (!isValidCustomProviderConfig(config)) return;
  const others = listCustomProviderConfigs().filter((c) => c.id !== config.id);
  saveConfigs(
    [...others, { id: config.id, label: config.label.trim(), baseUrl: normalizeCustomBaseUrl(config.baseUrl) }].slice(
      0,
      MAX_CUSTOM_PROVIDERS,
    ),
  );
}

export function removeCustomProvider(id: string): void {
  saveConfigs(listCustomProviderConfigs().filter((c) => c.id !== id));
}

interface OpenAiModelList {
  data?: { id?: unknown }[];
}

export function createCustomProvider(config: CustomProviderConfig): ChatProvider {
  const base = config.baseUrl;
  return {
    id: config.id,
    label: config.label,
    requiresApiKey: true,

    // GET /models : seuls les modèles réellement accessibles avec cette clé
    // apparaissent (même approche que groq.ts). Un service qui n'expose pas
    // /models renverra une erreur claire plutôt qu'une liste inventée.
    async listModels(apiKey?: string): Promise<ProviderModel[]> {
      if (!apiKey) return [];
      const response = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Clé ${config.label} invalide ou expirée — vérifiez-la dans le panneau Fournisseurs.`);
      }
      if (!response.ok) throw new Error(`${config.label} a répondu ${response.status}`);
      const data = (await response.json()) as OpenAiModelList;
      if (!Array.isArray(data.data)) return [];
      return data.data
        .filter((m): m is { id: string } => typeof m?.id === "string")
        .map((m) => ({ id: m.id, label: m.id }));
    },

    async testKey(apiKey: string): Promise<KeyTestResult> {
      const response = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: "Clé invalide ou expirée — recopiez-la depuis la console du fournisseur." };
      }
      if (response.status === 429) {
        return { ok: false, reason: "Quota atteint (429) — la clé est valide, réessayez dans quelques instants." };
      }
      if (!response.ok) return { ok: false, reason: `${config.label} a répondu ${response.status}` };
      return { ok: true };
    },

    async chatStream(
      params: ChatStreamParams,
      apiKey: string | undefined,
      onChunk: (chunk: StreamChunk) => void,
    ): Promise<void> {
      if (!apiKey) throw missingKeyError(config.label);
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: params.signal,
        body: JSON.stringify(buildOpenAiCompatibleBody(params)),
      });
      if (!response.ok || !response.body) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Clé ${config.label} invalide ou expirée — vérifiez-la dans le panneau Fournisseurs.`);
        }
        if (response.status === 429) {
          throw new Error(`Quota ${config.label} atteint (429) — réessayez dans quelques instants.`);
        }
        const body = await response.text().catch(() => "");
        throw new Error(`${config.label} a répondu ${response.status}: ${body}`);
      }
      await readOpenAiCompatibleStream(response, onChunk);
    },
  };
}
