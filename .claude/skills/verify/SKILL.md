---
name: verify
description: Vérifier aidusia-studio en conditions réelles — servir le build et piloter l'UI avec Playwright (Edge système), Ollama simulé par interception réseau.
---

# Vérifier aidusia-studio

App Vite/React 100% client (pas de backend). Surface = pixels du navigateur.

## Build & serve

```
npm run build        # tsc -b && vite build
npm run preview      # sert dist/ sur http://localhost:4173 (lancer en arrière-plan)
```

## Piloter (playwright-core + Edge système, aucun téléchargement de navigateur)

Dans un dossier temporaire : `npm i playwright-core`, puis
`chromium.launch({ channel: "msedge", headless: true })`.

Points clés du script :

- **Passer l'onboarding** : `addInitScript` → `localStorage.setItem("aidusia_onboarded", "true")`.
- **Simuler Ollama** (provider par défaut) : `context.route("http://localhost:11434/**", ...)` :
  - `OPTIONS` → 204 avec headers CORS (`Access-Control-Allow-Origin: *`, `-Headers: content-type`, `-Methods: GET,POST,OPTIONS`) — le POST /api/chat déclenche un preflight.
  - `GET /api/tags` → `{"models":[{"name":"llama3.2:3b"}]}` (ajouter `"capabilities":["vision"]` pour activer le bouton image).
  - `POST /api/chat` → NDJSON : lignes `{"message":{"role":"assistant","content":"..."},"done":false}` puis `{"done":true}`.
- **Prouver zéro requête externe** : écouter `page.on("request")` et vérifier que tous les hostnames sont localhost (les polices sont auto-hébergées via Fontsource — toute requête googleapis/gstatic est une régression).
- **Chemin d'erreur** : `route.abort("connectionrefused")` sur 11434 → l'app doit afficher « Ollama injoignable… ».

## Sélecteurs utiles

- Bouton fournisseur/modèle du composer : `[data-tour="provider-bar"]` (ouvre le menu vers le haut ; « Gérer les fournisseurs » en pied de menu ouvre le panneau).
- Panneau Fournisseurs : `[role="dialog"][aria-label="Fournisseurs"]`, fermeture via `button[aria-label="Fermer"]`.
- Galerie Connecteurs (MCP) : menu Paramètres → « Connecteurs » → `[role="dialog"][aria-label="Connecteurs"]` ; 6 cartes (5 logos + personnalisé), un clic sur une carte ouvre le formulaire de connexion.
- Le menu auto-sélectionne le premier modèle du fournisseur au montage (attendre `:has-text("<modele>")` sur le bouton avant d'interagir).

## Pièges

- **La CSP de vercel.json ne s'applique qu'en production** — `vite preview` ne la sert pas. Tout nouveau domaine appelé (fournisseur, CDN de modèles…) doit être vérifié CONTRE https://aidusia-studio.vercel.app (script scratchpad prod-check : fetch depuis le contexte page + écouteur `securitypolicyviolation`). Un fournisseur qui marche en local peut être mort en prod uniquement à cause de connect-src.
- Les scripts inline d'index.html sont bloqués par la CSP (`script-src 'self'`) : tout bootstrap doit vivre dans public/*.js.

- **i18n** : l'app détecte la langue du navigateur (`aidusia_lang` en localStorage, sinon `navigator.language`). En Playwright, passer `locale: "fr-FR"` au contexte sinon tout s'affiche en anglais et les sélecteurs français échouent. Bascule via les boutons FR/EN du pied de sidebar (`getByRole("button", { name: "EN", exact: true })`).

- `document.querySelector(".overflow-y-auto")` attrape la liste de la **sidebar**, pas la zone de messages. Cibler celle qui contient `.message-in`.
- Le bouton « Revenir en bas » n'apparaît que si le débordement dépasse ~80px : prévoir une fausse réponse **longue** (6+ sections markdown) pour le tester.
- Attendre ~900ms après le chargement de l'accueil (cascade `rise-in`) avant screenshot.
- Textarea : placeholder exact « Écrivez un message… » ; auto-grow plafonné à 192px.
