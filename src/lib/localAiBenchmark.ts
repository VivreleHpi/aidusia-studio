import type { LocalAiCatalogEntry } from "@/lib/localAiCatalog";
import type { DeviceSnapshot } from "@/lib/localAiFit";
import { getProvider } from "@/providers";
import type { StreamChunk } from "@/providers/types";

const STORAGE_KEY = "aidusia_local_ai_benchmarks";

export interface BenchmarkRun {
  id: string;
  catalogEntryId: string;
  providerId: string;
  modelId: string;
  startedAt: number;
  durationMs: number;
  firstTokenMs: number | null;
  outputChars: number;
  device: DeviceSnapshot;
  ok: boolean;
  error?: string;
}

const BENCHMARK_PROMPT = {
  fr: "Réponds uniquement par le mot OK.",
  en: "Reply with the single word OK.",
} as const;

export function readBenchmarkHistory(): BenchmarkRun[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is BenchmarkRun =>
        item &&
        typeof item === "object" &&
        typeof (item as BenchmarkRun).id === "string" &&
        typeof (item as BenchmarkRun).catalogEntryId === "string",
    );
  } catch {
    return [];
  }
}

export function saveBenchmarkRun(run: BenchmarkRun): void {
  const history = readBenchmarkHistory();
  history.unshift(run);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 40)));
}

export function clearBenchmarkHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function runCatalogBenchmark(
  entry: LocalAiCatalogEntry,
  device: DeviceSnapshot,
  lang: keyof typeof BENCHMARK_PROMPT,
  signal?: AbortSignal,
): Promise<BenchmarkRun> {
  const startedAt = Date.now();
  const id = crypto.randomUUID();
  const provider = getProvider(entry.providerId);
  const prompt = BENCHMARK_PROMPT[lang];
  let firstTokenMs: number | null = null;
  let outputChars = 0;

  try {
    await provider.chatStream(
      {
        model: entry.modelId,
        messages: [{ role: "user", content: prompt }],
        signal,
      },
      undefined,
      (chunk: StreamChunk) => {
        if (chunk.type !== "text") return;
        if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
        outputChars += chunk.delta.length;
      },
    );
    const run: BenchmarkRun = {
      id,
      catalogEntryId: entry.id,
      providerId: entry.providerId,
      modelId: entry.modelId,
      startedAt,
      durationMs: Date.now() - startedAt,
      firstTokenMs,
      outputChars,
      device,
      ok: true,
    };
    saveBenchmarkRun(run);
    return run;
  } catch (err) {
    const run: BenchmarkRun = {
      id,
      catalogEntryId: entry.id,
      providerId: entry.providerId,
      modelId: entry.modelId,
      startedAt,
      durationMs: Date.now() - startedAt,
      firstTokenMs,
      outputChars,
      device,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    saveBenchmarkRun(run);
    return run;
  }
}

export function formatBenchmarkLine(run: BenchmarkRun, lang: "fr" | "en"): string {
  const date = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(run.startedAt);
  if (!run.ok) {
    return lang === "fr"
      ? `${date} — échec (${run.error ?? "?"})`
      : `${date} — failed (${run.error ?? "?"})`;
  }
  const ttft =
    run.firstTokenMs === null
      ? "—"
      : `${run.firstTokenMs} ms`;
  return lang === "fr"
    ? `${date} — ${run.durationMs} ms total · premier token ${ttft} · ${run.outputChars} car.`
    : `${date} — ${run.durationMs} ms total · first token ${ttft} · ${run.outputChars} chars`;
}
