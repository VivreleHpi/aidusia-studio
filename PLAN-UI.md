# PLAN UI — AIDUSIA Studio au niveau ChatGPT / Gemini / Claude

> Objectif : le studio est la **vitrine publique d'ALDUS**. L'interface doit inspirer
> la même confiance qu'un ChatGPT ou un Claude — sans trahir la promesse
> « votre clé, votre navigateur, rien ne transite par nos serveurs ».
>
> Ce plan est découpé en tâches autonomes pour agents IA.
> **Haiku** = tâche mécanique, spec fermée, zéro décision de design.
> **Sonnet** = tâche avec logique d'état ou décisions d'implémentation.

---

## Contrat commun (à coller dans le prompt de CHAQUE agent)

1. **Vérification obligatoire avant de conclure** : `npm run build` (tsc + vite) et
   `npm run lint` (oxlint) doivent passer sans erreur. Smoke test visuel via `npm run dev`.
2. **UI 100 % en français**, accents corrects (É, è, ê…).
3. **Aucune requête réseau externe au runtime** (pas de CDN, pas de Google Fonts —
   c'est la promesse produit). Seules nouvelles dépendances npm autorisées :
   `@fontsource/plus-jakarta-sans`, `@fontsource/jetbrains-mono`, `rehype-highlight`
   (et son peer `highlight.js`). **Aucune lib de composants UI** (pas de shadcn,
   radix, framer-motion…).
4. **Réutiliser les tokens existants** de [src/index.css](src/index.css)
   (`--primary`, `--card`, `--border`, `.glass`, etc.). Ne jamais coder une couleur en dur.
5. Respecter `prefers-reduced-motion` pour toute nouvelle animation.
6. Mobile d'abord : tout doit rester utilisable à 360 px de large.
7. **Ne pas toucher** `src/providers/*`, `src/lib/db.ts`, `src/lib/mcp/*` sauf si la
   tâche le précise explicitement.
8. Icônes : toujours des SVG inline dans [src/components/Icons.tsx](src/components/Icons.tsx)
   (stroke `currentColor`, viewBox 24, strokeWidth 1.5–2). **Jamais d'emoji** dans les boutons.
9. Un commit par tâche, message en français, préfixe `feat(ui):` ou `fix(ui):`.
10. ⚠️ **Conflits** : les tâches marquées `[ChatView]` ou `[Sidebar]` modifient le même
    fichier — les exécuter **séquentiellement**, jamais en parallèle.

---

## LOT 1 — Fondations (T1–T4 parallélisables)

### T1 — Polices auto-hébergées · **Haiku**
**Fichiers** : [src/index.css](src/index.css), [src/main.tsx](src/main.tsx), package.json
- Problème : la ligne 1 de `index.css` importe Google Fonts → contredit « rien ne
  transite par un serveur tiers ».
- Faire : `npm i @fontsource/plus-jakarta-sans @fontsource/jetbrains-mono`, supprimer
  le `@import url(...)`, importer dans `main.tsx` les poids 400/500/600/700/800 de
  Plus Jakarta Sans et 400/500 de JetBrains Mono.
- ✅ Critère : `npm run build` OK, aucune requête `fonts.googleapis.com` dans l'onglet
  Réseau, rendu identique.

### T2 — Icônes SVG partout + typos FR · **Haiku**
**Fichiers** : [src/components/Icons.tsx](src/components/Icons.tsx), [src/components/ChatView.tsx](src/components/ChatView.tsx), [src/components/Sidebar.tsx](src/components/Sidebar.tsx)
- Ajouter dans Icons.tsx : `IconPaperclip`, `IconImage`, `IconMic`, `IconSend`
  (flèche ↑ dans un cercle plein, style ChatGPT), `IconStop` (carré arrondi),
  `IconCopy`, `IconCheck`, `IconPencil`, `IconRefresh`, `IconArrowDown`,
  `IconDownload`, `IconDots` (⋯ vertical), `IconSun`, `IconMoon`, `IconX`.
- Remplacer les emojis 📎 🖼️ 🎙️ 📋 ✓ ✕ et les « ✕ » texte par ces icônes.
- Corriger : `Ecrivez un message…` → `Écrivez un message…`, `Arreter` → `Arrêter`.
- ✅ Critère : plus aucun emoji dans un `<button>` du code ; grep `📎|🖼️|🎙️|📋` vide
  (sauf `🖼️ Image jointe` qui devient `IconImage` + texte).

### T3 — Bascule de thème clair / sombre / système · **Haiku**
**Fichiers** : nouveau `src/hooks/useTheme.ts`, [src/components/Sidebar.tsx](src/components/Sidebar.tsx) `[Sidebar]`
- Le CSS est déjà prêt (`.dark`, `:root:not(.light)` — voir commentaire ligne 109 de
  index.css). Créer `useTheme()` : état `"system" | "light" | "dark"`, persisté dans
  `localStorage("aidusia:theme")`, applique la classe `light`/`dark` sur
  `document.documentElement` (rien pour `system`).
- UI : dans le menu Paramètres de la Sidebar, une ligne « Thème » avec 3 boutons
  segmentés (Système / Clair / Sombre, icônes IconSun/IconMoon).
- ✅ Critère : le choix survit au rechargement ; « Système » suit
  `prefers-color-scheme` en live.

### T4 — Styles markdown manquants (tables, citations, titres) · **Haiku** `[ChatView]`
**Fichiers** : [src/components/ChatView.tsx](src/components/ChatView.tsx) (objet `markdownComponents`)
- Ajouter : `table` (wrappée dans un `div.overflow-x-auto`, bordures `border-border`,
  `th` en `bg-foreground/5 font-medium`), `blockquote` (bordure gauche `border-primary/40`,
  texte muted, italique), `hr`, `h1`→`h4` (tailles décroissantes `text-lg`→`text-sm`,
  `font-semibold`, marges), `strong`.
- ✅ Critère : demander à un modèle « fais-moi un tableau comparatif markdown » →
  tableau propre, scrollable horizontalement sur mobile, lisible en clair et sombre.

---

## LOT 2 — Rendu des messages, le cœur visuel (T5 → T6 → T7, séquentiel)

### T5 — Layout des messages façon Claude/ChatGPT · **Sonnet** `[ChatView]`
**Fichiers** : [src/components/ChatView.tsx](src/components/ChatView.tsx)
- Aujourd'hui : deux bulles symétriques à 80 %. Cible :
  - **User** : bulle compacte alignée à droite, `bg-primary`, max 80 % — inchangé
    dans l'esprit, coins `rounded-2xl rounded-br-md`.
  - **Assistant** : **pleine largeur, sans bulle ni bordure** (comme Claude).
    En-tête discret au-dessus : pastille primary + label provider `· model` en
    `text-[11px] text-muted-foreground`. Prose en dessous, `max-w` porté à `3xl`
    (colonne centrale `max-w-3xl` au lieu de `2xl`).
  - **Barre d'actions** sous chaque message assistant terminé (pas pendant le
    streaming) : Copier, Régénérer (branché en T11 — mettre un placeholder masqué
    d'ici là), visible au survol sur desktop, toujours visible au tactile
    (`@media (hover: none)`).
  - Conserver : `ToolResultBlock`, indicateur « appel d'outil », dots de réflexion,
    curseur de frappe, `message-in`.
- ✅ Critère : conversation mixte (user/assistant/tool) visuellement équilibrée,
  aucune régression streaming (les dots puis le texte apparaissent bien), mobile OK.

### T6 — Blocs de code niveau ChatGPT · **Sonnet** `[ChatView]`
**Fichiers** : ChatView.tsx, nouveau `src/components/CodeBlock.tsx`, [src/index.css](src/index.css), package.json
- `npm i rehype-highlight highlight.js` ; passer `rehypePlugins={[rehypeHighlight]}`
  à ReactMarkdown (option `detect: false`, ignorer les langages inconnus).
- `CodeBlock.tsx` : remplace le rendu de `pre` — cadre `rounded-lg border border-border
  bg-foreground/[0.04]` avec **barre d'en-tête** : nom du langage (extrait de
  `language-xxx`) à gauche, bouton Copier (IconCopy → IconCheck 1,5 s) à droite.
  Corps `overflow-x-auto p-3 font-mono text-xs leading-relaxed`.
