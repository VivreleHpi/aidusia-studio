import { DEFAULT_CONTEXT_CHARACTER_BUDGET, selectMessagesForContext } from "@/lib/contextWindow";
import { isMobile } from "@/lib/deviceDetect";
import type { Lang } from "@/lib/i18n";
import { stripStudioBaseContext } from "@/lib/systemContext";
import type { ChatMessage } from "@/providers/types";

/**
 * Phrase système exacte du Modelfile / chat template officiel
 * (OpenLLM-France/Luciole-1B-Instruct-1.1). La remplacer par un long texte
 * français fait sortir le 1B de son alignement.
 */
export const LUCIOLE_OFFICIAL_SYSTEM =
  "You are a helpful AI assistant named Luciole, trained by LINAGORA and OpenLLM France.";

/** Une ligne, pas un second persona : le post-entraînement est surtout en anglais. */
export const LUCIOLE_LANGUAGE_HINT = "Answer in the same language as the user's last message.";

/**
 * Échantillonnage du Modelfile GGUF officiel (pas le generation_config
 * Transformers à 0.7, trop dispersé pour ce 1B).
 */
export const LUCIOLE_SAMPLING = {
  temperature: 0.2,
  top_k: 20,
  top_p: 0.95,
  min_p: 0.1,
} as const;

export const LUCIOLE_MAX_OUTPUT_TOKENS = 640;
const PROMPT_OVERHEAD_TOKENS = 64;
/** ~5 caractères/token en français courant ; 3 par prudence (aligné sur luciole.ts). */
const CHARS_PER_TOKEN = 3;

/** Taille de contexte n_ctx (tokens) : mobile 2048, sinon 4096. */
export function lucioleContextTokens(): number {
  return isMobile() ? 2048 : 4096;
}

/**
 * Budget caractères pour l’historique chat (hors message système passé à wllama),
 * aligné sur `lucioleHistoryBudget` du provider.
 */
export function lucioleHistoryCharBudget(nCtx: number, fullSystemPrompt: string): number {
  return (nCtx - LUCIOLE_MAX_OUTPUT_TOKENS - PROMPT_OVERHEAD_TOKENS) * CHARS_PER_TOKEN - fullSystemPrompt.length;
}

/** Prompt système passé au moteur : phrase officielle + éventuel surplus (RAG), sans le paragraphe Studio. */
export function lucioleFullSystemPrompt(lang: Lang, studioSystemPrompt: string | undefined): string {
  const extra = stripStudioBaseContext("luciole", lang, studioSystemPrompt);
  const head = `${LUCIOLE_OFFICIAL_SYSTEM}\n${LUCIOLE_LANGUAGE_HINT}`;
  return extra ? `${head}\n\n${extra}` : head;
}

/**
 * Luciole (GGUF + template chat) ne gère pas les rôles `tool` ni le function-calling.
 * On replie chaque tour « assistant + tool_calls + messages tool » en un seul message assistant
 * texte pour garder la cohérence de l’historique (sinon les tools étaient supprimés et le
 * modèle voyait des réponses utilisateur sans la question précédente).
 */
