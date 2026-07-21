import { providers } from "@/providers";
import { PROVIDER_LINKS } from "@/lib/providerLinks";
import { useLang } from "@/lib/i18n";
import { IconX } from "@/components/Icons";
import { useDialogFocus } from "@/hooks/useDialogFocus";

interface GuidePageProps {
  onClose: () => void;
}

const STRINGS = {
  fr: {
    dialogLabel: "Notice d'utilisation",
    title: "Notice d'utilisation",
    close: "Fermer",
    intro: "Comment fonctionne ce Studio, et comment récupérer une clé pour chaque fournisseur.",
    overviewTitle: "Vue d'ensemble",
    overviewSteps: [
      {
        title: "1. Choisissez un fournisseur",
        text: "Une IA en local (Ollama, gratuit, rien ne quitte votre machine) ou une clé API cloud (payante ou avec un quota gratuit selon le fournisseur).",
      },
      {
        title: "2. Récupérez une clé (sauf Ollama)",
        text: "Chaque fournisseur cloud a sa propre page de clés API, listée ci-dessous avec un lien direct.",
      },
      {
        title: "3. Collez la clé dans « Fournisseurs »",
        text: "Ouvrez le panneau Fournisseurs (menu Paramètres), collez la clé, elle est testée immédiatement avec un vrai appel.",
      },
      {
        title: "4. Discutez",
        text: "Choisissez le modèle directement dans la zone de saisie et écrivez votre premier message.",
      },
    ],
    keysTitle: "Récupérer une clé, fournisseur par fournisseur",
    getKey: "Obtenir une clé ↗",
    download: "Télécharger ↗",
    privacyTitle: "Confidentialité, en détail",
    privacyText:
      "Conversations et clés restent uniquement dans ce navigateur : les conversations dans IndexedDB, et les clés dans sessionStorage par défaut. Vous pouvez activer leur persistance dans localStorage. Les appels partent directement de votre navigateur vers le fournisseur choisi, avec votre propre clé — sauf OpenAI et Ollama Cloud, qui bloquent les requêtes directes depuis un navigateur (vérifié empiriquement). Pour ces deux-là, un petit proxy stateless et sans log relaie l'appel ; son code est dans ce même dépôt et vérifiable ligne par ligne.",
    limitsTitle: "Limites connues",
    limits: [
      "L'OCR (extraction de texte d'image) est 100% local mais conçu pour le texte imprimé — mauvais sur l'écriture manuscrite, quelle que soit la qualité de la photo.",
      "L'analyse d'image par vision (meilleure sur le manuscrit) n'est câblée que pour Ollama pour l'instant.",
      "La dictée vocale utilise l'API du navigateur, qui sur Chrome/Edge envoie l'audio aux serveurs de Google — ce n'est pas garanti 100% local.",
    ],
  },
  en: {
    dialogLabel: "User guide",
    title: "User guide",
    close: "Close",
    intro: "How this Studio works, and how to get a key for each provider.",
    overviewTitle: "Overview",
    overviewSteps: [
      {
        title: "1. Choose a provider",
        text: "A local AI (Ollama, free, nothing leaves your machine) or a cloud API key (paid, or with a free quota depending on the provider).",
      },
      {
        title: "2. Get a key (except for Ollama)",
        text: "Each cloud provider has its own API keys page, listed below with a direct link.",
      },
      {
        title: "3. Paste the key into \"Providers\"",
        text: "Open the Providers panel (Settings menu), paste the key — it's tested immediately with a real call.",
      },
      {
        title: "4. Chat",
        text: "Pick the model right in the message box and write your first message.",
      },
    ],
    keysTitle: "Getting a key, provider by provider",
    getKey: "Get a key ↗",
    download: "Download ↗",
    privacyTitle: "Privacy, in detail",
    privacyText:
      "Conversations and keys stay only in this browser: conversations in IndexedDB, and keys in sessionStorage by default. You can enable their persistence in localStorage. Requests go directly from your browser to your chosen provider, with your own key — except OpenAI and Ollama Cloud, which block direct browser requests (verified empirically). For those two, a small stateless, no-log proxy relays the call; its code lives in this same repository, auditable line by line.",
    limitsTitle: "Known limitations",
    limits: [
      "OCR (extracting text from images) is 100% local but built for printed text — poor at handwriting, whatever the photo quality.",
      "Vision image analysis (better on handwriting) is only wired up for Ollama for now.",
      "Voice dictation uses the browser API, which on Chrome/Edge sends audio to Google's servers — it isn't guaranteed 100% local.",
    ],
  },
} as const;

export function GuidePage({ onClose }: GuidePageProps) {
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
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.close}
            className="rounded-lg p-2 text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">{s.intro}</p>

        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {s.overviewTitle}
        </h3>
        <div className="mb-6 grid gap-2 sm:grid-cols-2">
          {s.overviewSteps.map((step) => (
            <div key={step.title} className="rounded-lg border border-border bg-background/40 p-3">
              <p className="mb-1 text-sm font-medium">{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>

        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {s.keysTitle}
        </h3>
        <div className="mb-6 flex flex-col gap-2">
          {providers
            .filter((p) => PROVIDER_LINKS[p.id])
            .map((p) => {
              const link = PROVIDER_LINKS[p.id];
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{link.note}</p>
                  </div>
                  <a
                    href={link.keyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-primary hover:bg-accent/10"
                  >
                    {p.requiresApiKey ? s.getKey : s.download}
                  </a>
                </div>
              );
            })}
        </div>

        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {s.privacyTitle}
        </h3>
        <div className="mb-6 space-y-2 text-sm text-muted-foreground">
          <p>{s.privacyText}</p>
        </div>

        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {s.limitsTitle}
        </h3>
        <ul className="mb-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {s.limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>

        <div className="mt-5 flex justify-end border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition duration-150 hover:opacity-90 active:scale-[0.98]"
          >
            {s.close}
          </button>
        </div>
      </div>
    </div>
  );
}
