export function citationAnchorId(chunkId: string): string {
  return `rag-cite-${chunkId}`;
}

/** Turn [1] markers into in-page markdown links when citations exist. */
export function linkifyCitationMarkers(content: string, labels: number[]): string {
  const set = new Set(labels);
  return content.replace(/\[(\d{1,2})\]/g, (match, raw) => {
    const n = Number(raw);
    if (!set.has(n)) return match;
    return `[${n}](#cite-${n})`;
  });
}
