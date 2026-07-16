import { createEdgeProxyHandler } from "../_shared/edgeProxy.js";

export const config = { runtime: "edge" };

const MEBIBYTE = 1024 * 1024;

export default createEdgeProxyHandler({
  requestPathPrefix: "/api/openai/",
  upstreamBaseUrl: "https://api.openai.com/v1/",
  secretHeader: "X-OpenAI-Key",
  missingSecretMessage: "Clé OpenAI manquante",
  invalidSecretMessage: "Clé OpenAI invalide",
  unreachableMessage: "OpenAI injoignable",
  timeoutMessage: "Délai OpenAI dépassé",
  routes: {
    models: {
      methods: ["GET"],
      timeoutMs: 15_000,
      maxBodyBytes: 0,
      maxResponseBytes: 2 * MEBIBYTE,
      responseContentTypes: ["application/json"],
    },
    "chat/completions": {
      methods: ["POST"],
      timeoutMs: 120_000,
      maxBodyBytes: 12 * MEBIBYTE,
      maxResponseBytes: 32 * MEBIBYTE,
      responseContentTypes: ["application/json", "text/event-stream"],
    },
  },
});
