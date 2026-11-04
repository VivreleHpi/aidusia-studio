# Fournisseurs OpenAI-compatible locaux (Lot E)

AIDUSIA peut appeler tout serveur exposant `/v1/models` et `/v1/chat/completions` depuis le navigateur.

## Préréglages intégrés

| Preset | URL par défaut |
|--------|----------------|
| LM Studio | `http://127.0.0.1:1234/v1` |
| Ollama OpenAI API | `http://127.0.0.1:11434/v1` |
| Jan | `http://127.0.0.1:1337/v1` |

Dans **Fournisseurs → Ajouter un fournisseur**, cliquez un préréglage puis enregistrez votre clé si le serveur en exige une (souvent une chaîne factice pour LM Studio).

## CORS

Le serveur local doit autoriser l’origine du Studio (`http://localhost:5173` ou votre domaine déployé). Sans en-têtes CORS, le navigateur bloquera les appels — ce n’est pas contournable côté client.

## Différence avec Ollama natif

Le fournisseur **Ollama (local)** utilise l’API `/api/chat` du Studio. Les préréglages ci-dessus ciblent l’**API compatible OpenAI** (`/v1/chat/completions`), utile pour LM Studio, Jan ou `OLLAMA_HOST` avec route `/v1`.
