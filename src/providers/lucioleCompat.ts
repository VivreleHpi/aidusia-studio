import wasm from "@wllama/wllama-compat/wasm/wllama.wasm?url";
import workerCode from "@wllama/wllama-compat/wasm/wllama.js?raw";

// Auto-hébergé pour que Safari puisse fonctionner sans charger de code depuis
// un CDN tiers, y compris une fois le modèle mis en cache hors connexion.
export const compatResources = { wasm, worker: { code: workerCode } };
