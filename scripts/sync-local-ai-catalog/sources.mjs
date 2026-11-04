import { fetchJson } from "./fetch.mjs";
import { defaultSyncConfig } from "./config.mjs";
import { defaultMobileCompatibility, estimateParametersB, slugifyId } from "./merge.mjs";

/**
 * @typedef {{
 *   suggestedId: string,
 *   runtime: 'webllm' | 'wllama' | 'ollama',
 *   providerId: string,
 *   modelId: string,
 *   name: { fr: string, en: string },
 *   family: string,
 *   parametersB: number,
 *   quantization: string,
 *   sizeGb: { f16: number, f32: number },
 *   contextTokens?: number,
 *   license?: string,
 *   capabilities?: string[],
 *   releasedAt?: string,
 *   compatibility: Record<string, unknown>,
 *   source: string,
 *   sourceVersion?: string,
 *   observedAt?: string,
 *   allowAutoAdd: boolean,
 * }} DiscoveredModel
 */

/**
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   config?: typeof defaultSyncConfig,
 * }} [options]
 * @returns {Promise<DiscoveredModel[]>}
 */
export async function discoverWebllmModels(options = {}) {
  const cfg = options.config ?? defaultSyncConfig;
  if (!cfg.webllm.enabled) return [];

  const { prebuiltAppConfig } = await import("@mlc-ai/web-llm");
  const list = prebuiltAppConfig.model_list ?? [];
  const ids = new Set(list.map((m) => m.model_id));

  /** @type {DiscoveredModel[]} */
  const out = [];

  for (const item of list) {
    const modelId = item.model_id;
    if (!/-Instruct-q4f16_1-MLC$/.test(modelId)) continue;

    const parametersB = estimateParametersB(modelId);
    const f32Id = modelId.replace("q4f16_1", "q4f32_1");
    const hasF32 = ids.has(f32Id);

    const sizeGb = estimateWebllmSizes(parametersB, hasF32);
    const family = familyFromModelId(modelId);
    const display = displayNameFromModelId(modelId);

    out.push({
      suggestedId: `browser-${slugifyId(display)}`,
      runtime: "webllm",
      providerId: "browser",
      modelId,
      name: {
        fr: `${display} (WebGPU)`,
        en: `${display} (WebGPU)`,
      },
      family,
      parametersB,
      quantization: "q4f16_1 / q4f32_1",
      sizeGb,
      license: inferLicense(family),
      compatibility: {
        webgpu: true,
        ollamaTag: null,
        mobile: defaultMobileCompatibility(parametersB),
      },
      source: "webllm-prebuilt",
      sourceVersion: modelId,
      allowAutoAdd:
        cfg.webllm.autoAddInstructQ4f16 &&
        parametersB <= cfg.webllm.maxParametersB &&
        cfg.webllm.autoAddModelIds.includes(modelId),
    });
  }

  return out;
}

/**
 * @param {number} parametersB
 * @param {boolean} hasF32Pair
 */
function estimateWebllmSizes(parametersB, hasF32Pair) {
  const known = {
    1: { f16: 0.7, f32: 1.1 },
    1.5: { f16: 1.0, f32: 1.5 },
    2: { f16: 1.4, f32: 2.0 },
  };
  const key = Object.keys(known).find((k) => Math.abs(Number(k) - parametersB) < 0.25);
  if (key) return known[/** @type {'1'|'1.5'|'2'} */ (key)];
  const f32 = hasF32Pair ? parametersB * 0.75 : parametersB * 1.1;
  const f16 = f32 * 0.65;
  return { f16: round1(f16), f32: round1(f32) };
}

/**
 * @param {string} modelId
 */
function familyFromModelId(modelId) {
  if (/llama/i.test(modelId)) return "Llama";
  if (/qwen/i.test(modelId)) return "Qwen";
  if (/gemma/i.test(modelId)) return "Gemma";
  if (/phi/i.test(modelId)) return "Phi";
  return "Local";
}

/**
 * @param {string} modelId
 */
function displayNameFromModelId(modelId) {
  const base = modelId.replace(/-q4f16_1-MLC$/i, "").replace(/-Instruct$/i, "");
  return base.replace(/-/g, " ");
}

/**
 * @param {string} family
 */
function inferLicense(family) {
  if (/llama/i.test(family)) return "Llama Community";
  if (/gemma/i.test(family)) return "Gemma";
  return "Apache-2.0";
}

/**
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   config?: typeof defaultSyncConfig,
 * }} [options]
 */
