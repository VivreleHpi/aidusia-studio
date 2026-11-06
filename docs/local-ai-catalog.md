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
| `providerId` / `modelId` | Liens vers le Studio (`browser`, `portable`, `ollama` + id modèle) |
| `sizeGb.f16` / `f32` | Taille indicative (WebLLM) ou unique (GGUF / Ollama) |
| `vramGbMin` / `ramGbMin` | Seuils pour la recommandation machine (estimations) |
| `compatibility.mobile` | `ok` \| `ok_light` \| `heavy` \| `desktop_only` |

## Sources publiques utiles

- **WebLLM / MLC** : modèles prébuildés du paquet `@mlc-ai/web-llm` et [Hugging Face mlc-ai](https://huggingface.co/mlc-ai).
- **Portable** : dépôt [Qwen/Qwen2.5-0.5B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF).
- **Ollama** : bibliothèque [ollama.com/library](https://ollama.com/library) (tags, tailles indicatives).

Ce catalogue est **indicatif** : les tailles réelles dépendent de la quantification servie sur l’appareil (shader-f16, variante f32, etc.).

## Synchronisation automatique (CI)

Un script **`npm run sync:local-ai-catalog`** interroge des **sources publiques** (sans appel réseau au runtime de l’app) :

| Source | Usage |
|--------|--------|
| Paquet **`@mlc-ai/web-llm`** (prebuilt MLC) | Rafraîchit les entrées WebGPU déjà présentes ; ajout auto **désactivé par défaut** (`autoAddInstructQ4f16` dans la config) |
| **API Hugging Face** | Dépôts GGUF suivis (ex. Qwen 0.5B) — taille fichier, licence |
| **Bibliothèque Ollama** (`ollama.com`) | Tags + manifeste Docker (`/v2/library/…/manifests/…`) pour les entrées configurées |

### Champs préservés (édition manuelle)

Lors d’une sync, les champs suivants **ne sont jamais écrasés** sur une entrée existante :

- `id`, `name`, `vramGbMin`, `ramGbMin`, `compatibility`, `capabilities`

Les autres champs (`sizeGb`, `license`, `releasedAt`, `modelId`, `quantization`, etc.) peuvent être mis à jour depuis les sources.

Configuration : [`scripts/sync-local-ai-catalog/config.mjs`](../scripts/sync-local-ai-catalog/config.mjs).

### Commandes

```bash
# Aperçu (stdout + scripts/sync-local-ai-catalog/last-summary.md)
npm run sync:local-ai-catalog

# Appliquer + valider
npm run sync:local-ai-catalog -- --write

# CI / vérification stricte
npm run sync:local-ai-catalog -- --check
```

### GitHub Actions

Workflow [`.github/workflows/sync-local-ai-catalog.yml`](../.github/workflows/sync-local-ai-catalog.yml) :

- **Planification** : chaque lundi 06:00 UTC
- **`workflow_dispatch`** : déclenchement manuel
- Si le JSON change : PR automatique via [`peter-evans/create-pull-request`](https://github.com/peter-evans/create-pull-request) (branche `automation/local-ai-catalog-sync`), corps = résumé généré

**Permissions dépôt** (Settings → Actions → General) : autoriser les workflows à **créer des pull requests** (*Workflow permissions* → « Read and write » + cocher *Allow GitHub Actions to create and approve pull requests* si disponible).

Token utilisé : `GITHUB_TOKEN` (fourni par Actions). Aucun secret supplémentaire pour les API publiques HF/Ollama.

Les entrées peuvent porter un objet optionnel `sync` (horodatage, source) — ignoré par l’app, utile pour la revue des PR auto.

## Limites connues

| Limite | Contournement / piste |
|--------|------------------------|
| Tailles et compatibilité **indicatives** | Vérifier dans Fournisseurs / hub après téléchargement réel. |
| Sync CI **ne crée pas** de nouvelles entrées WebLLM par défaut | Éditer `config.mjs` (`autoAddInstructQ4f16`) ou ajouter manuellement dans le JSON. |
| Champs manuels (`compatibility`, `ramGbMin`, …) **préservés** | Mettre à jour la doc produit si vous changez les seuils à la main. |
| PR hebdo **dépend** des permissions GitHub Actions | Activer « Allow GitHub Actions to create pull requests » (voir ci-dessus). |
| API Ollama/HF **hors ligne** = sync en échec | Relancer `npm run sync:local-ai-catalog` plus tard ou PR manuelle. |

Regroupement : [limites-connues.md](./limites-connues.md).

