import type { ChatMessage } from "@/providers/types";

/** OpenAI Chat Completions multimodal user content. */
export function openAiUserContent(message: ChatMessage): string | Array<Record<string, unknown>> {
  if (!message.images?.length) return message.content;
  const parts: Array<Record<string, unknown>> = [{ type: "text", text: message.content || " " }];
  for (const b64 of message.images) {
    parts.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${b64}` },
    });
  }
  return parts;
}

export function anthropicUserContent(message: ChatMessage): string | Array<Record<string, unknown>> {
  if (!message.images?.length) return message.content;
  const blocks: Array<Record<string, unknown>> = [];
  for (const b64 of message.images) {
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: b64 },
    });
  }
  if (message.content) blocks.push({ type: "text", text: message.content });
  return blocks;
}

export function geminiParts(message: ChatMessage): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [];
  if (message.content) parts.push({ text: message.content });
  for (const b64 of message.images ?? []) {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
  }
  return parts.length ? parts : [{ text: " " }];
}

const VISION_NAME = /vision|gpt-4o|gpt-4\.1|claude-3|gemini|llava|moondream|pixtral|qwen.*vl/i;

export function inferVisionCapable(modelId: string): boolean {
  return VISION_NAME.test(modelId);
}
