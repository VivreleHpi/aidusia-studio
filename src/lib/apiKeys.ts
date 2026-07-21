// Cles API : session-only par defaut pour toute nouvelle installation. Les
// installations historiques qui possedent deja une cle dans localStorage sans
// drapeau explicite sont migrees vers persist=true sans supprimer leur cle.
// Jamais envoyees ailleurs qu'au fournisseur choisi (ou au proxy same-origin
// documente pour OpenAI/Ollama Cloud). Jamais journalisees volontairement.
const PERSIST_FLAG_KEY = "aidusia_persist_keys";
export const API_KEY_STORAGE_PREFIX = "aidusia_key_";

export function isApiKeyStorageKey(key: string): boolean {
  return key.startsWith(API_KEY_STORAGE_PREFIX);
}

export function isPersistEnabled(): boolean {
  const storedPreference = localStorage.getItem(PERSIST_FLAG_KEY);
  if (storedPreference === "true") return true;
  if (storedPreference === "false") return false;

  // Compatibilite avec l'ancien defaut : l'absence du drapeau ne doit jamais
  // faire disparaitre ni cesser de persister silencieusement des cles deja la.
  const hasLegacyPersistedKey = Object.keys(localStorage).some((key) =>
    key.startsWith(API_KEY_STORAGE_PREFIX),
  );
  if (hasLegacyPersistedKey) {
    localStorage.setItem(PERSIST_FLAG_KEY, "true");
    return true;
  }
  return false;
}

export function setPersistEnabled(enabled: boolean) {
  if (enabled) {
    localStorage.setItem(PERSIST_FLAG_KEY, "true");
    // Le choix s'applique aussi aux cles deja saisies pendant cette session.
    // Sans cette migration, activer l'option apres configuration affichait
    // bien le toggle comme actif, mais les cles disparaissaient tout de meme
    // a la fermeture du navigateur.
    for (const key of Object.keys(sessionStorage)) {
      if (!key.startsWith(API_KEY_STORAGE_PREFIX)) continue;
      const value = sessionStorage.getItem(key);
      if (value !== null) localStorage.setItem(key, value);
    }
  } else {
    localStorage.setItem(PERSIST_FLAG_KEY, "false");
    // Conserver dans la session les cles historiques qui n'existent que dans
    // localStorage avant de purger le stockage durable. Une copie de session
    // deja presente reste prioritaire, comme dans getApiKey().
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(API_KEY_STORAGE_PREFIX)) continue;
      const value = localStorage.getItem(key);
      if (sessionStorage.getItem(key) === null && value !== null) {
        sessionStorage.setItem(key, value);
      }
      localStorage.removeItem(key);
    }
  }
}

export function getApiKey(providerId: string): string | undefined {
  return (
    sessionStorage.getItem(API_KEY_STORAGE_PREFIX + providerId) ??
    localStorage.getItem(API_KEY_STORAGE_PREFIX + providerId) ??
    undefined
  );
}

export function setApiKey(providerId: string, value: string) {
  sessionStorage.setItem(API_KEY_STORAGE_PREFIX + providerId, value);
  if (isPersistEnabled()) {
    localStorage.setItem(API_KEY_STORAGE_PREFIX + providerId, value);
  }
}

export function clearApiKey(providerId: string) {
  sessionStorage.removeItem(API_KEY_STORAGE_PREFIX + providerId);
  localStorage.removeItem(API_KEY_STORAGE_PREFIX + providerId);
}

export function clearAllApiKeys() {
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith(API_KEY_STORAGE_PREFIX)) sessionStorage.removeItem(key);
  }
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(API_KEY_STORAGE_PREFIX)) localStorage.removeItem(key);
  }
}
