import type { CustomProviderConfig } from "@/providers/custom";

/** One-click presets for local OpenAI-compatible servers (CORS must allow the Studio origin). */
export const LOCAL_OPENAI_PRESETS: Array<
  Pick<CustomProviderConfig, "label" | "baseUrl"> & { id: string; hintFr: string; hintEn: string }
> = [
  {
    id: "lm-studio",
    label: "LM Studio (local)",
    baseUrl: "http://127.0.0.1:1234/v1",
    hintFr: "Serveur OpenAI compatible LM Studio (Local Server).",
    hintEn: "LM Studio OpenAI-compatible local server.",
  },
  {
    id: "ollama-openai",
    label: "Ollama OpenAI API",
    baseUrl: "http://127.0.0.1:11434/v1",
    hintFr: "API /v1 d'Ollama sur votre machine.",
    hintEn: "Ollama /v1 API on your machine.",
  },
  {
    id: "jan-local",
    label: "Jan (local API)",
    baseUrl: "http://127.0.0.1:1337/v1",
    hintFr: "Serveur API local Jan Desktop.",
    hintEn: "Jan Desktop local API server.",
  },
];
