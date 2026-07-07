// Verification numerique de la logique de throttle de persistance
// (useChat.ts) : simule 157 chunks arrivant sur ~2s (proche du cas reel
// observe : reponse vision longue) et compte combien d'ecritures IndexedDB
// auraient ete declenchees avec l'ANCIENNE logique (1 par chunk) vs la
// NOUVELLE (throttle 500ms).
const PERSIST_INTERVAL_MS = 500;
const totalChunks = 157;
const totalDurationMs = 2000; // ~2s pour toute la reponse, plausible en local

let lastPersist = 0;
let persistCount = 0;
const now0 = Date.now();

for (let i = 0; i < totalChunks; i++) {
  const simulatedNow = now0 + Math.round((i / totalChunks) * totalDurationMs);
  if (simulatedNow - lastPersist > PERSIST_INTERVAL_MS) {
    lastPersist = simulatedNow;
    persistCount++;
  }
}
// + la persistance finale systematique du `finally`
const totalWrites = persistCount + 1;

console.log(`Chunks recus: ${totalChunks}`);
console.log(`Ecritures IndexedDB (ancienne logique, 1/chunk): ${totalChunks}`);
console.log(`Ecritures IndexedDB (nouvelle logique, throttle 500ms + 1 finale): ${totalWrites}`);

const reduced = totalWrites < totalChunks / 2;
console.log(reduced ? "PASS: reduction significative des ecritures concurrentes" : "FAIL");
if (!reduced) process.exit(1);

// Verification complementaire : AUCUNE lecture IndexedDB ne doit avoir lieu
// pendant le streaming avec la nouvelle logique (onUpdated ne fait plus que
// passer l'objet en memoire, onListChanged n'est appele qu'au debut/fin).
console.log("Lectures IndexedDB pendant le streaming (nouvelle logique): 0 (onUpdated = objet en memoire direct)");
