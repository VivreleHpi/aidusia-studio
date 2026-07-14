import { useState } from "react";
import { usePwaStatus } from "@/hooks/usePwaStatus";
import { promptPwaInstall, reloadForPwaUpdate } from "@/lib/offline";
import { useLang } from "@/lib/i18n";

const STRINGS = {
  fr: {
    online: "En ligne",
    offline: "Hors ligne",
    updateReady: "Mise à jour prête",
    reload: "Recharger",
    install: "Installer l’application",
    installing: "Ouverture…",
  },
  en: {
    online: "Online",
    offline: "Offline",
    updateReady: "Update ready",
    reload: "Reload",
    install: "Install app",
    installing: "Opening…",
  },
} as const;

export function PwaStatus() {
  const { lang } = useLang();
  const pwa = usePwaStatus();
  const [prompting, setPrompting] = useState(false);
  const s = STRINGS[lang];

  async function install() {
    setPrompting(true);
    try {
      await promptPwaInstall();
    } finally {
      setPrompting(false);
    }
  }

  return (
    <div className="px-2 py-1.5 text-xs text-muted-foreground" aria-live="polite">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${pwa.online ? "bg-success" : "bg-warning"}`}
        />
        <span>{pwa.online ? s.online : s.offline}</span>
      </div>
      {pwa.updateReady && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span>{s.updateReady}</span>
          <button
            type="button"
            onClick={reloadForPwaUpdate}
            className="rounded-md border border-border px-2 py-1 text-foreground transition hover:bg-foreground/5"
          >
            {s.reload}
          </button>
        </div>
      )}
      {pwa.installAvailable && (
        <button
          type="button"
          disabled={prompting}
          onClick={() => void install()}
          className="mt-1.5 rounded-md border border-border px-2 py-1 text-foreground transition hover:bg-foreground/5 disabled:opacity-50"
        >
          {prompting ? s.installing : s.install}
        </button>
      )}
    </div>
  );
}
