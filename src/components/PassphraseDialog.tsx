import { useEffect, useId, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";

const STRINGS = {
  fr: {
    title: "Phrase secrète",
    placeholder: "Phrase secrète",
    cancel: "Annuler",
    confirm: "Confirmer",
  },
  en: {
    title: "Passphrase",
    placeholder: "Passphrase",
    cancel: "Cancel",
    confirm: "Confirm",
  },
} as const;

export interface PassphraseDialogProps {
  open: boolean;
  description: string;
  onCancel: () => void;
  onConfirm: (passphrase: string) => void | Promise<void>;
}

export function PassphraseDialog({ open, description, onCancel, onConfirm }: PassphraseDialogProps) {
  const { lang } = useLang();
  const s = STRINGS[lang];
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) {
      setValue("");
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm">
      <div
        className="glass w-full max-w-sm rounded-2xl bg-card p-5 text-card-foreground shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="text-base font-semibold">
          {s.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <input
          ref={inputRef}
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
            if (event.key === "Enter" && value.trim()) void onConfirm(value.trim());
          }}
          placeholder={s.placeholder}
          className="mt-4 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-foreground/5"
          >
            {s.cancel}
          </button>
          <button
            type="button"
            disabled={!value.trim()}
            onClick={() => void onConfirm(value.trim())}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {s.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
