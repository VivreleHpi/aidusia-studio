# AIDUSIA Studio

🇫🇷 [Version française](./README.md)

AIDUSIA Studio is an open-source web interface for trying local and cloud AI models. It favors browser-side storage and includes no account or built-in analytics. Depending on the feature you choose, data may still be sent to a cloud provider, one of the project's two proxies, an MCP server, or the browser's speech-recognition service.

![Full AIDUSIA Studio walkthrough](docs/demo.gif)

## Quick start

```bash
npm install
npm run dev
```

Then choose a mode:

1. **Local Ollama**: install [Ollama](https://ollama.com/download) and use the Studio on a desktop. From a deployed domain, Ollama must explicitly allow that origin through `OLLAMA_ORIGINS`.
2. **In-browser AI**: select “On-device.” Model weights are downloaded on your request, cached, and run through WebGPU on the device. Support and performance depend on the browser, GPU, memory, and storage, especially on mobile.
3. **Cloud provider**: add your own API key under “Providers.” The provider's pricing, quotas, retention, and terms apply.

## Feature status

| Feature | Status | Where does data go? |
|---|---|---|
| Local Ollama chat | Shipped | To the configured Ollama URL, usually your machine |
| In-browser AI (WebLLM/WebGPU) | Shipped, experimental on mobile | Weights downloaded on request; inference on device |
| Anthropic, Gemini, Mistral, OpenRouter, Groq | Shipped | Direct browser → provider connection |
| OpenAI | Shipped | Through `/api/openai/`, then OpenAI |
| Ollama Cloud | Shipped | Through `/api/ollama-cloud/`, then Ollama Cloud |
| Tesseract OCR | Shipped | Local browser processing |
| Image analysis | Shipped for vision-capable Ollama | Image sent to the configured Ollama instance |
| Web Speech dictation | Shipped when supported by the browser | May use a remote browser/OS speech service |
| HTTP MCP connectors | Shipped, experimental | Requests to configured MCP servers |
| Settings export/import | Shipped | Passphrase-encrypted local file |
| Installable PWA and offline shell | Shipped | Application resources cached locally |
| Offline cloud chat | Not available | A provider connection remains necessary |

API, model, WebGPU, and speech support vary by browser, device, region, and provider. Installing the PWA does not make cloud services available offline.

## Operation and privacy

- Conversations are stored in IndexedDB on this device.
- Keys are held in `sessionStorage` and, by default, also in `localStorage`. Persistent storage can be disabled in the interface.
- The app includes no account, analytics, or advertising cookie.
- Fonts, icons, and OCR files are self-hosted.
- Local browser models are downloaded through the distribution infrastructure used by WebLLM, only when requested.
- Exported settings are encrypted client-side with AES-GCM and a key derived from the passphrase. Security depends on the strength of that passphrase.

“Stored locally” does not mean “never transmitted”: when you send a message to a cloud provider, use dictation, analyze an image with a remote model, or allow an MCP tool, the required data leaves the device. See [PRIVACY.md](./PRIVACY.md).

## MCP connectors: security warning

MCP servers add tools that a model can call during a conversation. Messages, documents, and tool results can contain prompt injection. An MCP server or tool can also be compromised, misleading, or highly privileged.

The current release displays a browser confirmation before every call, including the server, tool, a heuristic risk estimate, and a redacted argument preview. This confirmation does not guarantee the tool's real effect. Only add trusted servers, and use test accounts and least privilege. Local `stdio` servers are unsupported; only remote, CORS-compatible HTTP servers work. See [SECURITY.md](./SECURITY.md).

## Why are there two proxies?

OpenAI and Ollama Cloud calls are not made directly from the browser. Their implementations use `api/openai/` and `api/ollama-cloud/`, respectively. These Edge functions relay the key, method, path, and request content to the matching provider. The repository code does not intentionally persist or log this data.

That code-level property alone cannot guarantee the absence of logs at the hosting platform, network, or final provider. You can audit and self-host the proxies. Other supported providers are called directly from the browser.

## Known limitations

- In-browser AI may download hundreds of megabytes or more and can fail on resource-constrained devices.
- Tesseract targets printed text and generally performs poorly on handwriting.
- Image analysis is currently wired only for Ollama.
- There is no multi-device synchronization, account, or guaranteed commercial support.
- MCP should be treated as experimental: per-action confirmation exists, but risk classification is heuristic and there is no fine-grained persistent permission policy.

## Quality and contributing

Commands currently available:

```bash
npm run lint
npm test
npm run smoke
npm run build
npm run leak-scan
npm run e2e
```

Unit, smoke, and E2E/accessibility tests are integrated into CI. E2E tests require the Playwright browser (`npx playwright install chromium`). See [CONTRIBUTING.md](./CONTRIBUTING.md) and [CHANGELOG.md](./CHANGELOG.md).

## Security

Never publish a key, token, settings export, or conversation in an issue. Follow the reporting process in [SECURITY.md](./SECURITY.md) for vulnerabilities.

## License

GNU AGPL v3 — see [LICENSE](./LICENSE). Code licensing and trademark rights are separate; the repository license does not automatically grant rights to the “AIDUSIA” name.
