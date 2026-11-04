# Parcours IA locale sur mobile (Lot B)

Sur smartphone, le Studio distingue trois chemins :

1. **WebGPU disponible** — fournisseur « Sur cet appareil » : modèles MLC légers (≤2B recommandés). Une bannière rappelle Wi‑Fi et taille des téléchargements.
2. **WebGPU indisponible** — Luciole 1B (GGUF ~1 Go) ou une clé cloud. Une alerte propose d’ouvrir **Fournisseurs** pour configurer Luciole ou un API.
3. **Modèles lourds** — sélection possible mais avertissement ⚠ dans le menu modèle (heuristique sur la taille du modèle).

Voir aussi [ia-locale-mobile.md](./ia-locale-mobile.md) pour le contexte produit et les voies Ollama/Termux.

## Tests

- Parcours mobile E2E : `tests/e2e/mobile.spec.ts`
- Heuristiques unitaires : `tests/unit/mobileLocalPath.test.ts`
