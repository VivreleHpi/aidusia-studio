import { useEffect, useState } from "react";
import {
  detectOs,
  isLocalOrigin,
  isMobile,
  markOnboarded,
  ollamaDownloadUrl,
  ollamaOriginsCommand,
} from "@/lib/deviceDetect";
import { probeOllama, probeWebGpu, type OllamaProbe, type WebGpuProbe } from "@/lib/hardwareGovernor";
import { useLang } from "@/lib/i18n";
import { getOllamaBaseUrl } from "@/providers/ollama";

interface OnboardingWizardProps {
  onFinish: () => void;
  onOpenProviders: () => void;
}

const STRINGS = {
  fr: {
    dialogLabel: "Bienvenue dans AIDUSIA studio",
    welcome: "Bienvenue — votre clé, votre modèle, votre navigateur.",
    description:
      "Testez des IA locales ou cloud, sans rien envoyer sur un serveur (sauf les proxys OpenAI/Ollama Cloud, stateless — voir README).",
    checking: "Vérification de votre environnement…",
    ollamaDetectedTitle: (version: string) => `Ollama détecté (v${version})`,
    ollamaDetectedBody: "Tout est prêt — vous pouvez discuter avec vos modèles locaux dès maintenant.",
    installIntroBeforeStrong: "Pour utiliser une IA ",
    installIntroStrong: "locale et gratuite",
    installIntroAfterStrong: ", installez Ollama (2 minutes) :",
    downloadButton: "Télécharger Ollama",
    localOriginNoteBefore:
      "Vous utilisez le Studio en local : aucune configuration supplémentaire n'est nécessaire, Ollama autorise localhost par défaut. Installez-le, lancez-le, puis cliquez sur \"",
    localOriginNoteAfter: "\".",
    remoteOriginNote:
      "Ce site est déployé sur un vrai domaine : Ollama doit explicitement autoriser cette origine. Lancez cette commande au lieu de double-cliquer sur Ollama :",
    copy: "Copier",
    copied: "Copié !",
    retry: "Réessayer",
    cloudAlternativeBefore: "Ou passez directement au cloud : configurez une clé API dans \"",
    cloudAlternativeMid: "\" — aucun téléchargement requis.",
    providersLabel: "Fournisseurs",
    mobileIntro: "Ollama ne s'installe pas sur mobile. Deux options sur ce téléphone :",
    mobileOption1Label: "Le plus simple",
    mobileOption1Body: " : une clé API cloud (Anthropic, Gemini, Mistral, OpenRouter…), aucun téléchargement.",
    mobileOption2Label: "IA locale dans le navigateur",
    mobileOption2Mid: " (Gemma 4, WebGPU) — ",
    webgpuSupported: "votre téléphone est compatible",
    webgpuNotSupported: "pas encore disponible sur cet appareil",
    mobileOption2After: ", fonctionnalité à venir sur ce Studio.",
    configureCloudKey: "Configurer une clé cloud",
    start: "Commencer",
    language: "Langue",
  },
  en: {
    dialogLabel: "Welcome to AIDUSIA studio",
    welcome: "Welcome — your key, your model, your browser.",
    description:
      "Try local or cloud AI models without sending anything to a server (except the OpenAI/Ollama Cloud proxies, which are stateless — see README).",
    checking: "Checking your environment…",
    ollamaDetectedTitle: (version: string) => `Ollama detected (v${version})`,
    ollamaDetectedBody: "Everything is ready — you can chat with your local models right now.",
    installIntroBeforeStrong: "To use a ",
    installIntroStrong: "local, free AI",
    installIntroAfterStrong: ", install Ollama (2 minutes):",
    downloadButton: "Download Ollama",
    localOriginNoteBefore:
      "You're using the Studio locally: no extra configuration is needed, Ollama allows localhost by default. Install it, launch it, then click \"",
    localOriginNoteAfter: "\".",
    remoteOriginNote:
      "This site is deployed on a real domain: Ollama must explicitly allow this origin. Run this command instead of double-clicking Ollama:",
    copy: "Copy",
    copied: "Copied!",
    retry: "Retry",
    cloudAlternativeBefore: "Or skip straight to the cloud: set up an API key in \"",
    cloudAlternativeMid: "\" — no download required.",
    providersLabel: "Providers",
    mobileIntro: "Ollama can't be installed on mobile. Two options on this phone:",
    mobileOption1Label: "The simplest",
    mobileOption1Body: ": a cloud API key (Anthropic, Gemini, Mistral, OpenRouter…), no download.",
    mobileOption2Label: "Local AI in the browser",
    mobileOption2Mid: " (Gemma 4, WebGPU) — ",
    webgpuSupported: "your phone is compatible",
    webgpuNotSupported: "not yet available on this device",
    mobileOption2After: ", a feature coming soon to this Studio.",
    configureCloudKey: "Set up a cloud key",
    start: "Get started",
    language: "Language",
  },
} as const;

export function OnboardingWizard({ onFinish, onOpenProviders }: OnboardingWizardProps) {
  const { lang, setLang } = useLang();
  const s = STRINGS[lang];
  const [ollama, setOllama] = useState<OllamaProbe | null>(null);
  const [webgpu, setWebgpu] = useState<WebGpuProbe | null>(null);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState(false);

  const mobile = isMobile();
  const os = detectOs();
  const localOrigin = isLocalOrigin();
  const command = ollamaOriginsCommand(os);

  async function runProbes() {
    setChecking(true);
    const [o, w] = await Promise.all([probeOllama(getOllamaBaseUrl()), probeWebGpu()]);
    setOllama(o);
    setWebgpu(w);
    setChecking(false);
  }

  useEffect(() => {
    void runProbes();
  }, []);

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

  return (
    <div className="overlay-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-6 backdrop-blur-sm">
      <div
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
            className="flex items-center rounded-lg border border-border/60 p-0.5 text-[10px] font-medium"
          >
            <button
              type="button"
              onClick={() => setLang("fr")}
              aria-pressed={lang === "fr" ? "true" : "false"}
              className={`rounded-md px-1.5 py-1 transition duration-150 ${
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
              className={`rounded-md px-1.5 py-1 transition duration-150 ${
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

        {checking && <p className="text-sm text-muted-foreground">{s.checking}</p>}

        {!checking && !mobile && ollama?.reachable && (
          <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm">
            <p className="mb-1 font-medium text-success">✓ {s.ollamaDetectedTitle(ollama.version ?? "?")}</p>
            <p className="text-muted-foreground">{s.ollamaDetectedBody}</p>
          </div>
        )}

        {!checking && !mobile && !ollama?.reachable && (
          <div className="space-y-3 text-sm">
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

        {!checking && mobile && (
          <div className="space-y-3 text-sm">
            <p>{s.mobileIntro}</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                <strong className="text-foreground">{s.mobileOption1Label}</strong>
                {s.mobileOption1Body}
              </li>
              <li>
                <strong className="text-foreground">{s.mobileOption2Label}</strong>
                {s.mobileOption2Mid}
                {webgpu?.supported ? s.webgpuSupported : s.webgpuNotSupported}
                {s.mobileOption2After}
              </li>
            </ul>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <button
            type="button"
            onClick={() => {
              finish();
              onOpenProviders();
            }}
            className="text-xs text-muted-foreground hover:underline"
          >
            {s.configureCloudKey}
          </button>
          <button
            type="button"
            onClick={finish}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {s.start}
          </button>
        </div>
      </div>
    </div>
  );
}
