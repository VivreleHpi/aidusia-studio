import { useEffect, useMemo, useRef, useState } from "react";
import type { Conversation } from "@/lib/db";
import { shortcutLabel } from "@/lib/deviceDetect";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { PwaStatus } from "@/components/PwaStatus";
import {
  IconBook,
  IconCompass,
  IconGear,
  IconHelp,
  IconKey,
  IconList,
  IconMoon,
  IconPanelLeft,
  IconPlug,
  IconSparkles,
  IconSun,
  IconTrash,
  IconWrench,
  IconX,
} from "@/components/Icons";

export const FOCUS_SEARCH_EVENT = "aidusia:focus-search";
export const SIDEBAR_ID = "aidusia-sidebar";

const SETTINGS_POPOVER_ID = "aidusia-sidebar-settings";
const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const STRINGS = {
  fr: {
    newConversation: "Nouvelle conversation",
    searchPlaceholder: "Rechercher une conversation",
    clearSearch: "Effacer la recherche",
    tools: "Outils",
    compareAis: "Comparer les IA",
    closeMenu: "Fermer le menu",
    deleteConversation: "Supprimer la conversation",
    deleteConfirm: (title: string) => `Supprimer « ${title} » ? Cette action est irréversible.`,
    noConversations: "Aucune conversation.",
    noResults: (q: string) => `Aucun résultat pour « ${q} ».`,
    buckets: {
      today: "Aujourd'hui",
      yesterday: "Hier",
      last7: "7 derniers jours",
      last30: "30 derniers jours",
      older: "Plus ancien",
    },
    about: "Présentation",
    tour: "Visite guidée",
    guide: "Notice d'utilisation",
    faq: "FAQ",
    providers: "Fournisseurs",
    mcp: "Connecteurs",
    data: "Données",
    purgeAll: "Effacer toutes les conversations",
    settings: "Paramètres",
    language: "Langue",
    themeToggle: "Basculer le thème",
    collapseSidebar: "Rabattre le panneau",
    legalNotice: "Mentions légales",
    privacy: "Confidentialité",
    mainNavigation: "Navigation principale",
  },
  en: {
    newConversation: "New conversation",
    searchPlaceholder: "Search conversations",
    clearSearch: "Clear search",
    tools: "Tools",
    compareAis: "Compare AIs",
    closeMenu: "Close menu",
    deleteConversation: "Delete conversation",
    deleteConfirm: (title: string) => `Delete "${title}"? This cannot be undone.`,
    noConversations: "No conversations yet.",
    noResults: (q: string) => `No results for "${q}".`,
    buckets: {
      today: "Today",
      yesterday: "Yesterday",
      last7: "Last 7 days",
      last30: "Last 30 days",
      older: "Older",
    },
    about: "About",
    tour: "Guided tour",
    guide: "User guide",
    faq: "FAQ",
    providers: "Providers",
    mcp: "Connectors",
    data: "Data",
    purgeAll: "Delete all conversations",
    settings: "Settings",
    language: "Language",
    themeToggle: "Toggle theme",
    collapseSidebar: "Collapse sidebar",
    legalNotice: "Legal notice",
    privacy: "Privacy",
    mainNavigation: "Main navigation",
  },
};

interface SidebarProps {
  conversations: Conversation[];
  currentId: string | null;
  activeView: "chat" | "compare";
  onSelect: (id: string) => void;
  onCreate: () => void;
  onOpenCompare: () => void;
  onDelete: (id: string) => void;
  onOpenAbout: () => void;
  onOpenFaq: () => void;
  onOpenGuide: () => void;
  onStartTour: () => void;
  onOpenProviders: () => void;
  onOpenMcp: () => void;
  onOpenData: () => void;
  onPurgeAll: () => void;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const DAY_MS = 86_400_000;

type BucketKey = "today" | "yesterday" | "last7" | "last30" | "older";
const BUCKET_ORDER: BucketKey[] = ["today", "yesterday", "last7", "last30", "older"];

function useMobileViewport(): boolean {
  const read = () =>
    typeof window.matchMedia === "function" && window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
  const [mobile, setMobile] = useState(read);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return mobile;
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      const style = window.getComputedStyle(element);
      return (
        element.tabIndex >= 0 &&
        !element.hidden &&
        element.getAttribute("aria-hidden") !== "true" &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    },
  );
}

function bucketKey(updatedAt: number, now: number): BucketKey {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const diffDays = Math.floor((startOfToday - new Date(updatedAt).setHours(0, 0, 0, 0)) / DAY_MS);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays <= 7) return "last7";
  if (diffDays <= 30) return "last30";
  return "older";
}

