import { selectMessagesForContext } from "@/lib/contextWindow";
import { isMobile } from "@/lib/deviceDetect";
import type { Lang } from "@/lib/i18n";
import { stripStudioBaseContext } from "@/lib/systemContext";
import type { ChatMessage } from "@/providers/types";

/** Phrase du guide llama.cpp officiel Qwen2.5. */
export const PORTABLE_OFFICIAL_SYSTEM =
  "You are Qwen, created by Alibaba Cloud. You are a helpful assistant.";

export const PORTABLE_LANGUAGE_HINT = "Answer in the same language as the user's last message.";

export const PORTABLE_MAX_OUTPUT_TOKENS = 512;

const PROMPT_OVERHEAD_TOKENS = 64;
const CHARS_PER_TOKEN = 3;

/** 0.5B : 2048 tokens sur téléphone, 4096 ailleurs. Le modèle en supporte bien plus, pas le téléphone. */
export function portableContextTokens(): number {
  return isMobile() ? 2048 : 4096;
}

export function portableHistoryBudget(nCtx: number, systemPrompt: string): number {
  return (nCtx - PORTABLE_MAX_OUTPUT_TOKENS - PROMPT_OVERHEAD_TOKENS) * CHARS_PER_TOKEN - systemPrompt.length;
}

export function portableFullSystemPrompt(lang: Lang, studioSystemPrompt: string | undefined): string {
  const extra = stripStudioBaseContext("portable", lang, studioSystemPrompt);
  const head = `${PORTABLE_OFFICIAL_SYSTEM}\n${PORTABLE_LANGUAGE_HINT}`;
  return extra ? `${head}\n\n${extra}` : head;
}

/** Le GGUF texte ne rejoue pas les rôles tool : on les replie pour ne pas perdre le tour. */
export function portableFlattenHistory(messages: ChatMessage[], lang: Lang): ChatMessage[] {
  const out: ChatMessage[] = [];
  const pending: string[] = [];
  let i = 0;
  while (i < messages.length) {
    const message = messages[i];
    if (message.role === "tool") {
      const line =
        lang === "fr"
          ? `[Résultat d’outil${message.toolName ? ` (${message.toolName})` : ""}] ${message.content}`
          : `[Tool result${message.toolName ? ` (${message.toolName})` : ""}] ${message.content}`;
      const prev = out.at(-1);
      if (prev?.role === "user") prev.content = `${prev.content}\n\n${line}`;
      else pending.push(line);
      i += 1;
      continue;
    }
    if (message.role === "assistant" && (message.toolCalls?.length ?? 0) > 0) {
      const parts: string[] = [];
      if (message.content.trim()) parts.push(message.content.trim());
      for (const call of message.toolCalls ?? []) {
        parts.push(
          lang === "fr"
            ? `[Appel d’outil : ${call.name}] ${JSON.stringify(call.args)}`
            : `[Tool call: ${call.name}] ${JSON.stringify(call.args)}`,
        );
      }
      let j = i + 1;
      const results: string[] = [];
      while (j < messages.length && messages[j].role === "tool") {
        const tool = messages[j];
        results.push(
          lang === "fr"
            ? `Résultat (${tool.toolName ?? "outil"}) : ${tool.content}`
            : `Result (${tool.toolName ?? "tool"}): ${tool.content}`,
        );
        j += 1;
      }
      if (results.length > 0) parts.push(results.join("\n\n"));
      out.push({ role: "assistant", content: parts.join("\n\n") });
      i = j;
      continue;
    }
    if (message.role === "user" || message.role === "assistant") {
      let content = message.content;
      if (message.role === "user" && pending.length > 0) {
        content = [content, ...pending].join("\n\n");
        pending.length = 0;
      }
      if (message.role === "user" && message.images?.length) {
        content +=
          lang === "fr"
            ? "\n\n[Image jointe ignorée : ce modèle portable est texte seul.]"
            : "\n\n[Attached image ignored: this portable model is text-only.]";
      }
      out.push({ role: message.role, content });
    }
    i += 1;
  }
  if (pending.length > 0) out.push({ role: "user", content: pending.join("\n\n") });
  return out;
}

export function portablePrepareMessages(
  messages: ChatMessage[],
  nCtx: number,
  lang: Lang,
  studioSystemPrompt: string | undefined,
): { history: ChatMessage[]; budget: number; system: string } {
  const system = portableFullSystemPrompt(lang, studioSystemPrompt);
  const budget = Math.max(1, portableHistoryBudget(nCtx, system));
  const history = selectMessagesForContext(portableFlattenHistory(messages, lang), budget);
  return { history, budget, system };
}
