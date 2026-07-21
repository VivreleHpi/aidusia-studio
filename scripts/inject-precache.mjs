/* Injecte la liste des assets du build dans dist/sw.js (variable __PRECACHE__).
   Le service worker les precache alors des l'install, pour que le mode
   hors-ligne / avion marche apres UNE seule visite en ligne, sans dependre du
   timing de chargement de la page.

   On precache le shell ("/") + les assets memes-origine, SAUF :
   - les gros chunks (> LIMIT), dont le moteur web-llm (~6 Mo) ;
   - le runtime OCR Tesseract, dont les fichiers doivent rester un ensemble
     coherent et sont caches a la demande au premier OCR.
   Ces fonctions optionnelles ne consomment donc pas de bande passante tant
   que l'utilisateur ne les lance pas. */

import { createHash } from "node:crypto";
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = "dist";
const LIMIT = 1_500_000; // 1,5 Mo : au-dela, cache a la demande (lib web-llm)

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push({ full, size: st.size });
  }
  return out;
}

const files = walk(DIST);
const urls = new Set(["/"]); // le shell (index.html)

for (const { full, size } of files) {
  const rel = relative(DIST, full).split("\\").join("/");
  // sw.js ne se precache pas lui-meme ; index.html est deja couvert par "/".
  if (rel === "sw.js" || rel === "index.html") continue;
  // Tesseract charge plusieurs fichiers solidaires (worker, WASM et langue),
  // dont certains depassent LIMIT. N'en precacher qu'une partie alourdit
  // l'installation sans rendre l'OCR utilisable hors ligne. Le service worker
  // les met tous en cache au fil de leur premiere utilisation en ligne.
  if (rel.startsWith("tesseract/")) continue;
  // On evite les cartes de source et les gros chunks (caches a la demande).
  if (rel.endsWith(".map")) continue;
  if (size > LIMIT) continue;
  urls.add("/" + rel);
}

const list = [...urls];
const swPath = join(DIST, "sw.js");
// Retirer une eventuelle injection precedente rend le script idempotent (utile
// pour les builds locaux et les pipelines qui rejouent cette etape).
const original = readFileSync(swPath, "utf8").replace(
  /^(?:self\.__CACHE_VERSION__ = .*;\r?\n)?self\.__PRECACHE__ = .*;\r?\n/,
  "",
);
// La revision depend de tout le build, y compris des gros chunks charges a la
// demande et du service worker lui-meme. Deux builds identiques reutilisent le
// meme cache ; tout changement de contenu cree un cache distinct.
const revision = createHash("sha256");
for (const { full } of files) {
  const rel = relative(DIST, full).split("\\").join("/");
  if (rel.endsWith(".map")) continue;
  revision.update(rel);
  revision.update("\0");
  revision.update(rel === "sw.js" ? original : readFileSync(full));
  revision.update("\0");
}
const cacheVersion = revision.digest("hex").slice(0, 16);
const banner = `self.__CACHE_VERSION__ = ${JSON.stringify(cacheVersion)};\nself.__PRECACHE__ = ${JSON.stringify(list)};\n`;
writeFileSync(swPath, banner + original, "utf8");

console.log(
  `inject-precache : ${list.length} assets precaches dans dist/sw.js (cache ${cacheVersion})`,
);
