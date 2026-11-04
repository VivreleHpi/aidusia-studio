# Data subject rights (GDPR) — AIDUSIA Studio

Last updated: 4 November 2026.

This document supplements [PRIVACY.md](../PRIVACY.md). It explains how users
can exercise their rights when running the app as shipped in this repository
(PWA or local build), **without an AIDUSIA account**.

## Controller role

AIDUSIA Studio is a browser client. The repository publisher does not receive
conversations, API keys, or imported files unless the user voluntarily sends
data to a remote provider, MCP server, or model download infrastructure.

On a public deployment (e.g. Vercel), the host may log requests to documented
Edge proxies ([deployment-security.md](./deployment-security.md)). Chat content
then flows to the provider chosen by the user, who acts as controller for that
cloud processing.

## Data categories

| Category | Location | Purpose |
|---|---|---|
| Conversations, attachments | IndexedDB | Local use |
| RAG spaces (chunks, embeddings) | IndexedDB | Local retrieval |
| API keys, preferences | sessionStorage / localStorage | Configuration |
| MCP journal (call previews) | localStorage | Local transparency |
| Encrypted settings export | User-selected file | Backup |

No marketing telemetry or advertising cookies are built into this repository.

## Exercising rights (local tool)

| Right | In-app action |
|---|---|
| **Access** | Export conversations (Markdown/PDF) and settings from dedicated panels |
| **Rectification** | Edit messages and settings in the UI |
| **Erasure** | Delete conversations, RAG spaces, or use “Erase all data” in settings |
| **Restriction** | Deny MCP tools, disable remote providers, use fully local models |
| **Portability** | Markdown files, encrypted settings export (JSON) |
| **Objection** | Do not configure remote providers; refuse MCP confirmations |

For data already sent to a third-party provider, contact that provider under
their policy.

## Retention

Local data remains until the user deletes it or clears site data in the browser.
The application code does not enforce a retention period.

## Contact

For self-hosted instances, the controller is the entity operating the
deployment. For the open-source project, open a GitHub issue to report
documentation errors (do not paste personal data).
