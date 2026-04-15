/**
 * AI Chat Exporter – HTML & PDF Exporters
 * Depends on: shared/utils.js, shared/widget-css.js, shared/html-template.js
 */

// ── Shared message renderer ────────────────────────────────────────────────
// Returns messagesHtml + artifactCounter.
// Used by both HTML and ZIP exporters so logic lives in one place.

function renderMessagesToHtml(data, options, artifactUrlResolver) {
  // artifactUrlResolver(block, filename) → the iframe src to use
  // For HTML export: returns null → use srcdoc
  // For ZIP export:  returns the relative filename → use src

  let messagesHtml  = '';
  let artifactCounter = 0;
  let hasMermaid = false;

  for (const msg of data.messages) {
    const isUser   = msg.role === 'user';
    const roleClass = isUser ? 'user' : 'assistant';
    const roleLabel = isUser ? t('roleUser') : t('roleAssistant');
    let contentHtml = '';

    for (const block of (msg.content || [])) {
      switch (block.type) {

        // ── Text / code ─────────────────────────────────────────────────
        case 'text': {
          const textHtml = markdownToHtml(block.text);
          if (textHtml.includes('<div class="mermaid">')) hasMermaid = true;
          contentHtml += `<div class="text-block">${textHtml}</div>`;
          break;
        }

        case 'html':
          // Raw HTML block (e.g. tables passed through from ChatGPT DOM)
          contentHtml += `<div class="html-block">${sanitizeHtmlBlock(block.html)}</div>`;
          break;

        case 'code': {
          if (block.language && block.language.toLowerCase() === 'mermaid') {
            const mermaidHtml = buildRunnableArtifact({ artifactType: 'application/vnd.ant.mermaid', sourceCode: block.code });
            contentHtml += `<div class="artifact-block"><div class="artifact-header"><span class="artifact-icon">📊</span><span class="artifact-title">Mermaid Diagram</span></div><div class="artifact-preview"><iframe srcdoc="${escSrcdoc(mermaidHtml)}" sandbox="allow-scripts" loading="lazy"></iframe></div></div>`;
          } else {
            const langClass = block.language ? ` class="language-${escAttr(block.language)}"` : '';
            contentHtml += `<div class="code-block"><div class="code-header"><div class="code-header-left"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>${escHtml(block.language || '')}</div><button class="copy-btn" type="button"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg><span class="copy-label">Copy</span></button></div><pre><code${langClass}>${escHtml(block.code)}</code></pre></div>`;
          }
          break;
        }

        // ── Claude artifacts ─────────────────────────────────────────────
        case 'artifact': {
          if (!options.includeArtifacts) break;
          artifactCounter++;
          const artHtml = buildRunnableArtifact(block);
          const resolved = artifactUrlResolver
            ? artifactUrlResolver(block, artifactCounter, artHtml)
            : null;

          let iframeTag;
          if (resolved) {
            iframeTag = `<iframe src="${resolved}" sandbox="allow-scripts" loading="lazy"></iframe>`;
          } else {
            iframeTag = `<iframe srcdoc="${escSrcdoc(artHtml)}" sandbox="allow-scripts" loading="lazy"></iframe>`;
          }

          contentHtml += `<div class="artifact-block">
            <div class="artifact-header">
              <span class="artifact-icon">📦</span>
              <span class="artifact-title">${escHtml(block.title || 'Artifact')}</span>
              <span class="artifact-type">${escHtml(block.artifactType || '')}</span>
            </div>
            <div class="artifact-preview">${iframeTag}</div>
            ${resolved ? `<div class="artifact-link"><a href="${resolved}" target="_blank">↗ Open artifact</a></div>` : `<details class="artifact-source"><summary>View Source</summary><pre><code>${escHtml(block.sourceCode || '')}</code></pre></details>`}
          </div>`;
          break;
        }

        // ── ChatGPT canvas ───────────────────────────────────────────────
        case 'canvas': {
          if (!options.includeArtifacts) break;
          artifactCounter++;
          const cvHtml = buildCanvasHtml(block);
          const resolved = artifactUrlResolver
            ? artifactUrlResolver(block, artifactCounter, cvHtml)
            : null;

          let iframeTag;
          if (resolved) {
            iframeTag = `<iframe src="${resolved}" sandbox="allow-scripts" loading="lazy"></iframe>`;
          } else {
            iframeTag = `<iframe srcdoc="${escSrcdoc(cvHtml)}" sandbox="allow-scripts" loading="lazy"></iframe>`;
          }

          contentHtml += `<div class="artifact-block">
            <div class="artifact-header">
              <span class="artifact-icon">🎨</span>
              <span class="artifact-title">${escHtml(block.name || 'Canvas')}</span>
              <span class="artifact-type">${escHtml(block.canvasType || '')}</span>
            </div>
            <div class="artifact-preview">${iframeTag}</div>
            ${resolved ? `<div class="artifact-link"><a href="${resolved}" target="_blank">↗ Open canvas</a></div>` : `<details class="artifact-source"><summary>View Source</summary><pre><code>${escHtml(block.content || '')}</code></pre></details>`}
          </div>`;
          break;
        }

        // ── Claude visualizer ────────────────────────────────────────────
        case 'visualizer': {
          if (!options.includeArtifacts) break;
          artifactCounter++;
          const vizHtml = buildVisualizerHtml(block);
          const resolved = artifactUrlResolver
            ? artifactUrlResolver(block, artifactCounter, vizHtml)
            : null;

          let iframeTag;
          if (resolved) {
            iframeTag = `<iframe src="${resolved}" sandbox="allow-scripts" loading="lazy"></iframe>`;
          } else {
            iframeTag = `<iframe srcdoc="${escSrcdoc(vizHtml)}" sandbox="allow-scripts" loading="lazy"></iframe>`;
          }

          contentHtml += `<div class="artifact-block">
            <div class="artifact-header">
              <span class="artifact-icon">🎨</span>
              <span class="artifact-title">${escHtml(block.title || 'Visualization')}</span>
            </div>
            <div class="artifact-preview">${iframeTag}</div>
            ${resolved ? `<div class="artifact-link"><a href="${resolved}" target="_blank">↗ Open visualization</a></div>` : `<details class="artifact-source"><summary>View Source</summary><pre><code>${escHtml(block.code || '')}</code></pre></details>`}
          </div>`;
          break;
        }

        // ── Images ───────────────────────────────────────────────────────
        case 'image': {
          if (!options.includeImages) break;
          const imgSrc = block.base64 || (block.src ? safeUrl(block.src) : '');
          if (imgSrc && imgSrc !== '#') contentHtml += `<div class="image-block"><img src="${escAttr(imgSrc)}" alt="${escAttr(block.alt || '')}" loading="lazy"></div>`;
          break;
        }

        // ── Files ────────────────────────────────────────────────────────
        case 'attachment':
          contentHtml += `<div class="attachment-block">📎 <strong>${escHtml(block.fileName)}</strong> <span class="file-size">(${formatFileSize(block.fileSize)})</span></div>`;
          break;

        case 'file':
        case 'file_creation':
          if (!options.includeFiles) break;
          contentHtml += `<div class="file-block"><div class="file-header">📄 ${escHtml(block.path || block.fileName || 'file')}</div>${block.description ? `<div class="tool-desc">${escHtml(block.description)}</div>` : ''}${block.content ? `<pre><code>${escHtml(block.content.substring(0, 2000))}${block.content.length > 2000 ? '\n…' : ''}</code></pre>` : ''}</div>`;
          break;

        case 'present_files':
          if (!options.includeFiles) break;
          contentHtml += `<div class="file-block"><div class="file-header">📁 Files presented</div><ul>${(block.paths || []).map(p => `<li>${escHtml(p)}</li>`).join('')}</ul></div>`;
          break;

        // ── Tools ────────────────────────────────────────────────────────
        case 'thinking':
          if (!options.includeThinking) break;
          contentHtml += `<details class="thinking-block"><summary>💭 Thinking</summary><div class="thinking-content">${escHtml(block.text || '')}</div></details>`;
          break;

        case 'bash':
          if (!options.includeToolUse) break;
          contentHtml += `<div class="tool-block"><div class="tool-header">🖥️ Bash</div><pre><code>${escHtml(block.command || '')}</code></pre>${block.description ? `<div class="tool-desc">${escHtml(block.description)}</div>` : ''}</div>`;
          break;

        case 'web_search':
          if (!options.includeToolUse) break;
          contentHtml += `<div class="tool-block search"><div class="tool-header">🔍 Search: ${escHtml(block.query)}</div></div>`;
          break;

        case 'web_fetch':
          if (!options.includeToolUse) break;
          contentHtml += `<div class="tool-block"><div class="tool-header">🌐 Fetch: <a href="${escAttr(safeUrl(block.url))}" target="_blank" rel="noopener">${escHtml(block.url)}</a></div></div>`;
          break;

        case 'image_search':
          if (!options.includeToolUse) break;
          contentHtml += `<div class="tool-block"><div class="tool-header">🖼️ Image Search: ${escHtml(block.query)}</div></div>`;
          break;

        case 'file_edit':
          if (!options.includeToolUse) break;
          contentHtml += `<div class="tool-block"><div class="tool-header">✏️ Edit: ${escHtml(block.path)}</div>${block.description ? `<div class="tool-desc">${escHtml(block.description)}</div>` : ''}</div>`;
          break;

        case 'file_view':
          if (!options.includeToolUse) break;
          contentHtml += `<div class="tool-block"><div class="tool-header">👁️ View: ${escHtml(block.path)}</div></div>`;
          break;

        case 'tool_result':
          if (!options.includeToolUse) break;
          contentHtml += `<div class="tool-result-block"><div class="tool-header">📋 Result</div><pre><code>${escHtml(block.text || '')}</code></pre></div>`;
          break;

        case 'tool_use':
        case 'mcp_tool':
        case 'widget_tool':
        case 'system_tool':
          if (!options.includeToolUse) break;
          contentHtml += `<div class="tool-block"><div class="tool-header">🔧 ${escHtml(block.toolName || block.type)}</div>`;
          if (block.input && Object.keys(block.input).length > 0) {
            contentHtml += `<pre class="tool-input"><code>${escHtml(JSON.stringify(block.input, null, 2))}</code></pre>`;
          }
          contentHtml += `</div>`;
          break;

        case 'message_compose':
          if (!options.includeToolUse) break;
          contentHtml += `<div class="tool-block"><div class="tool-header">✉️ Message Draft (${escHtml(block.kind)})</div>`;
          for (const v of (block.variants || [])) {
            contentHtml += `<div style="margin:8px 0;padding:8px 12px;background:rgba(127,127,127,0.06);border-radius:6px"><strong>${escHtml(v.label||'Draft')}</strong><p style="margin:4px 0 0;white-space:pre-wrap">${escHtml(v.body||'')}</p></div>`;
          }
          contentHtml += `</div>`;
          break;
      }
    }

    messagesHtml += `<div class="message ${roleClass}"><div class="message-header"><span class="role-badge ${roleClass}">${roleLabel}</span>${msg.createdAt ? `<span class="timestamp">${new Date(msg.createdAt).toLocaleString()}</span>` : ''}</div><div class="message-content">${contentHtml}</div></div>`;
  }

  return { messagesHtml, artifactCounter, hasMermaid };
}

