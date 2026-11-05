# Installable mobile app (plan)

Last updated: 4 November 2026.

AIDUSIA Studio is currently a **PWA** (installable from the browser). This
document outlines a path to an **installable binary** (App Store / Play Store or
sideload) without abandoning the web core.

## Goal

- Keep a **single** React/Vite codebase.
- Preserve COOP/COEP and WebGPU/WebLLM where the OS allows.
- No mandatory account or telemetry.

## Recommended option (phase 1): Capacitor

| Criterion | Capacitor | Tauri mobile |
|---|---|---|
| Mobile maturity 2026 | High (iOS/Android) | Still limited |
| Vite integration | Official `@capacitor/cli` plugin | Separate webview wrapper |
| Team size | One web developer | Rust + web |

**Recommendation:** prototype with **Capacitor 7** wrapping the `dist/` output
from `npm run build`.

### Technical steps

1. `npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios`
2. `npx cap init "AIDUSIA Studio" com.aidusia.studio --web-dir dist`
3. Mirror isolation headers in the WebView (validate COEP on real devices).
4. Useful plugins: `@capacitor/filesystem`, `@capacitor/share`.
5. CI: optional `cap sync` job (non-blocking initially).

### Risks

- **WebGPU / SharedArrayBuffer** on mid-range phones; keep CPU fallback documented.
- **MCP stdio** unavailable in mobile sandboxes; HTTP/SSE MCP only.
- **Store review**: align privacy labels with `PRIVACY.md`.

## Phase 2: Tauri

Consider when mobile support matures, especially if desktop Tauri 2 shares the
same shell. Not priority for the first store release.

## Follow-up deliverables

- [ ] Minimal Capacitor scaffold and npm scripts.
- [ ] Android debug install screenshot.
- [ ] Test matrix: onboarding, local chat, Markdown export.

See also [ia-locale-mobile.md](./ia-locale-mobile.md) and
[mobile-local-path.md](./mobile-local-path.md).
