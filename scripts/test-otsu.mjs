// Verification numerique du seuillage d'Otsu + binarisation (imagePreprocess.ts)
// avec des donnees synthetiques - les fonctions pures (grayscale/contraste/
// Otsu/binarisation) ne dependent pas du DOM reel, seul le decodage image
// (createImageBitmap) en depend et n'est testable qu'en navigateur.

function toGrayscale(imageData) {
  const gray = new Float32Array(imageData.width * imageData.height);
  const { data } = imageData;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

function stretchContrast(gray) {
  let min = 255, max = 0;
  for (const v of gray) { if (v < min) min = v; if (v > max) max = v; }
  const range = max - min || 1;
  for (let i = 0; i < gray.length; i++) gray[i] = ((gray[i] - min) / range) * 255;
}

function otsuThreshold(gray) {
  const histogram = new Array(256).fill(0);
  for (const v of gray) histogram[Math.round(v)]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];
  let sumB = 0, weightB = 0, maxVariance = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    weightB += histogram[t];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;
    sumB += t * histogram[t];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const variance = weightB * weightF * (meanB - meanF) ** 2;
    if (variance > maxVariance) { maxVariance = variance; threshold = t; }
  }
  return threshold;
}

// Reproduit exactement la regle de binarisation d'imagePreprocess.ts.
function binarize(gray, threshold) {
  return Array.from(gray, (v) => (v > threshold ? 255 : 0));
}

function makeImageData(values) {
  const width = values.length, height = 1;
  const data = new Uint8ClampedArray(width * 4);
  values.forEach((v, x) => {
    data[x * 4] = data[x * 4 + 1] = data[x * 4 + 2] = v;
    data[x * 4 + 3] = 255;
  });
  return { width, height, data };
}

let failures = 0;

// Test 1 : image bimodale nette (50 sombres + 50 clairs) -> la binarisation
// DOIT separer les deux groupes en deux classes distinctes (pas tout blanc,
// pas tout noir) - c'est le vrai critere, pas une contrainte sur la valeur
// exacte du seuil (Otsu peut legitimement choisir t=50 par egalite de variance).
{
  const values = Array.from({ length: 100 }, (_, x) => (x < 50 ? 50 : 200));
  const imageData = makeImageData(values);
  const gray = toGrayscale(imageData);
  const t = otsuThreshold(gray);
  const bin = binarize(gray, t);
  const darkGroup = new Set(bin.slice(0, 50));
  const lightGroup = new Set(bin.slice(50));
  const pass = darkGroup.size === 1 && lightGroup.size === 1 && !darkGroup.has([...lightGroup][0]);
  console.log(`Test 1 (bimodal net) : seuil=${t} groupe_sombre=${[...darkGroup]} groupe_clair=${[...lightGroup]} ->`, pass ? "PASS" : "FAIL");
  if (!pass) failures++;
}

// Test 2 : faible contraste (photo terne, 100 vs 140) -> apres etirement de
// contraste, la binarisation doit quand meme separer correctement les deux
// groupes (c'est le cas d'usage reel : photo mal exposee).
{
  const values = Array.from({ length: 100 }, (_, x) => (x < 50 ? 100 : 140));
  const imageData = makeImageData(values);
  const gray = toGrayscale(imageData);
  stretchContrast(gray);
  const min = Math.min(...gray), max = Math.max(...gray);
  const stretchOk = min < 5 && max > 250;
  const t = otsuThreshold(gray);
  const bin = binarize(gray, t);
  const darkGroup = new Set(bin.slice(0, 50));
  const lightGroup = new Set(bin.slice(50));
  const pass = stretchOk && darkGroup.size === 1 && lightGroup.size === 1 && !darkGroup.has([...lightGroup][0]);
  console.log(`Test 2 (faible contraste etire) : min=${min.toFixed(1)} max=${max.toFixed(1)} seuil=${t} ->`, pass ? "PASS" : "FAIL");
  if (!pass) failures++;
}

// Test 3 : texte sombre minoritaire sur fond clair majoritaire (cas reel -
// une page de texte a plus de fond blanc que d'encre noire).
{
  const values = Array.from({ length: 100 }, (_, x) => (x < 20 ? 30 : 220));
  const imageData = makeImageData(values);
  const gray = toGrayscale(imageData);
  const t = otsuThreshold(gray);
  const bin = binarize(gray, t);
  const textPixels = bin.slice(0, 20);
  const bgPixels = bin.slice(20);
  const pass = textPixels.every((v) => v === 0) && bgPixels.every((v) => v === 255);
  console.log(`Test 3 (texte minoritaire) : seuil=${t} ->`, pass ? "PASS" : "FAIL");
  if (!pass) failures++;
}

if (failures > 0) {
  console.log(`${failures} test(s) ECHOUE(S)`);
  process.exit(1);
}
console.log("TOUS LES TESTS OTSU: PASS");
