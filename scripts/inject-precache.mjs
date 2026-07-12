/* Injecte la liste des assets du build dans dist/sw.js (variable __PRECACHE__).
   Le service worker les precache alors des l'install, pour que le mode
   hors-ligne / avion marche apres UNE seule visite en ligne, sans dependre du
   timing de chargement de la page.

   On precache le shell ("/") + les assets memes-origine, SAUF les gros chunks
   (> LIMIT) : le moteur web-llm (~6 Mo) reste cache a la demande, quand
   l'utilisateur choisit reellement l'IA locale. */

import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = "dist";
const LIMIT = 1_500_000; // 1,5 Mo : au-dela, cache a la demande (lib web-llm)

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
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
  // On evite les cartes de source et les gros chunks (caches a la demande).
  if (rel.endsWith(".map")) continue;
  if (size > LIMIT) continue;
  urls.add("/" + rel);
}

const list = [...urls];
const swPath = join(DIST, "sw.js");
const original = readFileSync(swPath, "utf8");
const banner = `self.__PRECACHE__ = ${JSON.stringify(list)};\n`;
writeFileSync(swPath, banner + original, "utf8");

console.log(`inject-precache : ${list.length} assets precaches dans dist/sw.js`);
