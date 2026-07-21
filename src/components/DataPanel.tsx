import { useState } from "react";
import { IconTrash, IconX } from "@/components/Icons";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useLang } from "@/lib/i18n";
import { deleteAllUserData, exportUserData } from "@/lib/userData";

const STRINGS = {
  fr: {
    dialogLabel: "Données",
    title: "Données",
    close: "Fermer",
    intro:
      "Exportez vos conversations et préférences, ou supprimez toutes les données AIDUSIA de ce navigateur.",
    exportTitle: "Export local",
    exportBody:
      "Le fichier JSON contient conversations, brouillons, préférences et serveurs MCP sans valeurs de headers. Les clés API restent exclues; utilisez l'export chiffré dans Fournisseurs.",
    exportButton: "Exporter mes données",
    deleteTitle: "Suppression complète",
    deleteBody:
      "Supprime conversations, brouillons, préférences, clés API, serveurs MCP, caches PWA et service worker AIDUSIA de ce navigateur. Les ressources des autres applications partageant cette origine sont conservées.",
    confirmLabel: "Tapez SUPPRIMER pour confirmer",
    confirmWord: "SUPPRIMER",
    deleteButton: "Tout supprimer",
    exporting: "Export en cours...",
    deleting: "Suppression en cours...",
    done: "Données supprimées. La page va se recharger.",
  },
  en: {
    dialogLabel: "Data",
    title: "Data",
    close: "Close",
    intro:
      "Export your conversations and preferences, or delete all AIDUSIA data from this browser.",
    exportTitle: "Local export",
    exportBody:
      "The JSON file contains conversations, drafts, preferences and MCP servers without header values. API keys are excluded; use the encrypted export in Providers.",
    exportButton: "Export my data",
    deleteTitle: "Full deletion",
    deleteBody:
      "Deletes conversations, drafts, preferences, API keys, MCP servers, and AIDUSIA's PWA caches and service worker from this browser. Resources belonging to other apps sharing this origin are preserved.",
    confirmLabel: "Type DELETE to confirm",
    confirmWord: "DELETE",
    deleteButton: "Delete everything",
    exporting: "Exporting...",
    deleting: "Deleting...",
    done: "Data deleted. The page will reload.",
  },
} as const;

interface DataPanelProps {
  onClose: () => void;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DataPanel({ onClose }: DataPanelProps) {
  const { lang } = useLang();
  const s = STRINGS[lang];
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const [confirmText, setConfirmText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canDelete = confirmText.trim() === s.confirmWord;

  async function handleExport() {
    setBusy(true);
    setStatus(s.exporting);
    try {
      const blob = await exportUserData();
      downloadBlob(blob, `aidusia-data-${new Date().toISOString().slice(0, 10)}.json`);
      setStatus(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!canDelete) return;
    setBusy(true);
    setStatus(s.deleting);
    try {
      await deleteAllUserData();
      setStatus(s.done);
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="overlay-in fixed inset-0 z-50 flex items-start justify-center bg-background/60 p-3 backdrop-blur-sm sm:p-6">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={s.dialogLabel}
        className="modal-in glass flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-card text-card-foreground shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-4 pt-6">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.close}
            className="rounded-lg p-2 text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground active:scale-[0.98]"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6">
          <p className="text-sm text-muted-foreground">{s.intro}</p>

          <section className="rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold">{s.exportTitle}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.exportBody}</p>
            <button
              type="button"
              onClick={handleExport}
              disabled={busy}
              className="mt-4 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {s.exportButton}
            </button>
          </section>

          <section className="rounded-xl border border-destructive/30 p-4">
            <div className="flex items-start gap-3">
              <IconTrash className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <h3 className="text-sm font-semibold text-destructive">{s.deleteTitle}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.deleteBody}</p>
              </div>
            </div>
            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              {s.confirmLabel}
              <input
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                disabled={busy}
                className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || busy}
              className="mt-3 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {s.deleteButton}
            </button>
          </section>

          {status && (
            <p role="status" className="text-sm text-muted-foreground">
              {status}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
