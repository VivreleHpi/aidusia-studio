import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type SetStateAction,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Conversation } from "@/lib/db";
import { linkifyCitationMarkers, citationAnchorId } from "@/lib/rag/citations";
import { resolveRagSpaceForConversation } from "@/lib/rag/conversationLink";
import { listRagSpaces } from "@/lib/rag/store";
import type { RagSpace } from "@/lib/rag/types";
import { prepareVisionImage, validateImageFile } from "@/lib/imageSafety";
import { useDictation } from "@/hooks/useDictation";
import { useVisionCapability } from "@/hooks/useVisionCapability";
import { listProviders, providers } from "@/providers";
import { LOCAL_AI_PROGRESS_EVENT, type LocalAiProgress } from "@/providers/browserLocal";
import { localeOf, useLang, type Lang } from "@/lib/i18n";
import {
  loadChatDrafts,
  NEW_CONVERSATION_DRAFT_KEY,
  saveChatDrafts,
} from "@/lib/chatDrafts";
import { splitUserFacingError } from "@/lib/chatErrorDisplay";
import { listAssistantTemplates } from "@/lib/assistantTemplates";
import { providerDisplayLabel } from "@/lib/providerTaglines";
import { MobileLocalPathBanner } from "@/components/MobileLocalPathBanner";
import {
  chatMarkdownComponents,
  CopyAnswerButton,
  ShareAnswerButton,
  ToolResultBlock,
} from "@/components/chat/ChatMessageBlocks";
import { ModelMenu, type ModelReadiness } from "@/components/ModelMenu";
import { StarPrompt } from "@/components/StarPrompt";
import { REPO_URL } from "@/lib/repo";
import {
  IconArrowUp,
  IconBook,
  IconChevronDown,
  IconRefresh,
  IconImage,
  IconKey,
  IconList,
  IconLock,
  IconMic,
  IconPaperclip,
  IconPencil,
  IconPlug,
  IconSparkles,
  IconSquare,
  IconX,
} from "@/components/Icons";

/* Icônes des puces de suggestion, dans l'ordre du tableau chips des STRINGS. */
const CHIP_ICONS = [IconPencil, IconBook, IconList, IconSparkles];

/** Au-delà de ce seuil, seuls les derniers messages sont rendus (virtualisation légère). */
const MESSAGE_RENDER_CAP = 80;
const MESSAGE_REVEAL_STEP = 40;

interface PendingImage {
  base64: string;
  previewUrl: string;
}

interface LastSubmission {
  draftKey: string;
  content: string;
  sentContent: string;
  image: PendingImage | null;
}

