import type { AssistantTemplate } from "@/lib/assistantTemplates";
import { REPO_URL } from "@/lib/repo";
import {
  IconBook,
  IconKey,
  IconList,
  IconLock,
  IconPencil,
  IconSparkles,
} from "@/components/Icons";

const CHIP_ICONS = [IconPencil, IconBook, IconList, IconSparkles];

export interface ChatWelcomeHeroProps {
  welcomeLine: string;
  helpPrompt: string;
  badgeLocal: string;
  badgeKeys: string;
  badgeOpenSource: string;
  starterChips: AssistantTemplate[];
  onApplyPrompt: (prompt: string) => void;
}

export function ChatWelcomeHero({
  welcomeLine,
  helpPrompt,
  badgeLocal,
  badgeKeys,
  badgeOpenSource,
  starterChips,
  onApplyPrompt,
}: ChatWelcomeHeroProps) {
  return (
    <div className="flex h-full flex-col items-center px-4 text-center">
      <div className="rise-in flex flex-1 flex-col items-center justify-center gap-4">
        <h1 className="bg-linear-to-br from-foreground to-foreground/60 bg-clip-text text-center text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
          AIDUSIA
        </h1>
        <p className="max-w-md text-base text-balance text-muted-foreground">
          {welcomeLine} {helpPrompt}
        </p>
        <div
          className="rise-in mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground"
          style={{ animationDelay: "100ms" }}
        >
          <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/20 px-3 py-1.5 dark:bg-muted/30">
            <IconLock className="h-3.5 w-3.5 shrink-0" /> {badgeLocal}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/20 px-3 py-1.5 dark:bg-muted/30">
            <IconKey className="h-3.5 w-3.5 shrink-0" /> {badgeKeys}
          </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 transition duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground active:scale-[0.98]"
          >
            <IconBook className="h-3.5 w-3.5" /> {badgeOpenSource}
          </a>
        </div>
      </div>

      <div
        className="rise-in mb-3 flex flex-wrap items-center justify-center gap-2"
        style={{ animationDelay: "200ms" }}
      >
        {starterChips.map((chip, i) => {
          const ChipIcon = CHIP_ICONS[i] ?? IconSparkles;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onApplyPrompt(chip.prompt)}
              className="glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs text-foreground transition duration-150 hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.98]"
            >
              <ChipIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
