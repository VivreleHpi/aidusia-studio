import { useCallback, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ModelMenu, type ModelReadiness } from "@/components/ModelMenu";
import {
  IconArrowRight,
  IconCheck,
  IconCopy,
  IconLock,
  IconRefresh,
  IconShare,
  IconSparkles,
  IconSquare,
} from "@/components/Icons";
import {
  useComparison,
  type ComparisonResult,
  type ComparisonTarget,
} from "@/hooks/useComparison";
import { useComparisonSynthesis } from "@/hooks/useComparisonSynthesis";
import { isMobile } from "@/lib/deviceDetect";
import { localeOf, useLang, type Lang } from "@/lib/i18n";
import { providerDisplayLabel } from "@/lib/providerTaglines";
import { listProviders } from "@/providers";

const STRINGS = {
  fr: {
    back: "Retour au chat",
    eyebrow: "Comparaison",
    title: "Comparer les IA",
    description: "Posez une question à deux modèles et comparez leurs réponses au même endroit.",
    response: (index: number) => `Réponse ${index === 0 ? "A" : "B"}`,
    model: (index: number) => `Modèle ${index === 0 ? "A" : "B"}`,
    waiting: "La réponse de ce modèle apparaîtra ici.",
    generating: "Génération en cours…",
    emptyResponse: "Le modèle n'a renvoyé aucun contenu.",
    failed: "Ce modèle n'a pas pu répondre.",
    duration: (value: string) => `Répondu en ${value}`,
    copy: "Copier la réponse",
    copied: "Réponse copiée",
    continueInChat: "Continuer dans le chat",
    synthesizeWith: (label: "A" | "B") => `Synthétiser avec ${label}`,
    synthesis: "Synthèse",
    synthesisWaiting: "La synthèse apparaîtra ici.",
    synthesisFailed: "La synthèse n'a pas pu être générée.",
    swap: "Intervertir A et B",
    exportMarkdown: "Exporter en Markdown",
    useResultFailed: "Impossible de continuer dans le chat. Réessayez.",
    promptLabel: "Question à comparer",
    placeholder: "Posez une question aux deux modèles…",
    compare: "Comparer",
    stop: "Arrêter",
    enterHint: "Entrée pour comparer · Maj + Entrée pour une nouvelle ligne",
    chooseModels: "Choisissez deux modèles disponibles pour lancer la comparaison.",
    disclaimer: "Les IA peuvent faire des erreurs. Vérifiez les informations importantes.",
    privacySummary: "Ce qui est envoyé aux modèles",
    privacy:
      "Seule cette question est traitée par les deux modèles. La synthèse envoie la question et les deux réponses au modèle choisi. Aucun historique ni outil MCP n’est envoyé, et rien n’est sauvegardé automatiquement.",
  },
  en: {
    back: "Back to chat",
    eyebrow: "Comparison",
    title: "Compare AI models",
    description: "Ask two models the same question and compare their answers in one place.",
    response: (index: number) => `Response ${index === 0 ? "A" : "B"}`,
    model: (index: number) => `Model ${index === 0 ? "A" : "B"}`,
    waiting: "This model's response will appear here.",
    generating: "Generating…",
    emptyResponse: "The model returned no content.",
    failed: "This model could not respond.",
    duration: (value: string) => `Answered in ${value}`,
    copy: "Copy response",
    copied: "Response copied",
    continueInChat: "Continue in chat",
    synthesizeWith: (label: "A" | "B") => `Synthesize with ${label}`,
    synthesis: "Synthesis",
    synthesisWaiting: "The synthesis will appear here.",
    synthesisFailed: "The synthesis could not be generated.",
    swap: "Swap A and B",
    exportMarkdown: "Export as Markdown",
    useResultFailed: "Could not continue in chat. Please try again.",
    promptLabel: "Question to compare",
    placeholder: "Ask both models a question…",
    compare: "Compare",
    stop: "Stop",
    enterHint: "Enter to compare · Shift + Enter for a new line",
    chooseModels: "Choose two available models to start comparing.",
    disclaimer: "AI can make mistakes. Verify important information.",
    privacySummary: "What is sent to the models",
    privacy:
      "Only this question is processed by both models. Synthesis sends the question and both responses to the selected model. No conversation history or MCP tool is sent, and nothing is saved automatically.",
  },
} as const;

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className={`${className} font-mono text-xs`}>{children}</code>
    ) : (
      <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-xs">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg bg-foreground/10 p-3 last:mb-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-primary/50 pl-3 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border bg-foreground/5 px-2 py-1.5">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1.5 align-top">{children}</td>,
  // Ne jamais charger une image distante issue de la réponse : cela évite les
  // pixels de suivi et garde la comparaison cohérente avec la promesse privée.
  img: ({ alt }) => <span className="text-muted-foreground">[{alt ?? "image"}]</span>,
};