- Thème de coloration **sur les tokens du projet** : ne PAS importer un .css de
  highlight.js ; définir dans index.css une vingtaine de règles `.hljs-*`
  (keyword, string, comment, number, function, title…) avec des HSL dérivés de la
  charte, deux variantes (base + `.dark`). Réutiliser les couleurs `--primary`,
  `--success`, `--warning` comme base de palette.
- ✅ Critère : demander « écris du code TypeScript, Python et bash » → 3 blocs
  colorés, en-tête avec langage, copie fonctionnelle, lisible dans les deux thèmes,
  copie pendant le streaming sans crash.

### T7 — Auto-scroll intelligent + bouton « descendre » · **Sonnet** `[ChatView]`
**Fichiers** : ChatView.tsx
- Problème : `scrollIntoView` à chaque token (ligne 120–122) **vole le scroll** si
  l'utilisateur remonte lire pendant le streaming.
- Faire : ref sur le conteneur scrollable ; suivi `isNearBottom`
  (`scrollHeight - scrollTop - clientHeight < 80`) mis à jour sur `onScroll` ;
  n'auto-scroller que si `isNearBottom`. Toujours scroller à l'envoi d'un message
  user et au changement de conversation.
- Bouton flottant rond `glass` avec `IconArrowDown`, en bas au centre de la zone
  messages, visible quand `!isNearBottom`, clic → scroll bas + re-stick.
