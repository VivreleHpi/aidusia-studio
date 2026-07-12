import { IconBook, IconEyeOff, IconKey, IconLock, IconX } from "@/components/Icons";
import { useLang } from "@/lib/i18n";
import { useDialogFocus } from "@/hooks/useDialogFocus";

interface AboutModalProps {
  onClose: () => void;
}

const STRINGS = {
  fr: {
    dialogLabel: "Présentation d'AIDUSIA Studio",
    close: "Fermer",
    tagline: "Une fenêtre ouverte sur l'IA, sans compromis sur la confidentialité.",
    steps: [
      {
        title: "Choisissez votre IA",
        text: "Une clé API cloud (Anthropic, Gemini, Mistral, OpenRouter…) ou Ollama en local, gratuit — vous gardez la main.",
      },
      {
        title: "Discutez, depuis votre navigateur",
        text: "Aucune installation lourde, aucun compte. Ça marche immédiatement, sur ordinateur comme sur mobile.",
      },
      {
        title: "Rien ne transite par un serveur à nous",
        text: "Vos conversations et vos clés restent dans ce navigateur. Le code est ouvert, vérifiable ligne par ligne.",
      },
    ],
    trustPoints: [
      "100% local possible (Ollama)",
      "Vos clés, vos règles (BYOK)",
      "Open source, vérifiable",
      "Zéro compte, zéro tracking",
    ],
    disclaimer:
      "Ce Studio n'est pas le produit complet AIDUSIA : c'est une brique isolée, volontairement minimale, pensée pour être testée et vérifiée par n'importe qui.",
    start: "Commencer",
  },
  en: {
    dialogLabel: "About AIDUSIA Studio",
    close: "Close",
    tagline: "An open window onto AI, with no compromise on privacy.",
    steps: [
      {
        title: "Choose your AI",
        text: "A cloud API key (Anthropic, Gemini, Mistral, OpenRouter…) or Ollama locally, for free — you stay in control.",
      },
      {
        title: "Chat, from your browser",
        text: "No heavy install, no account. It works immediately, on desktop and mobile alike.",
      },
      {
        title: "Nothing passes through a server of ours",
        text: "Your conversations and keys stay in this browser. The code is open, auditable line by line.",
      },
    ],
    trustPoints: [
      "100% local possible (Ollama)",
      "Your keys, your rules (BYOK)",
      "Open source, auditable",
      "No account, no tracking",
    ],
    disclaimer:
      "This Studio is not the complete AIDUSIA product: it's a single, deliberately minimal piece, built to be tested and verified by anyone.",
    start: "Get started",
  },
} as const;

const TRUST_ICONS = [IconLock, IconKey, IconBook, IconEyeOff];

export function AboutModal({ onClose }: AboutModalProps) {
  const { lang } = useLang();
  const s = STRINGS[lang];
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);

  return (
    <div className="overlay-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/60 p-6 backdrop-blur-sm">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={s.dialogLabel}
        className="modal-in glass w-full max-w-2xl rounded-lg bg-card p-6 text-card-foreground shadow-xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tracking-tight text-foreground">AIDUSIA</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
              studio
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.close}
            className="rounded-lg p-2 text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">{s.tagline}</p>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {s.steps.map((step, i) => (
            <div key={step.title} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {i + 1}
              </div>
              <p className="mb-1 text-sm font-medium">{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {s.trustPoints.map((text, i) => {
            const Icon = TRUST_ICONS[i];
            return (
              <span key={text} className="glass flex items-center gap-1.5 rounded-full px-3 py-1">
                <Icon className="h-3.5 w-3.5" /> {text}
              </span>
            );
          })}
        </div>

        <div className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          {s.disclaimer}
        </div>

        <div className="mt-5 flex justify-end border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition duration-150 hover:opacity-90 active:scale-[0.98]"
          >
            {s.start}
          </button>
        </div>
      </div>
    </div>
  );
}
