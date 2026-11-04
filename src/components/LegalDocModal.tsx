import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mentionsMd from "../../MENTIONS-LEGALES.md?raw";
import privacyMd from "../../PRIVACY.md?raw";
import { useLang } from "@/lib/i18n";
import { IconX } from "@/components/Icons";
import { useDialogFocus } from "@/hooks/useDialogFocus";

export type LegalDocKind = "mentions" | "privacy";

interface LegalDocModalProps {
  kind: LegalDocKind;
  onClose: () => void;
}

const STRINGS = {
  fr: {
    mentions: "Mentions légales",
    privacy: "Confidentialité",
    close: "Fermer",
  },
  en: {
    mentions: "Legal notice",
    privacy: "Privacy",
    close: "Close",
  },
} as const;

const CONTENT: Record<LegalDocKind, string> = {
  mentions: mentionsMd,
  privacy: privacyMd,
};

export function LegalDocModal({ kind, onClose }: LegalDocModalProps) {
  const { lang } = useLang();
  const s = STRINGS[lang];
  const title = kind === "mentions" ? s.mentions : s.privacy;
  const dialogRef = useDialogFocus<HTMLDivElement>();

  return (
    <div className="overlay-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-in glass my-6 flex w-full max-w-2xl flex-col rounded-lg bg-card text-card-foreground shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.close}
            className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none px-5 py-4 text-sm text-foreground prose-headings:text-foreground prose-a:text-primary">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{CONTENT[kind]}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