- ✅ Critère : pendant une longue réponse en stream, remonter → le scroll ne bouge
  plus, le bouton apparaît ; cliquer → recolle au flux.

---

## LOT 3 — Composer moderne (T8 → T9 → T10, séquentiel)

### T8 — Refonte du composer · **Sonnet** `[ChatView]`
**Fichiers** : ChatView.tsx
- Cible visuelle (comme ChatGPT/Claude) : **un seul conteneur** `rounded-2xl border
  border-border bg-card shadow-sm focus-within:ring-1 focus-within:ring-ring`,
  au-dessus de la bordure du bas (`p-4`, colonne `max-w-3xl` alignée sur T5) :
  - Rangée 1 : textarea **auto-extensible** (1 → ~8 lignes puis scroll ;
    `height:auto` puis `scrollHeight` clampé, reset après envoi), sans bordure
    propre (`bg-transparent focus:outline-none`).
  - Rangée 2 : à gauche les boutons ronds fantômes OCR / Vision / Dictée
    (icônes T2, `title` conservés) ; à droite le bouton d'envoi **rond plein**
    `bg-primary` avec IconSend, remplacé par IconStop `bg-destructive` pendant le
    streaming.
  - Les bandeaux d'état (OCR en cours, erreurs, dictée, aperçu image) passent
    **dans** le conteneur, au-dessus de la rangée 1, style pilule discrète.
- Sous le composer : ligne centrée `text-[11px] text-muted-foreground`
  « Les réponses de l'IA peuvent contenir des erreurs. Vos échanges restent dans
  votre navigateur. »
- Conserver : Enter = envoyer, Shift+Enter = saut de ligne, disabled si vide.
- ✅ Critère : coller 20 lignes → le champ grandit jusqu'à ~8 lignes puis scrolle,
  se réinitialise après envoi ; tous les boutons fonctionnent ; mobile OK.

### T9 — Coller / glisser-déposer une image · **Sonnet** `[ChatView]`
**Fichiers** : ChatView.tsx
- `onPaste` sur le textarea : si `clipboardData.items` contient une image et
  `visionCapable` → même chemin que `handleVisionFileSelected` (pendingImage).
  Si pas visionCapable → message discret « Ce modèle ne lit pas les images —
  utilisez l'OCR (📎) ou choisissez un modèle vision ».
