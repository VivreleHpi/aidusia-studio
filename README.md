# AIDUSIA Studio

🇬🇧 [English version](./README.en.md)

Testez vos IA — locales ou cloud — directement dans le navigateur. Rien ne
transite par un serveur à nous, à une seule exception documentée (OpenAI et
Ollama Cloud, ci-dessous).

![Parcours complet d'AIDUSIA Studio](docs/demo.gif)

## Démarrage en 60 secondes

Trois chemins, du plus simple au plus riche — le Studio vous guide au premier
lancement (assistant de démarrage), mais voici le résumé :

1. **Le plus simple, zéro téléchargement** : ouvrez "Fournisseurs", collez une
   clé API (Anthropic, Gemini, Mistral, OpenRouter, OpenAI). Ça marche
   immédiatement, sur ordinateur comme sur mobile.
2. **IA locale et gratuite (ordinateur)** : installez
   [Ollama](https://ollama.com/download), lancez-le. Si vous utilisez le
   Studio en local (`http://localhost:...`), **aucune configuration
   supplémentaire n'est nécessaire** — Ollama autorise `localhost` par défaut,
   vérifié empiriquement. Si vous utilisez une instance déployée sur un vrai
   domaine, lancez Ollama avec la variable `OLLAMA_ORIGINS` pointée sur ce
   domaine (l'assistant de démarrage vous donne la commande exacte à copier).
3. **Mobile, sans backend** : la voie recommandée aujourd'hui est la clé API
   cloud (option 1). L'IA locale *dans* le navigateur mobile (Gemma 4, WebGPU)
   est sur la feuille de route — voir plus bas — et n'est pas encore livrée.

## Ce que c'est

- Une interface de chat qui parle **directement, depuis votre navigateur**, à :
  - **Ollama** en local sur votre machine ;
  - **Anthropic, Google Gemini, Mistral, OpenRouter, Groq** avec votre propre
    clé API (BYOK), en connexion directe navigateur → fournisseur ;
  - **OpenAI** et **Ollama Cloud**, via un petit proxy — voir "Pourquoi un
    proxy" plus bas.
- Un **Gouverneur Matériel** qui dit la vérité sur ce que votre machine peut
  faire tourner (WebGPU, mémoire, Ollama local — avec la vraie VRAM utilisée
  quand Ollama est joignable), sans jamais prétendre savoir ce qu'il ne peut
  pas mesurer.
- **OCR 100% local** (WASM, `tesseract.js`, auto-hébergé — jamais de CDN) :
  extrayez le texte d'une image directement dans le champ de saisie.
  **Limite honnête** : Tesseract est conçu pour le texte **imprimé/tapé** ;
  il est fondamentalement mauvais sur l'**écriture manuscrite**, quel que
  soit le prétraitement appliqué — ce n'est pas un bug réglable, c'est la
  nature de cette technologie.
- **Analyse d'image par vision** (bouton d'image du composer, visible
  seulement quand le modèle sélectionné a une vraie capacité vision détectée
  via l'API — Ollama uniquement pour l'instant) : envoie l'image telle quelle
  au modèle au lieu d'en extraire le texte. Bien meilleur que l'OCR pour une
  photo, un document manuscrit ou une capture d'écran complexe.
- **Dictée vocale** via l'API Web Speech du navigateur — voir l'avertissement
  de confidentialité ci-dessous, ce n'est **pas** garanti 100% local partout.
- Seuls les modèles réellement renvoyés par l'API du fournisseur (avec votre
  clé) apparaissent dans la liste — jamais un catalogue figé en dur.
- **Interface bilingue** français/anglais (bascule instantanée, persistée) et
  **mode sombre / mode clair**.
- **Connecteurs (MCP)** : branchez des serveurs d'outils HTTP distants (n8n
  via son nœud « MCP Server Trigger », passerelles Gmail/Drive/X…) que le
  modèle peut appeler pendant la conversation. Polices, icônes et logos sont
  auto-hébergés — l'application ne fait **aucune requête externe** en dehors
  des appels IA que vous déclenchez.
