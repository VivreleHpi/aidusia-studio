# Application mobile installable (plan)

Dernière mise à jour : 4 novembre 2026.

AIDUSIA Studio est aujourd’hui une **PWA** (installable depuis le navigateur).
Ce document décrit la voie vers un **binaire installable** (App Store / Play Store
ou sideload) sans abandonner le noyau web.

## Objectif

- Conserver **un seul codebase** React/Vite.
- Réutiliser COOP/COEP et WebGPU/WebLLM là où l’OS le permet.
- Ne pas imposer de compte ni de télémétrie.

## Option retenue (phase 1) : Capacitor

| Critère | Capacitor | Tauri mobile |
|---|---|---|
| Maturité mobile 2026 | Élevée (iOS/Android) | Encore limitée |
| Intégration Vite | Plugin officiel `@capacitor/cli` | Wrapper webview séparé |
| Taille équipe | 1 dev web suffit | Rust + web |

**Recommandation :** prototyper avec **Capacitor 7** autour du dossier `dist/`
produit par `npm run build`.

### Étapes techniques

1. `npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios`
2. `npx cap init "AIDUSIA Studio" com.aidusia.studio --web-dir dist`
3. Copier les en-têtes d’isolation : configurer `server.androidScheme` et
   vérifier que `Cross-Origin-Embedder-Policy` est servi par le WebView
   (Android Chrome 119+ ; iOS WKWebView à valider sur appareil réel).
4. Plugins utiles : `@capacitor/filesystem` (export RAG), `@capacitor/share`.
5. CI : job optionnel `cap sync` + lint Gradle/Xcode (non bloquant au début).

### Risques

- **WebGPU / SharedArrayBuffer** : tester Qwen portable et les embeddings RAG sur iPhone
  et Android milieu de gamme ; prévoir repli CPU documenté.
- **MCP stdio** : inaccessible en sandbox mobile ; garder MCP HTTP/SSE uniquement.
- **Review stores** : mentionner chiffrement local et absence de collecte dans
  la fiche confidentialité (alignée sur `PRIVACY.md`).

## Option phase 2 : Tauri

Envisager Tauri lorsque le support mobile stabilise, surtout si un binaire desktop
(Tauri 2) doit partager la même coquille. Non prioritaire pour le premier store.

## Livrables PR suivants

- [ ] Dépôt Capacitor minimal (`capacitor.config.ts`, scripts npm `cap:sync`).
- [ ] Capture d’écran installable Android (debug).
- [ ] Matrice de tests : onboarding, chat local, export MD.

Voir aussi [ia-locale-mobile.md](./ia-locale-mobile.md) et
[mobile-local-path.md](./mobile-local-path.md).
