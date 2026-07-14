import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar, FOCUS_SEARCH_EVENT } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { ProvidersPanel } from "@/components/ProvidersPanel";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { AboutModal } from "@/components/AboutModal";
import { FaqPanel } from "@/components/FaqPanel";
import { GuidePage } from "@/components/GuidePage";
import { GuidedTour } from "@/components/GuidedTour";
import { McpPanel } from "@/components/McpPanel";
import { isMobile, shouldShowOnboarding } from "@/lib/deviceDetect";
import { useLang } from "@/lib/i18n";
import { IconPanelLeft } from "@/components/Icons";
import { useConversations } from "@/hooks/useConversations";
import { useChat } from "@/hooks/useChat";
import { getConversation, purgeAll, type Conversation } from "@/lib/db";

// Sur mobile, Ollama est impossible (appli de bureau) : on demarre plutot sur
// l'IA « Sur cet appareil » (navigateur). Sur PC, Ollama reste le defaut.
const DEFAULT_PROVIDER = isMobile() ? "browser" : "ollama";

const STRINGS = {
  fr: {
    purgeConfirm:
      "Effacer définitivement toutes les conversations ? Cette action est irréversible.",
    toggleMenu: "Basculer le menu",
    expandSidebar: "Ouvrir le panneau",
    loading: "Chargement de vos conversations…",
    storageTitle: "Le stockage local est indisponible",
    storageBody:
      "AIDUSIA ne peut pas ouvrir les conversations de ce navigateur. Vos données n'ont pas été supprimées. Vérifiez les permissions du site puis réessayez.",
    retry: "Réessayer",
  },
  en: {
    purgeConfirm: "Permanently delete all conversations? This cannot be undone.",
    toggleMenu: "Toggle menu",
    expandSidebar: "Open sidebar",
    loading: "Loading your conversations…",
    storageTitle: "Local storage is unavailable",
    storageBody:
      "AIDUSIA cannot open this browser's conversations. Your data has not been deleted. Check the site's permissions, then try again.",
    retry: "Try again",
  },
} as const;

