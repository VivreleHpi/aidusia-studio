import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Sidebar, FOCUS_SEARCH_EVENT, SIDEBAR_ID } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { isMobile, shouldShowOnboarding } from "@/lib/deviceDetect";
import { useLang } from "@/lib/i18n";
import { IconPanelLeft } from "@/components/Icons";
import { useConversations } from "@/hooks/useConversations";
import { useChat } from "@/hooks/useChat";
import type { ComparisonResult } from "@/hooks/useComparison";
import { createConversationFromComparison } from "@/lib/comparisonConversation";
import { clearChatDrafts } from "@/lib/chatDrafts";
import { getConversation, purgeAll, type Conversation } from "@/lib/db";

const ProvidersPanel = lazy(() =>
  import("@/components/ProvidersPanel").then((module) => ({ default: module.ProvidersPanel })),
);
const OnboardingWizard = lazy(() =>
  import("@/components/OnboardingWizard").then((module) => ({ default: module.OnboardingWizard })),
);
const AboutModal = lazy(() =>
  import("@/components/AboutModal").then((module) => ({ default: module.AboutModal })),
);
const FaqPanel = lazy(() =>
  import("@/components/FaqPanel").then((module) => ({ default: module.FaqPanel })),
);
const GuidePage = lazy(() =>
  import("@/components/GuidePage").then((module) => ({ default: module.GuidePage })),
);
const GuidedTour = lazy(() =>
  import("@/components/GuidedTour").then((module) => ({ default: module.GuidedTour })),
);
const McpPanel = lazy(() =>
  import("@/components/McpPanel").then((module) => ({ default: module.McpPanel })),
);
const DataPanel = lazy(() =>
  import("@/components/DataPanel").then((module) => ({ default: module.DataPanel })),
);
const CompareView = lazy(() =>
  import("@/components/CompareView").then((module) => ({ default: module.CompareView })),
);

type WorkspaceView = "chat" | "compare";

