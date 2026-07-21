import { useCallback, useEffect, useRef, useState } from "react";
import { getApiKey } from "@/lib/apiKeys";
import { describeFetchError } from "@/lib/fetchError";
import type { Lang } from "@/lib/i18n";
import { buildSystemPrompt } from "@/lib/systemContext";
import { getProvider } from "@/providers";
import type { ChatProvider } from "@/providers/types";

export interface ComparisonTarget {
  providerId: string;
  model: string;
}

export type ComparisonStatus = "idle" | "streaming" | "done" | "error";

export interface ComparisonResult {
  target: ComparisonTarget;
  status: ComparisonStatus;
  content: string;
  error?: string;
  durationMs?: number;
}

interface ActiveComparison {
  controller: AbortController;
  runId: number;
  startedAt: number;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

/**
 * Lance un comparatif ponctuel entre exactement deux modèles.
 *
 * Ce flux est volontairement indépendant des conversations et de MCP : il ne
 * persiste rien et n'envoie qu'un unique message utilisateur à chaque modèle.
 */
export function useComparison(lang: Lang) {
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [running, setRunning] = useState(false);
  const mountedRef = useRef(true);
  const nextRunIdRef = useRef(0);
  const activeRef = useRef<ActiveComparison | null>(null);

  const isCurrentRun = useCallback(
    (runId: number) => mountedRef.current && activeRef.current?.runId === runId,
    [],
  );

  const updateResult = useCallback(
    (runId: number, index: number, update: (current: ComparisonResult) => ComparisonResult) => {
      if (!isCurrentRun(runId)) return;
      setResults((current) =>
        current.map((result, resultIndex) => (resultIndex === index ? update(result) : result)),
      );
    },
    [isCurrentRun],
  );

  const stop = useCallback(() => {
    const active = activeRef.current;
    if (!active) return;

    active.controller.abort();
    activeRef.current = null;

    if (!mountedRef.current) return;
    const durationMs = Date.now() - active.startedAt;
    setResults((current) =>
      current.map((result) =>
        result.status === "streaming" ? { ...result, status: "done", durationMs } : result,
      ),
    );
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    if (!mountedRef.current) return;
    setResults([]);
    setRunning(false);
  }, [stop]);

  const compare = useCallback(
    async (prompt: string, targets: ComparisonTarget[]): Promise<void> => {
      if (targets.length !== 2) {
        throw new Error("La comparaison requiert exactement deux modèles.");
      }

      // Un nouveau comparatif remplace l'ancien. L'ancien run est invalidé
      // avant d'être aborté afin que ses callbacks tardifs soient ignorés.
      activeRef.current?.controller.abort();
      const runId = ++nextRunIdRef.current;
      const controller = new AbortController();
      const startedAt = Date.now();
      activeRef.current = { controller, runId, startedAt };

      const targetSnapshots = targets.map((target) => ({ ...target }));
      setResults(
        targetSnapshots.map((target) => ({
          target,
          status: "streaming",
          content: "",
        })),
      );
      setRunning(true);

      const runTarget = async (target: ComparisonTarget, index: number) => {
        let provider: ChatProvider | undefined;
        const targetStartedAt = Date.now();

        try {
          provider = getProvider(target.providerId);
          const apiKey = getApiKey(target.providerId);
          await provider.chatStream(
            {
              model: target.model,
              messages: [{ role: "user", content: prompt }],
              systemPrompt: buildSystemPrompt(target.providerId, lang),
              signal: controller.signal,
            },
            apiKey,
            (chunk) => {
              if (chunk.type !== "text") return;
              updateResult(runId, index, (current) => ({
                ...current,
                content: current.content + chunk.delta,
              }));
            },
          );

          updateResult(runId, index, (current) => ({
            ...current,
            status: "done",
            durationMs: Date.now() - targetStartedAt,
          }));
        } catch (error) {
          if (isAbortError(error)) {
            updateResult(runId, index, (current) => ({
              ...current,
              status: "done",
              durationMs: Date.now() - targetStartedAt,
            }));
            return;
          }

          const targetLabel = provider?.label ?? target.providerId;
          updateResult(runId, index, (current) => ({
            ...current,
            status: "error",
            error: describeFetchError(error, targetLabel),
            durationMs: Date.now() - targetStartedAt,
          }));
        }
      };

      // Les deux promesses sont créées avant l'attente : une erreur ou un
      // stream lent ne bloque jamais le démarrage ni le rendu de l'autre.
      await Promise.allSettled(targetSnapshots.map(runTarget));

      if (isCurrentRun(runId)) {
        activeRef.current = null;
        setRunning(false);
      }
    },
    [isCurrentRun, lang, updateResult],
  );

  useEffect(() => {
    // React StrictMode rejoue le cycle setup/cleanup en développement.
    // Réarmer ce drapeau au setup garde le hook utilisable après ce contrôle.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRef.current?.controller.abort();
      activeRef.current = null;
    };
  }, []);

  return { results, running, compare, stop, reset };
}
