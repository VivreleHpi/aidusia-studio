import { probeWebGpu } from "@/lib/hardwareGovernor";
import { isMobile } from "@/lib/deviceDetect";
import type { Lang } from "@/lib/i18n";

export type MobileLocalRecommendation = "webgpu" | "portable" | "cloud";

export interface MobileLocalPathAdvice {
  mobile: boolean;
  webgpuSupported: boolean;
  recommendation: MobileLocalRecommendation;
  title: string;
  body: string;
}

export async function getMobileLocalPathAdvice(lang: Lang): Promise<MobileLocalPathAdvice> {
  const mobile = isMobile();
  const webgpu = await probeWebGpu();
  const webgpuSupported = Boolean(webgpu?.supported);

  if (!mobile) {
    return {
      mobile: false,
      webgpuSupported,
      recommendation: webgpuSupported ? "webgpu" : "portable",
      title: "",
      body: "",
    };
  }

  if (webgpuSupported) {
    return {
      mobile: true,
      webgpuSupported: true,
      recommendation: "webgpu",
      title: lang === "fr" ? "IA locale (WebGPU)" : "On-device AI (WebGPU)",
      body:
        lang === "fr"
          ? "Modèles légers recommandés (≤2B). Les téléchargements peuvent être volumineux : préférez le Wi‑Fi."
          : "Stick to light models (≤2B). Downloads can be large — Wi‑Fi is recommended.",
    };
  }

  return {
    mobile: true,
    webgpuSupported: false,
    recommendation: "portable",
    title: lang === "fr" ? "WebGPU indisponible" : "WebGPU unavailable",
    body:
      lang === "fr"
        ? "Sur cet appareil, utilisez Qwen 2.5 0.5B (GGUF, ~0,5 Go, sans WebGPU) ou une clé cloud. L’IA « Sur cet appareil » (WebLLM) reste désactivée."
        : "On this device, use Qwen 2.5 0.5B (GGUF, ~0.5 GB, no WebGPU) or a cloud API key. On-device WebLLM stays disabled.",
  };
}

/** Heuristic perf guard for mobile WebGPU model picks. */
export function isHeavyMobileBrowserModel(modelId: string): boolean {
  return /3[bB]|7[bB]|8[bB]|13[bB]|70[bB]/i.test(modelId);
}

export function heavyMobileModelMessage(lang: Lang, modelId: string): string | null {
  if (!isMobile() || !isHeavyMobileBrowserModel(modelId)) return null;
  return lang === "fr"
    ? `« ${modelId} » est lourd pour un téléphone : risque de lenteur ou d’échec.`
    : `"${modelId}" is heavy for a phone — expect slowness or failure.`;
}
