# Journal des changements

Ce projet suit le format de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et prévoit d’utiliser le versionnage sémantique à partir de sa première version
stable.

## [Non publié]

### Documentation

- Clarification des flux de données locaux, directs, proxifiés, MCP et Web
  Speech.
- Ajout d’une matrice de statut des fonctionnalités.
- Alignement de la documentation sur la PWA et l’IA locale navigateur déjà
  livrées.
- Documentation des deux proxies Edge.
- Ajout des politiques de confidentialité, contribution et sécurité.
- Ajout d’un modèle de menace incluant MCP et l’injection de prompt.

### Sécurité

- Confirmation humaine obligatoire avant chaque appel d’outil MCP, avec
  aperçu expurgé des arguments et refus sans requête réseau.
- Namespace des outils MCP par serveur, délais d’expiration et limites de
  taille des réponses.
- Allowlist des routes/méthodes, limites de corps, timeout et `no-store` sur
  les proxies OpenAI et Ollama Cloud.
- Validation bornée des imports chiffrés et des images ; contexte de
  conversation plafonné par tours complets.
- CSP renforcée et shell rendu inerte pendant l’affichage des dialogues.

### Tests

- Ajout de commandes unitaires, smoke et E2E/accessibilité exécutées en CI.

## Versions publiées

Aucune version stable n’a encore été publiée. La valeur `0.0.0` du package
indique cet état et ne doit pas être présentée comme une release supportée.
