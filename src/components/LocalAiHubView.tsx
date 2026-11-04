import { useCallback, useEffect, useMemo, useState } from "react";
import {
  catalogEntryLabel,
  formatCatalogSize,
  getLocalAiCatalog,
  listLocalAiCatalogEntries,
  type LocalAiCatalogEntry,
} from "@/lib/localAiCatalog";
import {
  assessAllCatalogEntries,
  buildDeviceSnapshot,
  type DeviceSnapshot,
  type EntryFit,
  type FitLevel,
} from "@/lib/localAiFit";
import {
  clearBenchmarkHistory,
  formatBenchmarkLine,
  readBenchmarkHistory,
  runCatalogBenchmark,
  type BenchmarkRun,
} from "@/lib/localAiBenchmark";
import { probeHardware, probeWebGpu } from "@/lib/hardwareGovernor";
import { invalidateProviderReachability } from "@/lib/providerReachability";
import { supportsF16 } from "@/providers/browserLocal";
import { useLang } from "@/lib/i18n";
import { IconArrowRight, IconRefresh, IconSparkles, IconWrench } from "@/components/Icons";

type HubTab = "catalog" | "device" | "benchmark";

const STRINGS = {
  fr: {
    back: "Retour au chat",
    eyebrow: "IA locales",
    title: "Espace IA locales",
    description:
      "Catalogue des modèles locaux, compatibilité avec votre appareil et benchmarks stockés uniquement dans ce navigateur.",
    tabCatalog: "Catalogue",
    tabDevice: "Votre appareil",
    tabBenchmark: "Benchmark",
    catalogMeta: (version: string, updated: string) => `Version ${version} · MAJ ${updated}`,
    colModel: "Modèle",
    colSize: "Taille indicative",
    colFit: "Compatibilité",
    recommended: "Recommandé",
    marginal: "Limité",
    unsupported: "Non adapté",
    refresh: "Actualiser",
    openProviders: "Ouvrir Fournisseurs",
    deviceTitle: "Capacités détectées",
    webgpu: "WebGPU",
    memory: "Mémoire (estim.)",
    cores: "Cœurs CPU",
    formFactor: "Appareil",
    mobile: "Mobile",
    desktop: "Ordinateur",
    yes: "Oui",
    no: "Non",
    unknown: "Inconnu",
    benchmarkHelp:
      "Lance un court échange de test sur le modèle choisi. Les mesures restent locales ; le premier lancement peut inclure un téléchargement.",
    runBenchmark: "Lancer le benchmark",
    running: "Benchmark en cours…",
    clearHistory: "Effacer l'historique",
    history: "Historique",
    noHistory: "Aucun benchmark enregistré.",
    pickModel: "Modèle à tester",
    loading: "Analyse de compatibilité…",
  },
  en: {
    back: "Back to chat",
    eyebrow: "Local AI",
    title: "Local AI hub",
    description:
      "Catalog of local models, fit for your device, and benchmarks stored only in this browser.",
    tabCatalog: "Catalog",
    tabDevice: "Your device",
    tabBenchmark: "Benchmark",
    catalogMeta: (version: string, updated: string) => `Version ${version} · updated ${updated}`,
    colModel: "Model",
    colSize: "Indicative size",
    colFit: "Fit",
    recommended: "Recommended",
    marginal: "Marginal",
    unsupported: "Unsupported",
    refresh: "Refresh",
    openProviders: "Open Providers",
    deviceTitle: "Detected capabilities",
    webgpu: "WebGPU",
    memory: "Memory (est.)",
    cores: "CPU cores",
    formFactor: "Device",
    mobile: "Mobile",
    desktop: "Desktop",
    yes: "Yes",
    no: "No",
    unknown: "Unknown",
    benchmarkHelp:
      "Runs a short test prompt on the selected model. Measurements stay local; the first run may download weights.",
    runBenchmark: "Run benchmark",
    running: "Running benchmark…",
    clearHistory: "Clear history",
    history: "History",
    noHistory: "No benchmarks recorded yet.",
    pickModel: "Model to test",
    loading: "Assessing compatibility…",
  },
} as const;

