# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome/Edge Manifest V3 browser extension that exports conversations from Claude, ChatGPT, Gemini, and Microsoft Copilot as HTML, ZIP, Markdown, or PDF files.

## Loading and testing

There is no build step — this is plain JavaScript loaded directly by the browser.

To test changes:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this directory
4. After edits, click the reload icon on the extensions page
5. Reload the target platform tab before testing

## Architecture

The extension has three execution contexts that communicate via message passing:

**Popup** (`popup.html` / `popup.js`) — The toolbar UI. Detects the active platform via `detectPlatform()`, sends `cce:get-chat-data` to the content script, then passes the normalized data model to the chosen exporter.

**Background service worker** (`background.js`) — Handles file downloads (`cce:download`, `cce:download-blob`, `cce:download-and-open`), context menu setup, and opening the preview tab. PDF export uses `cce:download-and-open` to open the file in a new tab for printing.

**Content scripts** (`platforms/<platform>/content.js`) — One per platform, injected at `document_start`. Each responds to `cce:ping` and `cce:get-chat-data` from the popup/background.

### Claude platform specifics

Claude uses a two-layer approach:
- `platforms/claude/injector.js` runs in **page context** (injected via `<script src>`) to intercept the Claude API's `fetch` calls and capture org IDs and auth tokens
- `platforms/claude/content.js` runs in the **isolated world** and bridges messages between the injector (via `window.postMessage`) and the popup (via `chrome.runtime.onMessage`)
- If the API fetch fails or times out, it falls back to DOM scraping

ChatGPT also uses an injector (`platforms/chatgpt/injector.js`). Gemini and Copilot use DOM-only scraping.

### Normalized data model

All platform content scripts normalize their output to a single format before handing it to exporters:

```js
{
  id, title, platform, model, createdAt, updatedAt, source,
  messages: [{
    id, role, createdAt,
    content: [{ type, ...typeSpecificFields }]
  }]
}
```

Content block types: `text`, `code`, `artifact`, `visualizer`, `canvas`, `thinking`, `tool_use`, `tool_result`, `image`, `file`, `file_creation`, `file_edit`, `attachment`, `web_search`, `web_fetch`, `bash`, `mcp_tool`, and others.

### Exporters (`shared/exporters/`)

- `html.js` — Builds a self-contained HTML file; also used for PDF (opens in tab for browser print dialog)
- `markdown.js` — Plain Markdown with fenced code blocks
- `zip.js` — Two-pass: first pass builds artifact/image/file entries, second pass creates the ZIP using `jszip.min.js`

### Preview & Select (`preview.html` / `preview.js`)

Opens in a new tab. Reads chat data from `chrome.storage.session` (`cce_preview_data`). Supports `?autoexport=<format>` query param for direct export triggered by the context menu.

## Adding a new platform

1. Create `platforms/<name>/content.js` — must handle `cce:ping` and `cce:get-chat-data` messages and return the normalized data model
2. Add to `manifest.json`: `content_scripts` entry and `host_permissions`
3. Add to `background.js` → `SUPPORTED_URLS`
4. Add to `popup.js` → `detectPlatform()` and `platformLabel()`
5. Add badge mapping in `shared/exporters/html.js`

## Versioning policy

Version format: `MAJOR.MINOR.BUILD` — defined in both `manifest.json` (`"version"`) and `VERSION`.

| Change type | Version component | Examples |
|-------------|-------------------|---------|
| Breaking change or large new feature | **MAJOR** (`+1.0.0`) | New platform support, redesigned data model |
| New feature | **MINOR** (`+0.1.0`) | New export format, new block type rendered, new UI feature |
| Bug fix or improvement | **BUILD** (`+0.0.1`) | Security fix, rendering fix, performance improvement |

**Rules:**
- Bump the version in **both** `manifest.json` and the `VERSION` file in the same commit as the change.
- Add a changelog entry to `VERSION` in the format: `# X.Y.Z  YYYY-MM-DD  description`
- When MAJOR bumps, reset MINOR and BUILD to 0. When MINOR bumps, reset BUILD to 0.
- Each logical change gets its own bump — do not batch multiple changes into a single bump unless they ship in the same commit.

## Security policies

These policies apply to all code changes in this repository. They were established after a security review (2026-04-04) and must be maintained in future sessions.

