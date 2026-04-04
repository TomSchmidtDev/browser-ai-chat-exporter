/**
 * AI Chat Exporter — Preview & Select
 *
 * Loads chat data from chrome.storage.session, renders each message
 * with per-message and per-block checkboxes, then exports only the
 * selected items in the chosen format.
 */

// ── State ─────────────────────────────────────────────────────────────────
let chatData   = null;
// msgState[msgIndex] = { selected: bool, blocks: [bool, bool, ...] }
const msgState = [];

// ── Helpers ───────────────────────────────────────────────────────────────

function blockIcon(type) {
  const icons = {
    text: '💬', code: '🖥️', artifact: '📦', visualizer: '🎨', canvas: '🎨',
    image: '🖼️', thinking: '💭', web_search: '🔍', web_fetch: '🌐',
    bash: '⌨️', file_creation: '📄', file_edit: '✏️', present_files: '📥',
    tool_result: '📋', attachment: '📎', html: '📊', mcp_tool: '🔧',
    message_compose: '✉️', tool_use: '🔧', widget_tool: '🔧', system_tool: '⚙️'
  };
  return icons[type] || '▪';
}

function blockLabel(block) {
  switch (block.type) {
    case 'text':         return block.text?.substring(0, 120).replace(/\s+/g, ' ') || '(empty)';
    case 'code':         return `\`\`\`${block.language || ''}\` — ${block.code?.substring(0,60) || ''}`;
    case 'artifact':     return `Artifact: ${block.title || block.artifactType || ''}`;
    case 'visualizer':   return `Visualization: ${block.title || ''}`;
    case 'canvas':       return `Canvas: ${block.name || ''} (${block.canvasType || ''})`;
    case 'image':        return `Image${block.alt ? ': ' + block.alt : ''}`;
    case 'thinking':     return `Thinking — ${block.text?.substring(0,80) || ''}`;
    case 'web_search':   return `Search: ${block.query || ''}`;
    case 'web_fetch':    return `Fetch: ${block.url || ''}`;
    case 'bash':         return `$ ${block.command?.substring(0,80) || ''}`;
    case 'file_creation':return `📄 ${block.path || block.fileName || 'file'}`;
    case 'file_edit':    return `✏️ ${block.path || ''}`;
    case 'present_files':return `Download: ${(block.paths||[]).join(', ').substring(0,60)}`;
    case 'attachment':   return `📎 ${block.fileName || ''}`;
    case 'html':         return 'Table / HTML block';
    case 'tool_result':  return `Result: ${block.text?.substring(0,60) || ''}`;
    case 'mcp_tool':
    case 'widget_tool':
    case 'system_tool':
    case 'tool_use':     return `Tool: ${block.toolName || block.type}`;
    case 'message_compose': return `Message Draft (${block.kind || ''})`;
    default:             return block.type;
  }
}

function msgSummary(msg) {
  if (!msg.content?.length) return '(empty)';
  const first = msg.content.find(b => b.type === 'text');
  if (first) return first.text?.substring(0,80).replace(/\s+/g,' ') || '';
  return blockLabel(msg.content[0]);
}

// ── Render ────────────────────────────────────────────────────────────────

function render() {
  const container = document.getElementById('messages');
  container.innerHTML = '';

  chatData.messages.forEach((msg, mi) => {
    const state = msgState[mi];
    const isUser = msg.role === 'user';
    const card = document.createElement('div');
    card.className = `msg-card ${isUser ? 'user' : 'assistant'}${state.selected ? '' : ' deselected'}`;
    card.id = `msg-${mi}`;

    // Header
    const header = document.createElement('div');
    header.className = 'msg-header';
    header.onclick = () => toggleMsg(mi);
    header.innerHTML = `
      <div class="msg-check ${state.selected ? 'checked' : ''}" id="mc-${mi}"></div>
      <span class="role-badge ${isUser ? 'user' : 'assistant'}">${isUser ? 'You' : 'Assistant'}</span>
      <span class="msg-summary">${escHtml(msgSummary(msg))}</span>
      ${msg.content?.length > 1 ? `<span class="block-type-tag">${msg.content.length} blocks</span>` : ''}
      ${msg.createdAt ? `<span class="msg-timestamp">${new Date(msg.createdAt).toLocaleTimeString()}</span>` : ''}
    `;
    card.appendChild(header);

    // Blocks (only if message has >1 block or contains interesting types)
    if (msg.content && msg.content.length > 0) {
      const blocksDiv = document.createElement('div');
      blocksDiv.className = 'msg-blocks';

      msg.content.forEach((block, bi) => {
        const bSelected = state.blocks[bi];
        const row = document.createElement('div');
        row.className = `block-row${bSelected ? '' : ' deselected'}`;
        row.id = `br-${mi}-${bi}`;
        row.onclick = (e) => { e.stopPropagation(); toggleBlock(mi, bi); };
        row.innerHTML = `
          <div class="block-check ${bSelected ? 'checked' : ''}" id="bc-${mi}-${bi}"></div>
          <span class="block-label">
            ${blockIcon(block.type)} ${escHtml(blockLabel(block))}
            <span class="block-type-tag">${block.type}</span>
          </span>
        `;
        blocksDiv.appendChild(row);
      });

      card.appendChild(blocksDiv);
    }

    container.appendChild(card);
  });

  updateCount();
}

