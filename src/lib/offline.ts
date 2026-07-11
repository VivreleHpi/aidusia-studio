/* Enregistrement du service worker (mode hors-ligne) + envoi de la liste des
   ressources memes-origine deja chargees, pour que le hors-ligne marche des
   la premiere visite. Ne fait rien en dev (le SW cacherait les modules Vite
   servis a chaud) : uniquement en build/prod, servi depuis /sw.js. */

function collectSameOriginAssets(): string[] {
  const urls = new Set<string>([location.origin + "/"]);
  for (const el of document.querySelectorAll<HTMLScriptElement>("script[src]")) {
    if (el.src.startsWith(location.origin)) urls.add(el.src);
  }
  for (const el of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"],link[rel="modulepreload"]')) {
    if (el.href.startsWith(location.origin)) urls.add(el.href);
  }
  // Modules ES et fontes charges dynamiquement : visibles dans l'API
  // Performance meme sans balise dans le DOM.
  for (const entry of performance.getEntriesByType("resource")) {
    const url = (entry as PerformanceResourceTiming).name;
    if (
      url.startsWith(location.origin) &&
      /\.(js|mjs|css|woff2?|wasm|json|svg|png)(\?|$)/.test(url)
    ) {
      urls.add(url);
    }
  }
  return [...urls];
}

export function registerServiceWorker() {
  if (import.meta.env.DEV) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        const sendAssets = () => {
          const target = reg.active ?? navigator.serviceWorker.controller;
          target?.postMessage({ type: "cache-assets", urls: collectSameOriginAssets() });
        };
        // Laisser les chunks paresseux se charger avant de figer la liste.
        if (reg.active) setTimeout(sendAssets, 3000);
        reg.addEventListener("updatefound", () => {
          reg.installing?.addEventListener("statechange", function () {
            if (this.state === "activated") setTimeout(sendAssets, 3000);
          });
        });
      })
      .catch(() => {
        // enregistrement refuse (navigation privee, etc.) : l'app reste
        // parfaitement fonctionnelle en ligne
      });
  });
}
