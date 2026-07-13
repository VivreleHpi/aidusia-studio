// Pretraitement d'image avant OCR. Sans lui, tesseract degrade fortement sur
// une PHOTO (contraste faible, eclairage inegal, texte petit) meme si le
// pipeline lui-meme fonctionne parfaitement - c'est la cause la plus probable
// d'un texte extrait illisible. Toutes les etapes tournent en Canvas 2D,
// 100% dans le navigateur, aucune donnee ne sort jamais.
const MIN_TARGET_WIDTH = 1600;
const MAX_OCR_EDGE = 4096;
const MAX_OCR_PIXELS = 20_000_000;

// Recherche d'inclinaison : une photo de document est rarement prise
// parfaitement a plat, et tesseract degrade vite au-dela de quelques degres.
// Plage couverte a la main (photo tenue en main), pas un scan a plat.
const SKEW_SEARCH_RANGE_DEG = 15;
const SKEW_COARSE_STEP_DEG = 1;
const SKEW_FINE_STEP_DEG = 0.15;
// En dessous de ce seuil, corriger introduirait un flou de reechantillonnage
// pour un gain invisible.
const SKEW_MIN_CORRECTION_DEG = 0.3;
// Le profil de projection peut legerement preferer un angle non nul par bruit
// meme sur une image deja droite : on n'accepte la correction que si le gain
// de variance est net, pas une simple egalite flottante.
const SKEW_VARIANCE_MARGIN = 1.05;
// Image reduite pour la recherche d'angle : la precision necessaire est
// grossiere, la vitesse compte (jusqu'a une cinquantaine de rotations testees).
const SKEW_SEARCH_MAX_EDGE = 500;

async function decodeToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_OCR_PIXELS) {
    bitmap.close();
    throw new Error("Image trop grande pour l’OCR (20 millions de pixels maximum)");
  }
  const upscale = bitmap.width < MIN_TARGET_WIDTH ? MIN_TARGET_WIDTH / bitmap.width : 1;
  const edgeCap = MAX_OCR_EDGE / Math.max(bitmap.width, bitmap.height);
  const pixelCap = Math.sqrt(MAX_OCR_PIXELS / (bitmap.width * bitmap.height));
  const scale = Math.min(upscale, edgeCap, pixelCap);
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

// Redimensionne (sans jamais agrandir) pour rester sous le budget de pixels -
// une rotation fait grandir le rectangle englobant, ce qui peut repasser
// au-dessus du plafond deja applique par decodeToCanvas.
function capToPixelBudget(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const edgeCap = MAX_OCR_EDGE / Math.max(canvas.width, canvas.height);
  const pixelCap = Math.sqrt(MAX_OCR_PIXELS / (canvas.width * canvas.height));
  const scale = Math.min(1, edgeCap, pixelCap);
  if (scale >= 1) return canvas;
  const capped = document.createElement("canvas");
  capped.width = Math.round(canvas.width * scale);
  capped.height = Math.round(canvas.height * scale);
  const ctx = capped.getContext("2d");
  if (!ctx) throw new Error("Contexte canvas 2D indisponible");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, capped.width, capped.height);
  return capped;
}

// Fond blanc apres pivot : la rotation laisse des coins vides hors du
// rectangle d'origine, et un document photographie est presque toujours sur
// fond clair.
function rotateCanvas(source: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement {
  const rad = (angleDeg * Math.PI) / 180;
  const w = source.width;
  const h = source.height;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * cos + h * sin);
  canvas.height = Math.round(w * sin + h * cos);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexte canvas 2D indisponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -w / 2, -h / 2);
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

function rowInkVariance(bin: Uint8Array, width: number, height: number): number {
  const rowSums = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    const base = y * width;
    for (let x = 0; x < width; x++) sum += bin[base + x];
    rowSums[y] = sum;
  }
  let mean = 0;
  for (let y = 0; y < height; y++) mean += rowSums[y];
  mean /= height;
  let variance = 0;
  for (let y = 0; y < height; y++) variance += (rowSums[y] - mean) ** 2;
  return variance / height;
}

function binarize(gray: Float32Array, threshold: number): Uint8Array {
  const bin = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) bin[i] = gray[i] <= threshold ? 1 : 0;
  return bin;
}

// Angle qui aligne le mieux les lignes de texte a l'horizontale : des lignes
// droites produisent un profil de projection (encre cumulee par ligne) tres
// contraste (creux entre les lignes, pics sur le texte) donc une variance
// maximale ; un texte incline etale l'encre sur plus de lignes et aplatit
// cette variance. Deskew par profil de projection, methode standard, sans
// dependance externe.
function detectSkewAngle(source: HTMLCanvasElement): number {
  const scale = Math.min(1, SKEW_SEARCH_MAX_EDGE / Math.max(source.width, source.height));
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(source.width * scale));
  small.height = Math.max(1, Math.round(source.height * scale));
  const sctx = small.getContext("2d");
  if (!sctx) return 0;
  sctx.drawImage(source, 0, 0, small.width, small.height);

  const baseGray = toGrayscale(sctx.getImageData(0, 0, small.width, small.height));
  stretchContrast(baseGray);
  const threshold = otsuThreshold(baseGray);

  function varianceAtAngle(angleDeg: number): number {
    if (angleDeg === 0) return rowInkVariance(binarize(baseGray, threshold), small.width, small.height);
    const rotated = rotateCanvas(small, angleDeg);
    const rctx = rotated.getContext("2d");
    if (!rctx) return 0;
    const gray = toGrayscale(rctx.getImageData(0, 0, rotated.width, rotated.height));
    // Reutilise le seuil de l'image non tournee (meme eclairage) : evite un
    // recalcul Otsu couteux a chaque angle candidat.
    return rowInkVariance(binarize(gray, threshold), rotated.width, rotated.height);
  }

  const zeroVariance = varianceAtAngle(0);
  let bestAngle = 0;
  let bestVariance = zeroVariance;
  for (let a = -SKEW_SEARCH_RANGE_DEG; a <= SKEW_SEARCH_RANGE_DEG; a += SKEW_COARSE_STEP_DEG) {
    if (a === 0) continue;
    const v = varianceAtAngle(a);
    if (v > bestVariance) {
      bestVariance = v;
      bestAngle = a;
    }
  }
  const coarseAngle = bestAngle;
  for (let a = coarseAngle - SKEW_COARSE_STEP_DEG; a <= coarseAngle + SKEW_COARSE_STEP_DEG; a += SKEW_FINE_STEP_DEG) {
    const v = varianceAtAngle(a);
    if (v > bestVariance) {
      bestVariance = v;
      bestAngle = a;
    }
  }

  // Rejette une correction non nulle qui ne s'appuie que sur un gain marginal
  // (bruit) plutot qu'un vrai alignement de lignes de texte.
  if (bestAngle === 0 || bestVariance < zeroVariance * SKEW_VARIANCE_MARGIN) return 0;
  return bestAngle;
}

export async function preprocessForOcr(file: Blob): Promise<Blob> {
  let canvas = await decodeToCanvas(file);

  const skewAngle = detectSkewAngle(canvas);
  if (Math.abs(skewAngle) >= SKEW_MIN_CORRECTION_DEG) {
    canvas = capToPixelBudget(rotateCanvas(canvas, skewAngle));
  }

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
