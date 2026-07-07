import { useCallback, useRef, useState } from "react";

// Dictee via l'API Web Speech native du navigateur. IMPORTANT (honnetete) :
// contrairement a l'OCR (100% WASM local), cette API n'est PAS garantie
// locale - sur Chrome/Edge, la reconnaissance vocale passe par les serveurs
// de Google. C'est la seule option de dictee sans ajouter un gros modele
// WASM (whisper) au bundle ; le README doit le dire clairement.
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isDictationSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function useDictation(lang = "fr-FR") {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback(
    (onResult: (transcript: string) => void) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return;
      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event: unknown) => {
        const e = event as { results: { transcript: string }[][] };
        const transcript = e.results.map((r) => r[0].transcript).join(" ");
        onResult(transcript);
      };
      recognition.onerror = () => setListening(false);
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    },
    [lang],
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, start, stop, supported: isDictationSupported() };
}
