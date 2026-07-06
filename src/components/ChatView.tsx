import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Conversation } from "@/lib/db";

interface ChatViewProps {
  conversation: Conversation | null;
  streaming: boolean;
  error: string | null;
  onSend: (content: string) => void;
  onStop: () => void;
}

export function ChatView({ conversation, streaming, error, onSend, onStop }: ChatViewProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageCount = conversation?.messages.length ?? 0;
  const lastContent = conversation?.messages.at(-1)?.content ?? "";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageCount, lastContent]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || streaming) return;
    onSend(trimmed);
    setDraft("");
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!conversation || conversation.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-neutral-400">
            Envoyez un message pour commencer.
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {conversation.messages.map((m) => (
              <div
                key={m.id}
                className={`whitespace-pre-wrap rounded-lg px-4 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto max-w-[80%] bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "mr-auto max-w-[80%] bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                }`}
              >
                {m.content || (streaming ? "…" : "")}
              </div>
            ))}
            {error && (
              <div className="mr-auto max-w-[80%] rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-neutral-200 p-4 dark:border-neutral-800">
        <div className="mx-auto flex max-w-2xl gap-2">
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
            className="flex-1 resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Arreter
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              Envoyer
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
