import { useCallback, useEffect, useState } from "react";
import {
  detectOs,
  isLocalOrigin,
  isMobile,
  markOnboarded,
  ollamaDownloadUrl,
  ollamaOriginsCommand,
  ollamaOriginsRestartNote,
} from "@/lib/deviceDetect";
import { probeOllama, probeWebGpu, type OllamaProbe, type WebGpuProbe } from "@/lib/hardwareGovernor";
import { useLang } from "@/lib/i18n";
import { getOllamaBaseUrl } from "@/providers/ollama";
import { useDialogFocus } from "@/hooks/useDialogFocus";

interface OnboardingWizardProps {
  onFinish: () => void;
  onOpenProviders: () => void;
}

type OnboardingPath = "choose" | "explore" | "cloud" | "ollama" | "local";

const STRINGS = {
  fr: {
    dialogLabel: "Bienvenue dans AIDUSIA studio",
    welcome: "Bienvenue — votre clé, votre modèle, votre navigateur.",
    description:
      "Testez des IA locales ou cloud depuis votre navigateur. Les données restent locales sauf lorsque vous choisissez un fournisseur cloud, un connecteur MCP ou la dictée du navigateur — voir README.",
    checking: "Vérification de votre environnement…",
    chooseIntro: "Par où commencer ?",
    pathExplore: "Essayer sans rien installer",
    pathExploreHint: "Explorer l'interface, choisir un modèle plus tard.",
    pathCloud: "J'ai une clé API",
    pathCloudHint: "Anthropic, Gemini, Mistral, OpenRouter… aucun téléchargement.",
    pathOllama: "J'ai Ollama sur mon PC",
    pathOllamaHint: "Modèles locaux sur votre ordinateur (ordinateur uniquement).",
    pathLocal: "IA dans le navigateur",
    pathLocalHint: "Modèle léger via WebGPU, sans installation.",
    ollamaDetectedTitle: (version: string) => `Ollama détecté (v${version})`,
    ollamaDetectedBody: "Tout est prêt — vous pouvez discuter avec vos modèles locaux dès maintenant.",
    installIntroBeforeStrong: "Ollama n'est pas joignable depuis ce navigateur. Il peut être installé mais ",
    installIntroStrong: "bloqué par son origine réseau",
    installIntroAfterStrong: ". Vérifiez qu'il est lancé, puis autorisez le site ci-dessous :",
    downloadButton: "Télécharger Ollama",
    localOriginNoteBefore:
      "Vous utilisez le Studio en local : aucune configuration supplémentaire n'est nécessaire, Ollama autorise localhost par défaut. Installez-le, lancez-le, puis cliquez sur \"",
    localOriginNoteAfter: "\".",
    remoteOriginNote:
      "Ce site est déployé sur un vrai domaine : Ollama doit explicitement autoriser cette origine. Exécutez cette commande :",
    copy: "Copier",
    copied: "Copié !",
    retry: "Réessayer",
    cloudAlternativeBefore: "Ou passez directement au cloud : configurez une clé API dans \"",
    cloudAlternativeMid: "\" — aucun téléchargement requis.",
    providersLabel: "Fournisseurs",
    mobileIntro: "Sur téléphone, le plus simple est une clé cloud ou l'IA locale (WebGPU) :",
    mobileOption1Label: "Clé API cloud",
    mobileOption1Body: " — aucun téléchargement, prêt en quelques minutes.",
    mobileOption2Label: "IA locale (WebGPU)",
    mobileOption2Mid: " — ",
    webgpuSupported: "compatible sur cet appareil",
    webgpuNotSupported: "non disponible sur ce navigateur",
    mobileOption2AfterSupported: " ; modèle léger conseillé, sans installation.",
    mobileOption2AfterUnsupported: " ; essayez Chrome/Edge récent ou une clé cloud.",
    mobilePortable:
      "Sans WebGPU : Qwen 2.5 0.5B (environ 0,5 Go, confirmation avant téléchargement) tourne sur le processeur.",
    configureCloudKey: "Configurer une clé cloud",
    start: "Commencer",
    explore: "Explorer sans configurer",
    back: "Retour",
    language: "Langue",
  },
  en: {
    dialogLabel: "Welcome to AIDUSIA studio",
    welcome: "Welcome — your key, your model, your browser.",
    description:
      "Try local or cloud AI models from your browser. Data stays local unless you choose a cloud provider, an MCP connector, or browser dictation — see README.",
    checking: "Checking your environment…",
    chooseIntro: "Where would you like to start?",
    pathExplore: "Try without installing anything",
    pathExploreHint: "Browse the interface and pick a model later.",
    pathCloud: "I have an API key",
    pathCloudHint: "Anthropic, Gemini, Mistral, OpenRouter… no download.",
    pathOllama: "I have Ollama on my PC",
    pathOllamaHint: "Local models on your computer (desktop only).",
    pathLocal: "AI in the browser",
    pathLocalHint: "Lightweight WebGPU model, no install.",
    ollamaDetectedTitle: (version: string) => `Ollama detected (v${version})`,
    ollamaDetectedBody: "Everything is ready — you can chat with your local models right now.",
    installIntroBeforeStrong: "Ollama cannot be reached from this browser. It may be installed but ",
    installIntroStrong: "blocked by its network origin",
    installIntroAfterStrong: ". Check that it is running, then authorize this site below:",
    downloadButton: "Download Ollama",
    localOriginNoteBefore:
      "You're using the Studio locally: no extra configuration is needed, Ollama allows localhost by default. Install it, launch it, then click \"",
    localOriginNoteAfter: "\".",
    remoteOriginNote:
      "This site is deployed on a real domain: Ollama must explicitly allow this origin. Run this command:",
    copy: "Copy",
    copied: "Copied!",
    retry: "Retry",
    cloudAlternativeBefore: "Or skip straight to the cloud: set up an API key in \"",
    cloudAlternativeMid: "\" — no download required.",
    providersLabel: "Providers",
    mobileIntro: "On a phone, the simplest paths are a cloud key or in-browser AI (WebGPU):",
    mobileOption1Label: "Cloud API key",
    mobileOption1Body: " — no download, ready in a few minutes.",
    mobileOption2Label: "In-browser AI (WebGPU)",
    mobileOption2Mid: " — ",
    webgpuSupported: "supported on this device",
    webgpuNotSupported: "not available in this browser",
    mobileOption2AfterSupported: "; a light model is recommended, no install.",
    mobileOption2AfterUnsupported: "; try a recent Chrome/Edge or a cloud key.",
    mobilePortable:
      "Without WebGPU: Qwen 2.5 0.5B (about 0.5 GB, confirmed before download) runs on the processor.",
    configureCloudKey: "Set up a cloud key",
    start: "Get started",
    explore: "Explore without setup",
    back: "Back",
    language: "Language",
  },
} as const;

