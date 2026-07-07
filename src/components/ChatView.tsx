import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { Conversation } from "@/lib/db";
import { extractTextFromImage } from "@/lib/ocr";
import { blobToRawBase64 } from "@/lib/toBase64";
import { useDictation } from "@/hooks/useDictation";
import { useVisionCapability } from "@/hooks/useVisionCapability";

interface ChatViewProps {
  conversation: Conversation | null;
  streaming: boolean;
  error: string | null;
  onSend: (content: string, images?: string[]) => void;
  onStop: () => void;
  providerId: string;
  model: string;
}

export function ChatView({
  conversation,
  streaming,
  error,
  onSend,
  onStop,
  providerId,
  model,
}: ChatViewProps) {
  const [draft, setDraft] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{ base64: string; previewUrl: string } | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const visionInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageCount = conversation?.messages.length ?? 0;
  const lastContent = conversation?.messages.at(-1)?.content ?? "";
  const dictation = useDictation("fr-FR");
  const visionCapable = useVisionCapability(providerId, model);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageCount, lastContent]);

  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    };
  }, [pendingImage]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if ((!trimmed && !pendingImage) || streaming) return;
    onSend(trimmed, pendingImage ? [pendingImage.base64] : undefined);
    setDraft("");
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.previewUrl);
      setPendingImage(null);
    }
  }

  async function handleOcrFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOcrError(null);
    setOcrBusy(true);
    setOcrProgress(0);
    try {
      const text = await extractTextFromImage(file, "fra", setOcrProgress);
      setDraft((prev) => (prev ? `${prev}\n\n${text}` : text));
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : String(err));
    } finally {
      setOcrBusy(false);
    }
  }

  async function handleVisionFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setVisionError(null);
    try {
      const base64 = await blobToRawBase64(file);
      setPendingImage({ base64, previewUrl: URL.createObjectURL(file) });
    } catch (err) {
      setVisionError(err instanceof Error ? err.message : String(err));
    }
  }

  function toggleDictation() {
    if (dictation.listening) {
      dictation.stop();
    } else {
      dictation.start((transcript) => {
        setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript));
      });
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!conversation || conversation.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Envoyez un message pour commencer.
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {conversation.messages.map((m, i) => {
              const isLastAssistant =
                m.role === "assistant" && i === conversation.messages.length - 1;
              return (
                <div
                  key={m.id}
                  className={`glass whitespace-pre-wrap rounded-lg px-4 py-2 text-sm ${
                    m.role === "user"
                      ? "ml-auto max-w-[80%] bg-primary text-primary-foreground"
                      : "mr-auto max-w-[80%] bg-card text-card-foreground"
                  }`}
                >
                  {m.images && m.images.length > 0 && (
                    <p className="mb-1 text-xs opacity-70">🖼️ Image jointe</p>
                  )}
                  {m.content}
                  {isLastAssistant && streaming && <span className="typing-cursor" />}
                </div>
              );
            })}
            {error && (
              <div className="mr-auto max-w-[80%] rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {ocrBusy && (
            <p className="text-xs text-muted-foreground">
              OCR local en cours… {Math.round(ocrProgress * 100)}%
            </p>
          )}
          {ocrError && <p className="text-xs text-destructive">OCR : {ocrError}</p>}
          {visionError && <p className="text-xs text-destructive">Image : {visionError}</p>}
          {dictation.listening && (
            <p className="text-xs text-warning">
              Écoute en cours… (dictée via le service vocal du navigateur, pas
              garanti 100% local — voir README)
            </p>
          )}
          {pendingImage && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 p-2 text-xs">
              <img src={pendingImage.previewUrl} alt="" className="h-10 w-10 rounded object-cover" />
              <span className="flex-1 text-muted-foreground">
                Image prête à être envoyée au modèle (analyse directe, pas d'OCR)
              </span>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(pendingImage.previewUrl);
                  setPendingImage(null);
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={ocrInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleOcrFileSelected}
            />
            <button
              type="button"
              onClick={() => ocrInputRef.current?.click()}
              disabled={ocrBusy}
              title="Extraire le texte d'une image (OCR local, texte IMPRIMÉ uniquement — mauvais sur l'écriture manuscrite)"
              aria-label="Extraire le texte d'une image"
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/10 disabled:opacity-40"
            >
              📎
            </button>
            {visionCapable && (
              <>
                <input
                  ref={visionInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleVisionFileSelected}
                />
                <button
                  type="button"
                  onClick={() => visionInputRef.current?.click()}
                  title="Envoyer une image au modèle pour analyse directe (mieux pour l'écriture manuscrite — Ollama uniquement pour l'instant)"
                  aria-label="Analyser une image"
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/10"
                >
                  🖼️
                </button>
              </>
            )}
            {dictation.supported && (
              <button
                type="button"
                onClick={toggleDictation}
                title="Dictée vocale"
                aria-label="Dictée vocale"
                className={`rounded-md border px-3 py-2 text-sm hover:bg-accent/10 ${
                  dictation.listening ? "border-warning bg-warning/10" : "border-border"
                }`}
              >
                🎙️
              </button>
            )}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={1}
              placeholder="Ecrivez un message…"
              className="flex-1 resize-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
              >
                Arreter
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim() && !pendingImage}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                Envoyer
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
