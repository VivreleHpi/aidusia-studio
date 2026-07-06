#!/usr/bin/env node
// Bloque en CI toute mention des autres produits AIDUSIA dans ce dépôt public.
// Scanne les sources ET le bundle construit (dist/) — cf. docs/PLAN...  §4.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SELF_PATH = resolve(fileURLToPath(import.meta.url));

const FORBIDDEN_TERMS = [
  "aldus",
  "aldusmania",
  "martine",
  "zenith",
  "littéraire",
  "literary wing",
  "juridique",
  "legal wing",
  "presse wing",
  "press wing",
  "aile littéraire",
  "aile juridique",
  "aile presse",
  "bible narrative",
  "atelier guidé",
  "storyboard",
  "pont noir",
  "imprimerie souveraine",
  "x-aldus",
  "feature_packs",
];

const SCAN_DIRS = ["src", "api", "scripts", "public", "dist"];
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".css", ".html", ".md", ".json",
]);

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (resolve(full) === SELF_PATH) {
      continue;
    } else if (TEXT_EXTENSIONS.has(extname(full))) {
      yield full;
    }
  }
}

let violations = [];

for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const content = readFileSync(file, "utf-8").toLowerCase();
    for (const term of FORBIDDEN_TERMS) {
      if (content.includes(term.toLowerCase())) {
        violations.push(`${file}: terme interdit "${term}"`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("LEAK-SCAN ECHEC — termes interdits detectes:\n");
  for (const v of violations) console.error(`  - ${v}`);
  console.error(
    "\nCe depot public ne doit contenir aucune reference aux autres produits AIDUSIA.",
  );
  process.exit(1);
}

console.log("leak-scan OK — aucun terme interdit detecte.");
