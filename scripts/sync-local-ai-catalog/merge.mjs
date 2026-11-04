import { defaultSyncConfig } from "./config.mjs";

/** @typedef {import('./sources.mjs').DiscoveredModel} DiscoveredModel */

/**
 * @param {string} text
 */
export function slugifyId(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * @param {string} modelId
 */
export function estimateParametersB(modelId) {
  const m = modelId.match(/(\d+(?:\.\d+)?)\s*[bB]/);
  if (m) return Number(m[1]);
  const m2 = modelId.match(/-(\d+(?:\.\d+)?)B-/i);
  if (m2) return Number(m2[1]);
  return 1;
}

/**
 * @param {number} parametersB
 */
export function defaultMobileCompatibility(parametersB) {
  if (parametersB <= 1.2) return "ok_light";
  if (parametersB <= 2) return "ok";
  if (parametersB <= 3) return "heavy";
  return "desktop_only";
}

/**
 * @param {{ f16?: number, f32?: number }} sizeGb
 */
export function defaultRamVram(sizeGb) {
  const base = sizeGb.f16 ?? sizeGb.f32 ?? 2;
  const vramGbMin = Math.max(2, Math.ceil(base * 2));
  const ramGbMin = Math.max(4, Math.ceil(base * 4));
  return { vramGbMin, ramGbMin };
}

const DISCOVERY_META_KEYS = new Set([
  "suggestedId",
  "source",
  "sourceVersion",
  "observedAt",
  "allowAutoAdd",
]);

/**
 * @param {import('./sources.mjs').DiscoveredModel} discovered
 */
export function syncPatchFromDiscovery(discovered) {
  /** @type {Record<string, unknown>} */
  const patch = {};
  for (const [key, value] of Object.entries(discovered)) {
    if (DISCOVERY_META_KEYS.has(key)) continue;
    if (value === undefined) continue;
    patch[key] = value;
  }
  return patch;
}

/**
 * @param {Record<string, unknown>} entry
 * @param {import('./sources.mjs').DiscoveredModel} discovered
 * @param {string[]} protectedFields
 */
export function mergeDiscoveredIntoEntry(entry, discovered, protectedFields) {
  const out = { ...entry };
  const syncMeta = /** @type {Record<string, unknown>} */ (out.sync ?? {});
  syncMeta.lastSyncedAt = discovered.observedAt;
  syncMeta.source = discovered.source;
  if (discovered.sourceVersion) syncMeta.sourceVersion = discovered.sourceVersion;
  out.sync = syncMeta;

  const patch = syncPatchFromDiscovery(discovered);
  for (const [key, value] of Object.entries(patch)) {
    if (protectedFields.includes(key)) continue;
    if (key === "sync") continue;
    out[key] = value;
  }

  return out;
}

/**
 * @param {DiscoveredModel} discovered
 * @param {string[]} protectedFields
 */
export function entryFromDiscovered(discovered, protectedFields) {
  /** @type {Record<string, unknown>} */
  const base = {
    id: discovered.suggestedId,
    runtime: discovered.runtime,
    providerId: discovered.providerId,
    modelId: discovered.modelId,
    name: discovered.name,
    family: discovered.family,
    parametersB: discovered.parametersB,
    quantization: discovered.quantization,
    sizeGb: discovered.sizeGb,
    contextTokens: discovered.contextTokens ?? 8192,
    license: discovered.license ?? "unknown",
    capabilities: discovered.capabilities ?? ["chat"],
    releasedAt: discovered.releasedAt ?? discovered.observedAt.slice(0, 10),
    compatibility: discovered.compatibility,
    sync: {
      lastSyncedAt: discovered.observedAt,
      source: discovered.source,
      sourceVersion: discovered.sourceVersion ?? null,
      autoCreated: true,
    },
  };

  const { vramGbMin, ramGbMin } = defaultRamVram(discovered.sizeGb);
  base.vramGbMin = vramGbMin;
  base.ramGbMin = ramGbMin;

  for (const key of protectedFields) {
    if (key === "id" || key === "name") continue;
  }

  return base;
}

/**
 * @param {Record<string, unknown>} before
 * @param {Record<string, unknown>} after
 */
export function catalogEntryChanged(before, after) {
  return JSON.stringify(stripSyncMeta(before)) !== JSON.stringify(stripSyncMeta(after));
}

/**
 * @param {Record<string, unknown>} entry
 */
function stripSyncMeta(entry) {
  const { sync: _sync, ...rest } = entry;
  return rest;
}

/**
 * @param {Record<string, unknown>} catalog
 * @param {DiscoveredModel[]} discoveredList
 * @param {Partial<typeof defaultSyncConfig>} [config]
 */
export function mergeCatalog(catalog, discoveredList, config = {}) {
  const cfg = {
    ...defaultSyncConfig,
    ...config,
    protectedFields: config.protectedFields ?? defaultSyncConfig.protectedFields,
  };

  const observedAt = new Date().toISOString();
  /** @type {Record<string, unknown>[]} */
  const entries = [...(catalog.entries ?? [])];
  const byModelKey = new Map(
    entries.map((e) => [`${e.providerId}:${e.modelId}`, e]),
  );
  const byId = new Map(entries.map((e) => [String(e.id), e]));

  /** @type {{ added: string[], updated: string[], unchanged: string[] }} */
  const summary = { added: [], updated: [], unchanged: [] };

  for (const raw of discoveredList) {
    const discovered = { ...raw, observedAt: raw.observedAt ?? observedAt };
    const key = `${discovered.providerId}:${discovered.modelId}`;
    const existing = byModelKey.get(key) ?? (discovered.suggestedId ? byId.get(discovered.suggestedId) : undefined);

    if (existing) {
      const merged = mergeDiscoveredIntoEntry(existing, discovered, cfg.protectedFields);
      const changed = catalogEntryChanged(existing, merged);
      if (changed) {
        const idx = entries.findIndex((e) => e.id === existing.id);
        if (idx >= 0) entries[idx] = merged;
        byModelKey.set(key, merged);
        summary.updated.push(String(existing.id));
      } else {
        summary.unchanged.push(String(existing.id));
      }
      continue;
    }

    if (!discovered.allowAutoAdd) continue;

    const created = entryFromDiscovered(discovered, cfg.protectedFields);
    if (byId.has(String(created.id))) {
      summary.unchanged.push(String(created.id));
      continue;
    }
    entries.push(created);
    byModelKey.set(key, created);
    byId.set(String(created.id), created);
    summary.added.push(String(created.id));
  }

  const next = {
    ...catalog,
    entries,
  };

  if (hasCatalogChanges(summary)) {
    next.updatedAt = observedAt.slice(0, 10);
    next.catalogVersion = observedAt.slice(0, 10);
  }

  return { catalog: next, summary };
}

/**
 * @param {{ added: string[], updated: string[], unchanged: string[] }} summary
 */
export function formatSummaryMarkdown(summary) {
  const lines = ["## Sync catalogue IA locales", ""];
  if (summary.added.length) {
    lines.push("### Ajouts", ...summary.added.map((id) => `- \`${id}\``), "");
  } else {
    lines.push("### Ajouts", "_Aucun_", "");
  }
  if (summary.updated.length) {
    lines.push("### Mises à jour", ...summary.updated.map((id) => `- \`${id}\``), "");
  } else {
    lines.push("### Mises à jour", "_Aucune_", "");
  }
  lines.push(
    "### Inchangé",
    summary.unchanged.length ? summary.unchanged.map((id) => `- \`${id}\``).join("\n") : "_Tout le reste_",
  );
  return lines.join("\n");
}

export function hasCatalogChanges(summary) {
  return summary.added.length > 0 || summary.updated.length > 0;
}

