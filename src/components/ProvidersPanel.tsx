import { useRef, useState, type ChangeEvent } from "react";
import { providers } from "@/providers";
import {
  DEFAULT_OLLAMA_BASE_URL,
  getOllamaBaseUrl,
  setOllamaBaseUrl,
} from "@/providers/ollama";
import { clearAllApiKeys, clearApiKey, getApiKey, isPersistEnabled, setApiKey, setPersistEnabled } from "@/lib/apiKeys";
import { PROVIDER_LINKS } from "@/lib/providerLinks";
import type { KeyTestResult } from "@/providers/types";
import { HardwareGovernor } from "@/components/HardwareGovernor";
import { LocalAiManager } from "@/components/LocalAiManager";
import { IconX } from "@/components/Icons";
import { useLang } from "@/lib/i18n";
import { providerDisabledOnDevice, providerDisplayLabel, providerTagline } from "@/lib/providerTaglines";
import { describeFetchError } from "@/lib/fetchError";
import { exportSettings, importSettings } from "@/lib/settingsTransfer";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { detectOs, ollamaOriginsCommand } from "@/lib/deviceDetect";

const STRINGS = {
  fr: {
    dialogLabel: "Fournisseurs",
    title: "Fournisseurs",
    close: "Fermer",
    intro:
      "Vos clés restent dans ce navigateur — jamais sur un serveur (sauf les proxys OpenAI et Ollama Cloud, stateless, voir README). Le statut ci-dessous reflète un vrai appel au fournisseur, pas juste la présence d'une clé.",
    test: "Tester",
    configure: "Configurer",
    models: "Modèles",
    remove: "Supprimer",
    save: "Enregistrer",
    statusTesting: "Test en cours…",
    statusReachable: "Joignable",
    statusConfigured: "Configuré",
    statusNotConfigured: "Non configuré",
    keyPlaceholder: "Clé API",
    ollamaUrlPlaceholder: "URL d'Ollama (ex. http://192.168.1.20:11434)",
    getKey: "Obtenir une clé ↗",
    download: "Télécharger ↗",
    persistLabel: "Garder mes clés après fermeture du navigateur",
    clearAll: "Tout effacer",
    exportSettings: "Exporter",
    importSettings: "Importer",
    exportPromptPassphrase: "Choisissez une phrase secrète pour chiffrer le fichier :",
    importPromptPassphrase: "Entrez la phrase secrète utilisée pour chiffrer ce fichier :",
    importSuccess: "Réglages importés avec succès.",
    ollamaHelp: "Ollama installé mais inaccessible ? Ouvrir le guide",
    terminalHelp: "Terminal demandé : autorisez ce site dans Ollama",
    copyCommand: "Copier la commande",
    copiedCommand: "Commande copiée",
    cancel: "Annuler",
    confirm: "Continuer",
    passphraseTitle: "Phrase secrète",
    passphrasePlaceholder: "Phrase secrète",
  },
  en: {
    dialogLabel: "Providers",
    title: "Providers",
    close: "Close",
    intro:
      "Your keys stay in this browser — never on a server (except the stateless OpenAI and Ollama Cloud proxies, see the README). The status below reflects an actual call to the provider, not just the presence of a key.",
    test: "Test",
    configure: "Configure",
    models: "Models",
    remove: "Remove",
    save: "Save",
    statusTesting: "Testing…",
    statusReachable: "Reachable",
    statusConfigured: "Configured",
    statusNotConfigured: "Not configured",
    keyPlaceholder: "API key",
    ollamaUrlPlaceholder: "Ollama URL (e.g. http://192.168.1.20:11434)",
    getKey: "Get a key ↗",
    download: "Download ↗",
    persistLabel: "Keep my keys after closing the browser",
    clearAll: "Clear all",
    exportSettings: "Export",
    importSettings: "Import",
    exportPromptPassphrase: "Choose a passphrase to encrypt the file:",
    importPromptPassphrase: "Enter the passphrase used to encrypt this file:",
    importSuccess: "Settings imported successfully.",
    ollamaHelp: "Ollama installed but unreachable? Open the guide",
    terminalHelp: "Terminal required: allow this site in Ollama",
    copyCommand: "Copy command",
    copiedCommand: "Command copied",
    cancel: "Cancel",
    confirm: "Continue",
    passphraseTitle: "Passphrase",
    passphrasePlaceholder: "Passphrase",
  },
} as const;

interface ProviderRowState {
  draft: string;
  editing: boolean;
  testing: boolean;
  result: KeyTestResult | null;
}

function initialRowState(providerId: string): ProviderRowState {
  return {
    // Pour Ollama, le champ configurable est son URL, pas une cle.
    draft: providerId === "ollama" ? getOllamaBaseUrl() : (getApiKey(providerId) ?? ""),
    editing: false,
    testing: false,
    result: null,
  };
}

interface ProvidersPanelProps {
  onClose: () => void;
  onProviderReady?: (providerId: string) => void;
}

