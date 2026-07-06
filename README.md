# AIDUSIA Studio

Testez vos IA — locales ou cloud — directement dans le navigateur. Rien ne
transite par un serveur à nous, à une seule exception documentée (OpenAI, ci-dessous).

## Ce que c'est

- Une interface de chat qui parle **directement, depuis votre navigateur**, à :
  - **Ollama** en local sur votre machine ;
  - **Un modèle local dans le navigateur** (Gemma 4, via WebGPU — aucune donnée
    ne sort jamais de l'appareil) ;
  - **Anthropic, Google Gemini, Mistral** avec votre propre clé API (BYOK),
    en connexion directe navigateur → fournisseur ;
  - **OpenAI**, via un petit proxy — voir "Pourquoi un proxy" plus bas.
- Conversations et clés stockées **uniquement dans votre navigateur**
  (IndexedDB / localStorage), jamais sur un serveur.
- Zéro compte, zéro analytics, zéro cookie de suivi.

## Ce que ce n'est PAS

- Ce n'est pas un produit fini au sens SaaS : pas de compte, pas de synchro
  multi-appareil, pas de support commercial en v1.
- Ce n'est pas le produit complet AIDUSIA — ce dépôt est une brique isolée,
  volontairement minimale, extraite pour être vérifiable par tous.

## Pourquoi un proxy pour OpenAI (et pas les autres) ?

OpenAI bloque volontairement les requêtes directes depuis un navigateur
(pas d'en-tête CORS sur ses réponses réelles — vérifié empiriquement, pas
une légende de forum). Anthropic, Gemini et Mistral autorisent l'accès
direct navigateur et sont donc appelés sans intermédiaire.

Le proxy OpenAI est :
- **stateless** (aucune donnée écrite nulle part) ;
- **sans log** de votre clé ni de vos messages ;
- **open-source**, dans ce même dépôt — vérifiable ligne par ligne ;
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
