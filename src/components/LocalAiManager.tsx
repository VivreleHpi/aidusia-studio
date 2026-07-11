import { useCallback, useEffect, useState } from "react";
import {
  LOCAL_AI_PROGRESS_EVENT,
  deleteLocalModel,
  getLocalModelsStatus,
  type LocalModelStatus,
} from "@/providers/browserLocal";
import { useLang } from "@/lib/i18n";

const STRINGS = {
  fr: {
    loading: "Lecture du stockage…",
    loadedNow: "En mémoire — prêt à répondre instantanément",
    downloaded: (gb: string, f32: boolean) =>
      `Téléchargé sur cet appareil (${gb})${f32 ? " — variante compatible avec ce GPU" : ""}. Disponible hors connexion.`,
    notDownloaded: (gb: string) => `Non téléchargé — se téléchargera au premier message (${gb}).`,
    remove: "Supprimer",
    removing: "Suppression…",
    removeConfirm: (label: string) =>
      `Supprimer « ${label} » de cet appareil ?\nIl se retéléchargera au prochain usage.`,
    storageLine: (used: string, quota: string) =>
      `Stockage du navigateur : ${used} utilisés sur ${quota} autorisés.`,
    persisted: "Stockage protégé : le navigateur ne supprimera pas ces modèles de lui-même.",
    notPersisted: "Le navigateur peut effacer ces modèles si l'appareil manque d'espace.",
    protect: "Protéger",
    provenanceTitle: "D'où viennent ces modèles ?",
    provenance:
      "Llama 3.2 (Meta), Qwen 2.5 (Alibaba) et Gemma 2 (Google) — des modèles ouverts, " +
      "compressés par le projet open source MLC-AI et téléchargés une seule fois depuis " +
      "HuggingFace. Ils tournent ensuite 100 % sur votre appareil : rien n'est envoyé " +
      "sur un serveur, et ils répondent même sans connexion internet.",
    tip:
      "Appareil saturé ? Supprimez un modèle ici plutôt que de vider les données du " +
      "navigateur : cela effacerait aussi vos conversations et vos clés.",
  },
  en: {
    loading: "Reading storage…",
    loadedNow: "In memory — ready to answer instantly",
    downloaded: (gb: string, f32: boolean) =>
      `Downloaded on this device (${gb})${f32 ? " — variant compatible with this GPU" : ""}. Available offline.`,
    notDownloaded: (gb: string) => `Not downloaded — will download on first message (${gb}).`,
    remove: "Delete",
    removing: "Deleting…",
    removeConfirm: (label: string) =>
      `Delete “${label}” from this device?\nIt will re-download on next use.`,
    storageLine: (used: string, quota: string) =>
      `Browser storage: ${used} used out of ${quota} allowed.`,
    persisted: "Storage protected: the browser will not remove these models on its own.",
    notPersisted: "The browser may evict these models if the device runs low on space.",
    protect: "Protect",
    provenanceTitle: "Where do these models come from?",
    provenance:
      "Llama 3.2 (Meta), Qwen 2.5 (Alibaba) and Gemma 2 (Google) — open models, " +
      "compressed by the open source MLC-AI project and downloaded once from " +
      "HuggingFace. They then run 100% on your device: nothing is sent to any " +
      "server, and they keep answering even without an internet connection.",
    tip:
      "Device full? Delete a model here rather than clearing browser data: " +
      "that would also erase your conversations and keys.",
  },
} as const;

interface StorageInfo {
  usage: number;
  quota: number;
  persisted: boolean;
  canPersist: boolean;
}

async function readStorageInfo(): Promise<StorageInfo | null> {
  if (!("storage" in navigator) || typeof navigator.storage.estimate !== "function") return null;
  try {
    const [estimate, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted?.() ?? Promise.resolve(false),
    ]);
    return {
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
      persisted,
      canPersist: typeof navigator.storage.persist === "function",
    };
  } catch {
    return null;
  }
}