export function ProvidersPanel({ onClose, onProviderReady }: ProvidersPanelProps) {
  const { lang } = useLang();
  const s = STRINGS[lang];
  const [rows, setRows] = useState<Record<string, ProviderRowState>>(() =>
    Object.fromEntries(providers.map((p) => [p.id, initialRowState(p.id)])),
  );
  const [persist, setPersist] = useState(isPersistEnabled());
  const [localAiOpen, setLocalAiOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [passphraseAction, setPassphraseAction] = useState<"export" | "import" | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [pendingImport, setPendingImport] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [commandCopied, setCommandCopied] = useState(false);
  const ollamaCommand = ollamaOriginsCommand(detectOs());
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);

  function updateRow(id: string, patch: Partial<ProviderRowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function runTest(providerId: string, selectOnSuccess = false) {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;
    updateRow(providerId, { testing: true, result: null });
    const key = getApiKey(providerId) ?? "";
    const baseUrl = providerId === "ollama" ? getOllamaBaseUrl() : undefined;
    const result = await provider.testKey(key).catch(
      (err): KeyTestResult => ({ ok: false, reason: describeFetchError(err, provider.label, baseUrl) }),
    );
    // Certains testKey attrapent eux-memes l'erreur et renvoient le message
    // brut du navigateur dans reason : on le rend actionnable ici aussi.
    if (!result.ok && result.reason && /failed to fetch|networkerror|load failed/i.test(result.reason)) {
      result.reason = describeFetchError(new TypeError(result.reason), provider.label, baseUrl);
    }
    updateRow(providerId, { testing: false, result });
    if (result.ok && selectOnSuccess) onProviderReady?.(providerId);
  }

  function saveKey(providerId: string) {
    const draft = rows[providerId].draft.trim();
    if (providerId === "ollama") {
      setOllamaBaseUrl(draft || DEFAULT_OLLAMA_BASE_URL);
    } else {
      setApiKey(providerId, draft);
    }
    updateRow(providerId, { editing: false });
    void runTest(providerId, true);
  }

  function removeKey(providerId: string) {
    clearApiKey(providerId);
    updateRow(providerId, { draft: "", editing: false, result: null });
  }

  function togglePersist() {
    const next = !persist;
    setPersistEnabled(next);
    setPersist(next);
  }

  function reloadRows() {
    setRows(Object.fromEntries(providers.map((p) => [p.id, initialRowState(p.id)])));
    setPersist(isPersistEnabled());
  }

  async function handleExport() {
    setPassphrase("");
    setPassphraseAction("export");
  }

  async function submitPassphrase() {
    const secret = passphrase.trim();
    if (!secret) return;
    const action = passphraseAction;
    const file = pendingImport;
    setPassphraseAction(null);
    setPassphrase("");
    try {
      if (action === "export") {
        const blob = await exportSettings(secret);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "aidusia-reglages.aidusia";
        a.click();
        URL.revokeObjectURL(url);
      } else if (action === "import" && file) {
        await importSettings(file, secret);
        reloadRows();
        setNotice(s.importSuccess);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingImport(null);
    }
  }

  function handleImportClick() {
    importInputRef.current?.click();
  }

  async function handleImportFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset immediatement : permet de re-selectionner le meme fichier apres
    // un echec (sinon onChange ne se redeclenche pas pour un chemin identique).
    e.target.value = "";
    if (!file) return;
    setPendingImport(file);
    setPassphrase("");
    setPassphraseAction("import");
  }

  return (
    <div className="overlay-in fixed inset-0 z-50 flex items-start justify-center bg-background/60 p-3 backdrop-blur-sm sm:p-6">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={s.dialogLabel}
        className="modal-in glass flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-card text-card-foreground shadow-xl"
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

        <div className="flex-1 overflow-y-auto px-6">
          <p className="mb-4 text-sm text-muted-foreground">{s.intro}</p>

          <div className="mb-4">
            <HardwareGovernor ollamaBaseUrl={getOllamaBaseUrl()} />
            <a
              href="https://github.com/VivreleHpi/aidusia-studio/blob/main/docs/OLLAMA.md"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            >
              {s.ollamaHelp} ↗
            </a>
            <div className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-3">
              <p className="text-xs font-medium text-foreground">{s.terminalHelp}</p>
              <code className="mt-2 block overflow-x-auto rounded-lg bg-background/70 px-2 py-2 font-mono text-[11px] text-muted-foreground">
                {ollamaCommand}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(ollamaCommand);
                  setCommandCopied(true);
                  window.setTimeout(() => setCommandCopied(false), 1800);
                }}
                className="mt-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
              >
                {commandCopied ? s.copiedCommand : s.copyCommand}
              </button>
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-border divide-y divide-border">
            {providers.map((provider) => {
              const row = rows[provider.id];
              const off = providerDisabledOnDevice(provider.id, lang);
              const displayName = providerDisplayLabel(provider.id, lang) ?? provider.label;
              const configured = provider.requiresApiKey
                ? Boolean(getApiKey(provider.id))
                : true;

              const statusDotClass = row.testing
                ? "bg-warning animate-pulse"
                : row.result
                  ? row.result.ok
                    ? "bg-success"
                    : "bg-destructive"
                  : configured
                    ? "bg-success"
                    : "bg-muted-foreground/30";

              const statusText = row.testing
                ? s.statusTesting
                : row.result
                  ? row.result.ok
                    ? s.statusReachable
                    : row.result.reason
                  : configured
                    ? s.statusConfigured
                    : s.statusNotConfigured;

              const statusTextClass =
                !row.testing && row.result && !row.result.ok
                  ? "text-destructive"
                  : "text-muted-foreground";

              return (
                <div key={provider.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${off.disabled ? "bg-muted-foreground/20" : statusDotClass}`} />
                      <span className={`text-sm font-medium ${off.disabled ? "text-muted-foreground" : ""}`}>{displayName}</span>
                      {!off.disabled && PROVIDER_LINKS[provider.id] && (
                        <a
                          href={PROVIDER_LINKS[provider.id].keyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={PROVIDER_LINKS[provider.id].note}
                          className="text-xs text-primary hover:underline"
                        >
                          {provider.requiresApiKey ? s.getKey : s.download}
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!off.disabled && (
                        <button
                          type="button"
                          onClick={() => runTest(provider.id)}
                          className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground active:scale-[0.98]"
                        >
                          {s.test}
                        </button>
                      )}
                      {!off.disabled && provider.id === "browser" && (
                        <button
                          type="button"
                          onClick={() => setLocalAiOpen((v) => !v)}
                          className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground active:scale-[0.98]"
                        >
                          {s.models}
                        </button>
                      )}
                      {!off.disabled && (provider.requiresApiKey || provider.id === "ollama") && (
                        <button
                          type="button"
                          onClick={() => updateRow(provider.id, { editing: !row.editing })}
                          className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground active:scale-[0.98]"
                        >
                          {s.configure}
                        </button>
                      )}
                      {provider.requiresApiKey && configured && (
                        <button
                          type="button"
                          onClick={() => removeKey(provider.id)}
                          className="rounded-lg px-2.5 py-1.5 text-xs text-destructive transition duration-150 hover:bg-destructive/10 active:scale-[0.98]"
                        >
                          {s.remove}
                        </button>
                      )}
                    </div>
                  </div>

                  {providerTagline(provider.id, lang) && (
                    <p className="mt-0.5 pl-4 text-xs text-muted-foreground/70">
                      {providerTagline(provider.id, lang)}
                    </p>
                  )}
                  {off.disabled ? (
                    <p className="mt-0.5 wrap-break-word pl-4 text-xs text-muted-foreground">{off.reason}</p>
                  ) : (
                    <p className={`mt-0.5 wrap-break-word pl-4 text-xs ${statusTextClass}`}>{statusText}</p>
                  )}

                  {!off.disabled && provider.id === "browser" && localAiOpen && <LocalAiManager />}

                  {!off.disabled && row.editing && (
                    <div className="mt-2 flex gap-2 pl-4">
                      <input
                        type={provider.requiresApiKey ? "password" : "text"}
                        value={row.draft}
                        onChange={(e) => updateRow(provider.id, { draft: e.target.value })}
                        placeholder={provider.requiresApiKey ? s.keyPlaceholder : s.ollamaUrlPlaceholder}
                        className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => saveKey(provider.id)}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition duration-150 active:scale-[0.98]"
                      >
                        {s.save}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={persist}
              onChange={togglePersist}
              style={{ accentColor: "hsl(var(--primary))" }}
            />
            {s.persistLabel}
          </label>
          <div className="flex items-center gap-1">
            <input
              ref={importInputRef}
              type="file"
              accept=".aidusia,application/json"
              className="hidden"
              onChange={handleImportFileChange}
            />
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground active:scale-[0.98]"
            >
              {s.exportSettings}
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground active:scale-[0.98]"
            >
              {s.importSettings}
            </button>
            <button
              type="button"
              onClick={() => {
                clearAllApiKeys();
                reloadRows();
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs text-destructive transition duration-150 hover:bg-destructive/10 active:scale-[0.98]"
            >
              {s.clearAll}
            </button>
          </div>
        </div>
      </div>
      {passphraseAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm">
          <div className="glass w-full max-w-sm rounded-2xl bg-card p-5 text-card-foreground shadow-xl" role="dialog" aria-modal="true" aria-label={s.passphraseTitle}>
            <h2 className="text-base font-semibold">{s.passphraseTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {passphraseAction === "export" ? s.exportPromptPassphrase : s.importPromptPassphrase}
            </p>
            <input
              autoFocus
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void submitPassphrase(); }}
              placeholder={s.passphrasePlaceholder}
              className="mt-4 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setPassphraseAction(null); setPendingImport(null); }} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-foreground/5">{s.cancel}</button>
              <button type="button" onClick={() => void submitPassphrase()} disabled={!passphrase.trim()} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{s.confirm}</button>
            </div>
          </div>
        </div>
      )}
      {notice && (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-card px-4 py-3 text-sm text-card-foreground shadow-lg" role="status">
          <span>{notice}</span>
          <button type="button" className="ml-3 text-muted-foreground hover:text-foreground" onClick={() => setNotice(null)} aria-label={s.close}>×</button>
        </div>
      )}
    </div>
  );
}
