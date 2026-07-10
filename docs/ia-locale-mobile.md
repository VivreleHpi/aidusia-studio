# IA locale sur smartphone — état des lieux et plan

Objectif : faire tourner une IA **réellement locale** sur le téléphone de
l'utilisateur, sans backend, en restant fidèle à la promesse du Studio
(rien ne transite par un serveur à nous).

## Voie 1 — IA dans le navigateur (WebGPU) : la cible

C'est la voie déjà inscrite sur la feuille de route (Gemma via WebGPU).

**Comment :** un moteur d'inférence WASM/WebGPU côté page — les deux options
sérieuses sont [web-llm (MLC)](https://github.com/mlc-ai/web-llm) et
[MediaPipe LLM Inference](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js)
— avec un modèle quantisé type **Gemma 2B/4B en q4** (~1,5 à 2,5 Go de poids).

**Prérequis réels :**

- WebGPU : Chrome/Edge Android stable depuis la v121 ; iOS/iPadOS Safari 26.
  Le Gouverneur Matériel du Studio détecte déjà l'adaptateur.
- RAM : 6-8 Go minimum pour du 2-4B quantisé sans tuer l'onglet.
- Téléchargement unique des poids, mis en cache (Cache Storage / OPFS) —
  d'où l'intérêt de la **PWA installable** (déjà en roadmap) pour que le
  cache survive et que l'app s'ouvre hors ligne.
- Batterie/chauffe : décodage ~5-15 tokens/s sur un téléphone récent ;
  limiter la fenêtre de contexte et proposer des réponses courtes par défaut.

**Plan d'intégration dans le Studio :**

1. Le Gouverneur Matériel donne déjà un verdict (OPTIMAL/DÉGRADÉ/INDISPONIBLE) ;
   ne proposer le téléchargement du modèle **que** si le verdict le permet
   (RAM estimée + WebGPU + espace disque, trois probes déjà en place).
2. Ajouter un pseudo-fournisseur « Navigateur (local) » dans le menu modèle,
   qui déclenche le téléchargement guidé au premier usage (progression
   affichée, annulable, reprise possible).
3. L'assistant de démarrage mobile oriente déjà vers cette option quand
   WebGPU est compatible — le texte est en place, la fonctionnalité suivra.

## Voie 2 — Ollama du PC accessible depuis le téléphone : possible aujourd'hui

Sans rien coder : le téléphone et l'ordinateur sur le même Wi-Fi, Ollama
lancé sur le PC avec :

```bash
OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS=https://votre-instance.vercel.app ollama serve
```

puis, dans le Studio sur le téléphone, régler l'URL d'Ollama sur
`http://IP-du-PC:11434` (Réglages → Fournisseurs). Les données restent sur
le réseau local ; c'est « local » au sens du foyer, pas du téléphone.
À documenter dans la FAQ et la notice — c'est la meilleure réponse
immédiate pour un utilisateur motivé.

Attention : n'ouvrez jamais ce port au-delà de votre réseau local.

## Voie 3 — Ollama sur le téléphone (Termux) : ça marche dès aujourd'hui

Android uniquement (pas d'équivalent iOS). Ollama est empaqueté dans le
dépôt communautaire TUR de [Termux](https://termux.dev) :

```bash
pkg update && pkg upgrade
pkg install tur-repo
pkg install ollama
ollama serve &
ollama pull gemma3:1b        # ou qwen2.5:1.5b — visez 1-3B sur téléphone
```

Puis ouvrez le Studio **dans le navigateur du même téléphone** : l'URL
Ollama par défaut (`http://localhost:11434`) pointe cette fois vers le bon
appareil — le téléphone lui-même. Résultat : une IA 100% locale dans la
poche, sans compte ni cloud, dès maintenant.

Réalités à connaître : ~1 à 2 Go de poids à télécharger, 3-10 tokens/s
selon le SoC, chauffe sur les longues réponses, et Android peut tuer le
process Termux en arrière-plan (utilisez `termux-wake-lock`).

**Et la licence ?** Rien ne change pour le Studio : Termux (GPLv3) et
Ollama (MIT) sont des outils indépendants que l'utilisateur installe
lui-même — notre code reste sous sa propre licence (AGPL-3.0), aucune
contamination dans un sens comme dans l'autre.

## Recommandation

- **Court terme** : documenter les voies 2 et 3 (FAQ + notice), zéro code —
  la voie 3 (Termux) donne déjà une IA 100% locale sur Android.
- **Moyen terme** : implémenter la voie 1 derrière le Gouverneur Matériel,
  couplée à la PWA. C'est le différenciateur souverain : une IA qui tourne
  dans la poche, sans compte, sans serveur, sans fuite — et sans Termux.
