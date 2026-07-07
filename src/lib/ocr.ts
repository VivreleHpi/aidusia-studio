import { createWorker } from "tesseract.js";

// OCR 100% local (WASM, tesseract.js) : aucune image n'est jamais envoyee a
// un serveur. Tous les fichiers (worker, moteur WASM, donnees de langue)
// sont auto-heberges dans public/tesseract - jamais de CDN (CSP stricte,
// script-src 'self'). Voir README.
const WORKER_PATH = "/tesseract/worker.min.js";
const CORE_PATH = "/tesseract/tesseract-core-simd-lstm.wasm.js";
const LANG_PATH = "/tesseract/lang";

export type OcrLanguage = "fra" | "eng";

export async function extractTextFromImage(
  file: Blob,
  lang: OcrLanguage = "fra",
  onProgress?: (progress: number) => void,
): Promise<string> {
  const worker = await createWorker(lang, 1, {
    workerPath: WORKER_PATH,
    corePath: CORE_PATH,
    langPath: LANG_PATH,
    logger: onProgress
      ? (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") onProgress(m.progress);
        }
      : undefined,
  });
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return text.trim();
  } finally {
    await worker.terminate();
  }
}
