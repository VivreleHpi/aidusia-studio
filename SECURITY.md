# Politique de sécurité

## Versions prises en charge

| Version | Prise en charge |
|---|---|
| 0.1.x (dernière version publiée) | ✅ |
| < 0.1.0 | ❌ |

La branche `main` reste la seule ligne de développement : un correctif de
sécurité est livré en publiant une nouvelle version depuis `main` et en
redéployant. Le déploiement public suit toujours le dernier commit de `main`.

## Signaler une vulnérabilité

Ne publiez pas de détail exploitable, de clé, de jeton, d’export ou de
conversation dans une issue.

1. Utilisez en priorité **Security → Report a vulnerability** sur le dépôt
   GitHub si l’option est disponible. Elle crée un avis privé.
2. Si cette option n’est pas disponible et qu’aucun canal privé n’est indiqué
   sur le profil de l’organisation, ouvrez une issue ne contenant que la demande
   d’un canal privé, sans détail technique ni secret.

Le rapport privé devrait préciser la version ou le commit, l’impact, les étapes
minimales de reproduction et, si possible, une proposition de correction.
N’incluez que des données factices. Le projet ne publie actuellement ni délai de
réponse garanti ni programme de récompense ; un accusé de réception et une
chronologie seront communiqués selon les moyens des mainteneurs.

## Périmètre

Sont notamment dans le périmètre :

- l’application web et son service worker ;
- les fonctions Edge `api/openai/` et `api/ollama-cloud/` ;
- le stockage et l’import/export locaux ;
- le client MCP et ses décisions d’autorisation ;
- une fuite de secrets introduite par le dépôt ou le build.

Les plateformes, modèles et services tiers restent sous la politique de sécurité
de leur opérateur. Un comportement attendu d’un fournisseur, une limite connue
de modèle ou une clé volontairement publiée par son propriétaire ne constitue
pas à lui seul une vulnérabilité du Studio.

## Modèle de menace

### Actifs à protéger

- clés API et en-têtes d’authentification MCP ;
- conversations, images, résultats OCR et réponses d’outils ;
- intégrité des actions déclenchées via MCP ;
- phrase secrète et contenu des exports ;
- disponibilité du navigateur, du stockage et des proxies.

### Frontières de confiance

1. **Navigateur local** : code de l’application, IndexedDB, `localStorage`,
   `sessionStorage`, Cache Storage et WebGPU.
2. **Hébergement** : fichiers statiques, service worker et deux fonctions Edge.
3. **Fournisseurs IA** : services cloud directs, OpenAI/Ollama Cloud via proxy,
   ou instance Ollama configurée.
4. **Écosystème MCP** : serveur, passerelle, outils et comptes reliés.
5. **Services du navigateur/OS** : notamment la dictée Web Speech.
6. **Chaîne de dépendances et de build** : npm, GitHub Actions et distribution
   des modèles WebLLM.

### Menaces principales

- **XSS et dépendance compromise** : lecture des secrets accessibles au
  JavaScript, modification d’une requête ou exfiltration de données.
- **Injection de prompt indirecte** : un document, une page, un résultat d’outil
  ou une réponse de modèle tente de faire appeler un outil contre l’intention de
  l’utilisateur.
- **Confused deputy MCP** : le modèle exploite les droits d’un connecteur plus
  puissants que ceux nécessaires à la demande.
- **Serveur MCP malveillant** : faux schéma, résultat trompeur, collecte
  d’arguments ou actions non annoncées.
- **Collision ou usurpation d’outil** : noms semblables ou description
  mensongère conduisant au mauvais serveur.
- **Fuite par proxy ou fournisseur** : transit de clés et contenus, logs de
  plateforme, rétention du fournisseur ou interception d’un endpoint mal
  configuré.
- **Import hostile et épuisement de ressources** : fichier surdimensionné,
  paramètres cryptographiques coûteux, image énorme, contexte excessif ou modèle
  WebGPU trop lourd.
- **Persistance locale** : autre utilisateur du même profil, extension
  malveillante, poste compromis ou sauvegarde du profil accède aux données.
- **Service worker obsolète ou compromis** : conservation d’un ancien bundle ou
  interception des requêtes de l’origine.
- **Abus des proxies** : requêtes arbitraires, consommation de ressources ou
  contournement de limites en l’absence de contrôles suffisants.

### Contrôles présents

Le projet utilise notamment TypeScript, une CSP, des ressources visuelles
auto-hébergées, le chiffrement AES-GCM des exports et des limites de validation
à l’import. Les conversations restent dans IndexedDB et la persistance des clés
peut être désactivée. Les deux proxies sont stateless dans le code du dépôt.

Les headers MCP sont séparés des métadonnées persistantes et les tokens MCP sont
limités à la session du navigateur. Le client valide au runtime les enveloppes
JSON-RPC, les outils, les arguments et les résultats, avec une taille maximale
pour les réponses. La CI complète ces contrôles avec Gitleaks, Dependency Review
et `npm audit`. Ces protections réduisent l’exposition sans empêcher toute
compromission.

Les contraintes des proxys Edge, des headers web et du contrôle anti-abus sont détaillées dans [docs/deployment-security.md](./docs/deployment-security.md).

Pour MCP, chaque action doit être présentée à l’utilisateur avant envoi, avec le
serveur, l’outil, une estimation de risque et un aperçu expurgé des arguments.
Cette confirmation réduit le risque mais ne prouve ni l’innocuité de l’outil ni
l’exactitude de son effet.

### Risques résiduels et règles d’usage

- La CSP est une défense en profondeur, pas une garantie contre toute XSS.
- `localStorage` et IndexedDB ne sont pas un coffre-fort face à du JavaScript
  exécuté sur la même origine ou à un appareil compromis.
- Le code « sans log volontaire » des proxies ne contrôle pas les journaux de
  l’hébergeur, du réseau ou du fournisseur.
- Une confirmation MCP peut être approuvée par erreur ; les arguments expurgés
  peuvent masquer une information importante et la classification par nom est
  heuristique.
- Utilisez des comptes MCP dédiés, des droits minimaux, des données factices et
  des outils réversibles. Refusez toute action inattendue.
- Ne saisissez pas de données que le fournisseur ou serveur choisi ne devrait
  pas recevoir.

## Attentes pour les correctifs

Tout changement touchant l’authentification, MCP, les proxies, le stockage, le
service worker, la CSP ou l’import/export doit inclure une analyse des flux de
données et des tests adaptés. Les secrets réels sont interdits dans les tests,
captures, fixtures et rapports publics.
