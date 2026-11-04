# RAG local (AIDUSIA Studio)

Recherche documentaire **100 % dans le navigateur** : import, decoupage, embeddings, stockage IndexedDB, citations dans le chat.

## Formats supportes

- `.txt`, `.md` / Markdown
- `.pdf` (extraction texte via PDF.js, lazy-loaded)

## Espaces

1. Sidebar **Documents** → creer un espace, importer des fichiers.
2. Dans le chat, choisir l'**espace documentaire** dans le selecteur du composeur.
3. Chaque message utilisateur declenche une recherche par similarite (embeddings) sur les chunks de l'espace.

## Embeddings

- Mode principal : `@xenova/transformers` (`all-MiniLM-L6-v2`), charge a la demande.
- Repli : embedding hash deterministe (meme API) si le modele ne peut pas se charger.

Aucun appel reseau pour l'indexation (hors telechargement initial du modele d'embedding si necessaire).

## Citations

Le prompt systeme demande au modele de citer `[1]`, `[2]`, etc. Les sources utilisees sont listees sous la reponse avec extraits cliquables.

## Donnees

- Stores IndexedDB : `ragSpaces`, `ragDocuments`, `ragChunks` (migration v2).
- Lien conversation ↔ espace : champ `ragSpaceId` + cle localStorage de secours.

Voir [PRIVACY.md](../PRIVACY.md) : les documents restent sur l'appareil ; seuls les extraits retenus sont envoyes au fournisseur choisi avec le message.

## Limites connues

| Limite | Contournement / piste |
|--------|------------------------|
| PDF **scanné** sans couche texte | OCR via le bouton image du composeur, ou retraiter le PDF en amont. |
| Embeddings **hash** si `@xenova/transformers` ne charge pas | Réessayer après connexion stable ; le mode hash reste cohérent mais moins précis. |
| Indexation UI peut utiliser hash, retrieval chat **transformers** par défaut | Réimporter après chargement du modèle d’embedding si besoin d’uniformité. |
| Export **Données** (`userData`) sans chunks RAG IndexedDB | Réimporter les fichiers sources ; pas de sauvegarde RAG complète dans l’export JSON global aujourd’hui. |
| Pas de RAG sur plusieurs espaces simultanés par message | Un seul espace actif par conversation (sélecteur du composeur). |

Regroupement : [limites-connues.md](./limites-connues.md).
