import { useLang, type Lang } from "../lib/i18n";

interface FaqPanelProps {
  onClose: () => void;
}

interface FaqEntry {
  q: string;
  a: string;
}

const STRINGS: Record<Lang, { title: string; dialogLabel: string; closeLabel: string; faqs: FaqEntry[] }> = {
  fr: {
    title: "Questions fréquentes",
    dialogLabel: "Questions fréquentes",
    closeLabel: "Fermer",
    faqs: [
      {
        q: "Mes conversations et mes clés API sont-elles envoyées sur un serveur ?",
        a: "Non. Les conversations restent uniquement dans votre navigateur (IndexedDB), et les clés API dans localStorage. Les appels partent directement de votre navigateur vers le fournisseur choisi (Anthropic, Gemini, Mistral, OpenRouter, Groq) ou vers Ollama en local. Seules deux exceptions passent par un petit proxy — voir la question suivante.",
      },
      {
        q: "Pourquoi un proxy existe pour OpenAI et Ollama Cloud ?",
        a: "OpenAI et Ollama Cloud bloquent les requêtes directes depuis un navigateur (pas d'en-tête CORS sur la vraie réponse, vérifié empiriquement). Le proxy est stateless, sans log de votre clé ni de vos messages, et son code est dans ce même dépôt (api/openai/, api/ollama-cloud/) — vérifiable ligne par ligne.",
      },
      {
        q: "L'outil est-il français ?",
        a: "Oui, AIDUSIA Studio est conçu et développé en France. La conformité à la législation — le RGPD en premier lieu — n'est pas une contrainte ajoutée après coup : c'est un principe de conception, présent dès la première ligne de code.",
      },
      {
        q: "Comment obtenir une clé API ?",
        a: "Chaque fournisseur (Anthropic, Google Gemini, Mistral, OpenRouter, OpenAI, Groq) propose une page \"API keys\" dans son propre espace développeur après création d'un compte. La \"Notice d'utilisation\" (menu Paramètres) donne un lien direct vers la page de clé de chacun. Collez la clé obtenue dans le panneau \"Fournisseurs\" — rien n'est envoyé ailleurs qu'au fournisseur concerné.",
      },
      {
        q: "Qu'est-ce qu'Ollama, et pourquoi l'utiliser ?",
        a: "Ollama fait tourner des modèles d'IA en local sur votre machine, gratuitement, sans compte ni clé API. Installez-le, lancez-le, et ce Studio le détecte automatiquement. C'est l'option la plus privée : rien ne quitte votre ordinateur. Ollama demande une application de bureau : c'est donc une solution pour ordinateur. Sur téléphone, utilisez plutôt « Sur cet appareil ».",
      },
      {
        q: "L'IA locale « Sur cet appareil » : d'où viennent les modèles et où tournent-ils ?",
        a: "Le fournisseur « Sur cet appareil » exécute de vrais modèles ouverts — Llama 3.2 (Meta), Qwen 2.5 (Alibaba) et Gemma 2 (Google) — directement dans votre navigateur via WebGPU. Ils sont compressés par le projet open source MLC-AI et téléchargés une seule fois depuis HuggingFace (0,7 à 1,4 Go selon le modèle), puis mis en cache. Ensuite, tout se passe sur votre appareil : aucune requête vers un serveur, aucune clé, et ça marche sur PC comme sur mobile (Chrome/Edge 121+ sur Android, Safari 26 sur iOS). Vous pouvez voir l'état du téléchargement, la place occupée et supprimer un modèle dans Fournisseurs → Sur cet appareil → Modèles.",
      },
      {
        q: "L'application fonctionne-t-elle sans connexion internet ?",
        a: "Oui, en grande partie. Une fois le site ouvert une première fois, son interface est mise en cache et se relance sans réseau. Et si vous avez téléchargé un modèle « Sur cet appareil », il répond entièrement hors connexion — idéal en avion ou en zone blanche. Seuls les fournisseurs cloud (Anthropic, Groq, etc.) et Ollama ont évidemment besoin du réseau pour joindre leur serveur.",
      },
      {
        q: "Mon téléphone est saturé : comment libérer de la place ?",
        a: "Ouvrez Fournisseurs → Sur cet appareil → Modèles : chaque modèle téléchargé affiche sa taille et un bouton « Supprimer ». C'est la bonne façon de faire — évitez « effacer les données du site » depuis les réglages du navigateur, qui supprimerait aussi vos conversations et vos clés. Vous pouvez aussi « Protéger » le stockage pour empêcher le navigateur d'évincer un modèle quand l'espace manque.",
      },
      {
        q: "Pourquoi l'OCR ne lit pas correctement mon écriture manuscrite ?",
        a: "L'OCR intégré (Tesseract, 100 % local) est conçu pour le texte imprimé/tapé — il est fondamentalement mauvais sur l'écriture manuscrite, quel que soit le prétraitement. Pour une photo ou un document manuscrit, utilisez plutôt le bouton \"Analyse d'image\" (visible avec un modèle vision comme Ollama), qui envoie l'image telle quelle au modèle.",
      },
      {
        q: "Est-ce que c'est gratuit ?",
        a: "Le Studio lui-même est gratuit et open source. Ollama en local est gratuit. Les fournisseurs cloud (Anthropic, OpenAI, etc.) facturent selon leur propre grille tarifaire, via votre propre clé — ce Studio ne prend aucune marge ni abonnement.",
      },
      {
        q: "Le Studio restera-t-il gratuit ?",
        a: "Oui. Le Studio restera toujours gratuit et sera maintenu à jour, dans le respect des licences des composants open source qu'il embarque. Dans les mois à venir, des suites spécialisées viendront le compléter — mais le Studio lui-même ne deviendra jamais payant.",
      },
      {
        q: "Mes clés API sont-elles conservées si je ferme le navigateur ?",
        a: "Par défaut, oui (localStorage), mais vous pouvez désactiver cette persistance dans le panneau \"Fournisseurs\" si vous préférez ressaisir vos clés à chaque session.",
      },
      {
        q: "Est-ce la version complète du produit AIDUSIA ?",
        a: "Non. Ce Studio est une brique isolée et volontairement minimale, pensée pour être testée et vérifiée par n'importe qui — pas le produit complet.",
      },
    ],
  },
  en: {
    title: "Frequently asked questions",
    dialogLabel: "Frequently asked questions",
    closeLabel: "Close",
    faqs: [
      {
        q: "Are my conversations and API keys sent to a server?",
        a: "No. Conversations stay only in your browser (IndexedDB), and API keys in localStorage. Requests go directly from your browser to the provider you choose (Anthropic, Gemini, Mistral, OpenRouter, Groq) or to Ollama running locally. Only two exceptions go through a small proxy — see the next question.",
      },
      {
        q: "Why is there a proxy for OpenAI and Ollama Cloud?",
        a: "OpenAI and Ollama Cloud block direct requests from a browser (no CORS header on the actual response, verified empirically). The proxy is stateless, logs neither your key nor your messages, and its code lives in this same repository (api/openai/, api/ollama-cloud/) — auditable line by line.",
      },
      {
        q: "Is this tool French?",
        a: "Yes, AIDUSIA Studio is designed and built in France. Legal compliance — GDPR first and foremost — isn't a constraint bolted on afterward: it's a design principle, built in from the first line of code.",
      },
      {
        q: "How do I get an API key?",
        a: "Each provider (Anthropic, Google Gemini, Mistral, OpenRouter, OpenAI, Groq) offers an \"API keys\" page in its own developer console once you've created an account. The \"Usage notice\" (Settings menu) links directly to each provider's key page. Paste the key into the \"Providers\" panel — it's sent nowhere except to that provider.",
      },
      {
        q: "What is Ollama, and why use it?",
        a: "Ollama runs AI models locally on your machine, for free, with no account or API key needed. Install it, launch it, and this Studio detects it automatically. It's the most private option: nothing ever leaves your computer. Ollama needs a desktop app, so it's a computer-only solution. On a phone, use \"On-device\" instead.",
      },
      {
        q: "The \"On-device\" local AI: where do the models come from and where do they run?",
        a: "The \"On-device\" provider runs real open models — Llama 3.2 (Meta), Qwen 2.5 (Alibaba) and Gemma 2 (Google) — directly in your browser via WebGPU. They're compressed by the open-source MLC-AI project and downloaded once from HuggingFace (0.7 to 1.4 GB depending on the model), then cached. After that, everything happens on your device: no request to any server, no key, and it works on PC and mobile alike (Chrome/Edge 121+ on Android, Safari 26 on iOS). You can see download status, space used, and delete a model under Providers → On-device → Models.",
      },
      {
        q: "Does the app work without an internet connection?",
        a: "Yes, largely. Once you've opened the site once, its interface is cached and relaunches with no network. And if you've downloaded a \"On-device\" model, it answers entirely offline — perfect on a plane or in a dead zone. Only cloud providers (Anthropic, Groq, etc.) and Ollama obviously need the network to reach their server.",
      },
      {
        q: "My phone is full: how do I free up space?",
        a: "Open Providers → On-device → Models: each downloaded model shows its size and a \"Delete\" button. That's the right way — avoid \"clear site data\" from the browser settings, which would also erase your conversations and keys. You can also \"Protect\" storage to stop the browser from evicting a model when space runs low.",
      },
      {
        q: "Why doesn't OCR read my handwriting correctly?",
        a: "The built-in OCR (Tesseract, 100% local) is built for printed or typed text — it's fundamentally poor at handwriting, no matter how the image is pre-processed. For a photo or handwritten document, use the \"Image analysis\" button instead (visible with a vision-capable model like Ollama), which sends the image as-is to the model.",
      },
      {
        q: "Is it free?",
        a: "The Studio itself is free and open source. Running Ollama locally is free. Cloud providers (Anthropic, OpenAI, etc.) bill according to their own pricing, through your own key — this Studio takes no cut and charges no subscription.",
      },
      {
        q: "Will the Studio stay free?",
        a: "Yes. The Studio will always stay free and will be kept up to date, respecting the licenses of the open-source components it embeds. In the coming months, specialized add-on suites will complement it — but the Studio itself will never become paid.",
      },
      {
        q: "Are my API keys kept if I close the browser?",
        a: "By default, yes (localStorage), but you can turn off this persistence in the \"Providers\" panel if you'd rather re-enter your keys each session.",
      },
      {
        q: "Is this the full AIDUSIA product?",
        a: "No. This Studio is a single, deliberately minimal piece, built to be tested and verified by anyone — not the complete product.",
      },
    ],
  },
} as const;

export function FaqPanel({ onClose }: FaqPanelProps) {
  const { lang } = useLang();
  const s = STRINGS[lang];

  return (
    <div className="overlay-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/60 p-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={s.dialogLabel}
        className="modal-in glass w-full max-w-2xl rounded-lg bg-card p-6 text-card-foreground shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.closeLabel}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {s.faqs.map(({ q, a }) => (
            <details key={q} className="group rounded-md border border-border bg-background/40 px-3 py-2">
              <summary className="cursor-pointer list-none text-sm font-medium marker:content-none">
                <span className="flex items-center justify-between gap-2">
                  {q}
                  <span className="text-muted-foreground transition group-open:rotate-180">⌄</span>
                </span>
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