function groupConversations(conversations: Conversation[]): [BucketKey, Conversation[]][] {
  const now = Date.now();
  const groups = new Map<BucketKey, Conversation[]>();
  for (const c of conversations) {
    const key = bucketKey(c.updatedAt, now);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  return BUCKET_ORDER.filter((key) => groups.has(key)).map((key) => [key, groups.get(key)!]);
}

export function Sidebar({
  conversations,
  currentId,
  activeView,
  onSelect,
  onCreate,
  onOpenCompare,
  onDelete,
  onOpenAbout,
  onOpenFaq,
  onOpenGuide,
  onStartTour,
  onOpenProviders,
  onOpenMcp,
  onOpenData,
  onPurgeAll,
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isMobileViewport = useMobileViewport();
  const searchRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const settingsPopoverRef = useRef<HTMLDivElement>(null);
  const { lang, setLang } = useLang();
  const { theme, setTheme } = useTheme();
  const s = STRINGS[lang];

  useEffect(() => {
    const focusSearch = () => searchRef.current?.focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, focusSearch);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focusSearch);
  }, []);

  useEffect(() => {
    if (!isMobileViewport || !open) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => mobileCloseRef.current?.focus(), 0);

    function handleDrawerKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !drawer) return;

      const items = focusableElements(drawer);
      if (items.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    drawer.addEventListener("keydown", handleDrawerKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      drawer.removeEventListener("keydown", handleDrawerKeyDown);
      if (previouslyFocused?.isConnected) {
        window.setTimeout(() => previouslyFocused.focus(), 0);
      }
    };
  }, [isMobileViewport, onClose, open]);

  useEffect(() => {
    if (!settingsOpen) return;
    const focusTimer = window.setTimeout(() => {
      settingsPopoverRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    }, 0);

    function handleSettingsKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setSettingsOpen(false);
      window.setTimeout(() => settingsTriggerRef.current?.focus(), 0);
    }

    document.addEventListener("keydown", handleSettingsKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleSettingsKeyDown, true);
    };
  }, [settingsOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  const grouped = useMemo(() => groupConversations(filtered), [filtered]);

  function handleSelect(id: string) {
    onSelect(id);
    onClose();
  }

  function handleCreate() {
    onCreate();
    onClose();
  }

  function handleOpenCompare() {
    onOpenCompare();
    onClose();
  }

  function closeSettingsAndRestoreFocus() {
    setSettingsOpen(false);
    window.setTimeout(() => settingsTriggerRef.current?.focus(), 0);
  }

  const menuItemClass =
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition duration-150 hover:bg-accent/10";
  const mobileDrawerHidden = isMobileViewport && !open;

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden"
        />
      )}
      <aside
        id={SIDEBAR_ID}
        ref={drawerRef}
        role={isMobileViewport && open ? "dialog" : undefined}
        aria-modal={isMobileViewport && open ? "true" : undefined}
        aria-label={s.mainNavigation}
        aria-hidden={mobileDrawerHidden ? "true" : undefined}
        inert={mobileDrawerHidden ? true : undefined}
        tabIndex={isMobileViewport && open ? -1 : undefined}
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:hidden" : "md:static md:z-auto md:w-64 md:translate-x-0"}`}
      >
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
        <span className="flex items-baseline gap-1.5">
          <span className="text-base font-bold tracking-tight text-foreground">AIDUSIA</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
            studio
          </span>
        </span>
        <button
          type="button"
          onClick={onToggleCollapse}
          tabIndex={isMobileViewport ? -1 : undefined}
          aria-hidden={isMobileViewport ? "true" : undefined}
          aria-label={s.collapseSidebar}
          title={s.collapseSidebar}
          className="ml-auto hidden h-7 w-7 place-items-center rounded-lg text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground active:scale-95 md:grid"
        >
          <IconPanelLeft className="h-4 w-4" />
        </button>
        {isMobileViewport ? (
          <button
            ref={mobileCloseRef}
            type="button"
            onClick={onClose}
            aria-label={s.closeMenu}
            title={s.closeMenu}
            className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground active:scale-95 md:hidden"
          >
            <IconX className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="p-3 pt-1" data-tour="new-conversation">
        <button
          type="button"
          onClick={handleCreate}
          title={shortcutLabel("N")}
          className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground transition duration-150 hover:bg-accent/10 hover:text-foreground active:scale-[0.98]"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground/10 text-base leading-none text-foreground transition duration-150 group-hover:bg-primary/20 group-hover:text-primary">
            +
          </span>
          {s.newConversation}
        </button>
      </div>

      <div className="px-3 pb-2" data-tour="search">
        <div className="relative">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={s.searchPlaceholder}
            aria-label={s.searchPlaceholder}
            className="w-full rounded-md border border-border bg-card/60 py-1.5 pl-8 pr-14 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {!query && (
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border/60 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
              {shortcutLabel("K")}
            </kbd>
          )}
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={s.clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="mb-2">
          <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {s.tools}
          </p>
          <button
            type="button"
            onClick={handleOpenCompare}
            aria-current={activeView === "compare" ? "page" : undefined}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
              activeView === "compare"
                ? "bg-accent/15 text-foreground"
                : "text-sidebar-foreground hover:bg-accent/10"
            }`}
          >
            <IconList className="h-4 w-4 shrink-0" />
            <span>{s.compareAis}</span>
          </button>
        </div>
        {grouped.map(([key, items]) => (
          <div key={key} className="mb-2">
            <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {s.buckets[key]}
            </p>
            {items.map((c) => (
              <div
                key={c.id}
                className={`group mb-0.5 flex items-center rounded-md px-2 py-2 text-sm transition ${
                  activeView === "chat" && c.id === currentId
                    ? "bg-accent/15 text-foreground"
                    : "text-sidebar-foreground hover:bg-accent/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  aria-current={
                    activeView === "chat" && c.id === currentId ? "page" : undefined
                  }
                  className="flex-1 truncate text-left"
                  title={c.title}
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(s.deleteConfirm(c.title))) onDelete(c.id);
                  }}
                  aria-label={s.deleteConversation}
                  title={s.deleteConversation}
                  className="invisible ml-1 rounded-md p-1 text-muted-foreground transition duration-150 hover:bg-destructive/10 hover:text-destructive group-hover:visible pointer-coarse:visible"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="px-2 py-4 text-sm text-muted-foreground">{s.noConversations}</p>
        )}
        {conversations.length > 0 && filtered.length === 0 && (
          <p className="px-2 py-4 text-sm text-muted-foreground">{s.noResults(query)}</p>
        )}
      </nav>

      <div className="relative border-t border-sidebar-border p-2">
        {settingsOpen && (
          <>
            <div
              aria-hidden="true"
              onClick={closeSettingsAndRestoreFocus}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div
              id={SETTINGS_POPOVER_ID}
              ref={settingsPopoverRef}
              aria-label={s.settings}
              className="modal-in absolute bottom-full left-2 z-50 mb-2 w-56 rounded-lg border border-border/60 bg-card/95 p-1.5 text-sm shadow-xl backdrop-blur-xl"
            >
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  onOpenAbout();
                }}
                className={menuItemClass}
              >
                <IconSparkles className="h-4 w-4 text-muted-foreground" /> {s.about}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  onStartTour();
                }}
                className={menuItemClass}
              >
                <IconCompass className="h-4 w-4 text-muted-foreground" /> {s.tour}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  onOpenGuide();
                }}
                className={menuItemClass}
              >
                <IconBook className="h-4 w-4 text-muted-foreground" /> {s.guide}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  onOpenFaq();
                }}
                className={menuItemClass}
              >
                <IconHelp className="h-4 w-4 text-muted-foreground" /> {s.faq}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  onOpenProviders();
                }}
                className={menuItemClass}
              >
                <IconPlug className="h-4 w-4 text-muted-foreground" /> {s.providers}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  onOpenMcp();
                }}
                className={menuItemClass}
              >
                <IconWrench className="h-4 w-4 text-muted-foreground" /> {s.mcp}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  onOpenData();
                }}
                className={menuItemClass}
              >
                <IconKey className="h-4 w-4 text-muted-foreground" /> {s.data}
              </button>
              <div className="my-1 border-t border-border" />
              <PwaStatus />
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  onPurgeAll();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-destructive transition duration-150 hover:bg-destructive/10"
              >
                <IconTrash className="h-4 w-4" /> {s.purgeAll}
              </button>
            </div>
          </>
        )}
        <div className="flex items-center gap-1">
          <button
            ref={settingsTriggerRef}
            type="button"
            data-tour="settings-menu"
            onClick={() => {
              if (settingsOpen) closeSettingsAndRestoreFocus();
              else setSettingsOpen(true);
            }}
            aria-label={s.settings}
            aria-expanded={settingsOpen ? "true" : "false"}
            aria-controls={SETTINGS_POPOVER_ID}
            className="flex flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-sidebar-foreground transition hover:bg-accent/10"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15">
              <IconGear className="h-3.5 w-3.5" />
            </span>
            {s.settings}
          </button>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={s.themeToggle}
            title={s.themeToggle}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/60 text-muted-foreground transition duration-150 hover:text-foreground active:scale-95"
          >
            {theme === "dark" ? <IconSun className="h-3.5 w-3.5" /> : <IconMoon className="h-3.5 w-3.5" />}
          </button>
          <div
            role="group"
            aria-label={s.language}
            className="flex items-center rounded-lg border border-border/60 p-0.5 text-[10px] font-medium"
          >
            <button
              type="button"
              onClick={() => setLang("fr")}
              aria-pressed={lang === "fr" ? "true" : "false"}
              className={`rounded-md px-1.5 py-1 transition duration-150 ${
                lang === "fr"
                  ? "bg-accent/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              aria-pressed={lang === "en" ? "true" : "false"}
              className={`rounded-md px-1.5 py-1 transition duration-150 ${
                lang === "en"
                  ? "bg-accent/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              EN
            </button>
          </div>
        </div>
        <nav className="mt-1.5 flex gap-2.5 px-1 text-[10px] text-muted-foreground">
          <a href="https://github.com/VivreleHpi/aidusia-studio/blob/main/MENTIONS-LEGALES.md" target="_blank" rel="noopener noreferrer" className="transition hover:text-foreground">
            {s.legalNotice}
          </a>
          <a href="https://github.com/VivreleHpi/aidusia-studio/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer" className="transition hover:text-foreground">
            {s.privacy}
          </a>
        </nav>
      </div>
      </aside>
    </>
  );
}