const STRINGS = {
  fr: {
    welcome: (hour: number) =>
      hour >= 18 || hour < 5
        ? "Aidusia est à votre écoute ce soir."
        : hour < 12
          ? "Aidusia est à votre écoute ce matin."
          : "Aidusia est à votre écoute cet après-midi.",
    helpPrompt: "En quoi puis-je vous aider ?",
    jumpToTop: "Remonter en haut",
    chips: [
      { label: "Écrire", prompt: "Aide-moi à rédiger un email professionnel" },
      { label: "Apprendre", prompt: "Explique-moi un concept compliqué, simplement" },
      { label: "Résumer", prompt: "Résume ce texte en 3 points" },
      { label: "Créer", prompt: "Donne-moi des idées pour un projet créatif" },
    ],
    badgeLocal: "Stockage local",
    badgeKeys: "Votre clé, vos règles",
    badgeOpenSource: "Open source",
    copyAnswer: "Copier la réponse",
    shareAnswer: "Partager la réponse",
    shareFilename: "aidusia-reponse.md",
    regenerateAnswer: "Régénérer la réponse",
    toolResultFrom: "Résultat de",
    toolFallback: "l'outil",
    toolCallPrefix: "Appel de",
    imageAttached: "Image jointe",
    thinking: "En train de répondre",
    ocrRunning: "OCR local en cours…",
    ocrPrefix: "OCR",
    imagePrefix: "Image",
    dictationWarning:
      "Écoute en cours… (dictée via le service vocal du navigateur, pas garanti 100% local — voir README)",
    pendingImageInfo: "Image prête à être envoyée au modèle (analyse directe, pas d'OCR)",
    removeImage: "Retirer l'image",
    ocrPick: "Choisir une image pour l'OCR",
    ocrButtonTitle:
      "Extraire le texte d'une image (OCR local, texte IMPRIMÉ uniquement — mauvais sur l'écriture manuscrite)",
    ocrButtonLabel: "Extraire le texte d'une image",
    visionPick: "Choisir une image pour l'analyse vision",
    visionButtonTitle:
      "Envoyer une image au modèle pour analyse directe (mieux pour l'écriture manuscrite — Ollama uniquement pour l'instant)",
    visionButtonLabel: "Analyser une image",
    dictation: "Dictée vocale",
    placeholder: "Écrivez un message…",
    stop: "Arrêter la génération",
    send: "Envoyer",
    hint: "↵ envoyer · ⇧↵ retour à la ligne",
    disclaimer: "Les IA peuvent faire des erreurs. Vérifiez les informations importantes.",
    ragSpace: "Espace documentaire",
    ragSpaceNone: "Sans documents",
    ragSources: "Sources",
    showOlderMessages: (n: number) =>
      `Afficher ${n.toLocaleString("fr-FR")} messages plus anciens`,
    jumpToBottom: "Revenir en bas",
    openProviders: "Ouvrir les réglages fournisseurs",
    localAiLoading: "Modèle local en préparation (téléchargé une seule fois, puis en cache)…",
    configureProvider: "Configurer le fournisseur",
    retryModels: "Réessayer le chargement",
    chooseModelAction: "Choisir un modèle",
    retryMessage: "Réessayer",
    aiGenerated: "Généré par IA",
    markdownImageBlocked: "Image Markdown bloquée pour protéger votre confidentialité",
    openMarkdownImage: "Ouvrir l’image externe dans un nouvel onglet",
  },
  en: {
    welcome: (hour: number) =>
      hour >= 18 || hour < 5
        ? "Aidusia is at your service this evening."
        : hour < 12
          ? "Aidusia is at your service this morning."
          : "Aidusia is at your service this afternoon.",
    helpPrompt: "How can I help you?",
    jumpToTop: "Back to top",
    chips: [
      { label: "Write", prompt: "Help me write a professional email" },
      { label: "Learn", prompt: "Explain a complex concept to me, simply" },
      { label: "Summarize", prompt: "Summarize this text in 3 points" },
      { label: "Create", prompt: "Give me ideas for a creative project" },
    ],
    badgeLocal: "Local storage",
    badgeKeys: "Your key, your rules",
    badgeOpenSource: "Open source",
    copyAnswer: "Copy response",
    shareAnswer: "Share response",
    shareFilename: "aidusia-response.md",
    regenerateAnswer: "Regenerate response",
    toolResultFrom: "Result from",
    toolFallback: "the tool",
    toolCallPrefix: "Calling",
    imageAttached: "Image attached",
    thinking: "Thinking",
    ocrRunning: "Local OCR running…",
    ocrPrefix: "OCR",
    imagePrefix: "Image",
    dictationWarning:
      "Listening… (dictation uses the browser's speech service, not guaranteed 100% local — see README)",
    pendingImageInfo: "Image ready to send to the model (direct analysis, no OCR)",
    removeImage: "Remove image",
    ocrPick: "Choose an image for OCR",
    ocrButtonTitle:
      "Extract text from an image (local OCR, PRINTED text only — poor on handwriting)",
    ocrButtonLabel: "Extract text from an image",
    visionPick: "Choose an image for vision analysis",
    visionButtonTitle:
      "Send an image to the model for direct analysis (better for handwriting — Ollama only for now)",
    visionButtonLabel: "Analyze an image",
    dictation: "Voice dictation",
    placeholder: "Write a message…",
    stop: "Stop generating",
    send: "Send",
    hint: "↵ send · ⇧↵ new line",
    disclaimer: "AI can make mistakes. Check important information.",
    ragSpace: "Document space",
    ragSpaceNone: "No documents",
    ragSources: "Sources",
    showOlderMessages: (n: number) =>
      `Show ${n.toLocaleString("en-US")} earlier messages`,
    jumpToBottom: "Jump to bottom",
    openProviders: "Open provider settings",
    localAiLoading: "Preparing the local model (downloaded once, then cached)…",
    configureProvider: "Set up provider",
    retryModels: "Retry loading",
    chooseModelAction: "Choose a model",
    retryMessage: "Retry",
    aiGenerated: "AI-generated",
    markdownImageBlocked: "Markdown image blocked to protect your privacy",
    openMarkdownImage: "Open the external image in a new tab",
  },
} as const;

