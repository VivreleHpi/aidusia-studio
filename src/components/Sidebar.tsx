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
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="p-3">
        <button
          type="button"
          onClick={onCreate}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          + Nouvelle conversation
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`group mb-1 flex items-center rounded-md px-2 py-2 text-sm ${
              c.id === currentId
                ? "bg-neutral-200 dark:bg-neutral-800"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className="flex-1 truncate text-left text-neutral-800 dark:text-neutral-200"
            >
              {c.title}
            </button>
            <button
              type="button"
              onClick={() => onDelete(c.id)}
              aria-label="Supprimer la conversation"
              className="invisible ml-1 text-neutral-400 hover:text-red-500 group-hover:visible"
            >
              ✕
            </button>
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="px-2 py-4 text-sm text-neutral-500">Aucune conversation.</p>
        )}
      </nav>
    </aside>
  );
}
