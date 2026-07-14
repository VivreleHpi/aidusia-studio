// Cles API : session-only par defaut pour toute nouvelle installation. Les
// installations historiques qui possedent deja une cle dans localStorage sans
// drapeau explicite sont migrees vers persist=true sans supprimer leur cle.
// Jamais envoyees ailleurs qu'au fournisseur choisi (ou au proxy same-origin
// documente pour OpenAI/Ollama Cloud). Jamais journalisees volontairement.
const PERSIST_FLAG_KEY = "aidusia_persist_keys";
const KEY_PREFIX = "aidusia_key_";

export function isPersistEnabled(): boolean {
  const storedPreference = localStorage.getItem(PERSIST_FLAG_KEY);
  if (storedPreference === "true") return true;
  if (storedPreference === "false") return false;

  // Compatibilite avec l'ancien defaut : l'absence du drapeau ne doit jamais
  // faire disparaitre ni cesser de persister silencieusement des cles deja la.
  const hasLegacyPersistedKey = Object.keys(localStorage).some((key) => key.startsWith(KEY_PREFIX));
  if (hasLegacyPersistedKey) {
    localStorage.setItem(PERSIST_FLAG_KEY, "true");
    return true;
  }
  return false;
}

export function setPersistEnabled(enabled: boolean) {
  if (enabled) {
    localStorage.setItem(PERSIST_FLAG_KEY, "true");
  } else {
    localStorage.setItem(PERSIST_FLAG_KEY, "false");
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
