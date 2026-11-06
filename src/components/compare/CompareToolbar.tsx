import { IconLock, IconShare } from "@/components/Icons";

export interface CompareToolbarProps {
  privacySummary: string;
  privacy: string;
  benchmarkLabel: string;
  benchmarkEnabled: boolean;
  onToggleBenchmark: () => void;
  exportLabel: string;
  canExport: boolean;
  onExport: () => void;
}

export function CompareToolbar({
  privacySummary,
  privacy,
  benchmarkLabel,
  benchmarkEnabled,
  onToggleBenchmark,
  exportLabel,
  canExport,
  onExport,
}: CompareToolbarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-start gap-2">
      <details className="min-w-0 basis-full text-xs leading-5 text-muted-foreground sm:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <IconLock className="h-3.5 w-3.5 shrink-0" />
          <span className="underline decoration-dotted underline-offset-2">{privacySummary}</span>
        </summary>
        <p className="mt-1.5 pl-5.5">{privacy}</p>
      </details>
      <p className="hidden min-w-0 flex-1 items-start gap-2 text-xs leading-5 text-muted-foreground sm:flex">
        <IconLock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{privacy}</span>
      </p>
      <button
        type="button"
        onClick={onToggleBenchmark}
        aria-pressed={benchmarkEnabled}
        className={`inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-xs font-medium transition sm:min-h-9 ${
          benchmarkEnabled
            ? "border-primary/50 bg-primary/10 text-foreground"
            : "border-border text-foreground hover:bg-foreground/10 dark:hover:bg-foreground/15"
        }`}
      >
        {benchmarkLabel}
      </button>
      <button
        type="button"
        onClick={onExport}
        disabled={!canExport}
        title={exportLabel}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground transition hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-35 sm:min-h-9 dark:hover:bg-foreground/15"
      >
        <IconShare className="h-3.5 w-3.5" />
        {exportLabel}
      </button>
    </div>
  );
}
