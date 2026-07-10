// Gouverneur Materiel (edition navigateur) : verdicts HONNETES sur ce que la
// machine du visiteur peut faire tourner. Le navigateur ne lit pas la VRAM
// reelle -> tout est etiquete "estimation", sauf ce que confirme Ollama
// lui-meme (qui, lui, connait sa vraie VRAM via /api/ps).
export type Verdict = "optimal" | "degrade" | "indisponible" | "inconnu";

export interface WebGpuProbe {
  supported: boolean;
  verdict: Verdict;
  detail: string;
}

export interface HardwareProbe {
  deviceMemoryGb: number | null; // navigator.deviceMemory - Chrome only, plafonne a 8
  cpuCores: number | null;
  connectionType: string | null;
}

export interface OllamaProbe {
  reachable: boolean;
  version: string | null;
  loadedModels: { name: string; sizeVramGb: number }[];
  error: string | null;
}

export async function probeWebGpu(): Promise<WebGpuProbe> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) {
    return { supported: false, verdict: "indisponible", detail: "WebGPU non expose par ce navigateur" };
  }
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return { supported: false, verdict: "indisponible", detail: "Aucun adaptateur WebGPU disponible" };
    }
    return { supported: true, verdict: "optimal", detail: "Adaptateur WebGPU disponible" };
  } catch (err) {
    return {
      supported: false,
      verdict: "degrade",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export function probeHardware(): HardwareProbe {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string };
  };
  return {
    deviceMemoryGb: nav.deviceMemory ?? null,
    cpuCores: navigator.hardwareConcurrency ?? null,
    connectionType: nav.connection?.effectiveType ?? null,
  };
}

export async function probeStorageQuotaGb(): Promise<number | null> {
  if (!navigator.storage?.estimate) return null;
  const { quota } = await navigator.storage.estimate();
  return quota ? Math.round((quota / 1024 ** 3) * 10) / 10 : null;
}

import { describeFetchError } from "@/lib/fetchError";

export async function probeOllama(baseUrl: string): Promise<OllamaProbe> {
  try {
    const versionResponse = await fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(2000) });
    if (!versionResponse.ok) throw new Error(`HTTP ${versionResponse.status}`);
    const { version } = (await versionResponse.json()) as { version: string };

    const psResponse = await fetch(`${baseUrl}/api/ps`, { signal: AbortSignal.timeout(2000) });
    const psData = psResponse.ok
      ? ((await psResponse.json()) as { models: { name: string; size_vram: number }[] })
      : { models: [] };

    return {
      reachable: true,
      version,
      loadedModels: psData.models.map((m) => ({
        name: m.name,
        sizeVramGb: Math.round((m.size_vram / 1024 ** 3) * 10) / 10,
      })),
      error: null,
    };
  } catch (err) {
    return {
      reachable: false,
      version: null,
      loadedModels: [],
      error: describeFetchError(err, "Ollama", baseUrl),
    };
  }
}
