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

// inject-precache.mjs remplace la revision a chaque contenu de build distinct.
// Un nouveau deploiement ecrit ainsi dans un cache neuf avant de supprimer
// l'ancien a l'activation. Le fallback ne sert qu'en developpement, ou sw.js
// n'est pas passe par le script d'injection.
const CACHE_PREFIX = "aidusia-shell-";
const CACHE_VERSION = self.__CACHE_VERSION__ || "dev";
const CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;

// Le service worker ne doit jamais devenir un cache HTTP generaliste. En
// particulier, les deux proxies Edge same-origin transportent des cles dans
// leurs en-tetes : une reponse mise en Cache Storage pourrait sinon etre
// resservie apres un changement de cle. Les destinations couvrent les assets
// charges par le navigateur ; les extensions couvrent les ressources chargees
// via fetch() par Tesseract (WASM et donnees de langue).
const STATIC_DESTINATIONS = new Set([
  "audio",
  "font",
  "image",
  "manifest",
  "script",
  "style",
  "video",
  "worker",
]);
const STATIC_PATH = /\.(?:css|gif|gz|ico|jpe?g|js|json|mjs|png|svg|wasm|webmanifest|webp|woff2?)$/i;

function isApiRequest(url) {
  return url.pathname === "/api" || url.pathname.startsWith("/api/");
}

function isStaticAsset(request, url) {
  return STATIC_DESTINATIONS.has(request.destination) || STATIC_PATH.test(url.pathname);
}

function canStore(response) {
  return response.ok && !/(?:^|,)\s*no-store\b/i.test(response.headers.get("cache-control") || "");
}

// Liste du shell du build (index.html, JS/CSS hashes, polices, icones),
// injectee au build par scripts/inject-precache.mjs. Precachee des l'install
// pour que le chat et les reglages fonctionnent hors ligne apres UNE seule
// visite. Les fonctions optionnelles lourdes sont exclues : web-llm est cache
// quand l'IA locale est choisie ; Tesseract (worker, WASM et langue) est cache
// fichier par fichier par la strategie runtime lors du premier OCR en ligne.
const PRECACHE = self.__PRECACHE__ || ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // Une installation partielle ne doit pas remplacer un ancien shell
        // encore utilisable hors-ligne. Une prochaine tentative repartira du
        // cache de build vide supprime dans le catch ci-dessous.
        Promise.all(
          PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" }))),
        ),
      )
      .catch(async (error) => {
        await caches.delete(CACHE);
        throw error;
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data?.type === "skip-waiting") {
    self.skipWaiting();
    return;
  }
  if (!data || data.type !== "cache-assets" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const url of data.urls) {
        try {
          const parsed = new URL(url);
          if (parsed.origin !== self.location.origin || isApiRequest(parsed)) continue;
          if (parsed.pathname !== "/" && !STATIC_PATH.test(parsed.pathname)) continue;
          const hit = await cache.match(url);
          // Deja en HTTP cache navigateur (la page vient de les charger) :
          // ce fetch est quasi gratuit.
          if (!hit) {
            const res = await fetch(url);
            if (canStore(res)) await cache.put(url, res);
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
  if (isApiRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (canStore(res)) {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put("/", copy)));
          }
          return res;
        })
        .catch(() => caches.match("/", MATCH_OPTS).then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // Les documents, endpoints metier et autres GET same-origin restent sous le
  // controle normal du navigateur. Seuls les assets statiques sont servis par
  // la strategie cache-first ci-dessous.
  if (!isStaticAsset(request, url)) return;

  // Cache-first : les assets hashes sont immuables, on les sert
  // instantanement et hors-ligne, avec revalidation en arriere-plan pour les
  // rares ressources non hashees (theme-init.js, icônes).
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request, MATCH_OPTS);
      const refresh = fetch(request)
        .then(async (res) => {
          if (canStore(res)) await cache.put(request, res.clone());
          return res;
        })
        .catch(() => hit ?? Response.error());
      if (!hit) return refresh;
      event.waitUntil(refresh.then(() => undefined));
      return hit;
    }),
  );
});
