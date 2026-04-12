/**
 * AI Chat Exporter - Background Service Worker
 *
 * Handles:
 * - File downloads via chrome.downloads API
 * - Context menu entries for direct export from right-click
 * - Opening preview tab
 */

// ── Supported platforms ────────────────────────────────────────────────────
const SUPPORTED_URLS = [
  'https://claude.ai/*',
  'https://chatgpt.com/*',
  'https://chat.openai.com/*',
  'https://gemini.google.com/*',
  'https://m365.cloud.microsoft/*'
];

// ── Context menu setup ─────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  // Remove all existing items first (clean reinstall)
  chrome.contextMenus.removeAll(() => {
    // Root entry (shows as submenu)
    chrome.contextMenus.create({
      id: 'cce-root',
      title: 'Chat exportieren',
      contexts: ['page'],
      documentUrlPatterns: SUPPORTED_URLS
    });

    const formats = [
      { id: 'cce-html',     title: '📄 Als HTML exportieren' },
      { id: 'cce-markdown', title: '📝 Als Markdown exportieren' },
      { id: 'cce-zip',      title: '📦 Als ZIP exportieren' },
      { id: 'cce-pdf',      title: '🖨️ Als PDF exportieren' },
    ];

    for (const fmt of formats) {
      chrome.contextMenus.create({
        id: fmt.id,
        parentId: 'cce-root',
        title: fmt.title,
        contexts: ['page'],
        documentUrlPatterns: SUPPORTED_URLS
      });
    }

    // Separator
    chrome.contextMenus.create({
      id: 'cce-sep',
      parentId: 'cce-root',
      type: 'separator',
      contexts: ['page'],
      documentUrlPatterns: SUPPORTED_URLS
    });

    chrome.contextMenus.create({
      id: 'cce-preview',
      parentId: 'cce-root',
      title: '📋 Preview & Select…',
      contexts: ['page'],
      documentUrlPatterns: SUPPORTED_URLS
    });
  });
});

// ── Context menu click handler ─────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const id = info.menuItemId;
  if (!id.startsWith('cce-') || id === 'cce-root' || id === 'cce-sep') return;

  const format = id.replace('cce-', ''); // 'html' | 'markdown' | 'zip' | 'pdf' | 'preview'

  try {
    // Ask the content script for the chat data
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'cce:get-chat-data' });

    if (!response?.ok) {
      console.error('[CCE:Background] Context menu export failed:', response?.error);
      return;
    }

    // Store chat data in session storage — preview.html reads it from there
    await chrome.storage.session.set({ cce_preview_data: response.data });

    // Open preview.html; append ?autoexport=<format> for direct export
    const previewUrl = chrome.runtime.getURL('preview.html')
      + (format !== 'preview' ? `?autoexport=${format}` : '');
    chrome.tabs.create({ url: previewUrl });

  } catch (err) {
    console.error('[CCE:Background] Context menu error:', err);
  }
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'cce:download') {
    const { filename, content, mimeType } = message;

    // Create a data URL for download
    const blob = new Blob([content], { type: mimeType || 'text/plain' });
    const reader = new FileReader();
    reader.onload = () => {
      chrome.downloads.download({
        url: reader.result,
        filename: sanitizeFilename(filename),
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true, downloadId });
        }
      });
    };
    reader.onerror = () => sendResponse({ ok: false, error: 'Failed to read blob' });
    reader.readAsDataURL(blob);
    return true; // async
  }

  if (message.type === 'cce:download-blob') {
    const { filename, base64Data, mimeType } = message;

    chrome.downloads.download({
      url: base64Data,
      filename: sanitizeFilename(filename),
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ ok: true, downloadId });
      }
    });
    return true;
  }

  // Download a file AND open it in a new tab (used for PDF export)
  if (message.type === 'cce:download-and-open') {
    const { filename, content, mimeType } = message;
    const blob = new Blob([content], { type: mimeType || 'text/html' });
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      // Open in a new tab — data: URLs work in chrome.tabs.create
      chrome.tabs.create({ url: dataUrl }, (tab) => {
        if (chrome.runtime.lastError) {
          // Fallback: just download the file
          chrome.downloads.download({
            url: dataUrl,
            filename: sanitizeFilename(filename),
            saveAs: false
          }, (downloadId) => {
            sendResponse({ ok: !chrome.runtime.lastError, downloadId });
          });
        } else {
          sendResponse({ ok: true, tabId: tab.id });
        }
      });
    };
    reader.onerror = () => sendResponse({ ok: false, error: 'FileReader failed' });
    reader.readAsDataURL(blob);
    return true;
  }
});

// Canonical implementation — must stay identical to shared/utils.js sanitizeFilename
function sanitizeFilename(name) {
  return (name || 'export')
    .replace(/[^a-zA-Z0-9äöüÄÖÜß _\-\.]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 80);
}
