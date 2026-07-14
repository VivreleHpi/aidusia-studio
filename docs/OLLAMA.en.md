# Ollama with AIDUSIA Studio

## Installed does not always mean reachable

AIDUSIA checks the local API at `http://localhost:11434`. Ollama can be installed and running while refusing requests from the deployed site because of its CORS `OLLAMA_ORIGINS` setting.

## Check Ollama on Windows

In PowerShell:

```powershell
Invoke-WebRequest http://localhost:11434/api/version
ollama list
```

The first command should return a JSON version.

Also check that a model is installed:

```powershell
ollama list
ollama pull llama3.2
```

Without a model in `ollama list`, AIDUSIA can reach Ollama but cannot answer yet.

## Allow the deployed site

For `https://aidusia-studio.vercel.app`:

```powershell
setx OLLAMA_ORIGINS "https://aidusia-studio.vercel.app"
```

Fully quit Ollama from the notification-area icon, relaunch it, then click “Retry” in AIDUSIA → Providers.

If you use another domain, replace the value with the exact origin in the address bar, without a trailing path.

## If it still does not work

- Check that Providers → Ollama uses `http://localhost:11434`.
- Check that a model exists with `ollama list`.
- Open AIDUSIA on the same computer as Ollama.
- In local development (`http://localhost`), no remote origin is normally required.
- If the browser still shows `403`, fully quit and relaunch Ollama: `setx` does not change an already-running process.

Ollama remains fully local: messages do not leave your computer when this provider is used.
