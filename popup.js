/**
 * AI Chat Exporter – Popup Orchestration
 *
 * Platform-agnostic UI. Detects which platform the active tab belongs to,
 * sends a unified 'cce:get-chat-data' message to the right content script,
 * then hands the normalised data model to the chosen exporter.
 *
 * All rendering/export logic lives in shared/exporters/*.js and shared/*.js.
 */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────
  let selectedFormat = 'html';
  let chatData       = null;
  let isExporting    = false;
  let activePlatform = null; // 'claude' | 'chatgpt' | null

  // ── DOM refs ───────────────────────────────────────────────────────────
  const $ = s => document.querySelector(s);
  const statusDot    = $('#statusDot');
  const statusText   = $('#statusText');
  const chatInfo     = $('#chatInfo');
  const chatTitle    = $('#chatTitle');
  const chatMeta     = $('#chatMeta');
  const exportSection = $('#exportSection');
  const exportBtn    = $('#exportBtn');
  const previewBtn   = $('#previewBtn');
  const progress     = $('#progress');
  const progressFill = $('#progressFill');
  const progressText = $('#progressText');
  const logSection   = $('#logSection');
  const logContent   = $('#logContent');
  const errorEl      = $('#error');
  const errorText    = $('#errorText');

  // ── Format buttons ─────────────────────────────────────────────────────
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFormat = btn.dataset.format;
    });
  });

  // ── Log toggle ─────────────────────────────────────────────────────────
  $('#logToggle').addEventListener('click', () => logContent.classList.toggle('hidden'));

  // ── Platform list links ────────────────────────────────────────────────
  document.querySelectorAll('.platform-row').forEach(btn => {
    btn.addEventListener('click', () => {
      chrome.tabs.create({ url: btn.dataset.url });
    });
  });

  // ── Settings button ────────────────────────────────────────────────────
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // ── Helpers ────────────────────────────────────────────────────────────
  function setStatus(type, text) {
    statusDot.className = 'status-dot ' + type;
    statusText.textContent = text;
  }

  function setProgress(pct, text) {
    progressFill.style.width = pct + '%';
    progressText.textContent = text;
    progress.classList.remove('hidden');
  }

  function showError(msg) {
    errorEl.classList.remove('hidden');
    errorText.textContent = msg;
  }

  function log_(level, msg) {
    const row = document.createElement('div');
    row.className = 'log-entry log-' + level;
    row.textContent = `[${level.toUpperCase()}] ${msg}`;
    logContent.appendChild(row);
    logSection.classList.remove('hidden');
  }

  function resetButton() {
    exportBtn.disabled = false;
    exportBtn.classList.remove('exporting');
    exportBtn.querySelector('span').textContent = t('exportChat');
  }

  // ── Platform detection ─────────────────────────────────────────────────
  function detectPlatform(url) {
    if (!url) return null;
    if (url.includes('claude.ai'))   return 'claude';
    if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) return 'chatgpt';
    if (url.includes('gemini.google.com')) return 'gemini';
    if (url.includes('m365.cloud.microsoft') || url.includes('copilot.microsoft.com')) return 'copilot';
    return null;
  }

  function platformLabel(platform) {
    return platform === 'claude'   ? '🔶 Claude'
         : platform === 'chatgpt'  ? '🟢 ChatGPT'
         : platform === 'gemini'   ? '🔵 Gemini'
         : platform === 'copilot'  ? '🪟 Copilot'
         : platform || 'Unknown';
  }

  // ── Download a result object via background script ─────────────────────
  async function downloadResult(result, title) {
    const filename = sanitizeFilename(title || 'chat') + '_' + new Date().toISOString().slice(0, 10) + '.' + result.extension;

    // PDF: open in new tab so the print dialog fires automatically
    if (result.openInTab) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type:     'cce:download-and-open',
          filename,
          content:  result.content,
          mimeType: result.mimeType
        }, (resp) => {
          if (resp?.ok) resolve();
          else reject(new Error(resp?.error || 'Could not open PDF preview'));
        });
      });
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type:     'cce:download',
        filename,
        content:  result.content,
        mimeType: result.mimeType
      }, (resp) => {
        if (resp?.ok) { resolve(); return; }
        // Fallback: blob URL
        try {
          const blob = new Blob([result.content], { type: result.mimeType });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href = url; a.download = filename; a.click();
          URL.revokeObjectURL(url);
          resolve();
        } catch (e) {
          reject(new Error('Download failed: ' + (resp?.error || e.message)));
        }
      });
    });
  }

  // ── Get export stats for logging ───────────────────────────────────────
  function getExportStats(data) {
    const s = { text:0, artifacts:0, images:0, files:0, tools:0, canvases:0 };
    for (const msg of (data.messages || [])) {
      for (const b of (msg.content || [])) {
        if (b.type === 'text')         s.text++;
        else if (b.type === 'artifact' || b.type === 'visualizer') s.artifacts++;
        else if (b.type === 'canvas')  s.canvases++;
        else if (b.type === 'image')   s.images++;
        else if (b.type === 'file' || b.type === 'file_creation') s.files++;
        else s.tools++;
      }
    }
    return s;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Initialisation: ping content script ───────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  async function init() {
    await initI18n();
    applyI18n();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) { setStatus('error', t('noActiveTab')); return; }

      activePlatform = detectPlatform(tab.url);
      if (!activePlatform) {
        setStatus('warn', t('noSupportedTab'));
        document.getElementById('platformList').classList.remove('hidden');
        return;
      }

      setStatus('connecting', t('connecting', platformLabel(activePlatform)));

      const resp = await new Promise(resolve =>
        chrome.tabs.sendMessage(tab.id, { type: 'cce:ping' }, r => resolve(r))
      );

      if (!resp?.ok) {
        setStatus('error', t('contentScriptNotReady'));
        return;
      }

      setStatus('connected', t('ready', platformLabel(activePlatform)));

      // Fetch chat data for preview
      const dataResp = await new Promise(resolve =>
        chrome.tabs.sendMessage(tab.id, { type: 'cce:get-chat-data' }, r => resolve(r))
      );

      if (!dataResp?.ok) {
        setStatus('warn', t('connected', dataResp?.error || t('couldNotLoadPreview')));
        exportSection.classList.remove('hidden');
        return;
      }

      chatData = dataResp.data;

      // Show preview
      chatTitle.textContent = chatData.title || 'Untitled';
      const msgCount  = chatData.messages?.length || 0;
      const artCount  = chatData.messages?.flatMap(m => m.content).filter(b => ['artifact','canvas','visualizer'].includes(b.type)).length || 0;
      chatMeta.textContent = `${platformLabel(activePlatform)} · ${chatData.model || t('unknownModel')} · ${msgCount} ${t('messages')} · ${artCount} ${t('artifacts')}`;

      chatInfo.classList.remove('hidden');
      exportSection.classList.remove('hidden');

    } catch (err) {
      setStatus('error', err.message);
      log_('err', err.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Export ────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  exportBtn.addEventListener('click', async () => {
    if (isExporting) return;
    isExporting = true;
    exportBtn.disabled = true;
    exportBtn.classList.add('exporting');
    exportBtn.querySelector('span').textContent = t('exporting');
    errorEl.classList.add('hidden');
    logContent.textContent = '';
    setProgress(0, t('starting'));

    try {
      // If we have no cached data (e.g. preview failed), fetch now
      if (!chatData) {
        setProgress(10, t('fetchingChatData'));
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const resp  = await new Promise(resolve =>
          chrome.tabs.sendMessage(tab.id, { type: 'cce:get-chat-data' }, r => resolve(r))
        );
        if (!resp?.ok) throw new Error(resp?.error || 'Failed to fetch chat data');
        chatData = resp.data;
      }

      log_('info', `Platform: ${platformLabel(chatData.platform || activePlatform)}`);
      log_('info', `Model: ${chatData.model || 'unknown'}`);
      log_('info', `Messages: ${chatData.messages?.length || 0}`);
      log_('info', `Starting export as ${selectedFormat.toUpperCase()}`);

      const options = {
        includeArtifacts: $('#optArtifacts').checked,
        includeImages:    $('#optImages').checked,
        includeThinking:  $('#optThinking').checked,
        includeToolUse:   $('#optToolUse').checked,
        includeFiles:     $('#optFiles').checked,
      };

      setProgress(40, t('generating', selectedFormat.toUpperCase()));

      let result;
      switch (selectedFormat) {
        case 'markdown': result = exportMarkdown(chatData, options); break;
        case 'html':     result = exportHtml(chatData, options);     break;
        case 'pdf':      result = exportPdf(chatData, options);      break;
        case 'zip':      result = await exportZip(chatData, options); break;
        default: throw new Error(`Unknown format: ${selectedFormat}`);
      }

      setProgress(85, t('preparingDownload'));
      if (!result.skipDownload) {
        await downloadResult(result, chatData.title);
      }

      const stats  = getExportStats(chatData);
      const sizeKB = Math.round((result.sizeBytes ?? result.content?.length ?? 0) / 1024);
      log_('ok', `Export complete: ${selectedFormat.toUpperCase()} (${sizeKB} KB)`);
      log_('info', `Stats: ${stats.text} text, ${stats.artifacts} artifacts, ${stats.canvases} canvases, ${stats.images} images, ${stats.files} files, ${stats.tools} tools`);

      const doneLabel = selectedFormat === 'pdf' ? t('pdfReady')
                      : selectedFormat === 'zip' ? t('zipReady')
                      : t('exportComplete');
      setProgress(100, doneLabel);
      log_('ok', doneLabel);

      setTimeout(() => { progress.classList.add('hidden'); resetButton(); }, 1500);

    } catch (err) {
      console.error('[CCE] Export error:', err);
      log_('err', 'Export failed: ' + err.message);
      showError(err.message);
      progress.classList.add('hidden');
      resetButton();
    }

    isExporting = false;
  });

  // ── Preview & Select ───────────────────────────────────────────────────

  previewBtn.addEventListener('click', async () => {
    if (!chatData) {
      showError(t('noDataLoaded'));
      return;
    }
    previewBtn.disabled = true;
    previewBtn.querySelector('span').textContent = t('opening');
    try {
      // Store chat data in session storage so the preview page can read it
      await chrome.storage.session.set({ cce_preview_data: chatData });
      const url = chrome.runtime.getURL('preview.html');
      chrome.tabs.create({ url });
    } catch (err) {
      showError(t('couldNotOpenPreview', err.message));
    } finally {
      previewBtn.disabled = false;
      previewBtn.querySelector('span').textContent = t('previewAndSelect');
    }
  });

  // ── Start ──────────────────────────────────────────────────────────────
  init();

})();
