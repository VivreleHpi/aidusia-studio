import { blobToRawBase64 } from "./toBase64";

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 20_000_000;
const MAX_VISION_EDGE = 2048;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"]);

export function validateImageFile(file: File, lang: "fr" | "en"): void {
  if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw new Error(
      lang === "fr"
        ? "Format non pris en charge. Utilisez JPEG, PNG, WebP, GIF ou BMP (SVG refusé pour des raisons de sécurité)."
        : "Unsupported format. Use JPEG, PNG, WebP, GIF or BMP (SVG is blocked for security).",
    );
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      lang === "fr"
        ? "L’image doit faire moins de 15 Mo. Réduisez-la avant de continuer."
        : "The image must be smaller than 15 MB. Resize it before continuing.",
    );
  }
}

export async function inspectImageDimensions(blob: Blob, lang: "fr" | "en"): Promise<ImageBitmap> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error(lang === "fr" ? "Image illisible ou corrompue." : "Unreadable or corrupted image.");
  }
  if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
    bitmap.close();
    throw new Error(
      lang === "fr"
        ? "L’image dépasse 20 millions de pixels. Réduisez ses dimensions avant de continuer."
        : "The image exceeds 20 million pixels. Reduce its dimensions before continuing.",
    );
  }
  return bitmap;
}

export async function prepareVisionImage(
  file: File,
  lang: "fr" | "en",
): Promise<{ base64: string; previewUrl: string }> {
  validateImageFile(file, lang);
  const bitmap = await inspectImageDimensions(file, lang);
  const scale = Math.min(1, MAX_VISION_EDGE / Math.max(bitmap.width, bitmap.height));

  if (scale === 1 && file.type !== "image/gif") {
    bitmap.close();
    return { base64: await blobToRawBase64(file), previewUrl: URL.createObjectURL(file) };
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error(lang === "fr" ? "Traitement d’image indisponible." : "Image processing unavailable.");
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const output = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image conversion failed"))),
      "image/jpeg",
      0.88,
    );
  });
  return { base64: await blobToRawBase64(output), previewUrl: URL.createObjectURL(output) };
}