- Conversations et clés stockées **uniquement dans votre navigateur**
  (IndexedDB / localStorage), jamais sur un serveur.
- Zéro compte, zéro analytics, zéro cookie de suivi.

## Feuille de route — ce qui arrive sera plus lourd

Ce qui suit n'est **pas encore livré** :

- **IA locale dans le navigateur** (Gemma 4 via WebGPU, sans Ollama ni
  serveur) — nécessite de télécharger plusieurs Go de poids de modèle au
  premier usage. Pensé pour fonctionner sur mobile récent (WebGPU requis).
  Voir [la réflexion détaillée sur l'IA locale mobile](docs/ia-locale-mobile.md),
  y compris ce qui est possible dès aujourd'hui (Ollama du PC accessible
  depuis le téléphone sur le même Wi-Fi).
- **Modal de réglages complet** (profil, apparence, confidentialité).
- **PWA installable** sur mobile.
- **Vision pour les autres fournisseurs** (Anthropic, Gemini, OpenAI ont
  tous des modèles vision) — pour l'instant seul Ollama est câblé, vérifié
  réellement (image envoyée, couleur correctement identifiée par le modèle).

Ces fonctionnalités sont plus exigeantes en ressources (téléchargement,
calcul) que ce qui existe aujourd'hui : l'objectif reste que l'utilisateur
n'ait presque rien à faire pour en profiter — l'assistant de démarrage guidera
ce téléchargement le moment venu, comme il guide déjà l'installation d'Ollama.

## Confidentialité de la dictée vocale — soyons clairs

L'OCR est 100% local (WASM dans votre navigateur, aucune image n'est jamais
envoyée nulle part). La **dictée vocale, elle, ne l'est pas forcément** :
elle utilise l'API Web Speech native du navigateur, qui sur Chrome/Edge
envoie l'audio aux serveurs de Google pour la reconnaissance. C'est la seule
option de dictée qui n'ajoute pas un gros modèle WASM (type Whisper) au
bundle — un choix pragmatique, pas un choix "tout local" par défaut. Le
badge affiché pendant l'écoute le rappelle.

## Ce que ce n'est PAS

- Ce n'est pas un produit fini au sens SaaS : pas de compte, pas de synchro
  multi-appareil, pas de support commercial en v1.
- Ce n'est pas le produit complet AIDUSIA — ce dépôt est une brique isolée,
  volontairement minimale, extraite pour être vérifiable par tous.

## Pourquoi un proxy pour OpenAI et Ollama Cloud (et pas les autres) ?

OpenAI et Ollama Cloud bloquent volontairement (ou par défaut, sans le
prévoir) les requêtes directes depuis un navigateur — vérifié empiriquement,
aucune des deux ne renvoie d'en-tête CORS sur sa vraie réponse, contrairement
au preflight qui peut induire en erreur. Anthropic, Gemini, Mistral et
OpenRouter autorisent l'accès direct navigateur et sont donc appelés sans
intermédiaire.

Chaque proxy est :

- **stateless** (aucune donnée écrite nulle part) ;
- **sans log** de votre clé ni de vos messages ;
- **open-source**, dans ce même dépôt (`api/openai/`, `api/ollama-cloud/`) —
  vérifiable ligne par ligne ;
- **remplaçable** par votre propre instance si vous préférez ne pas nous faire confiance.

## Statut

En construction (voir les issues). Maintenu en mode produit, roadmap tenue
séparément. Les PR sont bienvenues.

## Licence

Apache License 2.0 — voir [LICENSE](./LICENSE). Le nom « AIDUSIA » est une
marque déposée ; la licence couvre le code, pas la marque.

## Développement local

```bash
npm install
npm run dev
```
