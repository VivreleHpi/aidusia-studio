import { useCallback, useEffect, useRef, useState } from "react";
import { getApiKey } from "@/lib/apiKeys";
import { describeFetchError } from "@/lib/fetchError";
import type { Lang } from "@/lib/i18n";
import { buildSystemPrompt, isLocalProvider } from "@/lib/systemContext";
import { getProvider } from "@/providers";
import type { ChatProvider } from "@/providers/types";

export interface ComparisonTarget {
  providerId: string;
  model: string;
}

export type ComparisonStatus = "idle" | "queued" | "streaming" | "done" | "error";

export interface ComparisonResult {
  target: ComparisonTarget;
  status: ComparisonStatus;
  content: string;
  error?: string;
  durationMs?: number;
  firstTextMs?: number;
  interrupted?: boolean;
  /** Horodatage de démarrage réel de ce modèle (≠ du lancement en séquentiel). */
  startedAt?: number;
  /** Mesures fournies par le moteur lui-même, quand il les expose. */
  outputTokens?: number;
  tokensPerSecond?: number;
}

export interface CompareOptions {
  /** Lance B seulement quand A a fini : mesures non faussées par la concurrence. */
  sequential?: boolean;
}

/**
 * Deux modèles sur le même appareil se disputent GPU, mémoire et CPU : en
 * parallèle, les temps sont faussés et un téléphone peut manquer de mémoire
 * (deux moteurs locaux ≈ 2 Go). On les enchaîne donc, comme en benchmark.
 */
export function shouldRunSequentially(targets: ComparisonTarget[], benchmark: boolean): boolean {
  return benchmark || targets.every((target) => isLocalProvider(target.providerId));
}

interface ActiveComparison {
  controller: AbortController;
  runId: number;
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
    const now = Date.now();
    setResults((current) =>
      current.map((result) => {
        if (result.status === "streaming") {
          return { ...result, status: "done", durationMs: now - (result.startedAt ?? now), interrupted: true };
        }
        if (result.status === "queued") return { ...result, status: "done", interrupted: true };
        return result;
      }),
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
    async (prompt: string, targets: ComparisonTarget[], options: CompareOptions = {}): Promise<void> => {
      if (targets.length !== 2) {
        throw new Error("La comparaison requiert exactement deux modèles.");
      }

      // Un nouveau comparatif remplace l'ancien. L'ancien run est invalidé
      // avant d'être aborté afin que ses callbacks tardifs soient ignorés.
      activeRef.current?.controller.abort();
      const runId = ++nextRunIdRef.current;
      const controller = new AbortController();
      activeRef.current = { controller, runId };
      const sequential = options.sequential === true;
      const launchedAt = Date.now();

      const targetSnapshots = targets.map((target) => ({ ...target }));
      setResults(
        targetSnapshots.map((target, index) => ({
          target,
          status: sequential && index > 0 ? "queued" : "streaming",
          content: "",
          startedAt: sequential && index > 0 ? undefined : launchedAt,
        })),
      );
      setRunning(true);

      const runTarget = async (target: ComparisonTarget, index: number) => {
        let provider: ChatProvider | undefined;
        const targetStartedAt = Date.now();
        let receivedText = false;
        updateResult(runId, index, (current) =>
          current.status === "queued" ? { ...current, status: "streaming", startedAt: targetStartedAt } : current,
        );

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
              if (chunk.type === "usage") {
                updateResult(runId, index, (current) => ({
                  ...current,
                  outputTokens: chunk.outputTokens,
                  tokensPerSecond: chunk.tokensPerSecond ?? current.tokensPerSecond,
                }));
                return;
              }
              if (chunk.type !== "text" || !chunk.delta) return;
              const firstTextMs = receivedText ? undefined : Date.now() - targetStartedAt;
              receivedText = true;
              updateResult(runId, index, (current) => ({
                ...current,
                content: current.content + chunk.delta,
                firstTextMs: current.firstTextMs ?? firstTextMs,
              }));
            },
          );

          // Mesuré ici, pas dans l'updater : React peut l'exécuter plus tard.
          const durationMs = Date.now() - targetStartedAt;
          updateResult(runId, index, (current) => ({
            ...current,
            status: "done",
            durationMs,
          }));
        } catch (error) {
          const durationMs = Date.now() - targetStartedAt;
          if (isAbortError(error)) {
            updateResult(runId, index, (current) => ({
              ...current,
              status: "done",
              durationMs,
            }));
            return;
          }

          const targetLabel = provider?.label ?? target.providerId;
          updateResult(runId, index, (current) => ({
            ...current,
            status: "error",
            error: describeFetchError(error, targetLabel),
            durationMs,
          }));
        }
      };

      if (sequential) {
        // runTarget ne rejette jamais (erreurs converties en résultat) : B
        // démarre même si A a échoué, sauf si le comparatif a été arrêté.
        for (const [index, target] of targetSnapshots.entries()) {
          if (!isCurrentRun(runId) || controller.signal.aborted) break;
          await runTarget(target, index);
        }
      } else {
        // Les deux promesses sont créées avant l'attente : une erreur ou un
        // stream lent ne bloque jamais le démarrage ni le rendu de l'autre.
        await Promise.allSettled(targetSnapshots.map(runTarget));
      }

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