export async function discoverOllamaModels(options = {}) {
  const cfg = options.config ?? defaultSyncConfig;
  if (!cfg.ollama.enabled) return [];

  const fetchImpl = options.fetchImpl;
  /** @type {DiscoveredModel[]} */
  const out = [];

  for (const watch of cfg.ollama.watch) {
    const tagsUrl = `https://ollama.com/library/${encodeURIComponent(watch.library)}/tags`;
    const tagsPayload = await fetchJson(tagsUrl, { fetchImpl });
    const tags = tagsPayload.tags ?? tagsPayload;
    if (!Array.isArray(tags) || !tags.includes(watch.tag)) {
      throw new Error(`Ollama tag ${watch.library}:${watch.tag} introuvable dans la bibliothèque publique`);
    }

    const manifestUrl = `https://ollama.com/v2/library/${encodeURIComponent(watch.library)}/manifests/${encodeURIComponent(watch.tag)}`;
    const manifest = await fetchJson(manifestUrl, { fetchImpl });
    const sizeBytes = sumManifestLayers(manifest);
    const sizeGb = round1(sizeBytes / 1e9);

    const modelId = `${watch.library}:${watch.tag}`;
    const parametersB = estimateParametersB(watch.library + watch.tag);
    const family = familyFromModelId(watch.library);

    out.push({
      suggestedId: watch.id ?? `ollama-${slugifyId(watch.library)}-${slugifyId(watch.tag)}`,
      runtime: "ollama",
      providerId: "ollama",
      modelId,
      name: {
        fr: `${capitalize(watch.library)} ${watch.tag} (Ollama)`,
        en: `${capitalize(watch.library)} ${watch.tag} (Ollama)`,
      },
      family,
      parametersB,
      quantization: "Q4_K_M (typique)",
      sizeGb: { f16: sizeGb, f32: sizeGb },
      compatibility: {
        webgpu: false,
        ollamaTag: modelId,
        mobile: "desktop_only",
      },
      source: "ollama-library",
      sourceVersion: manifest.config?.digest ?? watch.tag,
      allowAutoAdd: false,
    });
  }

  return out;
}

/**
 * @param {{ layers?: { size?: number }[] }} manifest
 */
function sumManifestLayers(manifest) {
  return (manifest.layers ?? []).reduce((acc, layer) => acc + (layer.size ?? 0), 0);
}

/**
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   config?: typeof defaultSyncConfig,
 * }} [options]
 */
export async function discoverHuggingfaceGguf(options = {}) {
  const cfg = options.config ?? defaultSyncConfig;
  if (!cfg.huggingfaceGguf.enabled) return [];

  const fetchImpl = options.fetchImpl;
  /** @type {DiscoveredModel[]} */
  const out = [];

  for (const repo of cfg.huggingfaceGguf.watchRepos) {
    const apiUrl = `https://huggingface.co/api/models/${repo}`;
    const meta = await fetchJson(apiUrl, { fetchImpl });
    const filesUrl = `https://huggingface.co/api/models/${repo}/tree/main?recursive=1`;
    let files = [];
    try {
      files = await fetchJson(filesUrl, { fetchImpl });
    } catch {
      files = [];
    }

    const gguf = pickPrimaryGguf(files);
    const sizeGb = gguf ? round1(gguf.size / 1e9) : 1;
    const quant = gguf?.path.match(/Q4_K_M|Q4_0|q4f16/i)?.[0] ?? "GGUF";

    const modelId = gguf ? `${repo}:${quant}` : `${repo}:Q4_K_M`;
    const parametersB = estimateParametersB(repo);

    out.push({
      suggestedId: repo.includes("Luciole") ? "luciole-1b" : `gguf-${slugifyId(repo)}`,
      runtime: "wllama",
      providerId: "luciole",
      modelId,
      name: {
        fr: `${shortRepoName(repo)} (GGUF)`,
        en: `${shortRepoName(repo)} (GGUF)`,
      },
      family: shortRepoName(repo),
      parametersB,
      quantization: quant,
      sizeGb: { f16: sizeGb, f32: sizeGb },
      license: meta.cardData?.license ?? meta.license ?? "Apache-2.0",
      releasedAt: meta.createdAt?.slice(0, 10),
      compatibility: {
        webgpu: "optional",
        ollamaTag: null,
        mobile: defaultMobileCompatibility(parametersB),
      },
      source: "huggingface-api",
      sourceVersion: gguf?.oid ?? meta.sha ?? repo,
      allowAutoAdd: false,
    });
  }

  return out;
}

/**
 * @param {{ path?: string, size?: number, oid?: string }[]} files
 */
function pickPrimaryGguf(files) {
  const ggufs = files.filter((f) => f.path?.endsWith(".gguf"));
  const preferred = ggufs.find((f) => /Q4_K_M/i.test(f.path ?? ""));
  return preferred ?? ggufs[0];
}

/**
 * @param {string} repo
 */
function shortRepoName(repo) {
  const part = repo.split("/").pop() ?? repo;
  return part.replace(/-GGUF$/i, "").replace(/-/g, " ");
}

/**
 * @param {string} s
 */
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * @param {number} n
 */
function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   config?: typeof defaultSyncConfig,
 * }} [options]
 */
export async function discoverAllSources(options = {}) {
  const batches = await Promise.all([
    discoverWebllmModels(options),
    discoverOllamaModels(options),
    discoverHuggingfaceGguf(options),
  ]);
  return batches.flat();
}
