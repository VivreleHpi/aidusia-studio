import { useEffect, useState } from "react";
import {
  probeHardware,
  probeOllama,
  probeStorageQuotaGb,
  probeWebGpu,
  type HardwareProbe,
  type OllamaProbe,
  type WebGpuProbe,
} from "@/lib/hardwareGovernor";
import { useLang } from "@/lib/i18n";

const verdictStyle: Record<string, string> = {
  optimal: "text-success",
  degrade: "text-warning",
  indisponible: "text-destructive",
  inconnu: "text-muted-foreground",
};

const STRINGS = {
  fr: {
    verdictLabel: {
      optimal: "OPTIMAL",
      degrade: "DÉGRADÉ",
      indisponible: "INDISPONIBLE",
      inconnu: "INCONNU",
    } as Record<string, string>,
    title: "Gouverneur Matériel",
    intro:
      "Estimations navigateur — le navigateur ne lit pas la VRAM réelle, seul Ollama la connaît vraiment (deuxième bloc).",
    webgpuLine: "IA locale dans le navigateur (WebGPU)",
    webgpuHelp:
      "Essayez une version récente de Chrome, Edge ou Safari 26+, et vérifiez que l'accélération matérielle est activée dans les réglages du navigateur. Cela ne bloque rien aujourd'hui (Ollama et le cloud restent disponibles) — ce sera nécessaire pour utiliser l'IA locale dans le navigateur (fournisseur « Sur cet appareil », en bêta).",
    memory: "Mémoire (estimation)",
    memoryUnknown: "non exposée par ce navigateur",
    gb: "Go",
    cpuCores: "Cœurs CPU",
    disk: "Espace disque disponible",
    connection: "Connexion",
    ollamaLocal: "Ollama local",
    reachable: (version: string) => `JOIGNABLE (v${version})`,
    unreachable: "INJOIGNABLE",
    noLoadedModels: "Aucun modèle chargé en mémoire actuellement.",
    vram: "VRAM réelle",
  },
  en: {
    verdictLabel: {
      optimal: "OPTIMAL",
      degrade: "DEGRADED",
      indisponible: "UNAVAILABLE",
      inconnu: "UNKNOWN",
    } as Record<string, string>,
    title: "Hardware Governor",
    intro:
      "Browser estimates — the browser can't read actual VRAM; only Ollama truly knows it (second block).",
    webgpuLine: "Local AI in the browser (WebGPU)",
    webgpuHelp:
      "Try a recent version of Chrome, Edge or Safari 26+, and check that hardware acceleration is enabled in the browser settings. Nothing is blocked today (Ollama and the cloud remain available) — it will be required to use local in-browser AI (the ‘On this device’ provider, in beta).",
    memory: "Memory (estimate)",
    memoryUnknown: "not exposed by this browser",
    gb: "GB",
    cpuCores: "CPU cores",
    disk: "Available disk space",
    connection: "Connection",
    ollamaLocal: "Local Ollama",
    reachable: (version: string) => `REACHABLE (v${version})`,
    unreachable: "UNREACHABLE",
    noLoadedModels: "No model currently loaded in memory.",
    vram: "actual VRAM",
  },
} as const;

interface HardwareGovernorProps {
  ollamaBaseUrl: string;
}

export function HardwareGovernor({ ollamaBaseUrl }: HardwareGovernorProps) {
  const [webgpu, setWebgpu] = useState<WebGpuProbe | null>(null);
  const [hardware, setHardware] = useState<HardwareProbe | null>(null);
  const [storageGb, setStorageGb] = useState<number | null>(null);
  const [ollama, setOllama] = useState<OllamaProbe | null>(null);
  const [ollamaTesting, setOllamaTesting] = useState(false);
  const { lang } = useLang();
  const s = STRINGS[lang];

  useEffect(() => {
    setHardware(probeHardware());
    probeWebGpu().then(setWebgpu);
    probeStorageQuotaGb().then(setStorageGb);
  }, []);

  async function handleOllamaProbe(): Promise<void> {
    setOllamaTesting(true);

    try {
      setOllama(await probeOllama(ollamaBaseUrl));
    } finally {
      setOllamaTesting(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-background/40 p-4">
      <h3 className="mb-1 text-sm font-semibold">{s.title}</h3>
      <p className="mb-3 text-xs text-muted-foreground">{s.intro}</p>

      <div className="mb-3 flex items-center justify-between text-sm">
        <span>{s.webgpuLine}</span>
        <span className={`font-mono text-xs ${webgpu ? verdictStyle[webgpu.verdict] : "text-muted-foreground"}`}>
          {webgpu ? s.verdictLabel[webgpu.verdict] : "…"}
        </span>
      </div>
      {webgpu && <p className="mb-1 text-xs text-muted-foreground">{webgpu.detail}</p>}
      {webgpu && !webgpu.supported && (
        <p className="mb-3 text-xs text-muted-foreground">{s.webgpuHelp}</p>
      )}

      <dl className="mb-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <dt>{s.memory}</dt>
          <dd className="font-mono text-foreground">
            {hardware?.deviceMemoryGb ? `≥ ${hardware.deviceMemoryGb} ${s.gb}` : s.memoryUnknown}
          </dd>
        </div>
        <div>
          <dt>{s.cpuCores}</dt>
          <dd className="font-mono text-foreground">{hardware?.cpuCores ?? "?"}</dd>
        </div>
        <div>
          <dt>{s.disk}</dt>
          <dd className="font-mono text-foreground">{storageGb ? `~${storageGb} ${s.gb}` : "…"}</dd>
        </div>
        <div>
          <dt>{s.connection}</dt>
          <dd className="font-mono text-foreground">{hardware?.connectionType ?? "?"}</dd>
        </div>
      </dl>

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between text-sm">
          <span>{s.ollamaLocal}</span>
          <div className="flex items-center gap-2">
            {ollama !== null &&
              (ollama.reachable ? (
                <span className="font-mono text-xs text-success">
                  {s.reachable(ollama.version ?? "?")}
                </span>
              ) : (
                <span className="font-mono text-xs text-destructive">{s.unreachable}</span>
              ))}
            <button
              type="button"
              onClick={() => void handleOllamaProbe()}
              disabled={ollamaTesting}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-foreground/5 disabled:opacity-50"
            >
              {ollamaTesting
                ? lang === "fr"
                  ? "Test en cours…"
                  : "Testing…"
                : lang === "fr"
                  ? "Tester Ollama"
                  : "Test Ollama"}
            </button>
          </div>
        </div>
        {ollama && !ollama.reachable && (
          <p className="mt-1 text-xs text-muted-foreground">{ollama.error}</p>
        )}
        {ollama?.reachable && (
          <p className="mt-1 text-xs text-muted-foreground">
            {ollama.loadedModels.length === 0
              ? s.noLoadedModels
              : ollama.loadedModels
                  .map((m) => `${m.name} (${m.sizeVramGb} ${s.gb} ${s.vram})`)
                  .join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
