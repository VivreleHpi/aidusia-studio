import { useCallback, useEffect, useRef, useState } from "react";
import { IconBook, IconTrash, IconX } from "@/components/Icons";
import { useLang } from "@/lib/i18n";
import { ingestFileIntoSpace } from "@/lib/rag/ingest";
import {
  createRagSpace,
  deleteRagDocument,
  deleteRagSpace,
  listRagDocuments,
  listRagSpaces,
} from "@/lib/rag/store";
import type { RagDocument, RagSpace } from "@/lib/rag/types";
import { setDefaultRagSpaceId } from "@/lib/rag/conversationLink";

const STRINGS = {
  fr: {
    title: "Espaces de documents",
    intro:
      "Importez PDF, Markdown ou texte. Les extraits et embeddings restent dans IndexedDB sur cet appareil. Liez un espace au chat pour des réponses avec citations.",
    newSpace: "Nouvel espace",
    spaceName: "Nom de l'espace",
    create: "Créer",
    upload: "Ajouter des fichiers",
    uploadHint: "PDF, .md, .txt — traitement local",
    defaultSpace: "Espace par défaut pour les nouvelles conversations",
    documents: "Documents",
    chars: (n: number) => `${n.toLocaleString("fr-FR")} caractères`,
    deleteSpace: "Supprimer l'espace",
    deleteDoc: "Retirer",
    empty: "Aucun espace. Créez-en un pour commencer.",
    busy: "Indexation en cours…",
    openDocs: "Voir la doc RAG",
  },
  en: {
    title: "Document spaces",
    intro:
      "Import PDF, Markdown, or plain text. Chunks and embeddings stay in IndexedDB on this device. Link a space in chat for cited answers.",
    newSpace: "New space",
    spaceName: "Space name",
    create: "Create",
    upload: "Add files",
    uploadHint: "PDF, .md, .txt — processed locally",
    defaultSpace: "Default space for new conversations",
    documents: "Documents",
    chars: (n: number) => `${n.toLocaleString("en-US")} characters`,
    deleteSpace: "Delete space",
    deleteDoc: "Remove",
    empty: "No spaces yet. Create one to get started.",
    busy: "Indexing…",
    openDocs: "Read RAG docs",
  },
} as const;

interface DocumentsViewProps {
  onClose?: () => void;
}

export function DocumentsView({ onClose }: DocumentsViewProps) {
  const { lang } = useLang();
  const s = STRINGS[lang];
  const [spaces, setSpaces] = useState<RagSpace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [docs, setDocs] = useState<RagDocument[]>([]);
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshSpaces = useCallback(async () => {
    const list = await listRagSpaces();
    setSpaces(list);
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }, [selectedId]);

  const refreshDocs = useCallback(async (spaceId: string) => {
    setDocs(await listRagDocuments(spaceId));
  }, []);

  useEffect(() => {
    void refreshSpaces();
  }, [refreshSpaces]);

  useEffect(() => {
    if (selectedId) void refreshDocs(selectedId);
    else setDocs([]);
  }, [selectedId, refreshDocs]);

  async function handleCreateSpace() {
    const space = await createRagSpace(newName || s.newSpace);
    setNewName("");
    await refreshSpaces();
    setSelectedId(space.id);
  }

  async function handleUpload(files: FileList | null) {
    if (!selectedId || !files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        setStatus(`${s.busy} ${file.name}`);
        await ingestFileIntoSpace(selectedId, file, (p) => setStatus(p.message), "hash");
      }
      await refreshDocs(selectedId);
      setStatus(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">{s.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{s.intro}</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5"
            aria-label={lang === "fr" ? "Fermer" : "Close"}
          >
            <IconX className="h-4 w-4" />
          </button>
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 sm:grid-cols-[240px_1fr] sm:p-6">
        <aside className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={s.spaceName}
              className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleCreateSpace()}
              className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              {s.create}
            </button>
          </div>
          <ul className="flex flex-col gap-1" role="listbox" aria-label={s.title}>
            {spaces.length === 0 ? (
              <li className="text-sm text-muted-foreground">{s.empty}</li>
            ) : (
              spaces.map((space) => (
                <li key={space.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedId === space.id}
                    onClick={() => setSelectedId(space.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      selectedId === space.id ? "bg-primary/15 text-foreground" : "hover:bg-muted/40"
                    }`}
                  >
                    {space.name}
                  </button>
                </li>
              ))
            )}
          </ul>
          {selectedId ? (
            <button
              type="button"
              className="text-left text-xs text-destructive hover:underline"
              onClick={() => void deleteRagSpace(selectedId).then(refreshSpaces)}
            >
              {s.deleteSpace}
            </button>
          ) : null}
        </aside>

        <section className="flex min-h-0 flex-col gap-4">
          {selectedId ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  onChange={(e) => setDefaultRagSpaceId(e.target.checked ? selectedId : null)}
                />
                {s.defaultSpace}
              </label>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.md,.markdown,.txt,text/plain,text/markdown,application/pdf"
                  multiple
                  className="sr-only"
                  onChange={(e) => void handleUpload(e.target.files)}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-muted/30 disabled:opacity-50"
                >
                  {s.upload}
                </button>
                <p className="mt-1 text-xs text-muted-foreground">{s.uploadHint}</p>
              </div>
              {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
              <h2 className="text-sm font-medium">{s.documents}</h2>
              <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <IconBook className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{doc.fileName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{s.chars(doc.charCount)}</span>
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                      aria-label={s.deleteDoc}
                      onClick={() => void deleteRagDocument(doc.id).then(() => refreshDocs(selectedId))}
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <a
            href="https://github.com/VivreleHpi/aidusia-studio/blob/main/docs/rag.md"
            className="text-xs text-primary hover:underline"
          >
            {s.openDocs}
          </a>
        </section>
      </div>
    </div>
  );
}
