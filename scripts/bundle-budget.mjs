#!/usr/bin/env node
/**
 * Vérifie que le build de production respecte des plafonds de taille (bytes bruts).
 * Échec non nul si un chunk ou le total des entrées index.html dépasse la budget.
 */
import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve("dist");
const INDEX = path.join(DIST, "index.html");

const LIMITS = {
  /** JS/CSS référencés depuis index.html (hors workers lazy) */
  entryTotalBytes: 900_000,
  /** Un seul fichier asset ne doit pas dépasser (onnx / lib) */
  singleAssetBytes: 6_500_000,
  /** Chunks RAG / PDF nommés explicitement */
  ragChunkBytes: 900_000,
  pdfChunkBytes: 500_000,
};

function listEntryAssets(html) {
  const hrefs = [...html.matchAll(/(?:src|href)="(\/?assets\/[^"]+)"/g)].map((m) => m[1]);
  return [...new Set(hrefs.map((h) => h.replace(/^\//, "")))];
}

function sizeOf(rel) {
  const p = path.join(DIST, rel);
  if (!fs.existsSync(p)) return 0;
  return fs.statSync(p).size;
}

function fail(msg) {
  console.error(`bundle-budget: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(INDEX)) {
  fail("dist/index.html introuvable — lancez npm run build");
}

const html = fs.readFileSync(INDEX, "utf8");
const entries = listEntryAssets(html);
let entryTotal = 0;
for (const rel of entries) {
  entryTotal += sizeOf(rel);
}
if (entryTotal > LIMITS.entryTotalBytes) {
  fail(
    `entrées index (${entryTotal} o) > budget ${LIMITS.entryTotalBytes} o — alléger le shell ou ajuster la budget`,
  );
}

const assetsDir = path.join(DIST, "assets");
if (fs.existsSync(assetsDir)) {
  for (const name of fs.readdirSync(assetsDir)) {
    const bytes = fs.statSync(path.join(assetsDir, name)).size;
    if (!name.endsWith(".wasm") && bytes > LIMITS.singleAssetBytes) {
      fail(`${name} (${bytes} o) > plafond fichier ${LIMITS.singleAssetBytes} o`);
    }
    if (/transformers|xenova|rag/i.test(name) && bytes > LIMITS.ragChunkBytes) {
      fail(`chunk RAG ${name} (${bytes} o) > ${LIMITS.ragChunkBytes} o`);
    }
    if (/pdfjs-/i.test(name) && bytes > LIMITS.pdfChunkBytes) {
      fail(`chunk PDF ${name} (${bytes} o) > ${LIMITS.pdfChunkBytes} o`);
    }
  }
}

console.log(
  `bundle-budget: OK — entrées index ${entryTotal.toLocaleString("fr-FR")} o, ${entries.length} fichiers`,
);
