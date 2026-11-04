# Limites connues (AIDUSIA Studio)

Document de référence regroupant les limites produit par **lot / fonctionnalité**, avec contournements et pistes d’évolution. Les fiches détaillées restent dans les docs liées.

🇬🇧 [English version](./limites-connues.en.md)

---

## Lot A — RAG local

| Limite | Contournement / piste |
|--------|------------------------|
| PDF sans texte sélectionnable | OCR dans le composeur ou pré-traitement PDF. |
| Repli embedding hash | Attendre le chargement de `@xenova/transformers` ; réindexer si besoin. |
| Un espace documentaire actif par conversation | Changer d’espace dans le sélecteur du composeur. |
| Export Données sans index RAG complet | Conserver les fichiers sources ; réimport dans **Documents**. |

→ [docs/rag.md](./rag.md)

---

## Lot B — Parcours mobile IA locale

| Limite | Contournement / piste |
|--------|------------------------|
| WebGPU absent ou instable | Luciole, Ollama LAN, ou cloud. |
| Modèles lourds sur téléphone | Modèles ≤2B ou avertissement ⚠ dans le menu modèle. |
| Téléchargements volumineux | Wi‑Fi ; PWA installée pour cache persistant. |

→ [docs/mobile-local-path.md](./mobile-local-path.md), [docs/ia-locale-mobile.md](./ia-locale-mobile.md)

---

## Lot C — Export & recherche historique

| Limite | Contournement / piste |
|--------|------------------------|
| Pas de messages MCP dans l’export MD | Copie manuelle ou partage de réponse. |
| PDF via impression | « Enregistrer en PDF » dans le navigateur. |
| Recherche textuelle simple | Mots-clés dans le titre ou le corps. |

→ [docs/conversation-export.md](./conversation-export.md)

---

## Lot D — MCP durci

| Limite | Contournement / piste |
|--------|------------------------|
| Pas de MCP stdio in-browser | Pont HTTP local : [docs/mcp-stdio-bridge.md](./mcp-stdio-bridge.md). |
| CORS obligatoire | Configurer le serveur ou le pont. |
| Risque heuristique | Politique « Refuser » ou « Demander » ; journal local. |
| Jetons MCP session non dans export Données | Reconnecter les connecteurs après migration. |

→ [SECURITY.md](../SECURITY.md)

---

## Lot E — API OpenAI-compatible locale

| Limite | Contournement / piste |
|--------|------------------------|
| CORS sur localhost | Configurer LM Studio / Jan / proxy. |
| Double chemin Ollama (`/api/chat` vs `/v1`) | Fournisseur **Ollama (local)** natif pour outils + vision Ollama. |

→ [docs/local-openai-compatible.md](./local-openai-compatible.md)

---

## Lot F — Vision multi-fournisseurs

| Limite | Contournement / piste |
|--------|------------------------|
| Pas de vision WebLLM / Luciole | Ollama vision, cloud, ou OCR. |
| JPEG forcé pour APIs cloud | Accepter la compression ou OCR pour texte. |
| `visionCapable` parfois heuristique | Choisir un modèle vision explicite. |

→ [docs/vision-multimodal.md](./vision-multimodal.md)

---

## Hub IA locales & catalogue

| Limite | Contournement / piste |
|--------|------------------------|
| Compatibilité catalogue indicative | Mesurer sur l’appareil ; hub + Fournisseurs. |
| Sync hebdo optionnelle / PR auto | Voir permissions Actions ; sync manuelle. |
| Hub ne remplace pas le téléchargement modèle | Menu modèle ou Fournisseurs. |

→ [docs/local-ai-hub.md](./local-ai-hub.md), [docs/local-ai-catalog.md](./local-ai-catalog.md)

---

## Transversal (hors lots)

| Sujet | Limite | Contournement / piste |
|-------|--------|------------------------|
| OCR Tesseract | Texte imprimé | Vision cloud/Ollama pour manuscrit. |
| Dictée | Service navigateur (souvent cloud) | Saisie clavier. |
| OpenAI / Ollama Cloud | Proxy Edge stateless | Auto-héberger les proxys ([README](../README.md)). |
| Sync multi-appareils | Absente | Export Données / réglages chiffrés manuels. |
| Hébergement public | Proxys et en-têtes documentés | [docs/deployment-security.md](./deployment-security.md). |

---

## Signaler une limite

Si une limite vous bloque et qu’elle n’est pas listée ici, ouvrez une issue **sans** coller de clés API ni d’exports de conversations.
