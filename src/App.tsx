import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { ProviderBar } from "@/components/ProviderBar";
import { ProvidersPanel } from "@/components/ProvidersPanel";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { shouldShowOnboarding } from "@/lib/deviceDetect";
import { useConversations } from "@/hooks/useConversations";
import { useChat } from "@/hooks/useChat";
import { getConversation, type Conversation } from "@/lib/db";

const DEFAULT_PROVIDER = "ollama";

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

  useEffect(() => {
    if (!currentId) {
      setCurrent(null);
      return;
    }
    getConversation(currentId).then((c) => setCurrent(c ?? null));
  }, [currentId, conversations]);

  const { sendMessage, stop, streaming, error } = useChat(setCurrent, refresh);

  async function handleSend(content: string, images?: string[]) {
    let id = currentId;
    if (!id) {
      const created = await createConversation();
      id = created.id;
    }
    await sendMessage(id, content, providerId, model, undefined, images);
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
      />
      <div className="flex flex-1 flex-col">
        <ProviderBar
          key={keysVersion}
          providerId={providerId}
          model={model}
          onChangeProvider={(p, m) => {
            setProviderId(p);
            setModel(m);
          }}
          onOpenProviders={() => setProvidersOpen(true)}
        />
        <ChatView
          conversation={current}
          streaming={streaming}
          error={error}
          onSend={handleSend}
          onStop={stop}
          providerId={providerId}
          model={model}
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
    </div>
  );
}

export default App;