const INITIAL_READINESS: ModelReadiness = { status: "loading" };

function initialTargets(): [ComparisonTarget, ComparisonTarget] {
  return isMobile()
    ? [
        { providerId: "browser", model: "" },
        { providerId: "anthropic", model: "" },
      ]
    : [
        { providerId: "ollama", model: "" },
        { providerId: "browser", model: "" },
      ];
}

function targetLabel(target: ComparisonTarget, lang: Lang): string {
  const provider = listProviders().find((candidate) => candidate.id === target.providerId);
  const providerName =
    providerDisplayLabel(target.providerId, lang) ?? provider?.label ?? target.providerId;
  return target.model ? `${providerName} · ${target.model}` : providerName;
}

function formatDuration(durationMs: number, lang: Lang): string {
  if (durationMs < 1_000) return `${Math.max(0, Math.round(durationMs))} ms`;
  return `${new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: 1 }).format(durationMs / 1_000)} s`;
}

function buildComparisonMarkdown(
  question: string,
  results: ComparisonResult[],
  synthesis: ComparisonResult | null,
  lang: Lang,
): string {
  const s = STRINGS[lang];
  const sections = results.map((result, index) => {
    const content = result.content.trim() || `${s.failed}${result.error ? ` ${result.error}` : ""}`;
    return `## ${s.response(index)} — ${targetLabel(result.target, lang)}\n\n${content}`;
  });

  if (synthesis?.content.trim()) {
    sections.push(
      `## ${s.synthesis} — ${targetLabel(synthesis.target, lang)}\n\n${synthesis.content.trim()}`,
    );
  }

  return `# ${s.title}\n\n## ${s.promptLabel}\n\n${question}\n\n${sections.join("\n\n")}\n`;
}

