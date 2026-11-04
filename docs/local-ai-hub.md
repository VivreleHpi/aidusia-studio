# Espace IA locales (hub)

Le hub **IA locales** (sidebar) s’appuie sur [`local-ai-catalog.json`](../src/data/local-ai-catalog.json) pour afficher le catalogue, estimer la compatibilité avec votre appareil (Gouverneur matériel + entrées `compatibility`) et lancer des comparaisons / benchmarks documentés.

## Limites connues

| Limite | Contournement / piste |
|--------|------------------------|
| Recommandations **indicatives** (VRAM/RAM, mobile) | Mesurer sur votre machine ; voir Fournisseurs → modèles locaux pour l’état réel (téléchargé, WebGPU). |
| Le hub ne **télécharge** pas les modèles à votre place | Utiliser le menu modèle ou Fournisseurs (WebLLM, Luciole, Ollama). |
| Entrées `desktop_only` ou `heavy` sur mobile | Préférer Luciole ou cloud ; voir [mobile-local-path.md](./mobile-local-path.md). |
| Benchmark du hub ≠ perf en conversation longue | Refaire un essai dans le chat ; le benchmark mesure surtout le premier jet. |

Catalogue et sync : [local-ai-catalog.md](./local-ai-catalog.md).
