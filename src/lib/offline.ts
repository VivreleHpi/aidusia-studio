/* Enregistrement du service worker et etat PWA partage avec l'interface.
   Les mises a jour et l'installation restent toujours declenchees par une
   action explicite de l'utilisateur : aucun reload ni prompt automatique. */

export const PWA_STATUS_EVENT = "aidusia:pwa-status";

export interface PwaStatus {
  online: boolean;
  serviceWorkerSupported: boolean;
  updateReady: boolean;
  installAvailable: boolean;
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type StatusListener = () => void;

const listeners = new Set<StatusListener>();
let status: PwaStatus = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  serviceWorkerSupported: typeof navigator !== "undefined" && "serviceWorker" in navigator,
  updateReady: false,
  installAvailable: false,
};
let installPrompt: InstallPromptEvent | null = null;
let waitingWorker: ServiceWorker | null = null;
let pageListenersInstalled = false;
let controllerListenerInstalled = false;
let registrationStarted = false;

function publish(patch: Partial<PwaStatus>) {
  const next = { ...status, ...patch };
  if (
    next.online === status.online &&
    next.serviceWorkerSupported === status.serviceWorkerSupported &&
    next.updateReady === status.updateReady &&
    next.installAvailable === status.installAvailable
  ) {
    return;
  }
  status = next;
  for (const listener of listeners) listener();
  window.dispatchEvent(new CustomEvent<PwaStatus>(PWA_STATUS_EVENT, { detail: status }));
}

function installPageListeners() {
  if (pageListenersInstalled || typeof window === "undefined") return;
  pageListenersInstalled = true;
  window.addEventListener("online", () => publish({ online: true }));
  window.addEventListener("offline", () => publish({ online: false }));
  window.addEventListener("beforeinstallprompt", (event) => {
    // Le mini-prompt du navigateur est remplace par une action discrete dans
    // Parametres. Le vrai prompt ne s'ouvre qu'apres un clic utilisateur.
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    publish({ installAvailable: true });
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    publish({ installAvailable: false });
  });
}

export function getPwaStatus(): PwaStatus {
  return status;
}

export function subscribePwaStatus(listener: StatusListener): () => void {
  installPageListeners();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function promptPwaInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const prompt = installPrompt;
  if (!prompt) return "unavailable";
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  installPrompt = null;
  publish({ installAvailable: false });
  return outcome;
}

export function reloadForPwaUpdate(): boolean {
  if (!status.updateReady) return false;
  const worker = waitingWorker;
  if (!worker) {
    window.location.reload();
    return true;
  }
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => window.location.reload(),
    { once: true },
  );
  worker.postMessage({ type: "skip-waiting" });
  return true;
}

function collectSameOriginAssets(): string[] {
  const urls = new Set<string>([location.origin + "/"]);
  for (const el of document.querySelectorAll<HTMLScriptElement>("script[src]")) {
    if (el.src.startsWith(location.origin)) urls.add(el.src);
  }
  for (const el of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"],link[rel="modulepreload"]')) {
    if (el.href.startsWith(location.origin)) urls.add(el.href);
  }
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

/* Exporte pour permettre un test du cycle de vie sans enregistrer un vrai SW.
   En production, seule registerServiceWorker appelle cette fonction. */
export function observeServiceWorkerRegistration(registration: ServiceWorkerRegistration) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  if (registration.waiting && hadController) {
    waitingWorker = registration.waiting;
    publish({ updateReady: true });
  }

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        waitingWorker = worker;
        publish({ updateReady: true });
      }
      if (worker.state === "activated") setTimeout(sendAssets, 3000);
    });
  });

  if (!controllerListenerInstalled) {
    controllerListenerInstalled = true;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController) waitingWorker = null;
    });
  }

  function sendAssets() {
    const target = registration.active ?? navigator.serviceWorker.controller;
    target?.postMessage({ type: "cache-assets", urls: collectSameOriginAssets() });
  }

  if (registration.active) setTimeout(sendAssets, 3000);
}

export function registerServiceWorker() {
  installPageListeners();
  if (import.meta.env.DEV || !("serviceWorker" in navigator) || registrationStarted) return;
  registrationStarted = true;

  const register = () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(observeServiceWorkerRegistration)
      .catch(() => {
        // Navigation privee ou politique restrictive : l'app reste utilisable
        // en ligne et le statut reseau continue de fonctionner.
      });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
