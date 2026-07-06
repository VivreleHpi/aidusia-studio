// Cles API : en memoire de session par defaut (sessionStorage), persistees
// dans localStorage uniquement si l'utilisateur active l'option Confidentialite.
// Jamais envoyees ailleurs qu'au fournisseur choisi (ou au proxy same-origin
// pour OpenAI). Jamais journalisees.
const PERSIST_FLAG_KEY = "aidusia_persist_keys";
const KEY_PREFIX = "aidusia_key_";

export function isPersistEnabled(): boolean {
  return localStorage.getItem(PERSIST_FLAG_KEY) === "true";
}

export function setPersistEnabled(enabled: boolean) {
  if (enabled) {
    localStorage.setItem(PERSIST_FLAG_KEY, "true");
  } else {
    localStorage.removeItem(PERSIST_FLAG_KEY);
    // Migration cle -> memoire de session uniquement : purge le stockage durable.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(KEY_PREFIX)) localStorage.removeItem(key);
    }
  }
}

export function getApiKey(providerId: string): string | undefined {
  return (
    sessionStorage.getItem(KEY_PREFIX + providerId) ??
    localStorage.getItem(KEY_PREFIX + providerId) ??
    undefined
  );
}

export function setApiKey(providerId: string, value: string) {
  sessionStorage.setItem(KEY_PREFIX + providerId, value);
  if (isPersistEnabled()) {
    localStorage.setItem(KEY_PREFIX + providerId, value);
  }
}

export function clearApiKey(providerId: string) {
  sessionStorage.removeItem(KEY_PREFIX + providerId);
  localStorage.removeItem(KEY_PREFIX + providerId);
}

export function clearAllApiKeys() {
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith(KEY_PREFIX)) sessionStorage.removeItem(key);
  }
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(KEY_PREFIX)) localStorage.removeItem(key);
  }
}
