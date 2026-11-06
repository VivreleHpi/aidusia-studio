import { useEffect, useState } from "react";
import { requestConfirm } from "@/lib/confirm";
import { useLang } from "@/lib/i18n";
import {
  deletePortableModel,
  getPortableBackend,
  getPortableCacheSize,
  getPortableRuntime,
  setPortableBackend,
  type PortableBackend,
} from "@/providers/portable";

const STRINGS = {
  fr: {
    reading: "Lecture du stockage…",
    downloaded: (gb: string) => `Téléchargé (${gb} Go). Disponible hors connexion.`,
    notDownloaded: "Non téléchargé — environ 0,49 Go, avec confirmation avant le téléchargement.",
    backendLabel: "Calcul",
    auto: "Automatique",
    autoHelp: "Carte graphique (WebGPU) si disponible, sinon processeur.",
    cpu: "Processeur",
    cpuHelp: "Plus lent, mais à choisir si les réponses sont incohérentes (certains pilotes graphiques mobiles).",
    running: (gpu: boolean) => `En mémoire : ${gpu ? "carte graphique" : "processeur"}.`,
    remove: "Supprimer Qwen 0.5B",
    removing: "Suppression…",
    removeTitle: "Supprimer Qwen 0.5B de cet appareil ?",
    removeMessage: "Les poids (~0,49 Go) seront effacés. Il faudra les retélécharger pour réutiliser ce modèle.",
    removeAction: "Supprimer",
    cancel: "Annuler",
    modelCard: "Fiche du modèle sur Hugging Face ↗",
  },
  en: {
    reading: "Reading storage…",
    downloaded: (gb: string) => `Downloaded (${gb} GB). Available offline.`,
    notDownloaded: "Not downloaded — about 0.49 GB, confirmed before downloading.",
    backendLabel: "Computation",
    auto: "Automatic",
    autoHelp: "Graphics card (WebGPU) when available, otherwise processor.",
    cpu: "Processor",
    cpuHelp: "Slower, but pick it if answers look garbled (some mobile graphics drivers).",
    running: (gpu: boolean) => `Loaded on: ${gpu ? "graphics card" : "processor"}.`,
    remove: "Delete Qwen 0.5B",
    removing: "Deleting…",
    removeTitle: "Delete Qwen 0.5B from this device?",
    removeMessage: "The weights (~0.49 GB) will be erased. You will need to download them again to use this model.",
    removeAction: "Delete",
    cancel: "Cancel",
    modelCard: "Model card on Hugging Face ↗",
  },
} as const;

export function PortableModelManager() {
  const { lang } = useLang();
  const s = STRINGS[lang];
  const [size, setSize] = useState<number | null>(null);
  const [backend, setBackend] = useState<PortableBackend>(getPortableBackend);
  const [runtime, setRuntime] = useState(getPortableRuntime);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getPortableCacheSize()
      .then((bytes) => { if (active) setSize(bytes); })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => { active = false; };
  }, []);

  async function changeBackend(next: PortableBackend) {
    setBackend(next);
    setError(null);
    try {
      await setPortableBackend(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
    setRuntime(getPortableRuntime());
  }

  async function remove() {
    const confirmed = await requestConfirm({
      title: s.removeTitle,
      message: s.removeMessage,
      confirmLabel: s.removeAction,
      cancelLabel: s.cancel,
      tone: "danger",
    });
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await deletePortableModel();
      setSize(0);
      setRuntime(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  const gb = size ? new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 2 }).format(size / 1e9) : "";

  return (
    <div className="mt-3 rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
      <p>{size === null ? s.reading : size > 0 ? s.downloaded(gb) : s.notDownloaded}</p>

      <fieldset className="mt-3">
        <legend className="font-medium text-foreground">{s.backendLabel}</legend>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {(["auto", "cpu"] as const).map((option) => (
            <label
              key={option}
              className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition ${
                backend === option ? "border-primary bg-primary/5 text-foreground" : "border-border hover:bg-foreground/5"
              }`}
            >
              <input
                type="radio"
                name="portable-backend"
                value={option}
                checked={backend === option}
                onChange={() => void changeBackend(option)}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="block font-medium text-foreground">{option === "auto" ? s.auto : s.cpu}</span>
                <span className="block">{option === "auto" ? s.autoHelp : s.cpuHelp}</span>
              </span>
            </label>
          ))}
        </div>
        {runtime && <p className="mt-1.5">{s.running(runtime.gpu)}</p>}
      </fieldset>

      {size !== null && size > 0 && (
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="mt-3 min-h-11 rounded-lg border border-border px-3 text-destructive disabled:opacity-50 sm:min-h-0 sm:py-1.5"
        >
          {busy ? s.removing : s.remove}
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-destructive">{error}</p>}
      <a
        href="https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex min-h-11 w-fit items-center text-primary underline underline-offset-2 sm:min-h-0"
      >
        {s.modelCard}
      </a>
    </div>
  );
}
