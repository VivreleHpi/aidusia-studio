// Transfert de réglages entre appareils sans serveur : tout se joue dans le
// navigateur. Le fichier exporté est un JSON chiffré (WebCrypto) protégé par
// une phrase secrète choisie par l'utilisateur — sans elle, le contenu est
// inexploitable, y compris pour nous (aucune clé ni mot de passe ne quitte
// jamais ce module vers un serveur).
import { providers } from "@/providers";
import { getApiKey, isPersistEnabled, setApiKey, setPersistEnabled } from "@/lib/apiKeys";
import { getOllamaBaseUrl, setOllamaBaseUrl } from "@/providers/ollama";

// Mêmes clés localStorage que src/lib/i18n.tsx et src/lib/theme.tsx. Non
// exportées par ces modules, donc dupliquées ici volontairement plutôt que
// d'élargir leur API publique pour ce seul besoin.
const LANG_STORAGE_KEY = "aidusia_lang";
const THEME_STORAGE_KEY = "aidusia_theme";

// 310 000 itérations : recommandation OWASP 2023 pour PBKDF2-SHA256, un bon
// compromis entre résistance au brute-force et latence acceptable côté UI.
const PBKDF2_ITERATIONS = 310_000;
const MIN_PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 1_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12; // taille standard du nonce AES-GCM
const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_SECRET_LENGTH = 20_000;

const WRONG_PASSPHRASE_MESSAGE = "Phrase secrète incorrecte ou fichier corrompu.";

interface ExportedSettingsV1 {
  version: 1;
  exportedAt: string;
  keys: Record<string, string>;
  ollamaUrl: string;
  lang: string | null;
  theme: string | null;
  persist: boolean;
}

// Format du fichier .aidusia sur disque : l'enveloppe (kdf, sel, iv) est en
// clair, seul le champ "data" (le JSON des réglages) est chiffré.
interface EncryptedFile {
  v: 1;
  kdf: "PBKDF2";
  iter: number;
  salt: string;
  iv: string;
  data: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  if (!b64 || b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) {
    throw new Error("Invalid base64");
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePayload(value: unknown): ExportedSettingsV1 {
  if (!isRecord(value) || value.version !== 1 || typeof value.persist !== "boolean") {
    throw new Error("Invalid payload");
  }
  if (
    typeof value.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(value.exportedAt)) ||
    typeof value.ollamaUrl !== "string" ||
    value.ollamaUrl.length > 2048 ||
    !isRecord(value.keys)
  ) {
    throw new Error("Invalid payload");
  }
  const url = new URL(value.ollamaUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Invalid URL");
  if (value.lang !== null && value.lang !== "fr" && value.lang !== "en") throw new Error("Invalid language");
  if (value.theme !== null && value.theme !== "light" && value.theme !== "dark") {
    throw new Error("Invalid theme");
  }

  const allowedProviders = new Set(providers.map((provider) => provider.id));
  for (const [providerId, secret] of Object.entries(value.keys)) {
    if (!allowedProviders.has(providerId) || typeof secret !== "string" || secret.length > MAX_SECRET_LENGTH) {
      throw new Error("Invalid key entry");
    }
  }
  return value as unknown as ExportedSettingsV1;
}

// Dérive une clé AES-GCM 256 bits à partir de la phrase secrète. La clé
// dérivée n'est jamais extractible (extractable: false) : elle ne peut
// servir qu'à chiffrer/déchiffrer via cette session WebCrypto.
async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function exportSettings(passphrase: string): Promise<Blob> {
  const payload: ExportedSettingsV1 = {
    version: 1,
    exportedAt: new Date().toISOString(),
    keys: Object.fromEntries(providers.map((p) => [p.id, getApiKey(p.id) ?? ""])),
    ollamaUrl: getOllamaBaseUrl(),
    lang: localStorage.getItem(LANG_STORAGE_KEY),
    theme: localStorage.getItem(THEME_STORAGE_KEY),
    persist: isPersistEnabled(),
  };

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plaintext);

  const file: EncryptedFile = {
    v: 1,
    kdf: "PBKDF2",
    iter: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext)),
  };

  return new Blob([JSON.stringify(file)], { type: "application/json" });
}

export async function importSettings(file: File, passphrase: string): Promise<void> {
  if (file.size === 0 || file.size > MAX_IMPORT_BYTES) {
    throw new Error(WRONG_PASSPHRASE_MESSAGE);
  }
  let envelope: EncryptedFile;
  try {
    envelope = JSON.parse(await file.text());
  } catch {
    throw new Error(WRONG_PASSPHRASE_MESSAGE);
  }
  if (
    !envelope ||
    envelope.v !== 1 ||
    envelope.kdf !== "PBKDF2" ||
    !Number.isInteger(envelope.iter) ||
    envelope.iter < MIN_PBKDF2_ITERATIONS ||
    envelope.iter > MAX_PBKDF2_ITERATIONS ||
    typeof envelope.salt !== "string" ||
    typeof envelope.iv !== "string" ||
    typeof envelope.data !== "string"
  ) {
    throw new Error(WRONG_PASSPHRASE_MESSAGE);
  }

  // Toute erreur ici (base64 invalide, sel/iv corrompus, ou surtout echec de
  // l'authentification GCM quand la phrase secrete est fausse) remonte comme
  // un seul message clair : on ne distingue pas "corrompu" de "mauvaise
  // phrase" pour ne rien reveler a un attaquant qui tenterait des essais.
  let payload: ExportedSettingsV1;
  try {
    const salt = fromBase64(envelope.salt);
    const iv = fromBase64(envelope.iv);
    const ciphertext = fromBase64(envelope.data);
    if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || ciphertext.length === 0) {
      throw new Error("Invalid cryptographic parameters");
    }
    const key = await deriveKey(passphrase, salt, envelope.iter);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    payload = validatePayload(JSON.parse(new TextDecoder().decode(plaintext)));
  } catch {
    throw new Error(WRONG_PASSPHRASE_MESSAGE);
  }

  // Ordre important : activer la persistance avant setApiKey, pour que les
  // cles importees soient elles-memes ecrites en localStorage si demande.
  setPersistEnabled(payload.persist);
  if (payload.ollamaUrl) setOllamaBaseUrl(payload.ollamaUrl);
  for (const [providerId, value] of Object.entries(payload.keys ?? {})) {
    if (value) setApiKey(providerId, value);
  }
  if (payload.lang === "fr" || payload.lang === "en") {
    localStorage.setItem(LANG_STORAGE_KEY, payload.lang);
  }
  if (payload.theme === "light" || payload.theme === "dark") {
    localStorage.setItem(THEME_STORAGE_KEY, payload.theme);
  }
}
