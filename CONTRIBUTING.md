# Contribuer à AIDUSIA Studio

Merci de contribuer. Le projet est encore en phase pré-stable : privilégiez les
changements petits, vérifiables et compatibles avec le stockage existant.

## Préparer l’environnement

Prérequis : Node.js 22 et npm.

```bash
npm ci
npm run dev
```

## Vérifications obligatoires

Avant une pull request :

```bash
npm run lint
npm test
npm run smoke
npm run build
npm run brand-scan
npm run e2e
```

Les E2E nécessitent le navigateur Playwright :

```bash
npx playwright install chromium
```

Les tests doivent rester déterministes et intégrés à la CI. N’utilisez jamais
de clé ou de compte réel dans une fixture.

## Principes de contribution

- Décrivez le problème utilisateur et le comportement avant/après.
- Ajoutez ou adaptez les tests proportionnellement au risque.
- Préservez la compatibilité des données IndexedDB et `localStorage`, ou
  fournissez une migration et un plan de retour arrière.
- Pour tout nouveau transfert réseau, documentez destination, données, moment,
  consentement, rétention connue et comportement hors ligne.
- Une fonctionnalité annoncée « locale » ne doit effectuer aucun transfert non
  documenté après le téléchargement explicitement nécessaire.
- Toute action MCP externe doit rester visible et soumise à une décision
  utilisateur ; appliquez le moindre privilège.
- Les erreurs et journaux ne doivent contenir ni clé, ni en-tête
  d’authentification, ni contenu de conversation.
- Maintenez les README français et anglais cohérents.
- Mettez à jour [PRIVACY.md](./PRIVACY.md), [SECURITY.md](./SECURITY.md) et
  [CHANGELOG.md](./CHANGELOG.md) lorsque le changement les affecte.

## Pull request

La description doit inclure :

- objectif et périmètre ;
- captures pour un changement visuel ;
- commandes exécutées et résultats ;
- impact accessibilité, mobile, confidentialité et sécurité ;
- risques, limites et stratégie de retour arrière.

Une PR n’est pas considérée prête si le build échoue, si elle ajoute une
promesse produit invérifiable ou si elle dégrade le fonctionnement clavier et
lecteur d’écran.

## Sécurité

Ne signalez jamais une vulnérabilité exploitable dans une issue ou une pull
request publique. Utilisez [SECURITY.md](./SECURITY.md).

## Licence

En contribuant, vous acceptez que votre contribution soit distribuée sous la
licence AGPL-3.0-only du dépôt. N’ajoutez que du code, des modèles, des images et
des données dont les droits permettent cette distribution.
