import { useCallback, useEffect, useState } from "react";
import { Sidebar, FOCUS_SEARCH_EVENT } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { ProvidersPanel } from "@/components/ProvidersPanel";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { AboutModal } from "@/components/AboutModal";
import { FaqPanel } from "@/components/FaqPanel";
import { GuidePage } from "@/components/GuidePage";
import { GuidedTour } from "@/components/GuidedTour";
import { McpPanel } from "@/components/McpPanel";
import { shouldShowOnboarding } from "@/lib/deviceDetect";
import { useLang } from "@/lib/i18n";
import { useConversations } from "@/hooks/useConversations";
import { useChat } from "@/hooks/useChat";
import { getConversation, purgeAll, type Conversation } from "@/lib/db";

const DEFAULT_PROVIDER = "ollama";

const STRINGS = {
  fr: {
    purgeConfirm:
      "Effacer définitivement toutes les conversations ? Cette action est irréversible.",
    toggleMenu: "Basculer le menu",
  },
  en: {
    purgeConfirm: "Permanently delete all conversations? This cannot be undone.",
    toggleMenu: "Toggle menu",
  },
} as const;

function App() {
  const {
    conversations,
    currentId,
    setCurrentId,
    loading,
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
  const { lang } = useLang();
  const s = STRINGS[lang];

  useEffect(() => {
    if (!currentId) {
      setCurrent(null);
      return;
    }
    getConversation(currentId).then((c) => setCurrent(c ?? null));
  }, [currentId, conversations]);

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

  if (loading) return null;

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar
        conversations={conversations}
        currentId={currentId}
        onSelect={setCurrentId}
        onCreate={createConversation}
        onDelete={removeConversation}
        onOpenAbout={() => setAboutOpen(true)}
        onOpenFaq={() => setFaqOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
        onStartTour={() => setTourOpen(true)}
        onOpenProviders={() => setProvidersOpen(true)}
        onOpenMcp={() => setMcpOpen(true)}
        onPurgeAll={() => void handlePurgeAll()}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden">
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
      </div>
      {providersOpen && (
        <ProvidersPanel
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
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      {faqOpen && <FaqPanel onClose={() => setFaqOpen(false)} />}
      {guideOpen && <GuidePage onClose={() => setGuideOpen(false)} />}
      {tourOpen && <GuidedTour onFinish={() => setTourOpen(false)} />}
      {mcpOpen && <McpPanel onClose={() => setMcpOpen(false)} />}
    </div>
  );
}

export default App;
