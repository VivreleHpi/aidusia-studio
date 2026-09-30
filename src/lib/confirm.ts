// Confirmation intégrée à l'app, à la place de window.confirm : la boîte
// native est illisible sur téléphone (texte tronqué, pas de mise en forme)
// et ne peut pas présenter proprement des détails comme les arguments MCP.
// Un hôte React (ConfirmHost) s'abonne ici ; sans hôte monté (tests unitaires,
// rendu isolé), on retombe sur window.confirm pour ne jamais bloquer.

export interface ConfirmRequest {
  title: string;
  message: string;
  /** Bloc préformaté affiché sous le message (ex. arguments JSON). */
  details?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** "danger" = action destructrice ou à effet externe (bouton rouge). */
  tone?: "default" | "danger";
}

type Host = (request: ConfirmRequest) => Promise<boolean>;

let host: Host | null = null;

export function registerConfirmHost(next: Host): () => void {
  host = next;
  return () => {
    if (host === next) host = null;
  };
}

export function requestConfirm(request: ConfirmRequest): Promise<boolean> {
  if (host) return host(request);
  const text = [request.title, request.message, request.details].filter(Boolean).join("\n\n");
  return Promise.resolve(window.confirm(text));
}