// ── Toggle handlers ────────────────────────────────────────────────────────

function toggleMsg(mi) {
  const state = msgState[mi];
  state.selected = !state.selected;
  // When deselecting a message, deselect all its blocks too
  state.blocks = state.blocks.map(() => state.selected);
  updateCard(mi);
  updateCount();
}

function toggleBlock(mi, bi) {
  const state = msgState[mi];
  state.blocks[bi] = !state.blocks[bi];
  // If any block selected → message selected
  state.selected = state.blocks.some(Boolean);
  updateCard(mi);
  updateCount();
}

function updateCard(mi) {
  const state = msgState[mi];
  const card = document.getElementById(`msg-${mi}`);
  if (!card) return;
  card.classList.toggle('deselected', !state.selected);
  const mc = document.getElementById(`mc-${mi}`);
  if (mc) mc.className = `msg-check ${state.selected ? 'checked' : ''}`;

  msgState[mi].blocks.forEach((bSel, bi) => {
    const row = document.getElementById(`br-${mi}-${bi}`);
    const bc  = document.getElementById(`bc-${mi}-${bi}`);
    if (row) row.classList.toggle('deselected', !bSel);
    if (bc)  bc.className = `block-check ${bSel ? 'checked' : ''}`;
  });
}

function updateCount() {
  const totalMsgs   = msgState.length;
  const selMsgs     = msgState.filter(s => s.selected).length;
  const totalBlocks = msgState.reduce((n, s) => n + s.blocks.length, 0);
  const selBlocks   = msgState.reduce((n, s) => n + s.blocks.filter(Boolean).length, 0);
  document.getElementById('selCount').textContent =
    `${selMsgs}/${totalMsgs} messages · ${selBlocks}/${totalBlocks} blocks selected`;
}

function toggleAll() {
  // If all messages are selected → deselect all. Otherwise → select all.
  const allSelected = msgState.every(s => s.selected && s.blocks.every(Boolean));
  msgState.forEach(s => {
    s.selected = !allSelected;
    s.blocks = s.blocks.map(() => !allSelected);
  });
  render();
}

// ── Build filtered data ────────────────────────────────────────────────────

function buildFilteredData() {
  const messages = [];
  chatData.messages.forEach((msg, mi) => {
    const state = msgState[mi];
    if (!state.selected) return;
    const filteredBlocks = msg.content
      ? msg.content.filter((_, bi) => state.blocks[bi] !== false)
      : [];
    if (filteredBlocks.length > 0 || msg.role === 'user') {
      messages.push({ ...msg, content: filteredBlocks });
    }
  });
  return { ...chatData, messages };
}

// ── Export ─────────────────────────────────────────────────────────────────

async function doExport() {
  const btn = document.getElementById('exportBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Exporting…';

  try {
    const fmt  = document.getElementById('fmtSelect').value;
    const data = buildFilteredData();

    if (data.messages.length === 0) {
      alert('No messages selected. Please select at least one message.');
      return;
    }

    const options = {
      includeArtifacts: true, includeImages: true,
      includeThinking: true, includeToolUse: true, includeFiles: true
    };

    let result;
    if      (fmt === 'markdown') result = exportMarkdown(data, options);
    else if (fmt === 'html')     result = exportHtml(data, options);
    else if (fmt === 'zip')      result = await exportZip(data, options);
    else if (fmt === 'pdf')      result = exportPdf(data, options);

    if (result && !result.skipDownload) {
      await sendDownload(result, data.title);
    } else if (result?.openInTab) {
      await sendDownloadAndOpen(result, data.title);
    }

    btn.textContent = '✓ Done!';
    setTimeout(() => { btn.disabled = false; btn.textContent = '⬇ Export Selected'; }, 2000);
  } catch (err) {
    console.error('[CCE:Preview] Export error:', err);
    alert('Export failed: ' + err.message);
    btn.disabled = false;
    btn.textContent = '⬇ Export Selected';
  }
}

function sanitizeFilename(name) {
  return (name || 'export')
    .replace(/[^a-zA-Z0-9äöüÄÖÜß _\-\.]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 80);
}

function sendDownload(result, title) {
  const filename = sanitizeFilename(title || 'chat') + '_'
    + new Date().toISOString().slice(0, 10) + '.' + result.extension;
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'cce:download', filename, content: result.content, mimeType: result.mimeType },
      resp => resp?.ok ? resolve() : reject(new Error(resp?.error || 'Download failed'))
    );
  });
}

function sendDownloadAndOpen(result, title) {
  const filename = sanitizeFilename(title || 'chat') + '_'
    + new Date().toISOString().slice(0, 10) + '.' + result.extension;
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'cce:download-and-open', filename, content: result.content, mimeType: result.mimeType },
      resp => resp?.ok ? resolve() : reject(new Error(resp?.error || 'Failed to open'))
    );
  });
}

