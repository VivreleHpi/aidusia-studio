# AIDUSIA Studio

🇬🇧 [English version](./README.en.md)

**Testez des modèles d'IA locaux et cloud depuis votre navigateur — sans compte, sans mouchard, avec vos propres clés et un chemin de données documenté.**

- 🔑 **Vos clés restent sous votre contrôle** — stockées dans le navigateur, puis envoyées uniquement pour l'appel demandé au fournisseur choisi ; OpenAI et Ollama Cloud passent par les proxys documentés ci-dessous.
- 🖥️ **Local *ou* cloud** — Ollama, IA dans le navigateur (WebGPU), ou votre clé Anthropic / OpenAI / Grok / etc.
- 🕵️ **Zéro compte, zéro analytics** — code ouvert (AGPL v3), polices et OCR auto-hébergés.

![Parcours complet d'AIDUSIA Studio](docs/demo.gif)

> ℹ️ « Stocké localement » ne veut pas dire « jamais transmis » : selon la fonction utilisée, des données partent vers un fournisseur cloud, un proxy du projet, un serveur MCP ou le service de dictée du navigateur. Le détail est plus bas et dans [PRIVACY.md](./PRIVACY.md).

## Démarrage rapide

```bash
npm install
npm run dev
```

Puis choisissez un mode :

1. **Ollama local** — installez [Ollama](https://ollama.com/download) et utilisez le Studio sur ordinateur. Depuis un domaine déployé, Ollama doit autoriser l'origine via `OLLAMA_ORIGINS`.
2. **IA dans le navigateur** — choisissez « Sur cet appareil ». Les poids sont téléchargés à la demande, mis en cache, puis exécutés par WebGPU. Performances variables selon navigateur, GPU et mémoire, surtout sur mobile.
3. **Fournisseur cloud** — ajoutez votre clé API dans « Fournisseurs ». Tarifs, quotas, rétention et conditions du fournisseur s'appliquent.

## Statut des fonctionnalités

Légende : ✅ livré · 🧪 livré, expérimental · ❌ non disponible

| Fonctionnalité | Statut | Où vont les données ? |
|---|---|---|
| Chat Ollama local | ✅ | Vers l'URL Ollama configurée, généralement votre machine |
| IA locale navigateur (WebLLM/WebGPU) | 🧪 (mobile) | Poids téléchargés à la demande ; inférence sur l'appareil |
| Anthropic, Gemini, Mistral, OpenRouter, Groq, xAI (Grok) | ✅ | Connexion directe navigateur → fournisseur |
| OpenAI | ✅ | Via le proxy Edge `/api/openai/`, puis OpenAI |
| Ollama Cloud | ✅ | Via le proxy Edge `/api/ollama-cloud/`, puis Ollama Cloud |
| OCR Tesseract | ✅ | Traitement local dans le navigateur |
| Analyse d'image | ✅ (Ollama vision) | Image envoyée à l'instance Ollama configurée |
| Dictée Web Speech | ✅ (si le navigateur la prend en charge) | Peut utiliser le service distant du navigateur/OS |
| Connecteurs MCP HTTP | 🧪 | Requêtes vers les serveurs MCP configurés |
| Export/import des réglages | ✅ | Fichier local chiffré par phrase secrète |
| PWA installable et shell hors ligne | ✅ | Ressources applicatives mises en cache localement |
| Chat cloud hors ligne | ❌ | Une connexion au fournisseur reste nécessaire |

La disponibilité d'une API, d'un modèle, de WebGPU ou de la dictée varie selon le navigateur, l'appareil, la région et le fournisseur. Une PWA installée ne rend pas les services cloud accessibles hors ligne.

## Confidentialité

- Les conversations sont enregistrées dans IndexedDB sur cet appareil.
- Les clés sont conservées dans `sessionStorage` et, par défaut, dans `localStorage`. La persistance peut être désactivée dans l'interface.
- Ni compte, ni analytics, ni cookie publicitaire. Polices, icônes et fichiers OCR auto-hébergés.
- Les réglages exportés sont chiffrés côté client (AES-GCM, clé dérivée de la phrase secrète par PBKDF2). La sécurité dépend de la qualité de cette phrase.

<details>
<summary>Quand des données quittent-elles l'appareil ?</summary>

Lorsque vous envoyez un message à un fournisseur cloud, utilisez la dictée, analysez une image avec un modèle distant ou activez MCP, les données nécessaires sont transmises. Avec MCP, les définitions d'outils sont présentées au modèle choisi et le résultat d'un appel autorisé lui est renvoyé pour poursuivre la réponse. Les modèles locaux du navigateur sont téléchargés depuis l'infrastructure de distribution de WebLLM, uniquement à votre demande. Détail complet dans [PRIVACY.md](./PRIVACY.md).
</details>

## Connecteurs MCP : avertissement de sécurité

Les serveurs MCP ajoutent des outils qu'un modèle peut appeler pendant une conversation. **N'ajoutez que des serveurs de confiance, avec des comptes de test et les privilèges minimaux.** Leurs définitions d'outils sont transmises au modèle choisi. Avant chaque appel, une confirmation affiche le serveur, l'outil, une estimation heuristique du risque et un aperçu expurgé des arguments ; le résultat autorisé est ensuite renvoyé au modèle. Refuser n'envoie aucun appel d'outil.

<details>
<summary>Pourquoi cette prudence, et ce que la confirmation ne garantit pas</summary>

Le contenu d'un message, d'un document ou d'une réponse d'outil peut contenir une injection de prompt. Un serveur ou un outil MCP peut aussi être compromis, trompeur ou disposer de droits importants. La confirmation ne garantit pas l'effet réel de l'outil, et la classification du risque reste heuristique. Les serveurs `stdio` locaux ne sont pas pris en charge ; seuls les serveurs HTTP distants compatibles CORS le sont. Voir [SECURITY.md](./SECURITY.md).
</details>

## Pourquoi deux proxies ?

Les appels OpenAI et Ollama Cloud passent par des fonctions Edge (`api/openai/` et `api/ollama-cloud/`) car ces fournisseurs bloquent le CORS direct navigateur. La clé et le contenu requis transitent par ces proxys, qui relaient la requête sans la persister ni la journaliser volontairement dans le code du dépôt. Les autres fournisseurs sont appelés directement depuis le navigateur.

<details>
<summary>Ce que cette propriété du code ne garantit pas</summary>

Le code du dépôt ne persiste ni ne journalise ces données, mais cela ne garantit pas à lui seul l'absence de logs de la plateforme d'hébergement, du réseau ou du fournisseur final. Vous pouvez auditer et auto-héberger les proxies.
</details>

## Limites connues

- L'IA locale navigateur peut télécharger plusieurs centaines de mégaoctets ou davantage et échouer sur un appareil peu puissant.
- Tesseract est adapté au texte imprimé ; ses résultats sur l'écriture manuscrite sont généralement faibles.
- L'analyse d'image n'est actuellement câblée que pour Ollama.
- Il n'existe ni synchronisation multi-appareil, ni compte, ni support commercial garanti.
- MCP doit être considéré comme expérimental : la confirmation par action existe, mais la classification du risque reste heuristique et aucune politique de permissions persistante et fine n'est fournie.

## Qualité et contribution

```bash
npm run lint       # oxlint
npm test           # tests unitaires (Vitest)
npm run smoke      # smoke tests (Otsu, throttling)
npm run build      # build de production
npm run leak-scan  # scan anti-fuite de secrets
npm run e2e        # E2E + accessibilité (Playwright + Axe)
```

Les tests unitaires, smoke et E2E/accessibilité sont intégrés à la CI. Les E2E nécessitent le navigateur Playwright (`npx playwright install chromium`). Voir [CONTRIBUTING.md](./CONTRIBUTING.md) et [CHANGELOG.md](./CHANGELOG.md).

## Sécurité

Ne publiez pas de clé, de jeton, d'export de réglages ou de conversation dans une issue. Pour signaler une vulnérabilité, suivez la procédure décrite dans [SECURITY.md](./SECURITY.md).

## Licence

GNU AGPL v3 — voir [LICENSE](./LICENSE). Le code et la marque sont des sujets distincts : la licence du dépôt ne concède pas automatiquement de droits sur le nom « AIDUSIA ».

## Mentions légales

Voir [MENTIONS-LEGALES.md](./MENTIONS-LEGALES.md) (éditeur, hébergeur, propriété intellectuelle des marques tierces).
