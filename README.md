# AIDUSIA Studio

🇬🇧 [English version](./README.en.md)

AIDUSIA Studio est une interface web open source pour tester des modèles d’IA locaux et cloud. L’application privilégie le stockage dans le navigateur, sans compte ni outil d’analytics intégré. Selon la fonctionnalité choisie, des données peuvent néanmoins être envoyées à un fournisseur cloud, à l’un des deux proxies du projet, à un serveur MCP ou au service de dictée du navigateur.

![Parcours complet d'AIDUSIA Studio](docs/demo.gif)

## Démarrage rapide

```bash
npm install
npm run dev
```

Puis choisissez un mode :

1. **Ollama local** : installez [Ollama](https://ollama.com/download) et utilisez le Studio sur ordinateur. Depuis un domaine déployé, Ollama doit autoriser explicitement cette origine avec `OLLAMA_ORIGINS`.
2. **IA dans le navigateur** : choisissez « Navigateur (local) ». Les poids du modèle sont téléchargés à votre demande, mis en cache puis exécutés par WebGPU sur l’appareil. Le support et les performances dépendent du navigateur, du GPU, de la mémoire et du stockage disponibles, en particulier sur mobile.
3. **Fournisseur cloud** : ajoutez votre propre clé API dans « Fournisseurs ». Les tarifs, quotas, rétentions et conditions du fournisseur s’appliquent.

## Statut des fonctionnalités

| Fonctionnalité | Statut | Où vont les données ? |
|---|---|---|
| Chat Ollama local | Livré | Vers l’URL Ollama configurée, généralement votre machine |
| IA locale navigateur (WebLLM/WebGPU) | Livrée, expérimentale sur mobile | Poids téléchargés à la demande ; inférence sur l’appareil |
| Anthropic, Gemini, Mistral, OpenRouter, Groq | Livré | Connexion directe navigateur → fournisseur |
| OpenAI | Livré | Via le proxy Edge `/api/openai/`, puis OpenAI |
| Ollama Cloud | Livré | Via le proxy Edge `/api/ollama-cloud/`, puis Ollama Cloud |
| OCR Tesseract | Livré | Traitement local dans le navigateur |
| Analyse d’image | Livrée pour Ollama compatible vision | Image envoyée à l’instance Ollama configurée |
| Dictée Web Speech | Livrée si le navigateur la prend en charge | Peut utiliser le service distant du navigateur/OS |
| Connecteurs MCP HTTP | Livré, expérimental | Requêtes vers les serveurs MCP configurés |
| Export/import des réglages | Livré | Fichier local chiffré par phrase secrète |
| PWA installable et shell hors ligne | Livré | Ressources applicatives mises en cache localement |
| Chat cloud hors ligne | Non | Une connexion au fournisseur reste nécessaire |

La disponibilité d’une API, d’un modèle, de WebGPU ou de la dictée varie selon le navigateur, l’appareil, la région et le fournisseur. Une PWA installée ne rend pas les services cloud accessibles hors ligne.

## Fonctionnement et confidentialité

- Les conversations sont enregistrées dans IndexedDB sur cet appareil.
- Les clés sont conservées dans `sessionStorage` et, par défaut, également dans `localStorage`. La persistance peut être désactivée dans l’interface.
- L’application n’intègre ni compte, ni analytics, ni cookie publicitaire.
- Les polices, icônes et fichiers OCR sont auto-hébergés.
- Les modèles locaux navigateur sont téléchargés depuis l’infrastructure de distribution utilisée par WebLLM, uniquement lorsque vous le demandez.
- Les réglages exportés sont chiffrés côté client avec AES-GCM et une clé dérivée de la phrase secrète. La sécurité dépend de la qualité de cette phrase.

« Stocké localement » ne signifie pas « jamais transmis » : lorsque vous envoyez un message à un fournisseur cloud, utilisez la dictée, analysez une image avec un modèle distant ou autorisez un outil MCP, les données nécessaires quittent l’appareil. Consultez [PRIVACY.md](./PRIVACY.md) pour le détail.

## Connecteurs MCP : avertissement de sécurité

Les serveurs MCP ajoutent des outils qu’un modèle peut appeler pendant une conversation. Le contenu d’un message, d’un document ou d’une réponse d’outil peut contenir une injection de prompt. Un serveur ou un outil MCP peut aussi être compromis, trompeur ou disposer de droits importants.

La version actuelle affiche une confirmation navigateur avant chaque appel, avec le serveur, l’outil, une estimation heuristique du risque et un aperçu expurgé des arguments. Cette confirmation ne garantit pas l’effet réel de l’outil. N’ajoutez donc que des serveurs de confiance, avec des comptes de test et les privilèges minimaux. Les serveurs `stdio` locaux ne sont pas pris en charge ; seuls les serveurs HTTP distants compatibles CORS le sont. Voir [SECURITY.md](./SECURITY.md).

## Pourquoi deux proxies ?

Les appels OpenAI et Ollama Cloud ne sont pas effectués directement depuis le navigateur : leurs implémentations passent respectivement par `api/openai/` et `api/ollama-cloud/`. Ces fonctions Edge relaient la clé, la méthode, le chemin et le contenu de la requête vers le fournisseur correspondant. Le code du dépôt ne persiste ni ne journalise volontairement ces données.

Cette propriété du code ne permet pas de garantir à elle seule l’absence de logs de la plateforme d’hébergement, du réseau ou du fournisseur final. Vous pouvez auditer et auto-héberger les proxies. Les autres fournisseurs pris en charge sont appelés directement depuis le navigateur.

## Limites connues

- L’IA locale navigateur peut télécharger plusieurs centaines de mégaoctets ou davantage et échouer sur un appareil peu puissant.
- Tesseract est adapté au texte imprimé ; ses résultats sur l’écriture manuscrite sont généralement faibles.
- L’analyse d’image n’est actuellement câblée que pour Ollama.
- Il n’existe ni synchronisation multi-appareil, ni compte, ni support commercial garanti.
- MCP doit être considéré comme expérimental : la confirmation par action existe, mais la classification du risque reste heuristique et aucune politique de permissions persistante et fine n’est fournie.

## Qualité et contribution

Commandes actuellement disponibles :

```bash
npm run lint
npm test
npm run smoke
npm run build
npm run leak-scan
npm run e2e
```

Les tests unitaires, smoke et E2E/accessibilité sont intégrés à la CI. Les E2E nécessitent l’installation du navigateur Playwright (`npx playwright install chromium`). Voir [CONTRIBUTING.md](./CONTRIBUTING.md) et [CHANGELOG.md](./CHANGELOG.md).

## Sécurité

Ne publiez pas de clé, de jeton, d’export de réglages ou de conversation dans une issue. Pour signaler une vulnérabilité, suivez la procédure décrite dans [SECURITY.md](./SECURITY.md).

## Licence

GNU AGPL v3 — voir [LICENSE](./LICENSE). Le code et la marque sont des sujets distincts : la licence du dépôt ne concède pas automatiquement de droits sur le nom « AIDUSIA ».
