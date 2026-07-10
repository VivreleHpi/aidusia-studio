import { useEffect, useMemo, useRef, useState } from "react";
import type { ProviderModel } from "@/providers/types";

interface ModelPickerProps {
  models: ProviderModel[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function ModelPicker({ models, value, onChange, disabled }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = models.find((m) => m.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    );
  }, [models, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function select(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label="Modele"
        aria-expanded={open ? "true" : "false"}
        className="select-chevron flex min-w-32 items-center rounded-md border border-border bg-card py-1 pl-2 pr-6 text-left text-foreground transition hover:border-ring/50 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
      >
        <span className="truncate">{selected?.label ?? "Choisir un modèle"}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="modal-in glass absolute left-0 top-full z-50 mt-1 w-72 rounded-lg bg-card p-1.5 shadow-xl">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && filtered.length > 0) select(filtered[0].id);
              }}
              placeholder={`Rechercher parmi ${models.length} modèles…`}
              className="mb-1 w-full rounded-md border border-border bg-background/60 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">Aucun résultat.</p>
              )}
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => select(m.id)}
                  className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-accent/10 ${
                    m.id === value ? "bg-accent/15 text-foreground" : "text-muted-foreground"
                  }`}
                  title={m.label}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
