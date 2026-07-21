# Journal des changements

Ce projet suit le format de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le versionnage sémantique depuis sa première version publiée.

## [Non publié]

### Ajouté

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

- OCR chargé uniquement lors de la sélection d’une image ; runtime Tesseract
  retiré du précache initial mais toujours mis en cache à sa première
  utilisation, pour un précache réduit d’environ 48 %.
- Fontes du shell limitées aux variantes latines nécessaires à l’interface
  française et anglaise.
- Navigation mobile de la barre latérale rendue entièrement utilisable au
  clavier : focus contenu, Échap, boucle Tab et états ARIA explicites.

### Corrigé

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