- Drag & drop sur toute la zone de chat : overlay `glass` en pointillés
  « Déposez votre image » pendant le survol (`dragenter`/`dragleave` avec compteur
  pour éviter le clignotement).
- ✅ Critère : capture d'écran collée avec Ctrl+V → aperçu s'affiche ; drop d'un
  fichier → idem ; drop d'un non-image → ignoré proprement.

### T10 — Raccourcis de confort · **Haiku** `[ChatView]`
**Fichiers** : ChatView.tsx, [src/App.tsx](src/App.tsx)
- `Échap` pendant le streaming → `onStop()`.
- Après envoi et après fin de réponse → refocus du textarea (desktop uniquement,
  pas si `window.matchMedia('(hover: none)')`).
- Au changement de conversation → focus textarea.
- ✅ Critère : envoyer → taper directement la suite sans cliquer ; Échap coupe le stream.

---

## LOT 4 — Actions sur les messages (T11 → T12, puis T13 parallèle)

### T11 — Régénérer la dernière réponse · **Sonnet** `[ChatView]`
**Fichiers** : [src/hooks/useChat.ts](src/hooks/useChat.ts), ChatView.tsx, App.tsx
- Refactor préalable dans useChat : extraire le cœur de `sendMessage` (création du
  message assistant + boucle de stream/outils + persistance) en une fonction interne
  `runAssistantTurn(conversation)` ; `sendMessage` = ajoute le message user puis
  l'appelle.
