const DEFAULT_CHUNK = 900;
const DEFAULT_OVERLAP = 120;

/**
 * Split plain text into overlapping chunks for indexing.
 */
export function chunkPlainText(
  text: string,
  chunkSize = DEFAULT_CHUNK,
  overlap = DEFAULT_OVERLAP,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + chunkSize);
    const slice = normalized.slice(start, end).trim();
    if (slice) chunks.push(slice);
    if (end >= normalized.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}