### Output HTML / XSS
- **Never inject raw HTML into export output** without sanitization. All content from scraped DOM or API responses must pass through `escHtml()` before being placed in HTML strings. The only exception is artifact `srcdoc` content, which must use `escSrcdoc()` and be placed inside a sandboxed iframe.
- **`javascript:` URLs must be blocked** in all `href` and `src` attributes in exported files. Use a `safeHref(url)` guard that allows only `http:` and `https:` schemes. This applies in `html.js`, `zip.js`, and `utils.js` (`markdownToHtml`).
- **`statusText.innerHTML`** in `popup.js` must not receive unsanitized content script data. Use `textContent` for error strings; use `innerHTML` only for hard-coded markup.

### iframe sandboxing
- Artifact iframes must use `sandbox="allow-scripts"` only. **Never use `allow-same-origin` together with `allow-scripts`** — this breaks sandbox isolation and gives iframe scripts access to the parent document.
- This applies to every `<iframe sandbox=...>` in `html.js`, `zip.js`, and `widget-css.js`.

### postMessage security
- All `window.postMessage` calls must specify the target origin explicitly (`window.location.origin`), never `'*'`.
- The injector↔content-script channel must be protected by a shared nonce (generated by content.js, passed to injector.js via `script.dataset`, validated on both sides). This prevents page scripts from impersonating the content script.

### Background message handler
- `background.js` `onMessage` must validate `sender` before processing `cce:download*` messages. Only accept messages from extension pages (popup, preview).

### fetch-file in injector
- The `fetch-file` handler in `injector.js` must validate that the requested URL matches `https://claude.ai/` before fetching. Arbitrary URLs must be rejected.

### ZIP path traversal
- When building ZIP entries from `file_creation` blocks, normalize paths by splitting on `/`, filtering out `.` and `..` segments, and rejoining. Never use raw `block.path` values directly.

### Permissions (manifest.json)
- The `"tabs"` permission is **not needed** — `"activeTab"` is sufficient. Do not add `"tabs"` back without justification.
- `preview.html` must **not** be listed in `web_accessible_resources`. Keep it extension-internal only.
- `web_accessible_resources` must be minimal: only list files that are actually injected into web pages by content scripts. `jszip.min.js` and `chatgpt/injector.js` must **not** be listed (they are not injected into any web page).
- The manifest must declare an explicit `content_security_policy` for extension pages: `"script-src 'self'; object-src 'self'"`.
- All image `src` attributes set from scraped data must be wrapped in `safeUrl()` before `escAttr()`. `block.base64` (data: URIs produced internally) is exempt.
- All `block.type` or other API-supplied strings placed in `innerHTML` must be wrapped in `escHtml()`.

### Licensing & NOTICE
- Any new bundled dependency (JS file copied into the repo) must be added to the `NOTICE` file with its name, version, copyright, license, and source URL.
- The project license is **Business Source License 1.1** (converts to Apache 2.0 on 2031-04-04). All bundled dependencies must be compatible (MIT, Apache 2.0, BSD, ISC). GPLv3-only code must not be bundled.
- After adding any dependency, run a license check before committing.
- Vendor JS/CSS files (React, ReactDOM, Babel, Tailwind, Recharts, Mermaid) are bundled locally in `shared/vendor/` and inlined into `shared/vendor.js` via `scripts/bundle-vendors.js`. To update a vendor version: replace the file in `shared/vendor/`, re-run `node scripts/bundle-vendors.js`, and update the version in `NOTICE`.

### `sanitizeFilename` — single source of truth
- The canonical implementation lives in `shared/utils.js`. Do not duplicate it in `background.js`, `preview.js`, or elsewhere. Import/reference `shared/utils.js` or copy the exact same function if scoping requires it.

## Key files

| File | Purpose |
|------|---------|
| `shared/utils.js` | `escHtml`, `escAttr`, `escSrcdoc`, `markdownToHtml`, `sanitizeFilename` |
| `shared/widget-css.js` | CSS variables + artifact/visualizer iframe builder |
| `shared/html-template.js` | Export HTML template (copy button, dark mode, syntax highlighting) |
| `platforms/claude/injector.js` | Page-context fetch interceptor for Claude API |
