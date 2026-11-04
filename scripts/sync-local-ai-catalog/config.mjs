/** @typedef {{ library: string, tag: string, id?: string }} OllamaWatch */

/**
 * Default sync policy: sources to query and how aggressively to add entries.
 * @type {{
 *   protectedFields: string[],
 *   webllm: { enabled: boolean, autoAddInstructQ4f16: boolean, maxParametersB: number },
 *   ollama: { enabled: boolean, watch: OllamaWatch[] },
 *   huggingfaceGguf: { enabled: boolean, watchRepos: string[] },
 * }}
 */
export const defaultSyncConfig = {
  /** Never overwritten on existing entries (manual / editorial). */
  protectedFields: ["name", "vramGbMin", "ramGbMin", "compatibility", "capabilities", "id"],
  webllm: {
    enabled: true,
    /** When false, only refresh entries already present in the JSON (matched by modelId). */
    autoAddInstructQ4f16: false,
    maxParametersB: 3,
    /** Optional explicit model_id list to auto-add when autoAddInstructQ4f16 is true. */
    autoAddModelIds: [],
  },
  ollama: {
    enabled: true,
    watch: [
      { library: "llama3.2", tag: "3b", id: "ollama-llama3.2-3b" },
      { library: "mistral", tag: "7b", id: "ollama-mistral-7b" },
    ],
  },
  huggingfaceGguf: {
    enabled: true,
    watchRepos: ["OpenLLM-France/Luciole-1B-Instruct-1.1-GGUF"],
  },
};
