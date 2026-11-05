import type { Conversation, StoredMessage } from "@/lib/db";
import type { Lang } from "@/lib/i18n";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function escapeMd(text: string): string {
  return text.replace(/^(#{1,6}\s)/gm, "\\$1");
}

export function conversationToMarkdown(conversation: Conversation, lang: Lang): string {
  const title = conversation.title || (lang === "fr" ? "Conversation" : "Conversation");
  const lines = [`# ${title}`, "", `> ${lang === "fr" ? "Exporté depuis AIDUSIA Studio" : "Exported from AIDUSIA Studio"}`, ""];
  for (const message of conversation.messages) {
    if (message.role === "tool") continue;
    const roleLabel =
      message.role === "user"
        ? lang === "fr"
          ? "Utilisateur"
          : "User"
        : lang === "fr"
          ? "Assistant"
          : "Assistant";
    lines.push(`## ${roleLabel}`, "", escapeMd(message.content || ""), "");
    if (message.ragCitations?.length) {
      lines.push("### Sources", "");
      for (const c of message.ragCitations) {
        lines.push(`- [${c.label}] ${c.fileName}: ${c.excerpt.replace(/\n/g, " ")}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n").trim() + "\n";
}

export function downloadTextFile(content: string, filename: string, mime = "text/markdown;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportConversationMarkdown(conversation: Conversation, lang: Lang): void {
  const md = conversationToMarkdown(conversation, lang);
  const safe = conversation.title.replace(/[^\w-]+/g, "-").slice(0, 40) || "conversation";
  downloadTextFile(md, `aidusia-${safe}.md`);
}

function messageHtml(m: StoredMessage, lang: Lang): string {
  const role =
    m.role === "user" ? (lang === "fr" ? "Utilisateur" : "User") : lang === "fr" ? "Assistant" : "Assistant";
  const body = (m.content ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
  return `<section><h2>${role}</h2><p>${body}</p></section>`;
}

function wrapPdfLine(text: string, maxChars: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function exportConversationPdf(conversation: Conversation, lang: Lang): Promise<void> {
  const title = conversation.title || (lang === "fr" ? "Conversation" : "Conversation");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage();
  const { height } = page.getSize();
  const margin = 48;
  let y = height - margin;

  const drawLine = (text: string, size: number, useBold = false) => {
    for (const chunk of wrapPdfLine(text, 92)) {
      if (y < margin + size) {
        page = pdf.addPage();
        y = height - margin;
      }
      page.drawText(chunk, {
        x: margin,
        y,
        size,
        font: useBold ? bold : font,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= size + 6;
    }
  };

  drawLine(title, 16, true);
  y -= 8;
  for (const message of conversation.messages) {
    if (message.role === "tool") continue;
    const roleLabel =
      message.role === "user"
        ? lang === "fr"
          ? "Utilisateur"
          : "User"
        : lang === "fr"
          ? "Assistant"
          : "Assistant";
    drawLine(roleLabel, 11, true);
    drawLine(message.content || "", 10);
    y -= 6;
  }

  const bytes = await pdf.save();
  const safe = conversation.title.replace(/[^\w-]+/g, "-").slice(0, 40) || "conversation";
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aidusia-${safe}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/** @deprecated Utiliser exportConversationPdf (fichier PDF) ; conservé pour compatibilité tests. */
export function exportConversationPdfViaPrint(conversation: Conversation, lang: Lang): void {
  const title = conversation.title || "AIDUSIA";
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;line-height:1.5;color:#111}
h1{font-size:1.4rem}h2{font-size:1rem;margin-top:1.5rem;color:#444}section{margin-bottom:1rem;border-bottom:1px solid #ddd;padding-bottom:.75rem}</style></head><body>
<h1>${title}</h1>
${conversation.messages.filter((m) => m.role !== "tool").map((m) => messageHtml(m, lang)).join("")}
</body></html>`;
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