// ── Shared HTML builder ───────────────────────────────────────────────────

function buildFullHtml(data, messagesHtml, artifactCounter, hasMermaid = false) {
  const platform = data.platform || 'unknown';
  const badge = platform === 'claude'
    ? '🔶 Claude'
    : platform === 'chatgpt'
    ? '🟢 ChatGPT'
    : platform === 'gemini'
    ? '🔵 Gemini'
    : platform === 'copilot'
    ? '🪟 Copilot'
    : platform;

  // Use replaceAll (or regex with /g) so placeholders that appear more than
  // once in the template (e.g. {{TITLE}} in both <title> and <h1>) are all replaced.
  return HTML_TEMPLATE
    .replaceAll('{{TITLE}}',          escHtml(data.title || 'Chat Export'))
    .replaceAll('{{PLATFORM_BADGE}}', badge)
    .replaceAll('{{MODEL}}',          escHtml(data.model || 'Unknown'))
    .replaceAll('{{DATE}}',           data.createdAt ? new Date(data.createdAt).toLocaleString() : 'Unknown')
    .replaceAll('{{EXPORT_DATE}}',    new Date().toLocaleString())
    .replaceAll('{{MESSAGE_COUNT}}',  String(data.messages?.length || 0))
    .replaceAll('{{ARTIFACT_COUNT}}', String(artifactCounter))
    .replace('{{MESSAGES}}',          () => messagesHtml) // keep function replacer to avoid $-issues
    .replace('{{MERMAID_SCRIPT}}',    () => hasMermaid
      ? `<script>${VENDOR_MERMAID}<\/script><script>mermaid.initialize({startOnLoad:false,theme:'neutral'});mermaid.run();<\/script>`
      : '');
}