export function OnboardingWizard({ onFinish, onOpenProviders }: OnboardingWizardProps) {
  const { lang, setLang } = useLang();
  const s = STRINGS[lang];
  const [path, setPath] = useState<OnboardingPath>("choose");
  const [ollama, setOllama] = useState<OllamaProbe | null>(null);
  const [webgpu, setWebgpu] = useState<WebGpuProbe | null>(null);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState(false);
  const dialogRef = useDialogFocus<HTMLDivElement>();

  const mobile = isMobile();
  const os = detectOs();
  const localOrigin = isLocalOrigin();
  const command = ollamaOriginsCommand(os);
  const restartNote = ollamaOriginsRestartNote(os, lang);

  const runProbes = useCallback(async () => {
    setChecking(true);
    const webgpuProbe = await probeWebGpu();
    setWebgpu(webgpuProbe);
    if (mobile) {
      setOllama(null);
      setChecking(false);
      return;
    }
    setOllama(await probeOllama(getOllamaBaseUrl()));
    setChecking(false);
  }, [mobile]);

  useEffect(() => {
    void runProbes();
  }, [runProbes]);

  function finish() {
    markOnboarded();
    onFinish();
  }

  function copyCommand() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function choose(next: OnboardingPath) {
    if (next === "explore") {
      finish();
      return;
    }
    if (next === "cloud") {
      finish();
      onOpenProviders();
      return;
    }
    setPath(next);
  }

  const pathChoiceClass =
    "flex w-full flex-col rounded-lg border border-border/70 px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-accent/5 active:scale-[0.99]";

  return (
    <div className="overlay-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-6 backdrop-blur-sm">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={s.dialogLabel}
        className="modal-in glass w-full max-w-lg rounded-lg bg-card p-6 text-card-foreground shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">AIDUSIA</span>
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">studio</span>
          </div>
          <div
            role="group"
            aria-label={s.language}
            className="flex items-center rounded-lg border border-border/60 p-0.5 text-xs font-medium"
          >
            <button
              type="button"
              onClick={() => setLang("fr")}
              aria-pressed={lang === "fr" ? "true" : "false"}
              className={`min-h-11 min-w-11 rounded-md px-1.5 py-1 transition duration-150 sm:min-h-0 sm:min-w-0 ${
                lang === "fr"
                  ? "bg-accent/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              aria-pressed={lang === "en" ? "true" : "false"}
              className={`min-h-11 min-w-11 rounded-md px-1.5 py-1 transition duration-150 sm:min-h-0 sm:min-w-0 ${
                lang === "en"
                  ? "bg-accent/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              EN
            </button>
          </div>
        </div>
        <p className="mb-1 text-sm text-muted-foreground">{s.welcome}</p>
        <p className="mb-4 text-sm text-muted-foreground">{s.description}</p>

        {checking && path !== "choose" && <p className="text-sm text-muted-foreground">{s.checking}</p>}

        {path === "choose" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{s.chooseIntro}</p>
            <button type="button" className={pathChoiceClass} onClick={() => choose("explore")}>
              <span className="text-sm font-medium">{s.pathExplore}</span>
              <span className="text-xs text-muted-foreground">{s.pathExploreHint}</span>
            </button>
            <button type="button" className={pathChoiceClass} onClick={() => choose("cloud")}>
              <span className="text-sm font-medium">{s.pathCloud}</span>
              <span className="text-xs text-muted-foreground">{s.pathCloudHint}</span>
            </button>
            {!mobile && (
              <button type="button" className={pathChoiceClass} onClick={() => choose("ollama")}>
                <span className="text-sm font-medium">{s.pathOllama}</span>
                <span className="text-xs text-muted-foreground">{s.pathOllamaHint}</span>
              </button>
            )}
            <button type="button" className={pathChoiceClass} onClick={() => choose("local")}>
              <span className="text-sm font-medium">{s.pathLocal}</span>
              <span className="text-xs text-muted-foreground">{s.pathLocalHint}</span>
            </button>
          </div>
        )}

        {path === "local" && !checking && (
          <div className="space-y-3 text-sm">
            <button
              type="button"
              onClick={() => setPath("choose")}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              ← {s.back}
            </button>
            <p>{mobile ? s.mobileIntro : s.pathLocalHint}</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                <strong className="text-foreground">{s.mobileOption2Label}</strong>
                {s.mobileOption2Mid}
                {webgpu?.supported ? s.webgpuSupported : s.webgpuNotSupported}
                {webgpu?.supported ? s.mobileOption2AfterSupported : s.mobileOption2AfterUnsupported}
              </li>
              <li>{s.mobilePortable}</li>
            </ul>
            {!webgpu?.supported && (
              <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {lang === "fr"
                  ? "WebGPU est requis pour l'IA « Sur cet appareil ». Vous pouvez utiliser Qwen 0.5B (portable) ou une clé cloud."
                  : "WebGPU is required for on-device AI. You can use Qwen 0.5B (portable) or a cloud API key."}
              </p>
            )}
          </div>
        )}

        {path === "ollama" && !checking && !mobile && ollama?.reachable && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setPath("choose")}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              ← {s.back}
            </button>
            <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm">
              <p className="mb-1 font-medium text-success">✓ {s.ollamaDetectedTitle(ollama.version ?? "?")}</p>
              <p className="text-muted-foreground">{s.ollamaDetectedBody}</p>
            </div>
          </div>
        )}

        {path === "ollama" && !checking && !mobile && !ollama?.reachable && (
          <div className="space-y-3 text-sm">
            <button
              type="button"
              onClick={() => setPath("choose")}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              ← {s.back}
            </button>
            <p>
              {s.installIntroBeforeStrong}
              <strong>{s.installIntroStrong}</strong>
              {s.installIntroAfterStrong}
            </p>
            <a
              href={ollamaDownloadUrl(os)}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {s.downloadButton} {os !== "inconnu" ? `(${os})` : ""}
            </a>

            {localOrigin ? (
              <p className="text-xs text-muted-foreground">
                {s.localOriginNoteBefore}
                {s.retry}
                {s.localOriginNoteAfter}
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{s.remoteOriginNote}</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-background/60 px-2 py-1 font-mono text-xs">
                    {command}
                  </code>
                  <button
                    type="button"
                    onClick={copyCommand}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/10"
                  >
                    {copied ? s.copied : s.copy}
                  </button>
                </div>
                {restartNote && <p className="text-xs text-muted-foreground">{restartNote}</p>}
              </>
            )}

            <button
              type="button"
              onClick={() => void runProbes()}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/10"
            >
              {s.retry}
            </button>

            <p className="text-xs text-muted-foreground">
              {s.cloudAlternativeBefore}
              {s.providersLabel}
              {s.cloudAlternativeMid}
            </p>
          </div>
        )}

        {path !== "choose" && (
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            {path === "local" || path === "ollama" ? (
              <>
                <button
                  type="button"
                  onClick={() => setPath("choose")}
                  className="min-h-11 text-xs text-muted-foreground hover:underline sm:min-h-0"
                >
                  {s.back}
                </button>
                <button
                  type="button"
                  disabled={checking}
                  onClick={() => {
                    if (path === "ollama" && ollama?.reachable) finish();
                    else if (path === "local") finish();
                    else {
                      finish();
                      onOpenProviders();
                    }
                  }}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {path === "ollama" && ollama?.reachable
                    ? s.start
                    : path === "local"
                      ? s.start
                      : s.configureCloudKey}
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
