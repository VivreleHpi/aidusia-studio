#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { discoverAllSources } from "./sources.mjs";
import { formatSummaryMarkdown, hasCatalogChanges, mergeCatalog } from "./merge.mjs";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const catalogPath = path.join(root, "src/data/local-ai-catalog.json");
const summaryPath = path.join(root, "scripts/sync-local-ai-catalog/last-summary.md");

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  return {
    write: argv.includes("--write"),
    check: argv.includes("--check"),
    dryRun: argv.includes("--dry-run"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = readFileSync(catalogPath, "utf8");
  const catalog = JSON.parse(raw);

  let discovered;
  if (args.dryRun) {
    discovered = [];
  } else {
    try {
      discovered = await discoverAllSources();
    } catch (err) {
      console.error("[sync-local-ai-catalog] Échec des sources publiques (aucune écriture) :");
      console.error(err instanceof Error ? err.message : err);
      process.exit(2);
    }
  }

  const { catalog: merged, summary } = mergeCatalog(catalog, discovered);
  const markdown = formatSummaryMarkdown(summary);

  writeFileSync(summaryPath, markdown, "utf8");
  console.log(markdown);

  if (!hasCatalogChanges(summary)) {
    console.log("\nAucun changement catalogue.");
    process.exit(0);
  }

  if (args.check) {
    console.error("\nLe catalogue diverge des sources (relancer avec --write).");
    process.exit(1);
  }

  if (!args.write) {
    console.log("\nMode aperçu : aucune écriture (utiliser --write pour appliquer).");
    process.exit(0);
  }

  writeFileSync(catalogPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  try {
    execFileSync("node", [path.join(root, "scripts/validate-local-ai-catalog.mjs")], {
      stdio: "inherit",
      cwd: root,
    });
  } catch {
    console.error("[sync-local-ai-catalog] Validation échouée — fichier laissé modifié pour inspection.");
    process.exit(1);
  }

  console.log("\nCatalogue mis à jour et validé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