- Nouvelle API `regenerate(conversationId, providerId, model)` : recharge la
  conversation, **supprime le dernier message assistant et ses éventuels messages
  tool associés** (remonter jusqu'au dernier message user exclu), puis
  `runAssistantTurn`. Utilise le provider/model **actuellement sélectionnés**
  (permet de régénérer avec un autre modèle — comportement ChatGPT).
- Bouton IconRefresh dans la barre d'actions T5, dernier message assistant
  uniquement, désactivé pendant le streaming.
- ✅ Critère : régénérer remplace la réponse (l'ancienne disparaît), fonctionne
  aussi après un échange avec outils MCP, et après changement de modèle.

### T12 — Éditer un message utilisateur · **Sonnet** `[ChatView]`
**Fichiers** : useChat.ts, ChatView.tsx — dépend du refactor T11.
- Survol d'un message user → IconPencil. Clic → la bulle devient un textarea
  (même style, boutons « Annuler / Envoyer »).
- Envoi : tronque la conversation **à partir de ce message inclus**, ré-ajoute le
  contenu édité comme nouveau message user (conserver `images`), relance
  `runAssistantTurn`. C'est destructif comme sur ChatGPT — pas d'arborescence de
  versions (hors scope).
- ✅ Critère : éditer le 1er message d'une conversation de 6 → il ne reste que le
  message édité + la nouvelle réponse ; le titre est recalculé si c'était le 1er.

### T13 — Copie généralisée · **Haiku** `[ChatView]`
**Fichiers** : ChatView.tsx
- `CopyButton` (avec IconCopy/IconCheck de T2) disponible aussi sur les messages
  **user** (au survol, dans la marge de la bulle) et sur `ToolResultBlock`.
- ✅ Critère : tout contenu de la conversation est copiable en un clic.

---

## LOT 5 — Sidebar & données (T14–T15, séquentiel entre eux)

### T14 — Renommer / supprimer proprement · **Haiku→Sonnet** (Sonnet si menu contextuel) `[Sidebar]`
**Fichiers** : [src/components/Sidebar.tsx](src/components/Sidebar.tsx), [src/hooks/useConversations.ts](src/hooks/useConversations.ts), [src/lib/db.ts](src/lib/db.ts) (autorisé ici : ajouter `renameConversation`)
- Remplacer le « ✕ » au survol par un bouton IconDots ouvrant un petit menu `glass` :
  **Renommer** (le titre devient un input inline, Enter valide, Échap annule) et
  **Supprimer** (rouge, avec `window.confirm` « Supprimer "titre" ? »).
- ✅ Critère : renommage persistant après rechargement ; suppression demande
  confirmation ; le menu se ferme au clic extérieur.

### T15 — Exporter une conversation en Markdown · **Haiku** `[Sidebar]`
**Fichiers** : Sidebar.tsx (entrée « Exporter » dans le menu T14), nouveau `src/lib/exportMarkdown.ts`
- Génère un `.md` : titre H1, puis pour chaque message `**Vous :**` /
  `**Assistant (provider · model) :**` / les résultats d'outils en bloc de citation.
  Téléchargement via Blob + `URL.createObjectURL`, nom de fichier = titre slugifié.
- ✅ Critère : le fichier s'ouvre proprement dans VS Code, contenu complet.

---

## LOT 6 — Finitions confiance (T16–T17)

### T16 — Erreurs humanisées + Réessayer · **Sonnet** `[ChatView]`
**Fichiers** : nouveau `src/lib/humanizeError.ts`, ChatView.tsx, useChat.ts
- Mapper les erreurs brutes vers des messages français actionnables :
  - `Failed to fetch` + provider ollama → « Ollama ne répond pas. Vérifiez qu'il est
    lancé (`ollama serve`) » + bouton « Guide » (ouvre GuidePage).
  - HTTP 401/403 → « Clé API refusée » + bouton « Configurer » (ouvre ProvidersPanel).
  - 429 → « Limite de débit atteinte, patientez quelques secondes. »
  - 404 modèle → « Modèle introuvable chez ce fournisseur. »
  - Défaut → message brut conservé en `<details>` repliable « Détails techniques ».
- La carte d'erreur (actuelle ligne 285–289 de ChatView) devient une carte
  `border-destructive/30 bg-destructive/10` avec titre, explication, boutons
  d'action + **Réessayer** (relance `regenerate` de T11).
- ✅ Critère : couper Ollama et envoyer un message → carte claire avec action ;
  clé invalide OpenRouter → propose « Configurer ».

### T17 — Passe accessibilité & focus · **Haiku**
**Fichiers** : tous les composants touchés
- `focus-visible:ring-2 ring-ring` cohérent sur tous les boutons interactifs
  ajoutés ; `aria-label` sur chaque bouton-icône ; vérifier le contraste des
  `text-muted-foreground/70` sur fond card (≥ 4.5:1, ajuster à `/80` sinon) ;
  ordre de tabulation logique dans le composer.
- ✅ Critère : navigation complète au clavier (Tab/Enter/Échap) : nouvelle
  conversation → écrire → envoyer → copier la réponse, sans souris.

---

## Optionnel (si le budget agent le permet)
- **T18 · Sonnet** : ModelPicker custom (dropdown `glass` avec recherche et
  descriptions) à la place du `<select>` natif — gros gain visuel, mais risqué ;
  à faire en dernier.
- **T19 · Haiku** : mémoïsation du rendu markdown par message (`React.memo` sur un
  composant `MessageBody`) si du jank apparaît sur les très longues réponses.

## Ordre d'exécution recommandé
```
Vague 1 (parallèle)  : T1, T2, T3
Vague 2 (séquentiel) : T4 → T5 → T6 → T7 → T8 → T9 → T10  (tous [ChatView])
Vague 3 (séquentiel) : T11 → T12 → T13                     (ChatView + useChat)
Vague 4 (séquentiel) : T14 → T15                            ([Sidebar])
Vague 5              : T16 → T17
```
Après chaque vague : `npm run build && npm run lint`, smoke test manuel
(conversation Ollama locale + un provider cloud), puis commit.

## Définition de « terminé » (niveau ChatGPT atteint)
- [ ] Blocs de code colorés avec en-tête langage + copie
- [ ] Composer auto-extensible avec icônes, coller/drop d'image
- [ ] Scroll qui ne vole jamais la lecture + bouton descendre
- [ ] Régénérer / éditer / copier sur les messages
- [ ] Renommer / exporter / supprimer (confirmé) les conversations
- [ ] Thème clair/sombre/système persistant
- [ ] Zéro requête externe au runtime (fonts incluses)
- [ ] Erreurs compréhensibles avec action de sortie
- [ ] 100 % navigable au clavier