function downloadMarkdown(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `aidusia-comparaison-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function CopyResultButton({ content, disabled }: { content: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const { lang } = useLang();
  const s = STRINGS[lang];

  async function copy() {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      // L'échec de la permission presse-papiers ne doit pas casser la vue.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      disabled={disabled}
      title={copied ? s.copied : s.copy}
      aria-label={copied ? s.copied : s.copy}
      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {copied ? (
        <IconCheck className="h-3.5 w-3.5 text-success" />
      ) : (
        <IconCopy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

interface ResultCardProps {
  index?: 0 | 1;
  target: ComparisonTarget;
  result?: ComparisonResult;
  lang: Lang;
  kind?: "response" | "synthesis";
  actionsDisabled?: boolean;
  onUse?: () => void | Promise<void>;
  onSynthesize?: () => void;
}

function ResultCard({
  index = 0,
  target,
  result,
  lang,
  kind = "response",
  actionsDisabled = false,
  onUse,
  onSynthesize,
}: ResultCardProps) {
  const s = STRINGS[lang];
  const streaming = result?.status === "streaming";
  const doneWithoutContent = result?.status === "done" && !result.content.trim();
  const successful = result?.status === "done" && Boolean(result.content.trim());
  const cardId = kind === "synthesis" ? "comparison-synthesis" : `comparison-result-${index}`;
  const title = kind === "synthesis" ? s.synthesis : s.response(index);
  const waiting = kind === "synthesis" ? s.synthesisWaiting : s.waiting;
  const failed = kind === "synthesis" ? s.synthesisFailed : s.failed;

  return (
    <article
      aria-labelledby={cardId}
      className="glass flex min-h-44 min-w-0 flex-col overflow-hidden rounded-2xl sm:min-h-72"
    >
      <header className="flex min-h-14 items-center gap-3 border-b border-border/60 px-4 py-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {kind === "synthesis" ? "Σ" : index === 0 ? "A" : "B"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={cardId} className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          <p className="truncate text-[11px] text-muted-foreground" title={targetLabel(target, lang)}>
            {targetLabel(target, lang)}
          </p>
        </div>
        {result?.content ? (
          <CopyResultButton content={result.content} disabled={actionsDisabled} />
        ) : null}
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm leading-6 text-foreground"
        aria-live="polite"
        aria-busy={streaming}
      >
        {!result || result.status === "idle" ? (
          <div className="grid h-full min-h-20 place-items-center text-center text-sm text-muted-foreground sm:min-h-44">
            <div>
              <IconSparkles className="mx-auto mb-2 h-5 w-5 text-primary/60" />
              <p>{waiting}</p>
            </div>
          </div>
        ) : result.content ? (
          <div className="wrap-break-word">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={MARKDOWN_COMPONENTS}
              skipHtml
              urlTransform={defaultUrlTransform}
            >
              {result.content}
            </ReactMarkdown>
            {streaming ? <span className="typing-cursor" aria-hidden="true" /> : null}
          </div>
        ) : streaming ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="typing-cursor" aria-hidden="true" />
            <span>{s.generating}</span>
          </div>
        ) : doneWithoutContent ? (
          <p className="text-muted-foreground">{s.emptyResponse}</p>
        ) : null}

        {result?.status === "error" ? (
          <div
            role="alert"
            className={`${result.content ? "mt-4" : ""} rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive`}
          >
            <p className="font-medium">{failed}</p>
            {result.error ? <p className="mt-1 text-xs opacity-90">{result.error}</p> : null}
          </div>
        ) : null}
      </div>

      {(result?.durationMs !== undefined && result.status !== "streaming") ||
      (successful && (onUse || onSynthesize)) ? (
        <footer className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
          {result?.durationMs !== undefined && result.status !== "streaming" ? (
            <span className="mr-auto">{s.duration(formatDuration(result.durationMs, lang))}</span>
          ) : (
            <span className="mr-auto" />
          )}
          {successful && onSynthesize ? (
            <button
              type="button"
              onClick={onSynthesize}
              disabled={actionsDisabled}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconSparkles className="h-3.5 w-3.5" />
              {s.synthesizeWith(index === 0 ? "A" : "B")}
            </button>
          ) : null}
          {successful && onUse ? (
            <button
              type="button"
              onClick={() => void onUse()}
              disabled={actionsDisabled}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 font-medium text-foreground transition hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {s.continueInChat}
              <IconArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}

export interface CompareViewProps {
  onOpenProviders: () => void;
  keysVersion: number;
  onBackToChat: () => void;
  onUseResult: (prompt: string, result: ComparisonResult) => void | Promise<void>;
}

export function CompareView({
  onOpenProviders,
  keysVersion,
  onBackToChat,
  onUseResult,
}: CompareViewProps) {
  const { lang } = useLang();
  const s = STRINGS[lang];
  const [prompt, setPrompt] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [savingResult, setSavingResult] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const savingResultRef = useRef(false);
  const [targets, setTargets] = useState<[ComparisonTarget, ComparisonTarget]>(initialTargets);
  const [readiness, setReadiness] = useState<[ModelReadiness, ModelReadiness]>([
    INITIAL_READINESS,
    INITIAL_READINESS,
  ]);
  const {
    results,
    running: comparisonRunning,
    compare,
    stop: stopComparison,
    reset: resetComparison,
  } = useComparison(lang);
  const {
    result: synthesisResult,
    running: synthesisRunning,
    synthesize,
    stop: stopSynthesis,
    reset: resetSynthesis,
  } = useComparisonSynthesis(lang);
  const [synthesisTarget, setSynthesisTarget] = useState<ComparisonTarget | null>(null);
  const anyRunning = comparisonRunning || synthesisRunning;
  const actionsBusy = anyRunning || savingResult;

  const setFirstReadiness = useCallback((next: ModelReadiness) => {
    setReadiness((current) =>
      current[0].status === next.status && current[0].message === next.message
        ? current
        : [next, current[1]],
    );
  }, []);

  const setSecondReadiness = useCallback((next: ModelReadiness) => {
    setReadiness((current) =>
      current[1].status === next.status && current[1].message === next.message
        ? current
        : [current[0], next],
    );
  }, []);

  const changeTarget = useCallback(
    (index: 0 | 1, providerId: string, model: string) => {
      if (comparisonRunning || synthesisRunning || savingResultRef.current) return;
      resetComparison();
      resetSynthesis();
      setSynthesisTarget(null);
      setSubmittedPrompt("");
      setActionError(null);
      setTargets((current) => {
        const next = [...current] as [ComparisonTarget, ComparisonTarget];
        next[index] = { providerId, model };
        return next;
      });
    },
    [comparisonRunning, resetComparison, resetSynthesis, synthesisRunning],
  );

  const changeFirstTarget = useCallback(
    (providerId: string, model: string) => changeTarget(0, providerId, model),
    [changeTarget],
  );
  const changeSecondTarget = useCallback(
    (providerId: string, model: string) => changeTarget(1, providerId, model),
    [changeTarget],
  );

  const modelsReady =
    targets.every((target) => Boolean(target.model)) &&
    readiness.every((state) => state.status === "ready");
  const canCompare = !actionsBusy && Boolean(prompt.trim()) && modelsReady;
  const bothResultsSucceeded =
    results.length === 2 &&
    results.every((result) => result.status === "done" && Boolean(result.content.trim()));
  const canExport =
    Boolean(submittedPrompt) &&
    results.length === 2 &&
    results.every((result) => result.status !== "idle" && result.status !== "streaming") &&
    !actionsBusy;
  const readinessHint = useMemo(() => {
    if (modelsReady) return null;
    const detail = readiness
      .map((state, index) =>
        state.status === "ready" || !state.message ? null : `${s.model(index)} : ${state.message}`,
      )
      .filter(Boolean)
      .join(" ");
    return detail || s.chooseModels;
  }, [modelsReady, readiness, s]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = prompt.trim();
    if (!value || !modelsReady || actionsBusy) return;
    resetSynthesis();
    setSynthesisTarget(null);
    setSubmittedPrompt(value);
    setActionError(null);
    void compare(value, targets);
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  function stopActiveFlow() {
    if (comparisonRunning) stopComparison();
    if (synthesisRunning) stopSynthesis();
  }

  function backToChat() {
    if (savingResultRef.current) return;
    stopActiveFlow();
    onBackToChat();
  }

  function swapTargets() {
    if (actionsBusy) return;
    resetComparison();
    resetSynthesis();
    setSynthesisTarget(null);
    setSubmittedPrompt("");
    setActionError(null);
    setTargets((current) => [current[1], current[0]]);
    setReadiness((current) => [current[1], current[0]]);
  }

  function startSynthesis(target: ComparisonTarget) {
    if (!bothResultsSucceeded || !submittedPrompt || actionsBusy) return;
    setActionError(null);
    setSynthesisTarget({ ...target });
    void synthesize(submittedPrompt, results, target);
  }

  function exportComparison() {
    if (!canExport) return;
    downloadMarkdown(buildComparisonMarkdown(submittedPrompt, results, synthesisResult, lang));
  }

  async function useResultInChat(result: ComparisonResult) {
    if (!submittedPrompt || actionsBusy || savingResultRef.current) return;
    savingResultRef.current = true;
    setSavingResult(true);
    setActionError(null);
    try {
      await onUseResult(submittedPrompt, result);
    } catch {
      setActionError(s.useResultFailed);
    } finally {
      savingResultRef.current = false;
      setSavingResult(false);
    }
  }

  const synthesisDisplayResult =
    synthesisResult ??
    (synthesisRunning && synthesisTarget
      ? ({ target: synthesisTarget, status: "streaming", content: "" } satisfies ComparisonResult)
      : undefined);

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="comparison-title">
      <header className="shrink-0 border-b border-border/60 px-3 py-3 sm:px-5">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <button
            type="button"
            onClick={backToChat}
            disabled={savingResult}
            aria-label={s.back}
            title={s.back}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <IconArrowRight className="h-4 w-4 rotate-180" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {s.eyebrow}
            </p>
            <h1 id="comparison-title" className="truncate text-base font-semibold text-foreground sm:text-lg">
              {s.title}
            </h1>
          </div>
          <p className="ml-auto hidden max-w-md text-right text-xs text-muted-foreground md:block">
            {s.description}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-3 flex flex-wrap items-start gap-2">
            {/* Sur téléphone, la note complète occupait un tiers de l'écran :
                elle devient un disclosure, sans rien retirer de l'information. */}
            <details className="min-w-0 flex-1 text-[11px] leading-4 text-muted-foreground sm:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                <IconLock className="h-3.5 w-3.5 shrink-0" />
                <span className="underline decoration-dotted underline-offset-2">
                  {s.privacySummary}
                </span>
              </summary>
              <p className="mt-1.5 pl-5.5">{s.privacy}</p>
            </details>
            <p className="hidden min-w-0 flex-1 items-start gap-2 text-[11px] leading-4 text-muted-foreground sm:flex">
              <IconLock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{s.privacy}</span>
            </p>
            <button
              type="button"
              onClick={exportComparison}
              disabled={!canExport}
              title={s.exportMarkdown}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground transition hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <IconShare className="h-3.5 w-3.5" />
              {s.exportMarkdown}
            </button>
          </div>
          {actionError ? (
            <p
              role="alert"
              className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {actionError}
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            <ResultCard
              index={0}
              target={results[0]?.target ?? targets[0]}
              result={results[0]}
              lang={lang}
              actionsDisabled={actionsBusy}
              onUse={
                submittedPrompt && results[0]
                  ? () => useResultInChat(results[0])
                  : undefined
              }
              onSynthesize={
                bothResultsSucceeded && results[0]
                  ? () => startSynthesis(results[0].target)
                  : undefined
              }
            />
            <ResultCard
              index={1}
              target={results[1]?.target ?? targets[1]}
              result={results[1]}
              lang={lang}
              actionsDisabled={actionsBusy}
              onUse={
                submittedPrompt && results[1]
                  ? () => useResultInChat(results[1])
                  : undefined
              }
              onSynthesize={
                bothResultsSucceeded && results[1]
                  ? () => startSynthesis(results[1].target)
                  : undefined
              }
            />
          </div>
          {synthesisTarget ? (
            <div className="mx-auto mt-4 max-w-4xl">
              <ResultCard
                target={synthesisDisplayResult?.target ?? synthesisTarget}
                result={synthesisDisplayResult}
                lang={lang}
                kind="synthesis"
                actionsDisabled={actionsBusy}
                onUse={
                  submittedPrompt && synthesisResult
                    ? () => useResultInChat(synthesisResult)
                    : undefined
                }
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/60 bg-background/80 px-3 py-3 backdrop-blur-xl sm:px-5">
        <form onSubmit={submit} className="mx-auto w-full max-w-4xl">
          {/* Mobile : A et B empilés pleine largeur, bouton d'échange sur le
              côté (row-span-2). Dès sm : les trois colonnes sur une ligne. */}
          <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-2">
            <fieldset
              disabled={actionsBusy}
              className="glass flex min-w-0 items-center gap-2 rounded-xl px-2 py-1 disabled:opacity-60"
            >
              <span className="shrink-0 pl-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                A
              </span>
              <div className="ml-auto min-w-0">
                <ModelMenu
                  providerId={targets[0].providerId}
                  model={targets[0].model}
                  onChangeProvider={changeFirstTarget}
                  onOpenProviders={onOpenProviders}
                  lockedLocalModel={null}
                  onReadinessChange={setFirstReadiness}
                  reloadRequest={keysVersion}
                />
              </div>
            </fieldset>
            <button
              type="button"
              onClick={swapTargets}
              disabled={actionsBusy}
              aria-label={s.swap}
              title={s.swap}
              className="row-span-2 grid h-10 w-10 shrink-0 place-items-center self-center rounded-xl text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:row-span-1"
            >
              <IconRefresh className="h-4 w-4 rotate-90" />
            </button>
            <fieldset
              disabled={actionsBusy}
              className="glass flex min-w-0 items-center gap-2 rounded-xl px-2 py-1 disabled:opacity-60"
            >
              <span className="shrink-0 pl-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                B
              </span>
              <div className="ml-auto min-w-0">
                <ModelMenu
                  providerId={targets[1].providerId}
                  model={targets[1].model}
                  onChangeProvider={changeSecondTarget}
                  onOpenProviders={onOpenProviders}
                  lockedLocalModel={null}
                  onReadinessChange={setSecondReadiness}
                  reloadRequest={keysVersion}
                />
              </div>
            </fieldset>
          </div>

          <div className="glass flex items-end gap-2 rounded-2xl p-2 shadow-lg shadow-black/5 focus-within:border-ring/50 focus-within:ring-1 focus-within:ring-ring/40">
            <label htmlFor="comparison-prompt" className="sr-only">
              {s.promptLabel}
            </label>
            <textarea
              id="comparison-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handlePromptKeyDown}
              placeholder={s.placeholder}
              rows={2}
              className="max-h-40 min-h-12 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />
            {anyRunning ? (
              <button
                type="button"
                onClick={stopActiveFlow}
                aria-label={s.stop}
                title={s.stop}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground transition hover:opacity-90 active:scale-95 sm:h-10 sm:w-10"
              >
                <IconSquare className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canCompare}
                aria-label={s.compare}
                title={s.compare}
                aria-describedby={readinessHint ? "comparison-readiness" : undefined}
                className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 sm:h-10"
              >
                <IconSparkles className="h-4 w-4" />
                <span className="hidden sm:inline">{s.compare}</span>
              </button>
            )}
          </div>

          <div className="mt-1.5 min-h-4 px-2 text-[10px] text-muted-foreground" aria-live="polite">
            {readinessHint ? (
              <p id="comparison-readiness" className="text-warning">
                {readinessHint}
              </p>
            ) : (
              <p>{s.enterHint}</p>
            )}
            <p className="mt-1 text-center text-muted-foreground">{s.disclaimer}</p>
          </div>
        </form>
      </div>
    </section>
  );
}