// ── Init ───────────────────────────────────────────────────────────────────

const TOOL_BLOCK_TYPES = new Set([
  'thinking', 'tool_result', 'tool_use',
  'bash', 'file_view', 'file_edit', 'file_creation',
  'present_files', 'web_search', 'web_fetch', 'image_search',
  'mcp_tool', 'widget_tool', 'system_tool', 'message_compose'
]);

function togglePrompts() {
  // If all prompts are currently selected → deselect. Otherwise → select.
  const promptStates = msgState
    .map((s, mi) => ({ s, role: chatData.messages[mi].role }))
    .filter(x => x.role === 'user');
  const allSelected = promptStates.every(x => x.s.selected);

  msgState.forEach((s, mi) => {
    if (chatData.messages[mi].role === 'user') {
      s.selected = !allSelected;
      s.blocks = s.blocks.map(() => !allSelected);
    }
  });
  render();
}

function toggleTools() {
  // If all tool blocks are currently deselected → select. Otherwise → deselect.
  let anyToolSelected = false;
  msgState.forEach((s, mi) => {
    const content = chatData.messages[mi].content || [];
    content.forEach((block, bi) => {
      if (TOOL_BLOCK_TYPES.has(block.type) && s.blocks[bi]) anyToolSelected = true;
    });
  });

  msgState.forEach((s, mi) => {
    const content = chatData.messages[mi].content || [];
    content.forEach((block, bi) => {
      if (TOOL_BLOCK_TYPES.has(block.type)) {
        s.blocks[bi] = !anyToolSelected;
      }
    });
    // Cascade: if all blocks now deselected → deselect message
    if (s.blocks.every(v => !v)) s.selected = false;
    // Cascade: if any block now selected → select message
    else if (s.blocks.some(Boolean)) s.selected = true;
  });
  render();
}

async function init() {
  // Wire toolbar buttons — must use addEventListener, not inline onclick (CSP)
  document.getElementById('btnSelectAll').addEventListener('click', toggleAll);
  document.getElementById('btnDeselectPrompts').addEventListener('click', togglePrompts);
  document.getElementById('btnDeselectTools').addEventListener('click', toggleTools);
  document.getElementById('exportBtn').addEventListener('click', doExport);

  // Check for autoexport mode (launched from context menu)
  const autoFormat = new URLSearchParams(window.location.search).get('autoexport');
  try {
    // Read chat data stored by popup.js before opening this tab
    const result = await chrome.storage.session.get('cce_preview_data');
    if (!result.cce_preview_data) {
      throw new Error('No chat data found. Please trigger the export from the extension popup.');
    }
    chatData = result.cce_preview_data;

    // Initialise state — text/code/artifacts selected, tool output deselected by default
    chatData.messages.forEach(msg => {
      const blockStates = (msg.content || []).map(block => !TOOL_BLOCK_TYPES.has(block.type));
      msgState.push({
        selected: true,
        blocks: blockStates
      });
    });

    // Render meta bar
    const platform = chatData.platform || '';
    const badge = platform === 'claude' ? '🔶 Claude' : platform === 'chatgpt' ? '🟢 ChatGPT' : platform;
    const meta = document.getElementById('chat-meta');
    meta.style.display = 'flex';
    meta.innerHTML = `
      <span class="platform-badge">${badge}</span>
      <strong>${escHtml(chatData.title || 'Chat')}</strong>
      <span>${chatData.messages.length} messages</span>
      ${chatData.model ? `<span>Model: ${escHtml(chatData.model)}</span>` : ''}
      ${chatData.createdAt ? `<span>Created: ${new Date(chatData.createdAt).toLocaleString()}</span>` : ''}
    `;

    document.getElementById('loading').style.display = 'none';
    document.title = `Preview — ${chatData.title || 'Chat'}`;

    // Auto-export mode: triggered from context menu — export immediately and close tab
    if (autoFormat && ['html', 'markdown', 'zip', 'pdf'].includes(autoFormat)) {
      document.getElementById('loading').style.display = 'block';
      document.getElementById('loading').textContent = `Exporting as ${autoFormat.toUpperCase()}…`;
      try {
        const options = {
          includeArtifacts: true, includeImages: true,
          includeThinking: true, includeToolUse: true, includeFiles: true
        };
        let result;
        if      (autoFormat === 'markdown') result = exportMarkdown(chatData, options);
        else if (autoFormat === 'html')     result = exportHtml(chatData, options);
        else if (autoFormat === 'zip')      result = await exportZip(chatData, options);
        else if (autoFormat === 'pdf')      result = exportPdf(chatData, options);

        if (result?.openInTab) {
          await sendDownloadAndOpen(result, chatData.title);
        } else if (result && !result.skipDownload) {
          await sendDownload(result, chatData.title);
        }
        window.close();
      } catch (err) {
        document.getElementById('loading').textContent = 'Export failed: ' + err.message;
      }
      return;
    }

    render();
  } catch (err) {
    document.getElementById('loading').style.display = 'none';
    const errEl = document.getElementById('error-msg');
    errEl.style.display = 'block';
    errEl.textContent = err.message;
  }
}

init();
