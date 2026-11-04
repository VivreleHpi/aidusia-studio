# Export de conversations (Lot C)

Depuis la barre latérale, chaque conversation propose :

- **Markdown** — titre, messages utilisateur/assistant, citations RAG le cas échéant.
- **PDF** — fenêtre d’impression du navigateur (aucun serveur).

La recherche dans la barre latérale filtre le **titre** et le **contenu des messages**.

## Limites connues

| Limite | Contournement / piste |
|--------|------------------------|
| Messages **`tool`** (MCP) absents du Markdown | Copier-coller depuis le chat ou exporter message par message (partage réponse). |
| **PDF** = impression navigateur (pas de PDF serveur) | Utiliser « Enregistrer au format PDF » dans la boîte d’impression si disponible. |
| Recherche **sans regex**, insensible à la casse uniquement | Affiner le titre ou mots-clés simples. |
| Pas d’export groupé de toutes les conversations | Exporter conversation par conversation. |

Regroupement : [limites-connues.md](./limites-connues.md).
