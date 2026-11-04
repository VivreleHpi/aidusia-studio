import catalogJson from "@/data/local-ai-catalog.json";
import type { Lang } from "@/lib/i18n";

export type LocalAiRuntime = "webllm" | "wllama" | "ollama";

export interface LocalAiCatalogEntry {
  id: string;
  runtime: LocalAiRuntime;
  providerId: string;
  modelId: string;
  name: Record<Lang, string>;
  family: string;
  parametersB: number;
  quantization: string;
  sizeGb: { f16: number; f32: number };
  vramGbMin: number;
  ramGbMin: number;
  contextTokens: number;
  license: string;
  capabilities: string[];
  releasedAt: string;
  compatibility: {
    webgpu: boolean | "optional";
    ollamaTag: string | null;
    mobile: "ok" | "ok_light" | "heavy" | "desktop_only";
  };
}

export interface LocalAiCatalog {
  schemaVersion: number;
  catalogVersion: string;
  updatedAt: string;
  entries: LocalAiCatalogEntry[];
}

const catalog = catalogJson as LocalAiCatalog;

export function getLocalAiCatalog(): LocalAiCatalog {
  return catalog;
}

export function listLocalAiCatalogEntries(): LocalAiCatalogEntry[] {
  return catalog.entries;
}

export function getLocalAiCatalogEntry(id: string): LocalAiCatalogEntry | undefined {
  return catalog.entries.find((e) => e.id === id);
}

export function catalogEntryLabel(entry: LocalAiCatalogEntry, lang: Lang): string {
  return entry.name[lang];
}

export function formatCatalogSize(entry: LocalAiCatalogEntry, lang: Lang, useF32: boolean): string {
  const gb = useF32 ? entry.sizeGb.f32 : entry.sizeGb.f16;
  const formatted = new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
    maximumFractionDigits: 1,
  }).format(gb);
  return lang === "fr" ? `~${formatted} Go` : `~${formatted} GB`;
}
