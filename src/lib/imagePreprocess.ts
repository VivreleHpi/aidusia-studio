// Pretraitement d'image avant OCR. Sans lui, tesseract degrade fortement sur
// une PHOTO (contraste faible, eclairage inegal, texte petit) meme si le
// pipeline lui-meme fonctionne parfaitement - c'est la cause la plus probable
// d'un texte extrait illisible. Toutes les etapes tournent en Canvas 2D,
// 100% dans le navigateur, aucune donnee ne sort jamais.
const MIN_TARGET_WIDTH = 1600;

async function decodeToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width < MIN_TARGET_WIDTH ? MIN_TARGET_WIDTH / bitmap.width : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexte canvas 2D indisponible");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

function toGrayscale(imageData: ImageData): Float32Array {
  const gray = new Float32Array(imageData.width * imageData.height);
  const { data } = imageData;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // luminance ponderee (perception humaine), plus fiable qu'une simple moyenne
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

function stretchContrast(gray: Float32Array): void {
  let min = 255;
  let max = 0;
  for (const v of gray) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  for (let i = 0; i < gray.length; i++) {
    gray[i] = ((gray[i] - min) / range) * 255;
  }
}

// Seuil d'Otsu : separe automatiquement texte/fond sans reglage manuel,
// robuste sur des photos a l'exposition variable.
function otsuThreshold(gray: Float32Array): number {
  const histogram = new Array(256).fill(0);
  for (const v of gray) histogram[Math.round(v)]++;
  const total = gray.length;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0;
  let weightB = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    weightB += histogram[t];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;

    sumB += t * histogram[t];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const variance = weightB * weightF * (meanB - meanF) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  return threshold;
}

export async function preprocessForOcr(file: Blob): Promise<Blob> {
  const canvas = await decodeToCanvas(file);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexte canvas 2D indisponible");

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = toGrayscale(imageData);
  stretchContrast(gray);
  const threshold = otsuThreshold(gray);

  const { data } = imageData;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Convention Otsu : classe "fond" = valeurs > seuil (texte plus sombre
    // que le fond, cas standard d'un document). Un `>=` ici classerait a
    // tort le mode le plus sombre comme fond quand le seuil tombe pile sur
    // sa valeur (egalite de variance, cas reel rencontre en test).
    const value = gray[p] > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Echec de conversion canvas -> blob"));
    }, "image/png");
  });
}
