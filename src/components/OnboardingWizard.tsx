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
import { getOllamaBaseUrl } from "@/providers/ollama";

interface OnboardingWizardProps {
  onFinish: () => void;
  onOpenProviders: () => void;
}

export function OnboardingWizard({ onFinish, onOpenProviders }: OnboardingWizardProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
      <div className="glass w-full max-w-lg rounded-lg bg-card p-6 text-card-foreground shadow-xl">
        <h2 className="mb-1 text-lg font-semibold">Bienvenue dans AIDUSIA Studio</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Testez des IA locales ou cloud, sans rien envoyer sur un serveur (sauf
          les proxys OpenAI/Ollama Cloud, stateless — voir README).
        </p>

        {checking && <p className="text-sm text-muted-foreground">Vérification de votre environnement…</p>}

        {!checking && !mobile && ollama?.reachable && (
          <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm">
            <p className="mb-1 font-medium text-success">✓ Ollama détecté (v{ollama.version})</p>
            <p className="text-muted-foreground">
              Tout est prêt — vous pouvez discuter avec vos modèles locaux dès maintenant.
            </p>
          </div>
        )}

        {!checking && !mobile && !ollama?.reachable && (
          <div className="space-y-3 text-sm">
            <p>
              Pour utiliser une IA <strong>locale et gratuite</strong>, installez Ollama
              (2 minutes) :
            </p>
            <a
              href={ollamaDownloadUrl(os)}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Télécharger Ollama {os !== "inconnu" ? `(${os})` : ""}
            </a>

            {localOrigin ? (
              <p className="text-xs text-muted-foreground">
                Vous utilisez le Studio en local : aucune configuration
                supplémentaire n'est nécessaire, Ollama autorise localhost par
                défaut. Installez-le, lancez-le, puis cliquez sur "Réessayer".
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Ce site est déployé sur un vrai domaine : Ollama doit
                  explicitement autoriser cette origine. Lancez cette commande
                  au lieu de double-cliquer sur Ollama :
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded-md bg-background/60 px-2 py-1 font-mono text-xs">
                    {command}
                  </code>
                  <button
                    type="button"
                    onClick={copyCommand}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/10"
                  >
                    {copied ? "Copié !" : "Copier"}
                  </button>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => void runProbes()}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/10"
            >
              Réessayer
            </button>

            <p className="text-xs text-muted-foreground">
              Ou passez directement au cloud : configurez une clé API dans
              "Fournisseurs" — aucun téléchargement requis.
            </p>
          </div>
        )}

        {!checking && mobile && (
          <div className="space-y-3 text-sm">
            <p>
              Ollama ne s'installe pas sur mobile. Deux options sur ce
              téléphone :
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Le plus simple</strong> : une clé
                API cloud (Anthropic, Gemini, Mistral, OpenRouter…), aucun
                téléchargement.
              </li>
              <li>
                <strong className="text-foreground">IA locale dans le navigateur</strong>{" "}
                (Gemma 4, WebGPU) —{" "}
                {webgpu?.supported ? "votre téléphone est compatible" : "pas encore disponible sur cet appareil"}
                , fonctionnalité à venir sur ce Studio.
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
            Configurer une clé cloud
          </button>
          <button
            type="button"
            onClick={finish}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Commencer
          </button>
        </div>
      </div>
    </div>
  );
}
