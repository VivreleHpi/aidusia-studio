import { createEdgeProxyHandler } from "../_shared/edgeProxy.js";

export const config = { runtime: "edge" };

const MEBIBYTE = 1024 * 1024;

export default createEdgeProxyHandler({
  requestPathPrefix: "/api/ollama-cloud/",
  upstreamBaseUrl: "https://ollama.com/api/",
  secretHeader: "X-Ollama-Key",
  missingSecretMessage: "Clé Ollama Cloud manquante",
  invalidSecretMessage: "Clé Ollama Cloud invalide",
  unreachableMessage: "Ollama Cloud injoignable",
  timeoutMessage: "Délai Ollama Cloud dépassé",
  routes: {
    tags: {
      methods: ["GET"],
      timeoutMs: 15_000,
      maxBodyBytes: 0,
      maxResponseBytes: 2 * MEBIBYTE,
      responseContentTypes: ["application/json"],
    },
    chat: {
      methods: ["POST"],
      timeoutMs: 120_000,
      maxBodyBytes: 12 * MEBIBYTE,
      maxResponseBytes: 32 * MEBIBYTE,
      responseContentTypes: [
        "application/json",
        "application/x-ndjson",
        "application/json-seq",
      ],
    },
  },
});
