import type { Conversation } from "@/lib/db";

interface SidebarProps {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({ conversations, currentId, onSelect, onCreate, onDelete }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="p-3">
        <button
          type="button"
          onClick={onCreate}
          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          + Nouvelle conversation
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`group mb-1 flex items-center rounded-md px-2 py-2 text-sm transition ${
              c.id === currentId
                ? "bg-accent/15 text-foreground"
                : "text-sidebar-foreground hover:bg-accent/10"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className="flex-1 truncate text-left"
            >
              {c.title}
            </button>
            <button
              type="button"
              onClick={() => onDelete(c.id)}
              aria-label="Supprimer la conversation"
              className="invisible ml-1 text-muted-foreground hover:text-destructive group-hover:visible"
            >
              ✕
            </button>
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="px-2 py-4 text-sm text-muted-foreground">Aucune conversation.</p>
        )}
      </nav>
    </aside>
  );
}
