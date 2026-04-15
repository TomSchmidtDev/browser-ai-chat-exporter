/**
 * AI Chat Exporter – ZIP Exporter
 * Depends on: jszip, shared/utils.js, shared/widget-css.js,
 *             shared/html-template.js, shared/exporters/html.js
 *
 * ZIP structure:
 *   index.html         — full chat, iframes use src= (relative paths)
 *   artifacts/
 *     001_<name>.html  — each artifact/canvas/visualizer as standalone HTML
 *   files/
 *     <original/path>  — file_creation blocks with original paths preserved
 *   images/
 *     img_001.<ext>    — Base64-decoded image binaries
 */

async function exportZip(data, options) {
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip not loaded — make sure jszip.min.js is in the extension folder.');
  }

  const zip = new JSZip();
  let artifactCounter = 0;
  let imageCounter    = 0;
  let hasMermaid      = false;

  // ── Pass 1: collect paths that were presented as download buttons ──────
  // These files are already packed into files/ — link only, no inline preview.
  const presentedPaths = new Set();
  for (const msg of data.messages) {
    for (const block of (msg.content || [])) {
      if (block.type === 'present_files') {
        for (const p of (block.paths || [])) presentedPaths.add(p);
      }
    }
  }

  // ── Pass 2: build messages HTML using the shared renderer ─────────────
  // The resolver is called for each artifact to add it to the ZIP and return its path.

  function artifactResolver(block, counter, html) {
    const idx      = String(counter).padStart(3, '0');
    const rawName  = block.title || block.name || block.toolName || 'artifact';
    const safeName = rawName.replace(/[^a-zA-Z0-9äöüÄÖÜß _\-]/g, '').replace(/\s+/g, '_').substring(0, 60);
    const filename = `artifacts/${idx}_${safeName}.html`;
    zip.file(filename, html);
    return filename;
  }

  // We need a custom render pass to handle image binary extraction + presented files,
  // so we can't use renderMessagesToHtml directly. Instead we duplicate the loop
  // with ZIP-specific handling for images and files.

  let messagesHtml = '';

  for (const msg of data.messages) {
    const isUser    = msg.role === 'user';
    const roleClass = isUser ? 'user' : 'assistant';
    const roleLabel = isUser ? t('roleUser') : t('roleAssistant');
    let contentHtml = '';

    for (const block of (msg.content || [])) {
      switch (block.type) {

        case 'text': {
          const textHtml = markdownToHtml(block.text);
          if (textHtml.includes('<div class="mermaid">')) hasMermaid = true;
          contentHtml += `<div class="text-block">${textHtml}</div>`;
          break;
        }

        case 'html':
          contentHtml += `<div class="html-block">${sanitizeHtmlBlock(block.html)}</div>`;
          break;

        case 'code': {
          if (block.language && block.language.toLowerCase() === 'mermaid') {
            const mermaidHtml = buildRunnableArtifact({ artifactType: 'application/vnd.ant.mermaid', sourceCode: block.code });
            const mermaidPath = artifactResolver(block, ++artifactCounter, mermaidHtml);
            contentHtml += `<div class="artifact-block"><div class="artifact-header"><span class="artifact-icon">📊</span><span class="artifact-title">Mermaid Diagram</span></div><div class="artifact-preview"><iframe src="${mermaidPath}" sandbox="allow-scripts" loading="lazy"></iframe></div><div class="artifact-link"><a href="${mermaidPath}" target="_blank">↗ Open diagram</a></div></div>`;
          } else {
            const langClass = block.language ? ` class="language-${escAttr(block.language)}"` : '';
            contentHtml += `<div class="code-block"><div class="code-header"><div class="code-header-left"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>${escHtml(block.language || '')}</div><button class="copy-btn" type="button"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg><span class="copy-label">Copy</span></button></div><pre><code${langClass}>${escHtml(block.code)}</code></pre></div>`;
          }
          break;
        }

        // ── Artifacts → artifacts/ folder ─────────────────────────────
        case 'artifact': {
          if (!options.includeArtifacts) break;
          artifactCounter++;
          const artPath = artifactResolver(block, artifactCounter, buildRunnableArtifact(block));
          contentHtml += `<div class="artifact-block">
            <div class="artifact-header">
              <span class="artifact-icon">📦</span>
              <span class="artifact-title">${escHtml(block.title || 'Artifact')}</span>
              <span class="artifact-type">${escHtml(block.artifactType || '')}</span>
            </div>
            <div class="artifact-preview"><iframe src="${artPath}" sandbox="allow-scripts" loading="lazy"></iframe></div>
            <div class="artifact-link"><a href="${artPath}" target="_blank">↗ Open artifact</a></div>
          </div>`;
          break;
        }

        case 'canvas': {
          if (!options.includeArtifacts) break;
          artifactCounter++;
          const cvPath = artifactResolver(block, artifactCounter, buildCanvasHtml(block));
          contentHtml += `<div class="artifact-block">
            <div class="artifact-header">
              <span class="artifact-icon">🎨</span>
              <span class="artifact-title">${escHtml(block.name || 'Canvas')}</span>
              <span class="artifact-type">${escHtml(block.canvasType || '')}</span>
            </div>
            <div class="artifact-preview"><iframe src="${cvPath}" sandbox="allow-scripts" loading="lazy"></iframe></div>
            <div class="artifact-link"><a href="${cvPath}" target="_blank">↗ Open canvas</a></div>
          </div>`;
          break;
        }

        case 'visualizer': {
          if (!options.includeArtifacts) break;
          artifactCounter++;
          const vizPath = artifactResolver(block, artifactCounter, buildVisualizerHtml(block));
          contentHtml += `<div class="artifact-block">
            <div class="artifact-header">
              <span class="artifact-icon">🎨</span>
              <span class="artifact-title">${escHtml(block.title || 'Visualization')}</span>
            </div>
            <div class="artifact-preview"><iframe src="${vizPath}" sandbox="allow-scripts" loading="lazy"></iframe></div>
            <div class="artifact-link"><a href="${vizPath}" target="_blank">↗ Open visualization</a></div>
          </div>`;
          break;
        }

        // ── Images → images/ folder ────────────────────────────────────
        case 'image': {
          if (!options.includeImages) break;
          imageCounter++;
          const imgIdx  = String(imageCounter).padStart(3, '0');
          const mime    = block.mediaType || 'image/png';
          const ext     = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
          const imgPath = `images/img_${imgIdx}.${ext}`;

          if (block.base64) {
            const b64 = block.base64.replace(/^data:[^;]+;base64,/, '');
            zip.file(imgPath, b64, { base64: true });
            contentHtml += `<div class="image-block"><img src="${imgPath}" alt="${escAttr(block.alt || '')}" loading="lazy"></div>`;
          } else if (block.src) {
            contentHtml += `<div class="image-block"><img src="${escAttr(block.src)}" alt="${escAttr(block.alt || '')}" loading="lazy"></div>`;
          }
          break;
        }

        // ── Generated files → files/ folder ───────────────────────────
        case 'file':
        case 'file_creation': {
          if (!options.includeFiles) break;
          const filePath    = block.path || block.fileName || `file_${Date.now()}`;
          const safeRelPath = filePath
            .replace(/\\/g, '/')
            .split('/')
            .filter(seg => seg && seg !== '.' && seg !== '..')
            .join('/');
          const zipPath     = `files/${safeRelPath}`;
          if (block.content) zip.file(zipPath, block.content);

          // If later presented as a download button: link only, no inline preview
          const isPresented = presentedPaths.has(filePath);
          contentHtml += `<div class="file-block">
            <div class="file-header">📄 <a href="${zipPath}" target="_blank">${escHtml(filePath)}</a>${isPresented ? ' <span class="file-tag">↓ in ZIP</span>' : ''}</div>
            ${block.description ? `<div class="tool-desc">${escHtml(block.description)}</div>` : ''}
            ${(!isPresented && block.content) ? `<pre><code>${escHtml(block.content.substring(0, 2000))}${block.content.length > 2000 ? '\n…' : ''}</code></pre>` : ''}
          </div>`;
          break;
        }

        case 'present_files': {
          if (!options.includeFiles) break;
          contentHtml += `<div class="file-block present-files">
            <div class="file-header">📥 Download</div>
            <ul class="present-files-list">${(block.paths || []).map(p => {
              const safe = p.replace(/\\/g, '/').split('/').filter(s => s && s !== '.' && s !== '..').join('/');
              const name = p.split('/').pop() || p;
              return `<li><a href="files/${safe}" target="_blank">⬇ ${escHtml(name)}</a> <span class="file-tag">${escHtml(p)}</span></li>`;
            }).join('')}</ul>
          </div>`;
          break;
        }

        // ── Tools / thinking (reuse HTML exporter output) ──────────────
        case 'attachment':
          contentHtml += `<div class="attachment-block">📎 <strong>${escHtml(block.fileName)}</strong> <span class="file-size">(${formatFileSize(block.fileSize)})</span></div>`;
          break;

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

        case 'tool_use': case 'mcp_tool': case 'widget_tool': case 'system_tool':
          if (!options.includeToolUse) break;
          contentHtml += `<div class="tool-block"><div class="tool-header">🔧 ${escHtml(block.toolName || block.type)}</div>`;
          if (block.input && Object.keys(block.input).length > 0)
            contentHtml += `<pre class="tool-input"><code>${escHtml(JSON.stringify(block.input, null, 2))}</code></pre>`;
          contentHtml += `</div>`;
          break;
      }
    }

    messagesHtml += `<div class="message ${roleClass}"><div class="message-header"><span class="role-badge ${roleClass}">${roleLabel}</span>${msg.createdAt ? `<span class="timestamp">${new Date(msg.createdAt).toLocaleString()}</span>` : ''}</div><div class="message-content">${contentHtml}</div></div>`;
  }

  // ── Build index.html ──────────────────────────────────────────────────
  zip.file('index.html', buildFullHtml(data, messagesHtml, artifactCounter, hasMermaid));

  // ── Compress and download ─────────────────────────────────────────────
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const filename = sanitizeFilename(data.title || 'chat') + '_' + new Date().toISOString().slice(0, 10) + '.zip';

  const dataUrl = await new Promise((resolve, reject) => {
    const reader  = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(zipBlob);
  });

  await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'cce:download-blob', filename, base64Data: dataUrl, mimeType: 'application/zip' },
      (resp) => { if (resp?.ok) resolve(); else reject(new Error(resp?.error || 'Download failed')); }
    );
  });

  return { skipDownload: true, sizeBytes: zipBlob.size, extension: 'zip' };
}