interface ActiveChatRun {
  conversationId: string;
  promise: Promise<void>;
}

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
    loadingConversation: "Chargement de la conversation…",
    storageTitle: "Le stockage local est indisponible",
    storageBody:
      "AIDUSIA ne peut pas ouvrir les conversations de ce navigateur. Vos données n'ont pas été supprimées. Vérifiez les permissions du site puis réessayez.",
    retry: "Réessayer",
    loadingComparison: "Chargement de l’espace de comparaison…",
  },
  en: {
    purgeConfirm: "Permanently delete all conversations? This cannot be undone.",
    toggleMenu: "Toggle menu",
    expandSidebar: "Open sidebar",
    loading: "Loading your conversations…",
    loadingConversation: "Loading conversation…",
    storageTitle: "Local storage is unavailable",
    storageBody:
      "AIDUSIA cannot open this browser's conversations. Your data has not been deleted. Check the site's permissions, then try again.",
    retry: "Try again",
    loadingComparison: "Loading comparison workspace…",
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
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(null);
  const [conversationReloadRequest, setConversationReloadRequest] = useState(0);
  const [conversationCreationPending, setConversationCreationPending] = useState(false);
  const [chatActivityConversationId, setChatActivityConversationId] = useState<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(currentId);
  const loadedConversationIdRef = useRef<string | null>(null);
  const activeChatRunRef = useRef<ActiveChatRun | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("chat");
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
  const [dataOpen, setDataOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const modalReturnFocusRef = useRef<HTMLElement | null>(null);
  const tourFocusRestorePending = useRef(false);
  const launchParamsHandled = useRef(false);
  const { lang } = useLang();
  const s = STRINGS[lang];

  const activateConversation = useCallback(
    (id: string | null, snapshot?: Conversation) => {
      activeConversationIdRef.current = id;
      const readyId = id !== null && snapshot?.id === id ? id : null;
      loadedConversationIdRef.current = readyId;
      setLoadedConversationId(readyId);
      setCurrent(readyId ? snapshot ?? null : null);
      setCurrentId(id);
    },
    [setCurrentId],
  );

  // `currentId` peut aussi changer depuis useConversations (chargement initial
  // ou suppression de la conversation active). Synchroniser la référence
  // avant peinture empêche un ancien stream de gagner la course entre deux ids.
  useLayoutEffect(() => {
    if (activeConversationIdRef.current === currentId) return;
    activeConversationIdRef.current = currentId;
    loadedConversationIdRef.current = null;
    setLoadedConversationId(null);
    setCurrent(null);
  }, [currentId]);

  useEffect(() => {
    let cancelled = false;
    setConversationError(null);
    if (!currentId) {
      loadedConversationIdRef.current = null;
      setLoadedConversationId(null);
      setCurrent(null);
      return () => {
        cancelled = true;
      };
    }

    const requestedId = currentId;
    // Une création ou un import fournit déjà un snapshot exact : inutile de le
    // remplacer par une lecture IndexedDB potentiellement plus ancienne.
    if (loadedConversationIdRef.current === requestedId) {
      return () => {
        cancelled = true;
      };
    }

    setCurrent(null);
    setLoadedConversationId(null);
    void getConversation(currentId)
      .then((conversation) => {
        if (
          cancelled ||
          activeConversationIdRef.current !== requestedId ||
          loadedConversationIdRef.current === requestedId
        ) {
          return;
        }
        loadedConversationIdRef.current = requestedId;
        setLoadedConversationId(requestedId);
        setCurrent(conversation ?? null);
      })
      .catch((error) => {
        if (!cancelled && activeConversationIdRef.current === requestedId) {
          loadedConversationIdRef.current = null;
          setLoadedConversationId(null);
          setCurrent(null);
          setConversationError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [conversationReloadRequest, currentId]);

  useEffect(() => {
    if (tourOpen || !tourFocusRestorePending.current) return;
    tourFocusRestorePending.current = false;
    requestAnimationFrame(() => modalReturnFocusRef.current?.focus());
  }, [tourOpen]);

  const applyConversationUpdate = useCallback((conversation: Conversation) => {
    if (activeConversationIdRef.current !== conversation.id) return;
    loadedConversationIdRef.current = conversation.id;
    setLoadedConversationId(conversation.id);
    setCurrent(conversation);
  }, []);

  const { sendMessage, regenerate, stop, streaming, error } = useChat(
    applyConversationUpdate,
    refresh,
  );

  const stopAndWaitForActiveRun = useCallback(
    async (conversationId?: string) => {
      const activeRun = activeChatRunRef.current;
      if (!activeRun || (conversationId && activeRun.conversationId !== conversationId)) return;
      stop();
      try {
        await activeRun.promise;
      } catch {
        // L'erreur du run est déjà rendue par useChat/ChatView. Ici, seule la
        // fin de sa sauvegarde compte avant l'opération destructive.
      }
    },
    [stop],
  );

  const handleRemoveConversation = useCallback(
    async (id: string) => {
      await stopAndWaitForActiveRun(id);
      await removeConversation(id);
    },
    [removeConversation, stopAndWaitForActiveRun],
  );

  const openConversation = useCallback(
    (id: string) => {
      setActiveView("chat");
      if (
        activeConversationIdRef.current !== id ||
        loadedConversationIdRef.current !== id
      ) {
        activateConversation(id);
      }
    },
    [activateConversation],
  );

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const createChat = useCallback(async () => {
    setActiveView("chat");
    setConversationCreationPending(true);
    try {
      const conversation = await createConversation();
      activateConversation(conversation.id, conversation);
      return conversation;
    } finally {
      setConversationCreationPending(false);
    }
  }, [activateConversation, createConversation]);

  const handleGlobalKeydown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "k") {
        e.preventDefault();
        window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
      } else if (e.key === "n") {
        e.preventDefault();
        void createChat();
      }
    },
    [createChat],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeydown);
    return () => window.removeEventListener("keydown", handleGlobalKeydown);
  }, [handleGlobalKeydown]);

  useEffect(() => {
    if (loading || launchParamsHandled.current) return;
    launchParamsHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("panel") === "providers") setProvidersOpen(true);
    if (params.get("action") === "new") void createChat();
    if (params.has("panel") || params.has("action") || params.has("source")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [createChat, loading]);

  async function handleSend(content: string, images?: string[]) {
    // useChat possede son propre verrou, mais garder aussi le suivi App intact :
    // un second appel ne doit pas remplacer la promesse que suppression/purge
    // attend pour eviter de recreer une conversation apres effacement.
    if (activeChatRunRef.current) return;
    let id = activeConversationIdRef.current;
    if (!id) {
      const created = await createConversation();
      activateConversation(created.id, created);
      id = created.id;
    }
    setChatActivityConversationId(id);
    const promise = sendMessage(id, content, providerId, model, undefined, images);
    activeChatRunRef.current = { conversationId: id, promise };
    try {
      await promise;
    } finally {
      if (activeChatRunRef.current?.promise === promise) activeChatRunRef.current = null;
    }
  }

  async function handleRegenerate() {
    // Rejoue la derniere reponse avec le fournisseur/modele actuellement
    // selectionnes (permet aussi de comparer deux modeles sur un meme prompt).
    if (activeChatRunRef.current) return;
    const id = activeConversationIdRef.current;
    if (!id) return;
    setChatActivityConversationId(id);
    const promise = regenerate(id, providerId, model, undefined);
    activeChatRunRef.current = { conversationId: id, promise };
    try {
      await promise;
    } finally {
      if (activeChatRunRef.current?.promise === promise) activeChatRunRef.current = null;
    }
  }

  async function handleUseComparison(prompt: string, result: ComparisonResult) {
    const conversation = await createConversationFromComparison(prompt, result, lang);
    // Le résultat complet est déjà disponible : l'activer avant `refresh`
    // évite qu'un dernier chunk de l'ancien chat puisse reprendre l'écran.
    activateConversation(conversation.id, conversation);
    setActiveView("chat");
    await refresh();
  }

  async function handlePurgeAll() {
    if (!window.confirm(s.purgeConfirm)) {
      return;
    }
    await stopAndWaitForActiveRun();
    await purgeAll();
    clearChatDrafts();
    activateConversation(null);
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
            onClick={() => {
              if (conversationError) {
                setConversationError(null);
                setConversationReloadRequest((value) => value + 1);
              }
              void refresh();
            }}
            className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {s.retry}
          </button>
        </section>
      </main>
    );
  }

  const hasModal = providersOpen || onboarding || aboutOpen || faqOpen || guideOpen || tourOpen || mcpOpen || dataOpen;
  const currentMatchesSelection = current === null || current.id === currentId;
  const conversationLoading =
    conversationCreationPending ||
    (currentId !== null &&
      (loadedConversationId !== currentId || !currentMatchesSelection));
  const visibleConversation =
    loadedConversationId === currentId && current?.id === currentId ? current : null;
  const activeChatError = chatActivityConversationId === currentId ? error : null;

  return (
    // h-dvh (et non h-screen/100vh) : sur mobile, la barre d'adresse dynamique
    // fait varier la hauteur visible ; dvh colle exactement au viewport pour
    // que le bandeau reste en haut et le composer en bas, toujours visibles.
    <div className="flex h-dvh min-h-0 bg-background text-foreground">
      <div id="application-shell" className="contents" inert={hasModal ? true : undefined}>
      <Sidebar
        conversations={conversations}
        currentId={currentId}
        activeView={activeView}
        onSelect={openConversation}
        onCreate={() => void createChat()}
        onOpenCompare={() => setActiveView("compare")}
        onDelete={(id) => void handleRemoveConversation(id)}
        onOpenAbout={openAbout}
        onOpenFaq={() => setFaqOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
        onStartTour={openTour}
        onOpenProviders={() => setProvidersOpen(true)}
        onOpenMcp={() => setMcpOpen(true)}
        onOpenData={() => setDataOpen(true)}
        onPurgeAll={() => void handlePurgeAll()}
        open={sidebarOpen}
        onClose={closeSidebar}
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
            aria-expanded={sidebarOpen ? "true" : "false"}
            aria-controls={SIDEBAR_ID}
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
        {activeView === "chat" && conversationLoading ? (
          <div className="grid min-h-0 flex-1 place-items-center px-6">
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {s.loadingConversation}
            </p>
          </div>
        ) : activeView === "chat" ? (
          // useChat ne lance qu'un flux global à la fois. Conserver cet état
          // bloque un second envoi dans B pendant que A termine en arrière-plan,
          // sans laisser les snapshots de A reprendre l'écran.
          <ChatView
            conversation={visibleConversation}
            streaming={streaming}
            error={activeChatError}
            onSend={handleSend}
            onStop={stop}
            onRegenerate={handleRegenerate}
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
        ) : (
          <Suspense
            fallback={
              <div className="grid flex-1 place-items-center px-6">
                <p role="status" className="text-sm text-muted-foreground">
                  {s.loadingComparison}
                </p>
              </div>
            }
          >
            <CompareView
              onOpenProviders={() => setProvidersOpen(true)}
              keysVersion={keysVersion}
              onBackToChat={() => setActiveView("chat")}
              onUseResult={handleUseComparison}
            />
          </Suspense>
        )}
      </main>
      </div>
      <Suspense fallback={null}>
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
        {dataOpen && <DataPanel onClose={() => setDataOpen(false)} />}
      </Suspense>
    </div>
  );
}

export default App;
