import { useState, type ReactNode } from "react";
import { useLang, type Lang } from "@/lib/i18n";
import { IconCheck, IconCopy, IconPlug, IconShare } from "@/components/Icons";

const ACTION_STRINGS = {
  fr: {
    copyAnswer: "Copier la réponse",
    shareAnswer: "Partager la réponse",
    shareFilename: "aidusia-reponse.md",
    toolResultFrom: "Résultat de",
    toolFallback: "l'outil",
    markdownImageBlocked: "Image Markdown bloquée pour protéger votre confidentialité",
    openMarkdownImage: "Ouvrir l\u2019image externe dans un nouvel onglet",
  },
  en: {
    copyAnswer: "Copy answer",
    shareAnswer: "Share answer",
    shareFilename: "aidusia-response.md",
    toolResultFrom: "Result from",
    toolFallback: "tool",
    markdownImageBlocked: "Markdown image blocked to protect your privacy",
    openMarkdownImage: "Open the external image in a new tab",
  },
} as const;

function safeMarkdownImageHref(src: string | undefined): string | null {
  if (!src || src.length > 2_048) return null;
  try {
    const url = new URL(src, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function BlockedMarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const { lang } = useLang();
  const s = ACTION_STRINGS[lang];
  const safeHref = safeMarkdownImageHref(src);

  return (
    <span
      role="note"
      className="inline-flex flex-wrap items-center gap-x-2 rounded-md border border-border bg-foreground/5 px-2 py-1 text-xs text-muted-foreground dark:bg-foreground/10"
    >
      <span>
        [{s.markdownImageBlocked}{alt?.trim() ? ` : ${alt.trim()}` : ""}]
      </span>
      {safeHref ? (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
        >
          {s.openMarkdownImage}
        </a>
      ) : null}
    </span>
  );
}

export const chatMarkdownComponents = {
  p: ({ children }: { children?: ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li className="mb-0.5">{children}</li>,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
      {children}
    </a>
  ),
  img: BlockedMarkdownImage,
  code: ({ className, children }: { className?: string; children?: ReactNode }) => {
    const isBlock = Boolean(className);
    return isBlock ? (
      <code className={`${className ?? ""} font-mono text-xs`}>{children}</code>
    ) : (
      <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-xs dark:bg-foreground/15">{children}</code>
    );
  },
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="mb-2 overflow-x-auto rounded-md bg-foreground/10 p-3 last:mb-0 dark:bg-foreground/15">{children}</pre>
  ),
};

export function CopyAnswerButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { lang } = useLang();
  const s = ACTION_STRINGS[lang];
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={s.copyAnswer}
      aria-label={s.copyAnswer}
      className="inline-grid min-h-11 min-w-11 place-items-center rounded-md p-1 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground sm:min-h-0 sm:min-w-0 dark:hover:bg-foreground/15"
    >
      {copied ? (
        <IconCheck className="h-3.5 w-3.5 text-success" />
      ) : (
        <IconCopy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function ShareAnswerButton({ text }: { text: string }) {
  const { lang } = useLang();
  const s = ACTION_STRINGS[lang];
  return (
    <button
      type="button"
      onClick={async () => {
        if (typeof navigator.share === "function") {
          try {
            await navigator.share({ text });
            return;
          } catch (err) {
            if ((err as Error).name === "AbortError") return;
          }
        }
        const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = s.shareFilename;
        link.click();
        URL.revokeObjectURL(url);
      }}
      title={s.shareAnswer}
      aria-label={s.shareAnswer}
      className="inline-grid min-h-11 min-w-11 place-items-center rounded-md p-1 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground sm:min-h-0 sm:min-w-0 dark:hover:bg-foreground/15"
    >
      <IconShare className="h-3.5 w-3.5" />
    </button>
  );
}

export function ToolResultBlock({ name, content }: { name?: string; content: string }) {
  const { lang } = useLang();
  const s = ACTION_STRINGS[lang];
  return (
    <details className="message-in w-full rounded-md border border-border bg-background/40 px-3 py-1.5 text-xs text-muted-foreground dark:bg-card/50">
      <summary className="flex cursor-pointer items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <IconPlug className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {s.toolResultFrom} <span className="font-mono">{name ?? s.toolFallback}</span>
        </span>
      </summary>
      <pre className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap wrap-break-word font-mono text-[11px]">
        {content}
      </pre>
    </details>
  );
}

export function chatActionStrings(lang: Lang) {
  return ACTION_STRINGS[lang];
}
