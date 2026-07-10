import { useEffect, useState } from "react";
import { shortcutLabel } from "@/lib/deviceDetect";
import { useLang, type Lang } from "@/lib/i18n";

interface TourStep {
  selector: string;
  title: string;
  description: string;
}

const STRINGS = {
  fr: {
    stepOf: (current: number, total: number) => `Étape ${current} / ${total}`,
    skip: "Passer",
    previous: "Précédent",
    next: "Suivant",
    finish: "Terminer",
  },
  en: {
    stepOf: (current: number, total: number) => `Step ${current} / ${total}`,
    skip: "Skip",
    previous: "Back",
    next: "Next",
    finish: "Done",
  },
} as const;

function stepsFor(lang: Lang): TourStep[] {
  if (lang === "en") {
    return [
      {
        selector: '[data-tour="new-conversation"]',
        title: "Start a conversation",
        description: "Each conversation is independent and stays only in your browser.",
      },
      {
        selector: '[data-tour="search"]',
        title: "Find a conversation",
        description: `Search by title, grouped by period — or press ${shortcutLabel("K")} from anywhere.`,
      },
      {
        selector: '[data-tour="provider-bar"]',
        title: "Choose your AI",
        description: "Ollama locally (free), or a cloud API key (Anthropic, Gemini, Mistral, OpenRouter…).",
      },
      {
        selector: '[data-tour="chat-input"]',
        title: "Write, dictate, or send an image",
        description: "Local OCR, vision image analysis, and voice dictation are all available right here.",
      },
      {
        selector: '[data-tour="settings-menu"]',
        title: "Settings, FAQ, about",
        description: "Find this tour, the FAQ, and providers anytime from this menu.",
      },
    ];
  }
  return [
    {
      selector: '[data-tour="new-conversation"]',
      title: "Démarrez une conversation",
      description: "Chaque conversation est indépendante et reste uniquement dans votre navigateur.",
    },
    {
      selector: '[data-tour="search"]',
      title: "Retrouvez une conversation",
      description: `Recherchez par titre, groupé par période — ou utilisez ${shortcutLabel("K")} depuis n'importe où.`,
    },
    {
      selector: '[data-tour="provider-bar"]',
      title: "Choisissez votre IA",
      description: "Ollama en local (gratuit), ou une clé API cloud (Anthropic, Gemini, Mistral, OpenRouter…).",
    },
    {
      selector: '[data-tour="chat-input"]',
      title: "Écrivez, dictez, ou envoyez une image",
      description: "OCR local, analyse d'image par vision, et dictée vocale sont accessibles directement ici.",
    },
    {
      selector: '[data-tour="settings-menu"]',
      title: "Paramètres, FAQ, présentation",
      description: "Retrouvez cette visite, la FAQ, et les fournisseurs à tout moment depuis ce menu.",
    },
  ];
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface GuidedTourProps {
  onFinish: () => void;
}

export function GuidedTour({ onFinish }: GuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const { lang } = useLang();
  const s = STRINGS[lang];
  const steps = stepsFor(lang);
  const step = steps[stepIndex];

  useEffect(() => {
    function measure() {
      const el = document.querySelector(step.selector);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step.selector]);

  function next() {
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
    else onFinish();
  }

  function prev() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  const pad = 6;
  const spotlight = rect && {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };

  const tooltipTop = spotlight ? spotlight.top + spotlight.height + 12 : window.innerHeight / 2;
  const flipUp = tooltipTop + 160 > window.innerHeight;

  return (
    <div className="fixed inset-0 z-60">
      {spotlight && (
        <div
          className="fixed rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] transition-all duration-200"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}
      {!spotlight && <div className="fixed inset-0 bg-background/70" />}

      <div
        key={stepIndex}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="modal-in glass fixed w-72 rounded-lg bg-card p-4 text-card-foreground shadow-xl"
        style={{
          top: spotlight ? (flipUp ? undefined : tooltipTop) : "50%",
          bottom: spotlight && flipUp ? window.innerHeight - spotlight.top + 12 : undefined,
          left: spotlight ? Math.min(Math.max(spotlight.left, 16), window.innerWidth - 304) : "50%",
          transform: spotlight ? undefined : "translate(-50%, -50%)",
        }}
      >
        <p className="mb-1 text-xs font-medium text-primary">
          {s.stepOf(stepIndex + 1, steps.length)}
        </p>
        <p className="mb-1 text-sm font-semibold">{step.title}</p>
        <p className="mb-3 text-xs text-muted-foreground">{step.description}</p>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onFinish}
            className="text-xs text-muted-foreground hover:underline"
          >
            {s.skip}
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={prev}
                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/10"
              >
                {s.previous}
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              {stepIndex === steps.length - 1 ? s.finish : s.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
