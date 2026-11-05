import templates from "@/data/assistant-templates.json";
import type { Lang } from "@/lib/i18n";

export interface AssistantTemplate {
  id: string;
  label: string;
  prompt: string;
}

type RawTemplate = {
  id: string;
  fr: { label: string; prompt: string };
  en: { label: string; prompt: string };
};

export function listAssistantTemplates(lang: Lang): AssistantTemplate[] {
  return (templates as RawTemplate[]).map((entry) => {
    const localized = entry[lang];
    return { id: entry.id, label: localized.label, prompt: localized.prompt };
  });
}
