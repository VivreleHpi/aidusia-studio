# AIDUSIA Studio

🇫🇷 [Version française](./README.md)

Test your AI models — local or cloud — directly in the browser. Nothing
passes through a server of ours, with one documented exception (OpenAI and
Ollama Cloud, below).

![Full AIDUSIA Studio walkthrough](docs/demo.gif)

## Getting started in 60 seconds

Three paths, from simplest to richest — the Studio guides you on first
launch (onboarding wizard), but here's the summary:

1. **The simplest option, zero download**: open "Providers", paste an API
   key (Anthropic, Gemini, Mistral, OpenRouter, OpenAI). It works
   immediately, on desktop as well as mobile.
2. **Free, local AI (desktop)**: install
   [Ollama](https://ollama.com/download), launch it. If you're running the
   Studio locally (`http://localhost:...`), **no extra configuration is
   needed** — Ollama allows `localhost` by default, verified empirically. If
   you're using an instance deployed on a real domain, launch Ollama with
   the `OLLAMA_ORIGINS` variable pointed at that domain (the onboarding
   wizard gives you the exact command to copy).
3. **Mobile, no backend**: the recommended path today is the cloud API key
   (option 1). Local AI *inside* the mobile browser (Gemma 4, WebGPU) is on
   the roadmap — see below — and hasn't shipped yet.

## What this is

- A chat interface that talks **directly, from your browser**, to:
  - **Ollama** running locally on your machine;
  - **local AI in the browser** (WebGPU, "Navigateur (local)" provider):
    quantized Llama 3.2 1B, Qwen 2.5 1.5B or Gemma 2 2B, downloaded once
    from HuggingFace **at your request** then cached — also works on mobile
    (Chrome Android 121+, Safari 26), nothing to install;
  - **Anthropic, Google Gemini, Mistral, OpenRouter, Groq** with your own
    API key (BYOK), in a direct browser → provider connection;
  - **OpenAI** and **Ollama Cloud**, via a small proxy — see "Why a proxy"
    below.
- A **Hardware Governor** that tells the truth about what your machine can
  run (WebGPU, memory, local Ollama — with the actual VRAM in use when
  Ollama is reachable), without ever pretending to know what it can't
  measure.
- **100% local OCR** (WASM, `tesseract.js`, self-hosted — never a CDN):
  extract text from an image directly into the input field. **Honest
  limitation**: Tesseract is built for **printed/typed** text; it's
  fundamentally bad at **handwriting**, no matter what preprocessing you
  throw at it — this isn't a tunable bug, it's the nature of the
  technology.
- **Vision-based image analysis** (image button in the composer, shown only
  when the selected model has real vision capability detected via the
  API — Ollama only for now): sends the image as-is to the model instead of
  extracting text from it. Much better than OCR for a photo, a handwritten
  document, or a complex screenshot.
- **Voice dictation** via the browser's Web Speech API — see the privacy
  notice below, it is **not** guaranteed to be 100% local everywhere.
- Only models actually returned by the provider's API (with your key) show
  up in the list — never a hardcoded catalog.
- **Bilingual interface** French/English (instant, persisted toggle) and
  **dark mode / light mode**.
- **Connectors (MCP)**: plug in remote HTTP tool servers (n8n via its "MCP
  Server Trigger" node, Gmail/Drive/X gateways…) that the model can call
  during the conversation. Fonts, icons, and logos are self-hosted — the
  app makes **no external requests** beyond the AI calls you trigger (and
  local model downloads from HuggingFace, only at your request).
- **Encrypted settings export/import** (AES-GCM + passphrase): move your
  keys and preferences from one device to another as a file, without them
  ever touching a server.
- Conversations and keys stored **only in your browser** (IndexedDB /
  localStorage), never on a server.
- Zero account, zero analytics, zero tracking cookie.

## Roadmap — what's coming will be heavier

The following is **not shipped yet**:

- **Local AI in the browser — v1 shipped** ("Navigateur (local)" provider,
  see above). Still to come: bigger models gated by the Hardware Governor's
  verdict, download resume, and a PWA for cache persistence. See
  [the detailed mobile local-AI write-up](docs/ia-locale-mobile.md) (French),
  including today's alternatives (PC-hosted Ollama over local Wi-Fi, Termux
  on Android).
- **Full settings modal** (profile, appearance, privacy).
- **Installable PWA** on mobile.
- **Vision for the other providers** (Anthropic, Gemini, and OpenAI all
  have vision models) — for now only Ollama is wired up, actually verified
  (image sent, color correctly identified by the model).

These features are more resource-intensive (download, compute) than what
exists today: the goal remains that the user has almost nothing to do to
benefit from them — the onboarding wizard will guide that download when the
time comes, just as it already guides Ollama installation.

## Voice dictation privacy — let's be clear

OCR is 100% local (WASM in your browser, no image is ever sent anywhere).
**Voice dictation, however, is not necessarily so**: it uses the browser's
native Web Speech API, which on Chrome/Edge sends the audio to Google's
servers for recognition. It's the only dictation option that doesn't add a
large WASM model (like Whisper) to the bundle — a pragmatic choice, not an
"all local by default" one. The badge shown while listening is a reminder
of this.

## What this is NOT

- This isn't a finished product in the SaaS sense: no account, no
  multi-device sync, no commercial support in v1.
- This isn't the full AIDUSIA product — this repo is an isolated,
  deliberately minimal building block, extracted to be verifiable by
  anyone.

## Why a proxy for OpenAI and Ollama Cloud (and not the others)?

OpenAI and Ollama Cloud deliberately block (or block by default, without
planning to) direct requests from a browser — verified empirically: neither
returns a CORS header on its actual response, unlike the preflight, which
can be misleading. Anthropic, Gemini, Mistral, and OpenRouter allow direct
browser access and are therefore called without an intermediary.

Each proxy is:

- **stateless** (no data written anywhere);
- **log-free**: no logging of your key or your messages;
- **open-source**, in this same repo (`api/openai/`, `api/ollama-cloud/`) —
  verifiable line by line;
- **replaceable** with your own instance if you'd rather not trust us.

## Status

Under construction (see the issues). Maintained product-style, with the
roadmap tracked separately. PRs are welcome.

## License

GNU AGPL v3 — see [LICENSE](./LICENSE). Use, modify and fork freely — but
any derivative, **including one hosted online (SaaS)**, must publish its
source code under the same license. This is deliberate: what is open must
stay open. The name "AIDUSIA" is a registered trademark; the license covers
the code, not the trademark.

## Local development

```bash
npm install
npm run dev
```
