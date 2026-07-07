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

const verdictStyle: Record<string, string> = {
  optimal: "text-success",
  degrade: "text-warning",
  indisponible: "text-destructive",
  inconnu: "text-muted-foreground",
};

const verdictLabel: Record<string, string> = {
  optimal: "OPTIMAL",
  degrade: "DÉGRADÉ",
  indisponible: "INDISPONIBLE",
  inconnu: "INCONNU",
};

interface HardwareGovernorProps {
  ollamaBaseUrl: string;
}

export function HardwareGovernor({ ollamaBaseUrl }: HardwareGovernorProps) {
  const [webgpu, setWebgpu] = useState<WebGpuProbe | null>(null);
  const [hardware, setHardware] = useState<HardwareProbe | null>(null);
  const [storageGb, setStorageGb] = useState<number | null>(null);
  const [ollama, setOllama] = useState<OllamaProbe | null>(null);

  useEffect(() => {
    setHardware(probeHardware());
    probeWebGpu().then(setWebgpu);
    probeStorageQuotaGb().then(setStorageGb);
    probeOllama(ollamaBaseUrl).then(setOllama);
  }, [ollamaBaseUrl]);

  return (
    <div className="rounded-md border border-border bg-background/40 p-4">
      <h3 className="mb-1 text-sm font-semibold">Gouverneur Matériel</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Estimations navigateur — le navigateur ne lit pas la VRAM réelle, seul
        Ollama la connaît vraiment (deuxième bloc).
      </p>

      <div className="mb-3 flex items-center justify-between text-sm">
        <span>IA locale dans le navigateur (WebGPU)</span>
        <span className={`font-mono text-xs ${webgpu ? verdictStyle[webgpu.verdict] : "text-muted-foreground"}`}>
          {webgpu ? verdictLabel[webgpu.verdict] : "…"}
        </span>
      </div>
      {webgpu && <p className="mb-1 text-xs text-muted-foreground">{webgpu.detail}</p>}
      {webgpu && !webgpu.supported && (
        <p className="mb-3 text-xs text-muted-foreground">
          Essayez une version récente de Chrome, Edge ou Safari 26+, et
          vérifiez que l'accélération matérielle est activée dans les
          réglages du navigateur. Cela ne bloque rien aujourd'hui (Ollama et
          le cloud restent disponibles) — ce sera nécessaire pour l'IA locale
          dans le navigateur (Gemma 4), à venir sur ce Studio.
        </p>
      )}

      <dl className="mb-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <dt className="opacity-70">Mémoire (estimation)</dt>
          <dd className="font-mono text-foreground">
            {hardware?.deviceMemoryGb ? `≥ ${hardware.deviceMemoryGb} Go` : "non exposée par ce navigateur"}
          </dd>
        </div>
        <div>
          <dt className="opacity-70">Cœurs CPU</dt>
          <dd className="font-mono text-foreground">{hardware?.cpuCores ?? "?"}</dd>
        </div>
        <div>
          <dt className="opacity-70">Espace disque disponible</dt>
          <dd className="font-mono text-foreground">{storageGb ? `~${storageGb} Go` : "…"}</dd>
        </div>
        <div>
          <dt className="opacity-70">Connexion</dt>
          <dd className="font-mono text-foreground">{hardware?.connectionType ?? "?"}</dd>
        </div>
      </dl>

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between text-sm">
          <span>Ollama local</span>
          {ollama === null ? (
            <span className="text-xs text-muted-foreground">…</span>
          ) : ollama.reachable ? (
            <span className="font-mono text-xs text-success">JOIGNABLE (v{ollama.version})</span>
          ) : (
            <span className="font-mono text-xs text-destructive">INJOIGNABLE</span>
          )}
        </div>
        {ollama && !ollama.reachable && (
          <p className="mt-1 text-xs text-muted-foreground">{ollama.error}</p>
        )}
        {ollama?.reachable && (
          <p className="mt-1 text-xs text-muted-foreground">
            {ollama.loadedModels.length === 0
              ? "Aucun modèle chargé en mémoire actuellement."
              : ollama.loadedModels
                  .map((m) => `${m.name} (${m.sizeVramGb} Go VRAM réelle)`)
                  .join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
