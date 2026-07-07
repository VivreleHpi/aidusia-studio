// Convertit un Blob en base64 BRUT (sans prefixe data:...) - c'est le
// format attendu par l'API Ollama pour le champ `images`.
export function blobToRawBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
