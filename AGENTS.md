# Consignes pour les agents (AIDUSIA Studio)

Ce fichier **est** versionné : il fixe les règles que les agents doivent
respecter. Il ne contient aucune roadmap ni plan produit.

## Documents Markdown — public vs local

### Peuvent être commités / poussés (doc produit publique)

- `README.md`, `README.en.md`
- `PRIVACY.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- `MENTIONS-LEGALES.md`
- `docs/OLLAMA.md`, `docs/OLLAMA.en.md`
- `docs/deployment-security.md`, `docs/ia-locale-mobile.md`
- `LICENSE` et ce fichier `AGENTS.md`

### Jamais commités, jamais poussés (doc sensible / locale)

Ces fichiers restent **uniquement sur la machine** (ignorés par Git) :

- `ROADMAP.md` et tout `ROADMAP*.md`
- `PLAN-*.md` (ex. `PLAN-UI.md`, `PLAN-UI-HISTORIQUE.md`)
- tout fichier sous `docs/private/`
- tout `*.local.md`

**Interdit** pour un agent :

1. `git add` / `git commit` / `git push` de l’un de ces fichiers
2. Les inclure dans une PR, un release, ou un artefact CI
3. Les référencer depuis un Markdown **public** (README, PRIVACY, etc.) de
   façon à ce qu’un lecteur distant doive les ouvrir
4. Les renommer pour contourner `.gitignore` afin de les versionner

Si un travail s’appuie sur la roadmap ou un plan local : lire le fichier
local, appliquer le travail dans le code / la doc **publique**, sans jamais
versionner le plan lui-même.

## Vérification rapide avant commit

```bash
git status
git check-ignore -v ROADMAP.md PLAN-UI-HISTORIQUE.md
```

Aucun chemin listé en « sensible » ne doit apparaître dans `git status` comme
staged ou « to be committed ». S’il apparaît : `git restore --staged <fichier>`
puis vérifier `.gitignore`.

## Rappel produit

Respecter [PRIVACY.md](./PRIVACY.md), [SECURITY.md](./SECURITY.md) et
[CONTRIBUTING.md](./CONTRIBUTING.md) pour tout changement de comportement,
réseau ou stockage.
