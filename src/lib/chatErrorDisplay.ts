/** Sépare le message utilisateur du détail technique (souvent en anglais). */
export function splitUserFacingError(message: string): { summary: string; detail?: string } {
  const markers = ["Détail :", "Detail:"] as const;
  for (const marker of markers) {
    const index = message.indexOf(marker);
    if (index === -1) continue;
    const summary = message.slice(0, index).trim();
    const detail = message.slice(index + marker.length).trim();
    return detail ? { summary, detail } : { summary: message };
  }
  return { summary: message };
}