// ── HTML exporter ─────────────────────────────────────────────────────────

function exportHtml(data, options) {
  const { messagesHtml, artifactCounter, hasMermaid } = renderMessagesToHtml(data, options, null);
  return {
    content:   buildFullHtml(data, messagesHtml, artifactCounter, hasMermaid),
    extension: 'html',
    mimeType:  'text/html;charset=utf-8'
  };
}

// ── PDF exporter ──────────────────────────────────────────────────────────

function exportPdf(data, options) {
  const htmlResult = exportHtml(data, options);

  const printScript = `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},1500);});<\/script>`;
  const printStyles = `<style>
    @media print {
      .no-print { display:none!important; }
      body { background:#fff!important; }
      .message { break-inside:avoid; box-shadow:none!important; border:1px solid #ddd!important; }
      .artifact-preview iframe { max-height:300px!important; }
    }
  </style>`;

  const printBanner = `<div class="no-print" style="position:fixed;top:0;left:0;right:0;background:#6366f1;color:#fff;padding:12px 20px;z-index:9999;display:flex;align-items:center;justify-content:space-between;font-family:sans-serif;font-size:14px">
    <span>📄 PDF Export — use your browser print dialog (Ctrl/Cmd+P → Save as PDF)</span>
    <button onclick="window.print()" style="background:#fff;color:#6366f1;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-weight:600">Print Now</button>
  </div>
  <div class="no-print" style="height:48px"></div>`;

  const withPrint = htmlResult.content
    .replace('</head>', () => printStyles + printScript + '</head>')
    .replace('<body>',  () => '<body>' + printBanner);

  // window.open() is blocked in MV3 extension popups.
  // Strategy: download the HTML file, then open it in a new tab.
  // The background script handles both steps.
  return {
    content:    withPrint,
    extension:  'html',
    mimeType:   'text/html;charset=utf-8',
    openInTab:  true   // signal to popup.js to open the downloaded file
  };
}
