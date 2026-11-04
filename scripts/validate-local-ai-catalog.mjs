import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const raw = readFileSync(path.join(root, "src/data/local-ai-catalog.json"), "utf8");
const data = JSON.parse(raw);

const errors = [];

if (data.schemaVersion !== 1) errors.push("schemaVersion must be 1");
if (!data.catalogVersion || !data.updatedAt) errors.push("catalogVersion and updatedAt required");
if (!Array.isArray(data.entries) || data.entries.length === 0) errors.push("entries must be a non-empty array");

const ids = new Set();
for (const [index, entry] of (data.entries ?? []).entries()) {
  const p = `entries[${index}]`;
  for (const key of ["id", "runtime", "providerId", "modelId", "family", "license"]) {
    if (!entry[key]) errors.push(`${p}.${key} missing`);
  }
  if (entry.id) {
    if (ids.has(entry.id)) errors.push(`duplicate id ${entry.id}`);
    ids.add(entry.id);
  }
  if (!entry.name?.fr || !entry.name?.en) errors.push(`${p}.name.fr/en required`);
  if (!entry.sizeGb || typeof entry.sizeGb.f16 !== "number") errors.push(`${p}.sizeGb.f16 required`);
}

if (errors.length) {
  console.error("Invalid local-ai-catalog.json:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}

console.log(`OK — ${data.entries.length} entries (${data.catalogVersion})`);
