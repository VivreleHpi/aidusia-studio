# Parcours IA locale sur mobile (Lot B)

Sur smartphone, le Studio distingue trois chemins :

1. **WebGPU disponible** — fournisseur « Sur cet appareil » : modèles MLC légers (≤2B recommandés). Une bannière rappelle Wi‑Fi et taille des téléchargements.
2. **WebGPU indisponible** — Qwen 2.5 0.5B (GGUF ~0,5 Go) ou une clé cloud. Une alerte propose d’ouvrir **Fournisseurs** pour configurer ce modèle ou une clé.
3. **Modèles lourds** — sélection possible mais avertissement ⚠ dans le menu modèle (heuristique sur la taille du modèle).

Voir aussi [ia-locale-mobile.md](./ia-locale-mobile.md) pour le contexte produit et les voies Ollama/Termux.

## Tests

- Parcours mobile E2E : `tests/e2e/mobile.spec.ts`
- Heuristiques unitaires : `tests/unit/mobileLocalPath.test.ts`

## Limites connues

| Limite | Contournement / piste |
|--------|------------------------|
| Détection **mobile** et WebGPU dépend du navigateur | Tester sur l’appareil réel ; utiliser Qwen portable ou Ollama sur le réseau local (voir [ia-locale-mobile.md](./ia-locale-mobile.md)). |
| Avertissement modèle **lourd** = heuristique (ex. 3B, 7B) | Choisir un modèle ≤2B recommandé ou passer par le cloud. |
| WebLLM **désactivé** sans adaptateur WebGPU | Qwen 2.5 0.5B (~0,5 Go) ou clé API cloud. |
| Perf/batterie non garanties | Wi‑Fi pour les téléchargements ; réponses courtes par défaut. |

Regroupement : [limites-connues.md](./limites-connues.md).
