// Smoke test manuel (pas en CI) : le worker/core WASM navigateur
// (dist/worker.min.js + tesseract-core-simd-lstm.wasm.js) ne peut PAS
// s'executer sous Node (bundle specifiquement navigateur, utilise `self`/
// evenements DOM) - seul un vrai navigateur peut le prouver, comme deja note
// pour d'autres gaps de ce plan (S0 CORS navigateur, Playwright).
// Ce script verifie en revanche ce qui EST testable ici : que les fichiers
// de langue auto-heberges (public/tesseract/lang/*.traineddata.gz,
// telecharges une fois depuis jsdelivr puis committes) sont valides et
// exploitables par tesseract.js en mode Node natif (chemin different du
// navigateur, mais qui lit exactement les memes fichiers .traineddata.gz).
import { createWorker } from "tesseract.js";

const worker = await createWorker("eng", 1, {
  langPath: "./public/tesseract/lang",
  cachePath: ".",
});

const { data } = await worker.recognize("./ocr-smoke.png");
console.log("Texte reconnu (image de test trop petite pour etre lisible, peu importe):", JSON.stringify(data.text));
await worker.terminate();
console.log("SMOKE TEST OCR (donnees de langue self-hostees, mode Node): PASS");
console.log("Le worker/core navigateur (public/tesseract/*.wasm*) reste a verifier dans un vrai navigateur.");
