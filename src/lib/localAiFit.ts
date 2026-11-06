import { isMobile } from "@/lib/deviceDetect";
import type { HardwareProbe, WebGpuProbe } from "@/lib/hardwareGovernor";
import type { Lang } from "@/lib/i18n";
import type { LocalAiCatalogEntry } from "@/lib/localAiCatalog";
import { getProviderReachability, type ProviderReachability } from "@/lib/providerReachability";

export type FitLevel = "recommended" | "marginal" | "unsupported";

export interface DeviceSnapshot {
  mobile: boolean;
  webgpuSupported: boolean;
  webgpuDetail: string;
  deviceMemoryGb: number | null;
  cpuCores: number | null;
}

export interface EntryFit {
  entry: LocalAiCatalogEntry;
  level: FitLevel;
  reason: string;
  providerReachability: ProviderReachability;
}

export function buildDeviceSnapshot(
  webgpu: WebGpuProbe,
  hardware: HardwareProbe,
): DeviceSnapshot {
  return {
    mobile: isMobile(),
    webgpuSupported: webgpu.supported,
    webgpuDetail: webgpu.detail,
    deviceMemoryGb: hardware.deviceMemoryGb,
    cpuCores: hardware.cpuCores,
  };
}

function memoryScore(entry: LocalAiCatalogEntry, device: DeviceSnapshot): FitLevel {
  const mem = device.deviceMemoryGb;
  if (mem === null) return "marginal";
  if (mem + 0.5 >= entry.ramGbMin) return "recommended";
  if (mem + 0.5 >= entry.ramGbMin * 0.75) return "marginal";
  return "unsupported";
}

function runtimeGate(
  entry: LocalAiCatalogEntry,
  device: DeviceSnapshot,
  reachability: ProviderReachability,
  lang: Lang,
): { level: FitLevel; reason: string } {
  if (device.mobile && entry.compatibility.mobile === "desktop_only") {
    return {
      level: "unsupported",
      reason:
        lang === "fr"
          ? "Réservé à un ordinateur (Ollama ou modèle trop lourd pour ce téléphone)."
          : "Desktop only (Ollama or model too heavy for this phone).",
    };
  }

  if (entry.runtime === "webllm") {
    if (!device.webgpuSupported) {
      return {
        level: "unsupported",
        reason:
          lang === "fr"
            ? "WebGPU indisponible sur ce navigateur."
            : "WebGPU is unavailable in this browser.",
      };
    }
    if (device.mobile && entry.compatibility.mobile === "heavy") {
      return {
        level: "marginal",
        reason:
          lang === "fr"
            ? "Modèle lourd pour un téléphone — le 1B léger est préférable."
            : "Heavy for a phone — prefer the light 1B model.",
      };
    }
  }

  if (entry.runtime === "wllama" && entry.compatibility.webgpu === "optional" && !device.webgpuSupported) {
    return {
      level: "marginal",
      reason:
        lang === "fr"
          ? "Qwen 0.5B peut tourner sur processeur (plus lent) sans WebGPU."
          : "Qwen 0.5B can run on CPU (slower) without WebGPU.",
    };
  }

  if (reachability !== "ready") {
    if (entry.providerId === "ollama") {
      return {
        level: "unsupported",
        reason:
          lang === "fr"
            ? "Ollama n'est pas joignable — configurez-le dans Fournisseurs."
            : "Ollama is unreachable — set it up in Providers.",
      };
    }
    return {
      level: "marginal",
      reason:
        lang === "fr"
          ? "Fournisseur non prêt — ouvrez Fournisseurs pour vérifier."
          : "Provider not ready — open Providers to check.",
    };
  }

  return { level: "recommended", reason: "" };
}

export async function assessCatalogEntryFit(
  entry: LocalAiCatalogEntry,
  device: DeviceSnapshot,
  lang: Lang,
): Promise<EntryFit> {
  const providerReachability = await getProviderReachability(entry.providerId);
  const runtime = runtimeGate(entry, device, providerReachability, lang);
  if (runtime.level === "unsupported") {
    return { entry, level: "unsupported", reason: runtime.reason, providerReachability };
  }

  const mem = memoryScore(entry, device);
  if (mem === "unsupported") {
    return {
      entry,
      level: "unsupported",
      reason:
        lang === "fr"
          ? `Mémoire système estimée insuffisante (≈ ${entry.ramGbMin} Go conseillés).`
          : `Estimated system memory likely too low (~${entry.ramGbMin} GB advised).`,
      providerReachability,
    };
  }

  const level: FitLevel =
    runtime.level === "marginal" || mem === "marginal" ? "marginal" : "recommended";
  const reason =
    runtime.reason ||
    (mem === "marginal"
      ? lang === "fr"
        ? "Marge mémoire faible — fermez d'autres onglets avant un gros modèle."
        : "Tight on memory — close other tabs before a large model."
      : lang === "fr"
        ? "Compatible avec cet appareil d'après nos estimations."
        : "Likely compatible with this device based on our estimates.");

  return { entry, level, reason, providerReachability };
}

export async function assessAllCatalogEntries(
  entries: LocalAiCatalogEntry[],
  device: DeviceSnapshot,
  lang: Lang,
): Promise<EntryFit[]> {
  return Promise.all(entries.map((entry) => assessCatalogEntryFit(entry, device, lang)));
}