function App() {
  const {
    conversations,
    currentId,
    setCurrentId,
    loading,
    storageError,
    refresh,
    createConversation,
    removeConversation,
  } = useConversations();

  const [current, setCurrent] = useState<Conversation | null>(null);
  const [providerId, setProviderId] = useState(DEFAULT_PROVIDER);
  const [model, setModel] = useState("");
  const [providersOpen, setProvidersOpen] = useState(false);
  const [keysVersion, setKeysVersion] = useState(0);
  const [onboarding, setOnboarding] = useState(shouldShowOnboarding);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const modalReturnFocusRef = useRef<HTMLElement | null>(null);
  const tourFocusRestorePending = useRef(false);
  const { lang } = useLang();
  const s = STRINGS[lang];

  useEffect(() => {
    let cancelled = false;
    setConversationError(null);
    if (!currentId) {
      setCurrent(null);
      return () => {
        cancelled = true;
      };
    }
    void getConversation(currentId)
      .then((conversation) => {
        if (!cancelled) setCurrent(conversation ?? null);
      })
      .catch((error) => {
        if (!cancelled) {
          setCurrent(null);
          setConversationError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentId, conversations]);

  useEffect(() => {
    if (tourOpen || !tourFocusRestorePending.current) return;
    tourFocusRestorePending.current = false;
    requestAnimationFrame(() => modalReturnFocusRef.current?.focus());
  }, [tourOpen]);

  const { sendMessage, stop, streaming, error } = useChat(setCurrent, refresh);

  const handleGlobalKeydown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "k") {
        e.preventDefault();
        window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
      } else if (e.key === "n") {
        e.preventDefault();
        void createConversation();
      }
    },
    [createConversation],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeydown);
    return () => window.removeEventListener("keydown", handleGlobalKeydown);
  }, [handleGlobalKeydown]);

  async function handleSend(content: string, images?: string[]) {
    let id = currentId;
    if (!id) {
      const created = await createConversation();
      id = created.id;
    }
    await sendMessage(id, content, providerId, model, undefined, images);
  }

  async function handlePurgeAll() {
    if (!window.confirm(s.purgeConfirm)) {
      return;
    }
    await purgeAll();
    setCurrentId(null);
    await refresh();
  }

  function openAbout() {
    modalReturnFocusRef.current = document.querySelector<HTMLElement>("[data-tour='settings-menu']");
    setAboutOpen(true);
  }

  function closeAbout() {
    setAboutOpen(false);
    requestAnimationFrame(() => modalReturnFocusRef.current?.focus());
  }

  function openTour() {
    modalReturnFocusRef.current = document.querySelector<HTMLElement>("[data-tour='settings-menu']");
    setTourOpen(true);
  }

  function closeTour() {
    tourFocusRestorePending.current = true;
    setTourOpen(false);
  }

  if (loading) {
    return (
      <main className="grid h-dvh place-items-center bg-background px-6 text-foreground">
        <p role="status" className="text-sm text-muted-foreground">
          {s.loading}
        </p>
      </main>
    );
  }

  const effectiveStorageError = storageError ?? conversationError;
  if (effectiveStorageError) {
    return (
      <main className="grid h-dvh place-items-center bg-background px-6 text-foreground">
        <section
          role="alert"
          className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-lg"
        >
          <h1 className="text-lg font-semibold">{s.storageTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{s.storageBody}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {s.retry}
          </button>
        </section>
      </main>
    );
  }

  const hasModal = providersOpen || onboarding || aboutOpen || faqOpen || guideOpen || tourOpen || mcpOpen;

  return (
    // h-dvh (et non h-screen/100vh) : sur mobile, la barre d'adresse dynamique
    // fait varier la hauteur visible ; dvh colle exactement au viewport pour
    // que le bandeau reste en haut et le composer en bas, toujours visibles.
    <div className="flex h-dvh min-h-0 bg-background text-foreground">
      <div id="application-shell" className="contents" inert={hasModal ? true : undefined}>
      <Sidebar
        conversations={conversations}
        currentId={currentId}
        onSelect={setCurrentId}
        onCreate={createConversation}
        onDelete={removeConversation}
        onOpenAbout={openAbout}
        onOpenFaq={() => setFaqOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
        onStartTour={openTour}
        onOpenProviders={() => setProvidersOpen(true)}
        onOpenMcp={() => setMcpOpen(true)}
        onPurgeAll={() => void handlePurgeAll()}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />
      <main className="relative flex min-w-0 flex-1 flex-col">
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            aria-label={s.expandSidebar}
            title={s.expandSidebar}
            className="absolute left-3 top-3 z-30 hidden h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/80 text-muted-foreground backdrop-blur transition duration-150 hover:text-foreground active:scale-95 md:grid"
          >
            <IconPanelLeft className="h-4 w-4" />
          </button>
        )}
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 py-2 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={s.toggleMenu}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
          >
            <svg viewBox="0 0 18 18" fill="none" className="h-4 w-4">
              <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <span className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold tracking-tight text-foreground">AIDUSIA</span>
            <span className="text-[9px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
              studio
            </span>
          </span>
        </div>
        <ChatView
          conversation={current}
          streaming={streaming}
          error={error}
          onSend={handleSend}
          onStop={stop}
          providerId={providerId}
          model={model}
          onChangeProvider={(p, m) => {
            setProviderId(p);
            setModel(m);
          }}
          onOpenProviders={() => setProvidersOpen(true)}
          onOpenFaq={() => setFaqOpen(true)}
          keysVersion={keysVersion}
        />
      </main>
      </div>
      {providersOpen && (
        <ProvidersPanel
          onProviderReady={(readyProviderId) => {
            setProviderId(readyProviderId);
            setModel("");
          }}
          onClose={() => {
            setProvidersOpen(false);
            setKeysVersion((v) => v + 1);
          }}
        />
      )}
      {onboarding && (
        <OnboardingWizard
          onFinish={() => setOnboarding(false)}
          onOpenProviders={() => setProvidersOpen(true)}
        />
      )}
      {aboutOpen && <AboutModal onClose={closeAbout} />}
      {faqOpen && <FaqPanel onClose={() => setFaqOpen(false)} />}
      {guideOpen && <GuidePage onClose={() => setGuideOpen(false)} />}
      {tourOpen && <GuidedTour onFinish={closeTour} />}
      {mcpOpen && <McpPanel onClose={() => setMcpOpen(false)} />}
    </div>
  );
}

export default App;
