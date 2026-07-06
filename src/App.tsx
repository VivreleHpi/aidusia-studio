import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { ProviderBar } from "@/components/ProviderBar";
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

  useEffect(() => {
    if (!currentId) {
      setCurrent(null);
      return;
    }
    getConversation(currentId).then((c) => setCurrent(c ?? null));
  }, [currentId, conversations]);

  const reloadCurrent = () => {
    if (currentId) getConversation(currentId).then((c) => setCurrent(c ?? null));
    refresh();
  };

  const { sendMessage, stop, streaming, error } = useChat(reloadCurrent);

  async function handleSend(content: string) {
    let id = currentId;
    if (!id) {
      const created = await createConversation();
      id = created.id;
    }
    await sendMessage(id, content, providerId, model);
  }

  if (loading) return null;

  return (
    <div className="flex h-screen bg-white dark:bg-neutral-950">
      <Sidebar
        conversations={conversations}
        currentId={currentId}
        onSelect={setCurrentId}
        onCreate={createConversation}
        onDelete={removeConversation}
      />
      <div className="flex flex-1 flex-col">
        <ProviderBar
          providerId={providerId}
          model={model}
          onChangeProvider={(p, m) => {
            setProviderId(p);
            setModel(m);
          }}
        />
        <ChatView
          conversation={current}
          streaming={streaming}
          error={error}
          onSend={handleSend}
          onStop={stop}
        />
      </div>
    </div>
  );
}

export default App;
