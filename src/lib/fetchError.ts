/* "Failed to fetch" brut n'explique rien : ce helper traduit les echecs
   reseau du navigateur en message actionnable. Cas mobile frequent :
   l'URL contient localhost, qui designe le telephone lui-meme. */
export function describeFetchError(err: unknown, target: string, url?: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  const isNetwork =
    err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(raw);
  const isTimeout =
    err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
  if (!isNetwork && !isTimeout) return raw;

  const localhostHint =
    url && /localhost|127\.0\.0\.1/.test(url)
      ? " Sur téléphone ou autre appareil, « localhost » désigne cet appareil-là — pas votre PC : utilisez l'adresse IP du PC (voir docs/ia-locale-mobile.md)."
      : "";
  return (
    `${target} injoignable depuis ce navigateur — vérifiez votre connexion, ` +
    `l'URL, et que le service tourne (CORS autorisé pour cette origine).${localhostHint}`
  );
}
