import { useEffect, useRef, useState } from "react";
import { REPO_URL } from "@/lib/repo";
import {
  dismissStarPrompt,
  loadStarPromptState,
  recordCompletedResponse,
  shouldShowStarPrompt,
  snoozeStarPrompt,
} from "@/lib/starPrompt";
import { useLang } from "@/lib/i18n";
import { IconX } from "@/components/Icons";

const STRINGS = {
  fr: {
    message: "Ce studio vous est utile ? Une étoile sur GitHub aide d'autres personnes à le découvrir.",
    cta: "Étoiler sur GitHub",
    later: "Plus tard",
    never: "Ne plus proposer",
  },
  en: {
    message: "Finding this studio useful? A GitHub star helps others discover it.",
    cta: "Star on GitHub",
    later: "Later",
    never: "Don't ask again",
  },
} as const;

interface StarPromptProps {
  streaming: boolean;
  error: string | null;
}

/* Bandeau discret au-dessus du composer. Voir src/lib/starPrompt.ts pour la
   politique d'affichage (seuils, reports, arrêt définitif). */
export function StarPrompt({ streaming, error }: StarPromptProps) {
  const { lang } = useLang();
  const s = STRINGS[lang];
  const [state, setState] = useState(loadStarPromptState);
  const previousStreamingRef = useRef(streaming);

  useEffect(() => {
    if (previousStreamingRef.current && !streaming && !error) {
      setState(recordCompletedResponse());
    }
    previousStreamingRef.current = streaming;
  }, [streaming, error]);

  if (streaming || error || !shouldShowStarPrompt(state)) return null;

  return (
    <div
      role="status"
      className="glass flex flex-wrap items-center gap-2 rounded-xl border border-border/60 p-2 pl-3 text-xs"
    >
      <span className="text-muted-foreground">⭐ {s.message}</span>
      <span className="ml-auto flex items-center gap-1">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setState(dismissStarPrompt())}
          className="rounded-lg bg-primary px-2.5 py-1.5 font-medium text-primary-foreground transition duration-150 hover:opacity-90 active:scale-[0.98]"
        >
          {s.cta}
        </a>
        <button
          type="button"
          onClick={() => setState(snoozeStarPrompt())}
          className="rounded-lg px-2.5 py-1.5 text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground"
        >
          {s.later}
        </button>
        <button
          type="button"
          onClick={() => setState(dismissStarPrompt())}
          aria-label={s.never}
          title={s.never}
          className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground"
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
}