export function lucioleFlattenHistoryForTextModel(messages: ChatMessage[], lang: Lang): ChatMessage[] {
  const out: ChatMessage[] = [];
  const pendingToolLines: string[] = [];
  function toolLine(message: ChatMessage): string {
    return lang === "fr"
      ? `[Résultat d’outil${message.toolName ? ` (${message.toolName})` : ""}] ${message.content}`
      : `[Tool result${message.toolName ? ` (${message.toolName})` : ""}] ${message.content}`;
  }
  let i = 0;
  while (i < messages.length) {
    const m = messages[i];

    if (m.role === "tool") {
      const line = toolLine(m);
      const prev = out.at(-1);
      if (prev?.role === "user") {
        prev.content = `${prev.content}\n\n${line}`;
      } else {
        pendingToolLines.push(line);
      }
      i += 1;
      continue;
    }

    if (m.role === "assistant" && (m.toolCalls?.length ?? 0) > 0) {
      const parts: string[] = [];
      if (m.content.trim()) parts.push(m.content.trim());
      for (const tc of m.toolCalls!) {
        parts.push(
          lang === "fr"
            ? `[Appel d’outil : ${tc.name}] ${JSON.stringify(tc.args)}`
            : `[Tool call: ${tc.name}] ${JSON.stringify(tc.args)}`,
        );
      }
      let j = i + 1;
      const toolBodies: string[] = [];
      while (j < messages.length && messages[j].role === "tool") {
        const t = messages[j];
        toolBodies.push(
          lang === "fr"
            ? `Résultat (${t.toolName ?? "outil"}) : ${t.content}`
            : `Result (${t.toolName ?? "tool"}): ${t.content}`,
        );
        j += 1;
      }
      if (toolBodies.length > 0) parts.push(toolBodies.join("\n\n"));
      out.push({ role: "assistant", content: parts.join("\n\n") });
      i = j;
      continue;
    }

    if (m.role === "user") {
      let content = m.content;
      if (pendingToolLines.length > 0) {
        content = [content, ...pendingToolLines].join("\n\n");
        pendingToolLines.length = 0;
      }
      if (m.images?.length) {
        content +=
          lang === "fr"
            ? "\n\n[Images jointes : Luciole 1B est texte seul et ne les analyse pas — choisissez un fournisseur avec vision si besoin.]"
            : "\n\n[Attached images: Luciole 1B is text-only and does not analyze them — pick a vision-capable provider if needed.]";
      }
      out.push({ role: "user", content });
      i += 1;
      continue;
    }

    if (m.role === "assistant") {
      out.push({ role: "assistant", content: m.content });
      i += 1;
      continue;
    }

    i += 1;
  }
  if (pendingToolLines.length > 0) {
    out.push({ role: "user", content: pendingToolLines.join("\n\n") });
  }
  return out;
}

export interface LuciolePreparedMessages {
  /** Messages après troncature budget (équivalent à ce qui alimente createChatCompletion). */
  forCompletion: ChatMessage[];
  /** Avant sélection par budget (après repli MCP). */
  flattened: ChatMessage[];
  budgetChars: number;
  hadMcpShape: boolean;
}

export function luciolePrepareMessagesForChat(
  messages: ChatMessage[],
  nCtx: number,
  lang: Lang,
  studioSystemPrompt: string | undefined,
): LuciolePreparedMessages {
  const fullSystem = lucioleFullSystemPrompt(lang, studioSystemPrompt);
  const budget = lucioleHistoryCharBudget(nCtx, fullSystem);
  const hadMcpShape = messages.some(
    (msg) => msg.role === "tool" || ((msg.toolCalls?.length ?? 0) > 0),
  );
  const flattened = lucioleFlattenHistoryForTextModel(messages, lang);
  const forCompletion = selectMessagesForContext(flattened, Math.max(1, budget));
  return { forCompletion, flattened, budgetChars: Math.max(1, budget), hadMcpShape };
}

export interface ProviderContextStatsInput {
  providerId: string;
  /** Langue interface (pour repli Luciole). */
  lang: Lang;
  /** Messages éligibles (assistant non vides / avec tool_calls, etc.). */
  eligibleMessages: ChatMessage[];
  /** Résultat de buildSystemPrompt(…) + RAG, sans identité Luciole. */
  studioSystemPrompt: string | undefined;
  /** Pour Luciole uniquement : n_ctx chargé ; défaut = budget théorique client. */
  lucioleNCtx?: number;
}

/** Compteurs d’historique pour l’UI — alignés Luciole sur le budget et le repli MCP réels. */
export function computeProviderContextStats(input: ProviderContextStatsInput): {
  sentMessageCount: number;
  eligibleMessageCount: number;
  flattenedEligibleCount?: number;
  truncated: boolean;
  budgetChars: number;
  lucioleMcpFolded?: boolean;
} {
  const { providerId, lang, eligibleMessages, studioSystemPrompt, lucioleNCtx } = input;

  if (providerId !== "luciole") {
    const selected = selectMessagesForContext(eligibleMessages);
    return {
      eligibleMessageCount: eligibleMessages.length,
      sentMessageCount: selected.length,
      truncated: selected.length < eligibleMessages.length,
      budgetChars: DEFAULT_CONTEXT_CHARACTER_BUDGET,
    };
  }

  const nCtx = lucioleNCtx ?? lucioleContextTokens();
  const prep = luciolePrepareMessagesForChat(eligibleMessages, nCtx, lang, studioSystemPrompt);
  return {
    eligibleMessageCount: eligibleMessages.length,
    flattenedEligibleCount: prep.flattened.length,
    sentMessageCount: prep.forCompletion.length,
    truncated: prep.forCompletion.length < prep.flattened.length,
    budgetChars: prep.budgetChars,
    lucioleMcpFolded: prep.hadMcpShape,
  };
}
