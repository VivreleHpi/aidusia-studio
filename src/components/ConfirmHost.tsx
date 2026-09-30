import { useCallback, useEffect, useId, useRef, useState } from "react";
import { registerConfirmHost, type ConfirmRequest } from "@/lib/confirm";
import { useDialogFocus } from "@/hooks/useDialogFocus";

interface PendingConfirm {
  id: number;
  request: ConfirmRequest;
  resolve: (value: boolean) => void;
}

function ConfirmDialog({
  request,
  onResolve,
}: {
  request: ConfirmRequest;
  onResolve: (value: boolean) => void;
}) {
  const titleId = useId();
  const messageId = useId();
  const cancel = useCallback(() => onResolve(false), [onResolve]);
  const dialogRef = useDialogFocus<HTMLDivElement>(cancel);
  const danger = request.tone === "danger";

  return (
    <div
      className="overlay-in fixed inset-0 z-50 flex items-end justify-center bg-background/60 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        // Opaque (pas de .glass) : en feuille basse, le champ de saisie
        // transparaissait derrière les boutons.
        className="modal-in flex max-h-full w-full max-w-md flex-col overflow-y-auto rounded-t-2xl border border-border bg-card p-5 pb-[max(1rem,env(safe-area-inset-bottom))] text-card-foreground shadow-xl sm:rounded-2xl sm:pb-5"
      >
        <h2 id={titleId} className="mb-2 text-base font-semibold text-foreground">
          {request.title}
        </h2>
        <p id={messageId} className="whitespace-pre-line text-sm text-muted-foreground">
          {request.message}
        </p>
        {request.details && (
          <pre className="mt-3 max-h-[40dvh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background/60 p-3 font-mono text-xs text-foreground">
            {request.details}
          </pre>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={cancel}
            className="min-h-11 w-full rounded-lg border border-border bg-background/40 px-4 py-2 text-sm font-medium text-foreground transition duration-150 hover:bg-foreground/5 sm:w-auto"
          >
            {request.cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            className={`min-h-11 w-full rounded-lg px-4 py-2 text-sm font-medium transition duration-150 hover:opacity-90 active:scale-[0.98] sm:w-auto ${
              danger
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Monté une fois à la racine : affiche les confirmations une par une. */
export function ConfirmHost() {
  const [queue, setQueue] = useState<PendingConfirm[]>([]);
  const nextId = useRef(0);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  useEffect(
    () =>
      registerConfirmHost(
        (request) =>
          new Promise<boolean>((resolve) => {
            setQueue((current) => [...current, { id: nextId.current++, request, resolve }]);
          }),
      ),
    [],
  );

  const current = queue[0];
  const resolveCurrent = useCallback((value: boolean) => {
    const head = queueRef.current[0];
    if (!head) return;
    head.resolve(value);
    setQueue((items) => items.slice(1));
  }, []);

  if (!current) return null;
  // key : remonte le dialogue (focus initial, piège, restauration) à chaque demande.
  return <ConfirmDialog key={current.id} request={current.request} onResolve={resolveCurrent} />;
}
