/* Service worker AIDUSIA Studio — mode hors-ligne.
   Strategie :
   - navigations : reseau d'abord (les deploiements frais gagnent), copie en
     cache, et cache en secours quand il n'y a pas de reseau ;
   - assets memes-origine (JS/CSS/fontes/wasm, noms hashes par Vite) :
     stale-while-revalidate — reponse immediate depuis le cache, refresh en
     arriere-plan ;
   - JAMAIS le cross-origin : les poids des modeles locaux (HuggingFace) sont
     deja geres par web-llm dans Cache Storage, et les appels API des
     fournisseurs ne doivent surtout pas etre caches.
   La page envoie aussi la liste des ressources qu'elle a chargees (message
   "cache-assets") : filet de securite complementaire au precache. */

const CACHE = "aidusia-shell-v3";

// Liste des assets du build (index.html, JS/CSS hashes, polices, icones),
// injectee au build par scripts/inject-precache.mjs. Precachee des l'install
// pour que le hors-ligne (mode avion) marche apres UNE seule visite en ligne,
// sans dependre du timing de chargement de la page. Le gros chunk web-llm en
// est exclu (cache a la demande quand on utilise l'IA locale).
const PRECACHE = self.__PRECACHE__ || ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // addAll echoue en bloc si UN asset manque : on tolere les absences.
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
        ),
      );
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("aidusia-shell") && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "cache-assets" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const url of data.urls) {
        try {
          if (new URL(url).origin !== self.location.origin) continue;
          const hit = await cache.match(url);
          // Deja en HTTP cache navigateur (la page vient de les charger) :
          // ce fetch est quasi gratuit.
          if (!hit) {
            const res = await fetch(url);
            if (res.ok) await cache.put(url, res);
          }
        } catch {
          // ressource individuelle injoignable : on continue avec les autres
        }
      }
    }),
  );
});

// Vite sert ses assets hashes avec l'attribut `crossorigin` (requete en mode
// "cors") et un en-tete Vary. Par defaut cache.match honore Vary : la requete
// cors du chargeur ne matchait alors PAS l'entree en cache et l'asset
// echouait hors-ligne. Les noms etant hashes (immuables), on ignore Vary et
// la query pour matcher de facon fiable. Verifie empiriquement.
const MATCH_OPTS = { ignoreVary: true, ignoreSearch: true };

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put("/", copy));
          }
          return res;
        })
        .catch(() => caches.match("/", MATCH_OPTS).then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // Cache-first : les assets hashes sont immuables, on les sert
  // instantanement et hors-ligne, avec revalidation en arriere-plan pour les
  // rares ressources non hashees (theme-init.js, icônes).
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request, MATCH_OPTS);
      const refresh = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => hit ?? Response.error());
      return hit ?? refresh;
    }),
  );
});
