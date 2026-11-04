# Pont MCP stdio → HTTP (AIDUSIA Studio)

AIDUSIA ne lance **pas** de processus `stdio` dans le navigateur. Les connecteurs MCP du Studio acceptent uniquement des serveurs **HTTP distants** compatibles CORS (Streamable HTTP / SSE), comme documenté dans [SECURITY.md](../SECURITY.md).

## Pourquoi

- Un serveur MCP `stdio` suppose un sous-processus local (`npx`, binaire…) : impossible depuis une PWA sans backend.
- Les secrets MCP restent en `sessionStorage` ; un pont local doit tourner **sur la machine de l'utilisateur**, pas sur l'hébergeur Vercel.

## Schéma recommandé

```text
[MCP stdio server] ←→ [pont local HTTP] ←→ [AIDUSIA Studio (navigateur)]
     npx …              127.0.0.1:PORT          CORS + confirmation
```

## Options de pont (hors dépôt)

1. **[mcporter](https://github.com/modelcontextprotocol/mcporter)** ou **[mcpo](https://github.com/open-webui/mcpo)** — expose un serveur stdio en OpenAPI/HTTP local.
2. **Proxy Streamable HTTP** minimal (Node) utilisant le SDK `@modelcontextprotocol/sdk` en mode `StdioClientTransport` côté machine et `StreamableHTTPServerTransport` sur `localhost`.

## Configuration dans AIDUSIA

1. Lancez le pont sur `http://127.0.0.1:<port>/mcp` (HTTPS inutile en boucle locale).
2. **Connecteurs MCP** → URL du pont → test → enregistrer.
3. Définissez des **politiques par outil** (Lot D) : autoriser / demander / refuser.

## Sécurité

- N'exposez le pont **que** sur la boucle locale (`127.0.0.1`), sauf si vous comprenez les risques réseau.
- Chaque appel d'outil reste soumis à la **confirmation** utilisateur (sauf politique « autoriser » explicite).
- Consultez le **journal MCP** local pour auditer les décisions.

## Limites

- Pas de support stdio natif prévu dans l'app.
- CORS : le pont doit renvoyer les en-têtes adaptés à l'origine du Studio (local ou domaine déployé).
