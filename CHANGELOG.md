# Journal des changements

Ce projet suit le format de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le versionnage sémantique depuis sa première version publiée.

## [Non publié]

### Ajouté

- Boîte de confirmation intégrée (feuille basse sur téléphone, accessible au
  clavier et aux lecteurs d'écran) à la place des `window.confirm` natifs :
  approbation des outils MCP avec aperçu lisible des arguments, suppressions
  de conversations, de modèles et de toutes les données.
- Confirmation avant le premier téléchargement d'un modèle local (Luciole et
  IA du navigateur), avec vérification de l'espace libre pour Luciole et
  demande de stockage persistant.
- Luciole : choix du mode de calcul (automatique ou processeur forcé) pour
  contourner les pilotes graphiques mobiles qui produisent des réponses
  incohérentes.
- Comparateur : débit réel en tokens/s quand le moteur le fournit (Luciole,
  IA du navigateur, Ollama), à défaut en caractères/s clairement étiquetés.
- Espace « Comparer les IA » dans la barre latérale : deux réponses en
  parallèle, permutation A/B, synthèse explicite, export Markdown et poursuite
  d’un résultat dans une nouvelle conversation locale.
- Avertissement de fiabilité près du composer et dans le comparateur : les
  informations importantes doivent être vérifiées.
- Écran de secours global en cas d’erreur React irrécupérable.
- Rappel discret de soutien (étoile GitHub) : apparaît uniquement après trois
  réponses menées à terme, jamais pendant une génération ; « Plus tard » le
  reporte de huit réponses, un refus ou deux reports l'arrêtent
  définitivement. Aucune requête réseau, état local uniquement (couvert par
  l'export et la remise à zéro des données).

### Modifié

- Luciole reçoit désormais le bon contexte système (modèle local, et non
  « modèle cloud ») précédé de son identité, les réglages d'échantillonnage
  publiés dans son GGUF, un contexte de 2048 tokens sur téléphone (4096
  ailleurs) avec un historique tronqué en conséquence, des réponses jusqu'à
  640 tokens signalées quand elles sont coupées, et des messages d'erreur qui
  distinguent chargement, génération et message trop long.
- Isolation cross-origin (COOP/COEP) : le calcul de Luciole sur processeur
  passe en multi-thread au lieu d'un seul thread.
- Comparateur : deux modèles qui tournent sur l'appareil (et tout comparatif
  en mode benchmark) répondent l'un après l'autre, chacun chronométré depuis
  son propre départ ; sur téléphone, le modèle B par défaut est un fournisseur
  cloud déjà configuré, sinon Luciole.
- Dernier fournisseur et modèle choisis conservés d'une visite à l'autre ;
  « Nouvelle conversation » réutilise une conversation encore vide.
- Mobile : blocs propres à Ollama (commande terminal, test) masqués sur
  téléphone, cibles tactiles agrandies, barre d'outils du comparateur
  réorganisée, menu des modèles fermé par Échap.
- OCR chargé uniquement lors de la sélection d’une image ; runtime Tesseract
  retiré du précache initial mais toujours mis en cache à sa première
  utilisation, pour un précache réduit d’environ 48 %.
- Fontes du shell limitées aux variantes latines nécessaires à l’interface
  française et anglaise.
- Navigation mobile de la barre latérale rendue entièrement utilisable au
  clavier : focus contenu, Échap, boucle Tab et états ARIA explicites.
- IA locale navigateur : couverture de tests renforcée (bascule f16→f32,
  reprise après erreur mémoire GPU, arrêt d'un flux, messages d'indisponibilité
  WebGPU) et messages d'erreur désormais bilingues (français/anglais) — retrait
  du statut expérimental sur mobile.

### Corrigé

- Contraste insuffisant (WCAG AA) des textes secondaires rendus avec une
  opacité réduite.
- Durées du comparateur mesurées à la fin réelle de chaque réponse, et non au
  moment du rendu.
- Dépendances de développement mises à jour (`npm audit` sans vulnérabilité).
- Changement de conversation sécurisé pendant un flux : aucun snapshot tardif
  d’un ancien échange ne peut remplacer la conversation sélectionnée.
- Réouverture IndexedDB réellement réessayable après un échec transitoire et
  écritures confirmées seulement après validation de la transaction.
- Migration immédiate des clés déjà saisies lors de l’activation ou de la
  désactivation de leur persistance.
- Suppression des brouillons avec leur conversation afin d’éviter les données
  locales orphelines.
- Double envoi ou régénération concurrente bloqué avant tout accès IndexedDB ;
  une suppression attend désormais la sauvegarde finale du flux concerné.

### Sécurité

- Images Markdown produites par un modèle neutralisées par défaut : aucune
  requête vers un pixel ou une image distante sans action explicite.
- Suppression locale bornée aux caches et service worker appartenant à AIDUSIA
  sur une origine éventuellement partagée.

## [0.1.0] — 2026-07-18

Première version publiée. L'ancien blocage de release — valider l'IA locale
Ollama depuis le domaine public (`OLLAMA_ORIGINS`) — a été levé : validation
faite par l'éditeur sur le déploiement public avec un modèle installé.

### Ajouté

- Barre d'actions sous chaque réponse : copier, partager (partage natif ou
  téléchargement Markdown) et régénérer la réponse avec le fournisseur/modèle
  sélectionnés.
- Fournisseurs personnalisés « API compatible OpenAI » (nom + URL de base +
  clé) : z.ai, DeepSeek, Together, LM Studio local… Inclus dans l'export
  chiffré des réglages.
- Liens Mentions légales et Confidentialité accessibles depuis l'application
  (pied de la barre latérale et fenêtre À propos).
- Analyse CodeQL continue (code JavaScript/TypeScript et workflows GitHub
  Actions, requêtes security-extended).

### Sécurité

- Confirmation humaine obligatoire avant chaque appel d'outil MCP, avec
  aperçu expurgé des arguments et refus sans requête réseau.
- Namespace des outils MCP par serveur, délais d'expiration et limites de
  taille des réponses.
- Allowlist des routes/méthodes, limites de corps, timeout et `no-store` sur
  les proxies OpenAI et Ollama Cloud.
- Validation bornée des imports chiffrés et des images ; contexte de
  conversation plafonné par tours complets.
- CSP renforcée et shell rendu inerte pendant l'affichage des dialogues.
- URL des fournisseurs personnalisés restreintes à https (http toléré
  uniquement sur la boucle locale), sans identifiants intégrés.
- Épinglage de l'action Gitleaks sur un commit précis ; protection de la
  branche `main` (7 vérifications requises, force-push interdit).

### Documentation

- Clarification des flux de données locaux, directs, proxifiés, MCP et Web
  Speech.
- Ajout d'une matrice de statut des fonctionnalités.
- Alignement de la documentation sur la PWA et l'IA locale navigateur déjà
  livrées.
- Documentation des deux proxies Edge.
- Ajout des politiques de confidentialité, contribution et sécurité, et d'un
  modèle de menace incluant MCP et l'injection de prompt.

### Tests

- Tests unitaires, smoke et E2E/accessibilité exécutés en CI, complétés par
  la couverture de la régénération, de la barre d'actions et des fournisseurs
  personnalisés.

### Retiré

- Composant `ProviderBar` obsolète (remplacé par le menu de modèles du
  composer).
