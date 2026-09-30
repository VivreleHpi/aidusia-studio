import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { deleteLucioleModel, getLucioleCacheSize } from "@/providers/luciole";

export function LucioleManager() {
  const { lang } = useLang();
  const [size, setSize] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getLucioleCacheSize()
      .then((bytes) => { if (active) setSize(bytes); })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => { active = false; };
  }, []);

  async function remove() {
    if (!window.confirm(lang === "fr" ? "Supprimer Luciole de cet appareil ?" : "Delete Luciole from this device?")) return;
    setBusy(true);
    setError(null);
    try {
      await deleteLucioleModel();
      setSize(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
      <p>
        {size === null
          ? (lang === "fr" ? "Lecture du stockage…" : "Reading storage…")
          : size > 0
            ? (lang === "fr" ? `Téléchargé (${(size / 1e9).toFixed(2)} Go). Disponible hors connexion.` : `Downloaded (${(size / 1e9).toFixed(2)} GB). Available offline.`)
            : (lang === "fr" ? "Non téléchargé — environ 1,02 Go au premier message." : "Not downloaded — about 1.02 GB on first message.")}
      </p>
      {size !== null && size > 0 && (
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="mt-2 min-h-11 rounded-lg border border-border px-3 text-destructive disabled:opacity-50 sm:min-h-0 sm:py-1.5"
        >
          {busy ? (lang === "fr" ? "Suppression…" : "Deleting…") : (lang === "fr" ? "Supprimer Luciole" : "Delete Luciole")}
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-destructive">{error}</p>}
      <a
        href="https://huggingface.co/OpenLLM-France/Luciole-1B-Instruct-1.1-GGUF"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block w-fit text-primary underline underline-offset-2"
      >
        {lang === "fr" ? "Fiche du modèle sur Hugging Face ↗" : "Model card on Hugging Face ↗"}
      </a>
    </div>
  );
}