function fitBadgeClass(level: FitLevel): string {
  switch (level) {
    case "recommended":
      return "bg-success/15 text-success";
    case "marginal":
      return "bg-warning/15 text-warning";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export interface LocalAiHubViewProps {
  onBackToChat: () => void;
  onOpenProviders: () => void;
  keysVersion: number;
}

export function LocalAiHubView({ onBackToChat, onOpenProviders, keysVersion }: LocalAiHubViewProps) {
  const { lang } = useLang();
  const s = STRINGS[lang];
  const meta = getLocalAiCatalog();
  const [tab, setTab] = useState<HubTab>("catalog");
  const [device, setDevice] = useState<DeviceSnapshot | null>(null);
  const [fits, setFits] = useState<EntryFit[]>([]);
  const [loading, setLoading] = useState(true);
  const [useF32, setUseF32] = useState(true);
  const [benchmarkEntryId, setBenchmarkEntryId] = useState(meta.entries[0]?.id ?? "");
  const [benchmarkBusy, setBenchmarkBusy] = useState(false);
  const [history, setHistory] = useState<BenchmarkRun[]>(() => readBenchmarkHistory());

  const refreshFit = useCallback(async () => {
    setLoading(true);
    invalidateProviderReachability();
    const [webgpu, f16] = await Promise.all([probeWebGpu(), supportsF16()]);
    setUseF32(!f16);
    const snapshot = buildDeviceSnapshot(webgpu, probeHardware());
    setDevice(snapshot);
    const next = await assessAllCatalogEntries(listLocalAiCatalogEntries(), snapshot, lang);
    setFits(next);
    setLoading(false);
  }, [lang]);

  useEffect(() => {
    void refreshFit();
  }, [refreshFit, keysVersion]);

  const fitById = useMemo(() => new Map(fits.map((f) => [f.entry.id, f])), [fits]);

  const benchmarkCandidates = fits.filter((f) => f.level !== "unsupported");

  async function handleBenchmark() {
    const entry = listLocalAiCatalogEntries().find((e) => e.id === benchmarkEntryId);
    if (!entry || !device || benchmarkBusy) return;
    setBenchmarkBusy(true);
    try {
      await runCatalogBenchmark(entry, device, lang);
      setHistory(readBenchmarkHistory());
    } finally {
      setBenchmarkBusy(false);
    }
  }

  function fitLabel(level: FitLevel): string {
    switch (level) {
      case "recommended":
        return s.recommended;
      case "marginal":
        return s.marginal;
      default:
        return s.unsupported;
    }
  }

  function renderCatalogRow(entry: LocalAiCatalogEntry) {
    const fit = fitById.get(entry.id);
    const disabled = fit?.level === "unsupported";
    return (
      <tr key={entry.id} className={disabled ? "opacity-55" : undefined}>
        <td className="px-3 py-2 align-top">
          <p className="font-medium text-foreground">{catalogEntryLabel(entry, lang)}</p>
          <p className="text-xs text-muted-foreground">
            {entry.family} · {entry.parametersB}B · {entry.license}
          </p>
          {fit?.reason ? (
            <p className="mt-1 text-xs text-muted-foreground">{fit.reason}</p>
          ) : null}
        </td>
        <td className="px-3 py-2 align-top text-xs text-muted-foreground">
          {formatCatalogSize(entry, lang, useF32)}
          <br />
          {entry.quantization}
        </td>
        <td className="px-3 py-2 align-top">
          {fit ? (
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${fitBadgeClass(fit.level)}`}>
              {fitLabel(fit.level)}
            </span>
          ) : (
            "…"
          )}
        </td>
      </tr>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="local-ai-hub-title">
      <header className="shrink-0 border-b border-border/60 px-3 py-3 sm:px-5">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
          <button
            type="button"
            onClick={onBackToChat}
            aria-label={s.back}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
          >
            <IconArrowRight className="h-4 w-4 rotate-180" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{s.eyebrow}</p>
            <h1 id="local-ai-hub-title" className="truncate text-base font-semibold sm:text-lg">
              {s.title}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
          </div>
          <button
            type="button"
            onClick={() => void refreshFit()}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border px-2.5 text-xs hover:bg-foreground/5"
          >
            <IconRefresh className="h-3.5 w-3.5" />
            {s.refresh}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        <div className="mx-auto w-full max-w-5xl">
          <div
            role="tablist"
            aria-label={s.title}
            className="mb-4 flex flex-wrap gap-2"
          >
            {(
              [
                ["catalog", s.tabCatalog],
                ["device", s.tabDevice],
                ["benchmark", s.tabBenchmark],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id ? "true" : "false"}
                onClick={() => setTab(id)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                  tab === id ? "bg-accent/15 text-foreground" : "text-muted-foreground hover:bg-foreground/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading && tab !== "benchmark" ? (
            <p role="status" className="text-sm text-muted-foreground">
              {s.loading}
            </p>
          ) : null}

          {tab === "catalog" && !loading ? (
            <div role="tabpanel">
              <p className="mb-3 text-xs text-muted-foreground">
                {s.catalogMeta(meta.catalogVersion, meta.updatedAt)}
              </p>
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">{s.colModel}</th>
                      <th className="px-3 py-2">{s.colSize}</th>
                      <th className="px-3 py-2">{s.colFit}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {listLocalAiCatalogEntries().map(renderCatalogRow)}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "device" && device && !loading ? (
            <div role="tabpanel" className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-card/40 p-4">
                <h2 className="mb-3 text-sm font-semibold">{s.deviceTitle}</h2>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">{s.formFactor}</dt>
                    <dd>{device.mobile ? s.mobile : s.desktop}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{s.webgpu}</dt>
                    <dd>{device.webgpuSupported ? s.yes : s.no}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{s.memory}</dt>
                    <dd>
                      {device.deviceMemoryGb !== null
                        ? lang === "fr"
                          ? `${device.deviceMemoryGb} Go`
                          : `${device.deviceMemoryGb} GB`
                        : s.unknown}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{s.cores}</dt>
                    <dd>{device.cpuCores ?? s.unknown}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">{device.webgpuDetail}</p>
              </div>
              <button
                type="button"
                onClick={onOpenProviders}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-foreground/5"
              >
                <IconWrench className="h-3.5 w-3.5" />
                {s.openProviders}
              </button>
            </div>
          ) : null}

          {tab === "benchmark" ? (
            <div role="tabpanel" className="space-y-4">
              <p className="text-xs text-muted-foreground">{s.benchmarkHelp}</p>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-foreground">{s.pickModel}</span>
                <select
                  value={benchmarkEntryId}
                  onChange={(e) => setBenchmarkEntryId(e.target.value)}
                  disabled={benchmarkBusy}
                  className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm"
                >
                  {benchmarkCandidates.map(({ entry, level }) => (
                    <option key={entry.id} value={entry.id}>
                      {catalogEntryLabel(entry, lang)} ({fitLabel(level)})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={benchmarkBusy || !device || benchmarkCandidates.length === 0}
                onClick={() => void handleBenchmark()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                <IconSparkles className="h-4 w-4" />
                {benchmarkBusy ? s.running : s.runBenchmark}
              </button>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{s.history}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      clearBenchmarkHistory();
                      setHistory([]);
                    }}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {s.clearHistory}
                  </button>
                </div>
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{s.noHistory}</p>
                ) : (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {history.map((run) => (
                      <li key={run.id} className="rounded-md border border-border/60 px-2 py-1.5">
                        <span className="font-medium text-foreground">
                          {getLocalAiCatalog().entries.find((e) => e.id === run.catalogEntryId)?.name[lang] ??
                            run.catalogEntryId}
                        </span>
                        {" — "}
                        {formatBenchmarkLine(run, lang)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
