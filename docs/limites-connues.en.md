# Known limitations (AIDUSIA Studio)

Reference document grouping product limits by **feature / delivery lot**, with workarounds and follow-up ideas. Detailed notes remain in linked docs.

🇫🇷 [Version française](./limites-connues.md)

---

## Lot A — Local RAG

| Limitation | Workaround / follow-up |
|------------|-------------------------|
| Scanned PDFs without text layer | OCR in the composer or preprocess the PDF. |
| Hash embedding fallback | Wait for `@xenova/transformers` to load; re-import if needed. |
| One active document space per conversation | Switch space in the composer selector. |
| Data export without full RAG index | Keep source files; re-import in **Documents**. |

→ [docs/rag.md](./rag.md)

---

## Lot B — Mobile on-device AI path

| Limitation | Workaround / follow-up |
|------------|-------------------------|
| Missing or unstable WebGPU | Portable Qwen 0.5B, LAN Ollama, or cloud. |
| Heavy models on phones | ≤2B models or heed ⚠ in the model menu. |
| Large downloads | Wi‑Fi; install PWA for persistent cache. |

→ [docs/mobile-local-path.md](./mobile-local-path.md), [docs/ia-locale-mobile.md](./ia-locale-mobile.md)

---

## Lot C — Export & history search

| Limitation | Workaround / follow-up |
|------------|-------------------------|
| MCP tool messages omitted from Markdown export | Copy from chat or share a single response. |
| PDF via print dialog | Use “Save as PDF” in the browser. |
| Simple substring search | Use keywords in title or body. |

→ [docs/conversation-export.md](./conversation-export.md)

---

## Lot D — Hardened MCP

| Limitation | Workaround / follow-up |
|------------|-------------------------|
| No in-browser MCP stdio | Local HTTP bridge: [docs/mcp-stdio-bridge.md](./mcp-stdio-bridge.md). |
| CORS required | Configure server or bridge. |
| Heuristic risk class | Deny or ask policies; local journal. |
| MCP session tokens not in Data export | Reconnect connectors after migration. |

→ [SECURITY.md](../SECURITY.md)

---

## Lot E — Local OpenAI-compatible API

| Limitation | Workaround / follow-up |
|------------|-------------------------|
| localhost CORS | Configure LM Studio / Jan / proxy. |
| Two Ollama paths (`/api/chat` vs `/v1`) | Native **Ollama (local)** provider for tools + Ollama vision. |

→ [docs/local-openai-compatible.md](./local-openai-compatible.md)

---

## Lot F — Multi-provider vision

| Limitation | Workaround / follow-up |
|------------|-------------------------|
| No vision on WebLLM / portable Qwen | Ollama vision, cloud, or OCR. |
| JPEG payload for cloud APIs | Accept compression or use OCR for text. |
| Sometimes heuristic `visionCapable` | Pick an explicitly vision model id. |

→ [docs/vision-multimodal.md](./vision-multimodal.md)

---

## Local AI hub & catalog

| Limitation | Workaround / follow-up |
|------------|-------------------------|
| Catalog compatibility is indicative | Measure on device; hub + Providers. |
| Weekly sync / auto PR optional | GitHub Actions permissions; manual sync. |
| Hub does not download models | Model menu or Providers. |

→ [docs/local-ai-hub.md](./local-ai-hub.md), [docs/local-ai-catalog.md](./local-ai-catalog.md)

---

## Cross-cutting

| Topic | Limitation | Workaround / follow-up |
|-------|------------|-------------------------|
| Tesseract OCR | Printed text | Cloud/Ollama vision for handwriting. |
| Dictation | Browser speech service (often cloud) | Type instead. |
| OpenAI / Ollama Cloud | Stateless Edge proxy | Self-host proxies ([README](../README.en.md)). |
| Multi-device sync | Not provided | Manual Data / encrypted settings export. |
| Public hosting | Documented proxy limits | [docs/deployment-security.md](./deployment-security.md). |

---

## Report a gap

If a limitation blocks you and is not listed here, open an issue **without** API keys or conversation exports.
