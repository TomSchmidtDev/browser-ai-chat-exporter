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

## Key files

| File | Purpose |
|------|---------|
| `shared/utils.js` | `escHtml`, `escAttr`, `escSrcdoc`, `markdownToHtml`, `sanitizeFilename` |
| `shared/widget-css.js` | CSS variables + artifact/visualizer iframe builder |
| `shared/html-template.js` | Export HTML template (copy button, dark mode, syntax highlighting) |
| `platforms/claude/injector.js` | Page-context fetch interceptor for Claude API |
