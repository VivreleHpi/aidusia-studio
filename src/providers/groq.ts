import type { ChatProvider, ChatStreamParams, KeyTestResult, ProviderModel, StreamChunk } from "./types";
import { buildOpenAiCompatibleBody, readOpenAiCompatibleStream } from "./openaiCompatibleStream";

// API compatible OpenAI. Contrairement a OpenAI et Ollama Cloud, Groq renvoie
// un header Access-Control-Allow-Origin: * sur la vraie reponse (verifie
// empiriquement, pas seulement sur le preflight OPTIONS) : appel direct
// navigateur -> fournisseur, sans proxy.
const API_BASE = "https://api.groq.com/openai/v1";

// Modeles audio/moderation exposes par la meme API mais qui ne repondent pas
// a /chat/completions comme un modele de conversation classique.
const NON_CHAT_PATTERNS = ["whisper", "tts", "guard"];

interface GroqModel {
  id: string;
}

export const groqProvider: ChatProvider = {
  id: "groq",
  label: "Groq",
  requiresApiKey: true,

  // Vrai appel GET /v1/models : seuls les modeles reellement accessibles
  // avec cette cle apparaissent.
  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    if (!apiKey) return [];
    const response = await fetch(`${API_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error(`Groq a repondu ${response.status}`);
    const data = (await response.json()) as { data: GroqModel[] };
    return data.data
      .filter((m) => !NON_CHAT_PATTERNS.some((p) => m.id.toLowerCase().includes(p)))
      .map((m) => ({ id: m.id, label: m.id }));
  },

  async testKey(apiKey: string): Promise<KeyTestResult> {
    const response = await fetch(`${API_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.status === 401) return { ok: false, reason: "Cle invalide" };
    if (!response.ok) return { ok: false, reason: `Erreur ${response.status}` };
    return { ok: true };
  },

  async chatStream(
    params: ChatStreamParams,
    apiKey: string | undefined,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    if (!apiKey) throw new Error("Cle API Groq manquante");
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: params.signal,
      body: JSON.stringify(buildOpenAiCompatibleBody(params)),
    });
    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => "");
      throw new Error(`Groq a repondu ${response.status}: ${body}`);
    }
    await readOpenAiCompatibleStream(response, onChunk);
  },
};
