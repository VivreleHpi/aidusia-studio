# Catalogue des IA locales (AIDUSIA Studio)

Le fichier [`src/data/local-ai-catalog.json`](../src/data/local-ai-catalog.json) alimente l’espace **IA locales** (catalogue, compatibilité, benchmark).

## Mettre à jour le catalogue

1. Éditer `src/data/local-ai-catalog.json` :
   - incrémenter `catalogVersion` (date ou semver) et `updatedAt` ;
   - ajouter ou modifier une entrée dans `entries`.
2. Valider : `npm run validate:local-ai-catalog`
3. Lancer les tests : `npm test -- tests/unit/localAiCatalog.test.ts tests/unit/localAiFit.test.ts`

## Champs d’une entrée

| Champ | Description |
|--------|-------------|
| `id` | Identifiant stable dans le dépôt |
| `runtime` | `webllm` \| `wllama` \| `ollama` |
| `providerId` / `modelId` | Liens vers le Studio (`browser`, `luciole`, `ollama` + id modèle) |
| `sizeGb.f16` / `f32` | Taille indicative (WebLLM) ou unique (GGUF / Ollama) |
| `vramGbMin` / `ramGbMin` | Seuils pour la recommandation machine (estimations) |
| `compatibility.mobile` | `ok` \| `ok_light` \| `heavy` \| `desktop_only` |

## Sources publiques utiles

- **WebLLM / MLC** : modèles prébuildés du paquet `@mlc-ai/web-llm` et [Hugging Face mlc-ai](https://huggingface.co/mlc-ai).
- **Luciole** : dépôt [OpenLLM-France/Luciole-1B-Instruct-1.1-GGUF](https://huggingface.co/OpenLLM-France/Luciole-1B-Instruct-1.1-GGUF).
- **Ollama** : bibliothèque [ollama.com/library](https://ollama.com/library) (tags, tailles indicatives).

Ce catalogue est **indicatif** : les tailles réelles dépendent de la quantification servie sur l’appareil (shader-f16, variante f32, etc.).
