import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "fr" | "en";

const STORAGE_KEY = "aidusia_lang";

function detectLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "fr" || stored === "en") return stored;
  return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({
  lang: "fr",
  setLang: () => {},
});

/* Chaque composant garde son propre dictionnaire local :
   const STRINGS = { fr: {...}, en: {...} } as const;
   const { lang } = useLang();
   const s = STRINGS[lang];
   — pas de fichier central de traductions a maintenir. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(next: Lang) {
    localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

export function localeOf(lang: Lang): string {
  return lang === "fr" ? "fr-FR" : "en-US";
}

/* Titre par defaut d'une conversation neuve (avant le 1er message). Utilise
   par les hooks (useConversations, useChat) qui n'ont pas de dictionnaire
   local — d'ou ce helper partage plutot qu'une chaine codee en dur. */
export function newConversationTitle(lang: Lang): string {
  return lang === "fr" ? "Nouvelle conversation" : "New conversation";
}