/* Etat des modeles d'IA locale sur CET appareil : telecharge ou non, charge
   en memoire ou non, suppression individuelle, jauge de stockage et
   provenance. Rend le "ou en est mon modele ?" visible au lieu de laisser
   l'utilisateur deviner. */
export function LocalAiManager() {
  const { lang } = useLang();
  const s = STRINGS[lang];
  const [models, setModels] = useState<LocalModelStatus[] | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const formatGb = useCallback(
    (gb: number) => (lang === "fr" ? `~${gb.toFixed(1).replace(".", ",")} Go` : `~${gb.toFixed(1)} GB`),
    [lang],
  );
  const formatBytes = useCallback(
    (bytes: number) => {
      const gb = bytes / 1e9;
      const n = gb >= 10 ? gb.toFixed(0) : gb.toFixed(1);
      return lang === "fr" ? `${n.replace(".", ",")} Go` : `${n} GB`;
    },
    [lang],
  );

  const refresh = useCallback(() => {
    void getLocalModelsStatus().then(setModels).catch(() => setModels([]));
    void readStorageInfo().then(setStorage);
  }, []);

  useEffect(() => {
    refresh();
    // Un modele qui finit de charger (progress=1) change son statut "en
    // memoire" : on rafraichit a ce moment-la.
    const onProgress = (e: Event) => {
      if ((e as CustomEvent<{ progress: number }>).detail?.progress === 1) refresh();
    };
    window.addEventListener(LOCAL_AI_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(LOCAL_AI_PROGRESS_EVENT, onProgress);
  }, [refresh]);

  async function handleRemove(m: LocalModelStatus) {
    if (!window.confirm(s.removeConfirm(m.label))) return;
    setRemoving(m.id);
    try {
      await deleteLocalModel(m.id);
    } finally {
      setRemoving(null);
      refresh();
    }
  }

  async function handleProtect() {
    try {
      await navigator.storage.persist();
    } finally {
      refresh();
    }
  }

  return (
    <div className="mt-2 ml-4 space-y-3 rounded-lg border border-border/60 bg-background/40 p-3">
      {models === null ? (
        <p className="text-xs text-muted-foreground">{s.loading}</p>
      ) : (
        <div className="space-y-2">
          {models.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium">{m.label}</p>
                <p className={`text-xs ${m.loaded ? "text-success" : "text-muted-foreground"}`}>
                  {m.loaded
                    ? s.loadedNow
                    : m.cached
                      ? s.downloaded(formatGb(m.sizeGb), m.variant === "f32")
                      : s.notDownloaded(formatGb(m.sizeGb))}
                </p>
              </div>
              {m.cached && (
                <button
                  type="button"
                  disabled={removing === m.id}
                  onClick={() => void handleRemove(m)}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-destructive transition duration-150 hover:bg-destructive/10 active:scale-[0.98] disabled:opacity-50"
                >
                  {removing === m.id ? s.removing : s.remove}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {storage && storage.quota > 0 && (
        <div className="space-y-1 border-t border-border/60 pt-2">
          <p className="text-xs text-muted-foreground">
            {s.storageLine(formatBytes(storage.usage), formatBytes(storage.quota))}
          </p>
          <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (storage.usage / storage.quota) * 100)}%` }}
            />
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            {storage.persisted ? s.persisted : s.notPersisted}
            {!storage.persisted && storage.canPersist && (
              <button
                type="button"
                onClick={() => void handleProtect()}
                className="rounded-md border border-border px-2 py-0.5 text-xs text-foreground transition duration-150 hover:bg-foreground/5 active:scale-[0.98]"
              >
                {s.protect}
              </button>
            )}
          </p>
        </div>
      )}

      <div className="border-t border-border/60 pt-2">
        <p className="text-xs font-medium">{s.provenanceTitle}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{s.provenance}</p>
        <p className="mt-1.5 text-xs text-muted-foreground/80">💡 {s.tip}</p>
      </div>
    </div>
  );
}
