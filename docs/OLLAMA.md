# Ollama avec AIDUSIA Studio

## Installation ne veut pas dire accès navigateur

AIDUSIA vérifie l'API locale `http://localhost:11434`. Ollama peut être installé et lancé dans le terminal tout en refusant les requêtes du site déployé : c'est une règle CORS contrôlée par `OLLAMA_ORIGINS`.

## Vérifier Ollama sur Windows

Dans PowerShell :

```powershell
Invoke-WebRequest http://localhost:11434/api/version
ollama list
```

La première commande doit répondre avec une version JSON.

Vérifiez aussi qu'un modèle est installé :

```powershell
ollama list
ollama pull llama3.2
```

Sans modèle dans `ollama list`, AIDUSIA peut joindre Ollama mais ne peut pas encore répondre.

## Autoriser le site déployé

Pour `https://aidusia-studio.vercel.app` :

```powershell
setx OLLAMA_ORIGINS "https://aidusia-studio.vercel.app"
```

Quittez ensuite complètement Ollama depuis l'icône de la zone de notification, relancez-le, puis cliquez sur « Réessayer » dans AIDUSIA → Fournisseurs.

Si vous utilisez un autre domaine, remplacez la valeur par l'origine exacte affichée dans la barre d'adresse, sans chemin final.

## Si cela ne fonctionne toujours pas

- Vérifiez que l'URL dans Fournisseurs → Ollama est `http://localhost:11434`.
- Vérifiez qu'un modèle existe avec `ollama list`.
- Ouvrez AIDUSIA sur le même ordinateur qu'Ollama.
- En développement local (`http://localhost`), aucune origine distante n'est normalement nécessaire.
- Si le navigateur affiche encore `403`, quittez et relancez réellement Ollama : `setx` ne modifie pas le processus déjà ouvert.

Ollama reste entièrement local : les messages ne quittent pas votre ordinateur quand ce fournisseur est utilisé.