function providerLabel(providerId: string | undefined, lang: Lang): string | null {
  if (!providerId) return null;
  // Intégrés d'abord (gratuit), puis fournisseurs personnalisés (lecture
  // localStorage) — un id inconnu (fournisseur supprimé) garde l'id brut.
  const fallback =
    providers.find((p) => p.id === providerId)?.label ??
    listProviders().find((p) => p.id === providerId)?.label ??
    providerId;
  return providerDisplayLabel(providerId, lang) ?? fallback;
}

interface ChatViewProps {
  conversation: Conversation | null;
  streaming: boolean;
  error: string | null;
  onSend: (content: string, images?: string[]) => void | Promise<void>;
  onStop: () => void;
  onRegenerate: () => void | Promise<void>;
  providerId: string;
  model: string;
  onChangeProvider: (providerId: string, model: string) => void;
  onOpenProviders: () => void;
  onOpenFaq: () => void;
  keysVersion: number;
  ragSpaceId?: string | null;
  onRagSpaceChange?: (spaceId: string | null) => void;
}

export function ChatView({
  conversation,
  streaming,
  error,
  onSend,
  onStop,
  onRegenerate,
  providerId,
  model,
  onChangeProvider,
  onOpenProviders,
  onOpenFaq: _onOpenFaq,
  keysVersion,
  ragSpaceId,
  onRagSpaceChange,
}: ChatViewProps) {
  const draftKey = conversation?.id ?? NEW_CONVERSATION_DRAFT_KEY;
  const draftsRef = useRef<Record<string, string> | null>(null);
  if (draftsRef.current === null) draftsRef.current = loadChatDrafts();
  const draftKeyRef = useRef(draftKey);
  const [draft, setDraft] = useState(() => draftsRef.current?.[draftKey] ?? "");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const pendingImagesRef = useRef(new Map<string, PendingImage>());
  const lastSubmissionRef = useRef<LastSubmission | null>(null);
  const handledExternalErrorRef = useRef<string | null>(null);
  const previousStreamingRef = useRef(streaming);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [modelReadiness, setModelReadiness] = useState<ModelReadiness>({ status: "loading" });
  const [modelReloadRequest, setModelReloadRequest] = useState(0);
  const [modelOpenRequest, setModelOpenRequest] = useState(0);
  const [ragSpaces, setRagSpaces] = useState<RagSpace[]>([]);

  useEffect(() => {
    if (typeof indexedDB === "undefined") return;
    void listRagSpaces()
      .then(setRagSpaces)
      .catch(() => setRagSpaces([]));
  }, [keysVersion, conversation?.id]);

  const effectiveRagSpaceId =
    ragSpaceId ?? (conversation ? resolveRagSpaceForConversation(conversation.id) : null);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [olderReveal, setOlderReveal] = useState(0);
  const [showJumpToTop, setShowJumpToTop] = useState(false);
  const [localAi, setLocalAi] = useState<LocalAiProgress | null>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const visionInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);
  useEffect(() => {
    setOlderReveal(0);
  }, [conversation?.id]);

  const messageCount = conversation?.messages.length ?? 0;
  const lastContent = conversation?.messages.at(-1)?.content ?? "";
  // Modele local auquel cette conversation est liee (1er message genere par
  // l'IA « navigateur ») : verrouille le choix du modele local pour eviter les
  // changements en cours de route (bugs GPU). Null tant qu'aucun message local.
  const lockedLocalModel =
    conversation?.messages.find((m) => m.role === "assistant" && m.providerId === "browser")?.model ??
    null;
  const { lang } = useLang();
  const s = STRINGS[lang];
  const starterChips = useMemo(() => listAssistantTemplates(lang), [lang]);
  const locale = localeOf(lang);
  const dictation = useDictation(locale);
  const visionCapable = useVisionCapability(providerId, model);

  function persistDraft(key: string, value: string) {
    const drafts = draftsRef.current ?? {};
    if (value) drafts[key] = value;
    else delete drafts[key];
    draftsRef.current = drafts;
    saveChatDrafts(drafts);
  }

  function updateDraft(update: SetStateAction<string>, key = draftKeyRef.current) {
    setDraft((current) => {
      const next = typeof update === "function" ? update(current) : update;
      persistDraft(key, next);
      return next;
    });
  }

  function releaseSubmission(submission: LastSubmission | null) {
    if (!submission?.image) return;
    const stillPending = [...pendingImagesRef.current.values()].some(
      (image) => image.previewUrl === submission.image?.previewUrl,
    );
    if (!stillPending) URL.revokeObjectURL(submission.image.previewUrl);
  }

  function restoreSubmission(submission: LastSubmission) {
    const existing = draftsRef.current?.[submission.draftKey] ?? "";
    const restored = existing
      ? existing.includes(submission.content)
        ? existing
        : `${submission.content}\n\n${existing}`
      : submission.content;
    persistDraft(submission.draftKey, restored);
    if (draftKeyRef.current === submission.draftKey) setDraft(restored);

    if (submission.image && !pendingImagesRef.current.has(submission.draftKey)) {
      pendingImagesRef.current.set(submission.draftKey, submission.image);
      if (draftKeyRef.current === submission.draftKey) setPendingImage(submission.image);
    }
  }

  function submit(content: string, image: PendingImage | null, key: string) {
    const submission: LastSubmission = {
      draftKey: key,
      content,
      sentContent: content.trim(),
      image,
    };
    lastSubmissionRef.current = submission;
    handledExternalErrorRef.current = null;
    setSubmitError(null);
    persistDraft(key, "");
    if (draftKeyRef.current === key) setDraft("");
    pendingImagesRef.current.delete(key);
    if (draftKeyRef.current === key) setPendingImage(null);

    try {
      void Promise.resolve(
        onSend(submission.sentContent, image ? [image.base64] : undefined),
      ).catch((reason) => {
        const message = reason instanceof Error ? reason.message : String(reason);
        setSubmitError(message);
        restoreSubmission(submission);
      });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setSubmitError(message);
      restoreSubmission(submission);
    }
  }

  useEffect(() => {
    const previousKey = draftKeyRef.current;
    if (previousKey === draftKey) return;

    // Le premier envoi cree son identifiant de conversation apres le submit :
    // la soumission en attente doit suivre ce nouvel identifiant.
    const lastSubmission = lastSubmissionRef.current;
    if (previousKey === NEW_CONVERSATION_DRAFT_KEY && lastSubmission?.draftKey === previousKey) {
      lastSubmission.draftKey = draftKey;
      const orphanDraft = draftsRef.current?.[previousKey];
      if (orphanDraft) {
        persistDraft(draftKey, orphanDraft);
        persistDraft(previousKey, "");
      }
      const orphanImage = pendingImagesRef.current.get(previousKey);
      if (orphanImage) {
        pendingImagesRef.current.delete(previousKey);
        pendingImagesRef.current.set(draftKey, orphanImage);
      }
    }

    draftKeyRef.current = draftKey;
    setDraft(draftsRef.current?.[draftKey] ?? "");
    setPendingImage(pendingImagesRef.current.get(draftKey) ?? null);
  }, [draftKey]);

  useEffect(() => {
    atBottomRef.current = true;
    setShowJumpToBottom(false);
    setShowJumpToTop(false);
  }, [conversation?.id]);

  // Ne suit le flux que si l'utilisateur est deja en bas : s'il remonte lire,
  // on ne le ramene pas de force a chaque chunk.
  useEffect(() => {
    if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth" });
    }
  }, [messageCount, lastContent, streaming]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [draft]);

  useEffect(() => {
    const pendingImages = pendingImagesRef.current;
    const submissionRef = lastSubmissionRef;
    return () => {
      const urls = new Set(
        [...pendingImages.values()].map((image) => image.previewUrl),
      );
      const submittedUrl = submissionRef.current?.image?.previewUrl;
      if (submittedUrl) urls.add(submittedUrl);
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!error) {
      handledExternalErrorRef.current = null;
      return;
    }
    if (handledExternalErrorRef.current === error) return;
    handledExternalErrorRef.current = error;
    const submission = lastSubmissionRef.current;
    if (submission) restoreSubmission(submission);
  }, [error]);

  useEffect(() => {
    if (previousStreamingRef.current && !streaming && !error && !submitError) {
      releaseSubmission(lastSubmissionRef.current);
      lastSubmissionRef.current = null;
    }
    previousStreamingRef.current = streaming;
  }, [error, streaming, submitError]);

  // Progression du fournisseur « Navigateur (local) » : telechargement puis
  // chargement du modele en memoire GPU, diffusee par evenement global.
  useEffect(() => {
    function onProgress(e: Event) {
      const detail = (e as CustomEvent<LocalAiProgress>).detail;
      setLocalAi(detail.progress >= 1 ? null : detail);
    }
    window.addEventListener(LOCAL_AI_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(LOCAL_AI_PROGRESS_EVENT, onProgress);
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = nearBottom;
    setShowJumpToBottom(!nearBottom && messageCount > 0);
    // Remonter : proposé dès qu'on a défilé un peu vers le bas.
    setShowJumpToTop(el.scrollTop > 240 && messageCount > 0);
  }

  function jumpToBottom() {
    atBottomRef.current = true;
    setShowJumpToBottom(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function jumpToTop() {
    atBottomRef.current = false;
    setShowJumpToTop(false);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if ((!trimmed && !pendingImage) || streaming || modelReadiness.status !== "ready") return;
    submit(draft, pendingImage, draftKeyRef.current);
  }

  function retryLastMessage() {
    const submission = lastSubmissionRef.current;
    if (!submission || submission.draftKey !== draftKeyRef.current) return;
    if (streaming || modelReadiness.status !== "ready") return;
    submit(submission.content, submission.image, submission.draftKey);
  }

  async function handleOcrFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOcrError(null);
    setOcrBusy(true);
    setOcrProgress(0);
    try {
      validateImageFile(file, lang);
      // Le module OCR (et donc Tesseract/WASM) n'entre dans le graphe charge
      // qu'au moment ou l'utilisateur choisit effectivement une image.
      const { extractTextFromImage } = await import("@/lib/ocr");
      const text = await extractTextFromImage(file, lang === "fr" ? "fra" : "eng", setOcrProgress);
      updateDraft((prev) => (prev ? `${prev}\n\n${text}` : text));
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : String(err));
    } finally {
      setOcrBusy(false);
    }
  }

  async function handleVisionFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setVisionError(null);
    try {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
      const prepared = await prepareVisionImage(file, lang);
      pendingImagesRef.current.set(draftKeyRef.current, prepared);
      setPendingImage(prepared);
    } catch (err) {
      setVisionError(err instanceof Error ? err.message : String(err));
    }
  }

  function applySuggestion(text: string) {
    updateDraft(text);
    textareaRef.current?.focus();
  }

  function toggleDictation() {
    if (dictation.listening) {
      dictation.stop();
    } else {
      dictation.start((transcript) => {
        updateDraft((prev) => (prev ? `${prev} ${transcript}` : transcript));
      });
    }
  }

  const composerButtonClass =
    "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition duration-150 hover:bg-foreground/5 hover:text-foreground active:scale-95 disabled:opacity-40 sm:h-9 sm:w-9";

  const allMessages = conversation?.messages ?? [];
  const hiddenMessageCount = Math.max(0, allMessages.length - MESSAGE_RENDER_CAP - olderReveal);
  const visibleMessages = hiddenMessageCount > 0 ? allMessages.slice(hiddenMessageCount) : allMessages;

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="relative flex-1 overflow-hidden">
        <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto px-6 py-4">
          {!conversation || conversation.messages.length === 0 ? (
            <div className="flex h-full flex-col items-center px-4 text-center">
              <div className="rise-in flex flex-1 flex-col items-center justify-center gap-4">
                <h1 className="bg-linear-to-br from-foreground to-foreground/60 bg-clip-text text-center text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
                  AIDUSIA
                </h1>
                <p className="max-w-md text-base text-balance text-muted-foreground">
                  {s.welcome(new Date().getHours())} {s.helpPrompt}
                </p>
                <div
                  className="rise-in mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground"
                  style={{ animationDelay: "100ms" }}
                >
                  <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/20 px-3 py-1.5">
                    <IconLock className="h-3.5 w-3.5 shrink-0" /> {s.badgeLocal}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/20 px-3 py-1.5">
                    <IconKey className="h-3.5 w-3.5 shrink-0" /> {s.badgeKeys}
                  </span>
                  <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 transition duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground active:scale-[0.98]"
                  >
                    <IconBook className="h-3.5 w-3.5" /> {s.badgeOpenSource}
                  </a>
                </div>
              </div>

              <div
                className="rise-in mb-3 flex flex-wrap items-center justify-center gap-2"
                style={{ animationDelay: "200ms" }}
              >
                {starterChips.map((chip, i) => {
                  const ChipIcon = CHIP_ICONS[i] ?? IconSparkles;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => applySuggestion(chip.prompt)}
                      className="glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs text-foreground transition duration-150 hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.98]"
                    >
                      <ChipIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {hiddenMessageCount > 0 && (
                <button
                  type="button"
                  className="mx-auto rounded-full border border-border/60 bg-muted/30 px-4 py-2 text-xs text-muted-foreground transition hover:bg-muted/50"
                  onClick={() => setOlderReveal((v) => v + MESSAGE_REVEAL_STEP)}
                >
                  {s.showOlderMessages(
                    Math.min(hiddenMessageCount, MESSAGE_REVEAL_STEP),
                  )}
                </button>
              )}
              {visibleMessages.map((m, vi) => {
                const i = hiddenMessageCount + vi;
                if (m.role === "tool") {
                  return <ToolResultBlock key={m.id} name={m.toolName} content={m.content} />;
                }
                const isLastAssistant =
                  m.role === "assistant" && i === conversation.messages.length - 1;
                const label = m.role === "assistant" ? providerLabel(m.providerId, lang) : null;
                const calledTools = m.role === "assistant" ? m.toolCalls : undefined;
                if (m.role === "user") {
                  return (
                    <div
                      key={m.id}
                      className="message-in ml-auto max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                      title={new Date(m.createdAt).toLocaleString(locale)}
                    >
                      {m.images && m.images.length > 0 && (
                        <p className="mb-1 flex items-center gap-1 text-xs opacity-70">
                          <IconImage className="h-3.5 w-3.5" /> {s.imageAttached}
                        </p>
                      )}
                      {m.content}
                    </div>
                  );
                }
                return (
                  <div
                    key={m.id}
                    className="message-in group w-full text-[15px] leading-relaxed text-foreground"
                    title={new Date(m.createdAt).toLocaleString(locale)}
                  >
                    {calledTools && calledTools.length > 0 && (
                      <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <IconPlug className="h-3 w-3" />
                        {s.toolCallPrefix} {calledTools.map((tc) => `\`${tc.name}\``).join(", ")}
                      </p>
                    )}
                    {m.content ? (
                      <>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>
                          {m.ragCitations?.length
                            ? linkifyCitationMarkers(
                                m.content,
                                m.ragCitations.map((c) => c.label),
                              )
                            : m.content}
                        </ReactMarkdown>
                        {m.ragCitations && m.ragCitations.length > 0 ? (
                          <ul
                            className="mt-3 space-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground"
                            aria-label={s.ragSources}
                          >
                            {m.ragCitations.map((cite) => (
                              <li key={cite.chunkId} id={citationAnchorId(cite.chunkId)}>
                                <a
                                  href={`#${citationAnchorId(cite.chunkId)}`}
                                  className="font-medium text-primary hover:underline"
                                >
                                  [{cite.label}]
                                </a>{" "}
                                <span className="font-medium text-foreground">{cite.fileName}</span>
                                <p className="mt-0.5 whitespace-pre-wrap">{cite.excerpt}</p>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : isLastAssistant && streaming ? (
                      <span className="flex items-center gap-1 py-1" aria-label={s.thinking}>
                        <span className="thinking-dot" />
                        <span className="thinking-dot" />
                        <span className="thinking-dot" />
                      </span>
                    ) : null}
                    {isLastAssistant && streaming && m.content && <span className="typing-cursor" />}
                    {label && (m.content || !streaming) && (
                      <div className="mt-1.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                        <span className="shrink-0">{s.aiGenerated} · {label}</span>
                        {m.model && (
                          <span className="min-w-0 truncate font-mono" title={m.model}>
                            · {m.model}
                          </span>
                        )}
                        {m.content && !streaming && (
                          <span
                            className={`ml-auto flex shrink-0 items-center gap-0.5 ${
                              isLastAssistant
                                ? ""
                                : "opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                            }`}
                          >
                            <CopyAnswerButton text={m.content} />
                            <ShareAnswerButton text={m.content} />
                            {isLastAssistant && (
                              <button
                                type="button"
                                onClick={() => void onRegenerate()}
                                disabled={streaming || modelReadiness.status !== "ready"}
                                title={s.regenerateAnswer}
                                aria-label={s.regenerateAnswer}
                                className="inline-grid min-h-11 min-w-11 place-items-center sm:min-h-0 sm:min-w-0 rounded-md p-1 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground disabled:opacity-40"
                              >
                                <IconRefresh className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {error && (() => {
                const { summary, detail } = splitUserFacingError(error);
                return (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mr-auto max-w-[80%] rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
                >
                  <p className="wrap-break-word">{summary}</p>
                  {detail ? (
                    <details className="mt-2 text-xs text-destructive/90">
                      <summary className="cursor-pointer underline-offset-2 hover:underline">
                        {lang === "fr" ? "Détails techniques" : "Technical details"}
                      </summary>
                      <pre className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap wrap-break-word font-mono text-xs">
                        {detail}
                      </pre>
                    </details>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lastSubmissionRef.current?.draftKey === draftKeyRef.current ? (
                      <button
                        type="button"
                        onClick={retryLastMessage}
                        disabled={streaming || modelReadiness.status !== "ready"}
                        className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs transition duration-150 hover:bg-destructive/15 active:scale-[0.98] disabled:opacity-40"
                      >
                        {s.retryMessage}
                      </button>
                    ) : (
                      // Regeneration echouee : plus de reponse a la fin de la
                      // conversation ni de soumission a rejouer - on propose
                      // de relancer la generation depuis le dernier message.
                      conversation.messages.at(-1)?.role === "user" && (
                        <button
                          type="button"
                          onClick={() => void onRegenerate()}
                          disabled={streaming || modelReadiness.status !== "ready"}
                          className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs transition duration-150 hover:bg-destructive/15 active:scale-[0.98] disabled:opacity-40"
                        >
                          {s.regenerateAnswer}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={onOpenProviders}
                      className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs transition duration-150 hover:bg-destructive/15 active:scale-[0.98]"
                    >
                      {s.openProviders}
                    </button>
                  </div>
                </div>
                );
              })()}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-4 right-4 flex flex-col gap-2">
          {showJumpToTop && (
            <button
              type="button"
              onClick={jumpToTop}
              aria-label={s.jumpToTop}
              title={s.jumpToTop}
              className="glass pointer-events-auto grid h-9 w-9 place-items-center rounded-full text-muted-foreground shadow-lg transition duration-150 hover:text-foreground active:scale-95"
            >
              <IconChevronDown className="h-4 w-4 rotate-180" />
            </button>
          )}
          {showJumpToBottom && (
            <button
              type="button"
              onClick={jumpToBottom}
              aria-label={s.jumpToBottom}
              title={s.jumpToBottom}
              className="glass pointer-events-auto grid h-9 w-9 place-items-center rounded-full text-muted-foreground shadow-lg transition duration-150 hover:text-foreground active:scale-95"
            >
              <IconChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
        data-tour="chat-input"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {ocrBusy && (
            <p role="status" aria-live="polite" className="px-2 text-xs text-muted-foreground">
              {s.ocrRunning} {Math.round(ocrProgress * 100)}%
            </p>
          )}
          {localAi && (
            <p role="status" aria-live="polite" className="px-2 text-xs text-muted-foreground">
              {s.localAiLoading} {Math.round(localAi.progress * 100)}%
            </p>
          )}
          {ocrError && <p role="alert" className="px-2 text-xs text-destructive">{s.ocrPrefix} : {ocrError}</p>}
          {visionError && (
            <p role="alert" className="px-2 text-xs text-destructive">{s.imagePrefix} : {visionError}</p>
          )}
          {submitError && <p role="alert" className="px-2 text-xs text-destructive">{submitError}</p>}
          {modelReadiness.status !== "ready" && (
            <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 px-2 text-xs">
              <span className="min-w-0 wrap-break-word text-muted-foreground">
                {modelReadiness.message ?? s.chooseModelAction}
              </span>
              {modelReadiness.status !== "loading" && (
                <button
                  type="button"
                  onClick={() => {
                    if (modelReadiness.status === "missing-key") onOpenProviders();
                    else if (modelReadiness.status === "error") setModelReloadRequest((value) => value + 1);
                    else setModelOpenRequest((value) => value + 1);
                  }}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-foreground transition hover:bg-foreground/5"
                >
                  {modelReadiness.status === "missing-key"
                    ? s.configureProvider
                    : modelReadiness.status === "error"
                      ? s.retryModels
                      : s.chooseModelAction}
                </button>
              )}
            </div>
          )}
          {dictation.listening && (
            <p className="px-2 text-xs text-warning">{s.dictationWarning}</p>
          )}
          <StarPrompt streaming={streaming} error={error} />
          {pendingImage && (
            <div className="glass flex items-center gap-2 rounded-xl p-2 text-xs">
              <img src={pendingImage.previewUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
              <span className="flex-1 text-muted-foreground">{s.pendingImageInfo}</span>
              <button
                type="button"
                 onClick={() => {
                   URL.revokeObjectURL(pendingImage.previewUrl);
                   pendingImagesRef.current.delete(draftKeyRef.current);
                   setPendingImage(null);
                }}
                aria-label={s.removeImage}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-foreground/5 hover:text-destructive"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <MobileLocalPathBanner providerId={providerId} onOpenProviders={onOpenProviders} />

          <div className="glass flex flex-col rounded-2xl p-2 shadow-lg shadow-black/5 transition duration-150 focus-within:border-ring/50 focus-within:ring-1 focus-within:ring-ring/40">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => updateDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={1}
              placeholder={s.placeholder}
              className="max-h-48 w-full resize-none bg-transparent px-2 pb-2.5 pt-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-[15px]"
            />
            <div className="flex items-center gap-1">
              <input
                ref={ocrInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
                className="hidden"
                aria-label={s.ocrPick}
                onChange={handleOcrFileSelected}
              />
              <button
                type="button"
                onClick={() => ocrInputRef.current?.click()}
                disabled={ocrBusy}
                title={s.ocrButtonTitle}
                aria-label={s.ocrButtonLabel}
                className={composerButtonClass}
              >
                <IconPaperclip className="h-4 w-4" />
              </button>
              {visionCapable && (
                <>
                  <input
                    ref={visionInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
                    className="hidden"
                    aria-label={s.visionPick}
                    onChange={handleVisionFileSelected}
                  />
                  <button
                    type="button"
                    onClick={() => visionInputRef.current?.click()}
                    title={s.visionButtonTitle}
                    aria-label={s.visionButtonLabel}
                    className={composerButtonClass}
                  >
                    <IconImage className="h-4 w-4" />
                  </button>
                </>
              )}
              {dictation.supported && (
                <button
                  type="button"
                  onClick={toggleDictation}
                  title={s.dictation}
                  aria-label={s.dictation}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition duration-150 active:scale-95 sm:h-9 sm:w-9 ${
                    dictation.listening
                      ? "bg-warning/15 text-warning"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  <IconMic className={`h-4 w-4 ${dictation.listening ? "animate-pulse" : ""}`} />
                </button>
              )}
              <label className="sr-only" htmlFor="rag-space-select">
                {s.ragSpace}
              </label>
              <select
                id="rag-space-select"
                value={effectiveRagSpaceId ?? ""}
                onChange={(e) =>
                  onRagSpaceChange?.(e.target.value ? e.target.value : null)
                }
                disabled={!conversation || !onRagSpaceChange}
                className="max-w-[9rem] truncate rounded-lg border border-border/60 bg-card px-2 py-1 text-xs text-foreground sm:max-w-[12rem]"
                title={s.ragSpace}
              >
                <option value="">{s.ragSpaceNone}</option>
                {ragSpaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
              <div className="ml-auto flex min-w-0 items-center gap-1.5">
                <ModelMenu
                  key={keysVersion}
                  providerId={providerId}
                  model={model}
                  onChangeProvider={onChangeProvider}
                  onOpenProviders={onOpenProviders}
                  lockedLocalModel={lockedLocalModel}
                  onReadinessChange={setModelReadiness}
                  reloadRequest={modelReloadRequest}
                  openRequest={modelOpenRequest}
                  keysVersion={keysVersion}
                />
                {streaming ? (
                  <button
                    type="button"
                    onClick={onStop}
                    title={s.stop}
                    aria-label={s.stop}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground transition duration-150 hover:opacity-90 active:scale-95 sm:h-9 sm:w-9"
                  >
                    <IconSquare className="h-3 w-3" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={modelReadiness.status !== "ready" || (!draft.trim() && !pendingImage)}
                    aria-label={s.send}
                    title={s.send}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition duration-150 hover:opacity-90 active:scale-95 disabled:opacity-30 sm:h-9 sm:w-9"
                  >
                    <IconArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="text-center text-xs leading-5 text-muted-foreground">
            <span className="hidden sm:inline">{s.hint} · </span>
            {s.disclaimer}
          </p>
        </div>
      </form>
    </div>
  );
}
