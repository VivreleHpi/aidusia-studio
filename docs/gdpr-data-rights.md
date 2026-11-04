# Droits des personnes (RGPD) — AIDUSIA Studio

Dernière mise à jour : 4 novembre 2026.

Ce document complète [PRIVACY.md](../PRIVACY.md). Il décrit comment un
utilisateur peut exercer ses droits lorsque l’application est utilisée telle
que publiée dans ce dépôt (PWA ou build local), **sans compte AIDUSIA**.

## Rôle du responsable de traitement

AIDUSIA Studio est un client exécuté dans le navigateur. L’éditeur du dépôt ne
reçoit pas les conversations, clés API ni fichiers importés tant que
l’utilisateur n’envoie pas volontairement de données à un fournisseur distant,
un serveur MCP ou un service de téléchargement de modèles.

Pour un déploiement public (par ex. Vercel), l’hébergeur peut voir des
requêtes réseau vers les proxys Edge documentés dans
[deployment-security.md](./deployment-security.md). Les données de chat
transitent alors vers le fournisseur choisi par l’utilisateur, qui devient
responsable du traitement côté cloud.

## Données concernées

| Catégorie | Emplacement | Finalité |
|---|---|---|
| Conversations, pièces jointes | IndexedDB | Usage local |
| Espaces RAG (extraits, embeddings) | IndexedDB | Recherche locale |
| Clés API, préférences | sessionStorage / localStorage | Configuration |
| Journal MCP (aperçus d’appels) | localStorage | Transparence locale |
| Export chiffré des réglages | Fichier choisi par l’utilisateur | Sauvegarde |

Aucune télémétrie marketing ni cookie publicitaire n’est intégrée au code de
ce dépôt.

## Exercer ses droits (outil local)

| Droit | Action dans l’application |
|---|---|
| **Accès** | Export des conversations (Markdown/PDF) et export des réglages depuis les panneaux dédiés |
| **Rectification** | Édition des messages et réglages dans l’interface |
| **Effacement** | Suppression de conversations, d’espaces RAG, ou « Tout effacer » dans les paramètres |
| **Limitation** | Refus des outils MCP, désactivation des fournisseurs distants, usage 100 % local |
| **Portabilité** | Fichiers Markdown, export des réglages (JSON chiffré) |
| **Opposition** | Ne pas configurer de fournisseur distant ; refuser les confirmations MCP |

Pour les données déjà transmises à un fournisseur tiers (OpenAI, Anthropic,
etc.), l’utilisateur doit contacter ce fournisseur selon sa propre politique.

## Conservation

Les données locales persistent jusqu’à suppression par l’utilisateur ou
effacement des données du site dans le navigateur. Aucune durée de conservation
n’est imposée par le code applicatif.

## Contact

Pour une instance auto-hébergée, le responsable de traitement est l’entité qui
déploie l’application. Pour le dépôt open source, ouvrez une issue GitHub pour
signaler une erreur documentaire (sans y coller de données personnelles).
