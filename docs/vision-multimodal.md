# Analyse d’image (vision multi-fournisseurs)

Le composeur du chat permet de joindre une image lorsque le **modèle sélectionné** est détecté comme compatible vision (`visionCapable` via l’API du fournisseur ou heuristique sur l’id du modèle).

## Fournisseurs concernés

- **Ollama** — champ `images` natif.
- **OpenAI-compatible** (OpenAI via proxy, Groq, Mistral, OpenRouter, xAI, fournisseurs personnalisés) — contenu multimodal type Chat Completions.
- **Anthropic** — blocs image base64.
- **Google Gemini** — `inlineData`.

Non concernés : **IA locale navigateur (WebLLM)**, **Qwen portable**, modèles texte seul.

## Préparation côté client

Les images passent par `prepareVisionImage` (redimensionnement, JPEG) avant encodage base64.

## Limites connues

| Limite | Contournement / piste |
|--------|------------------------|
| Encodage **JPEG** pour les APIs cloud (pas le PNG d’origine) | Recadrer ou exporter en JPEG avant import si la fidélité couleur compte. |
| **Heuristique** si l’API ne signale pas la vision | Choisir un modèle explicitement « vision » (ex. `llava`, `gpt-4o`, `claude-3`, `gemini-*`). |
| Qualité variable selon fournisseur et modèle | Tester sur le modèle réel ; préférer OCR local pour texte imprimé. |
| Pas de vision sur WebLLM / Qwen portable | Ollama vision, cloud, ou OCR Tesseract dans le composeur. |
| Taille / quota API | Réduire la résolution (le Studio compresse déjà) ; vérifier les limites du fournisseur. |

Voir aussi le regroupement [limites-connues.md](./limites-connues.md).
