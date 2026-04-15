/**
 * AI Chat Exporter – HTML Export Template
 */

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{TITLE}}</title>
<style>
  :root {
    --bg: #f8f9fa; --bg-msg: #ffffff; --bg-user: #f0f4ff;
    --bg-code: #1e1e1e; --text: #1a1a1a; --text-sec: #6b7280;
    --border: #e5e7eb; --accent-user: #4f46e5; --accent-assist: #d946ef;
    --radius: 12px;
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
    --font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f0f0f; --bg-msg: #1a1a1a; --bg-user: #1a1e2e;
      --bg-code: #0d1117; --text: #e0e0e0; --text-sec: #9ca3af; --border: #2a2a2a;
    }
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--text); font-family:var(--font); line-height:1.7; }
  .container { max-width:860px; margin:0 auto; padding:32px 20px; }
  .export-header { text-align:center; margin-bottom:32px; padding-bottom:24px; border-bottom:1px solid var(--border); }
  .export-header h1 { font-size:24px; font-weight:700; margin-bottom:8px; }
  .export-meta { font-size:13px; color:var(--text-sec); display:flex; gap:16px; justify-content:center; flex-wrap:wrap; }
  .platform-badge { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600;
    padding:3px 10px; border-radius:20px; background:rgba(127,127,127,0.1); }
  .message { margin-bottom:16px; padding:20px; background:var(--bg-msg);
    border-radius:var(--radius); border:1px solid var(--border); }
  .message.user { background:var(--bg-user); }
  .message-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
  .role-badge { font-size:12px; font-weight:600; padding:3px 10px; border-radius:20px;
    text-transform:uppercase; letter-spacing:0.03em; }
  .role-badge.user      { background:rgba(79,70,229,0.15);  color:var(--accent-user); }
  .role-badge.assistant { background:rgba(217,70,239,0.15); color:var(--accent-assist); }
  .timestamp { font-size:11px; color:var(--text-sec); }
  .message-content { font-size:15px; }
  .message-content a { color:var(--accent-user); text-decoration:none; }
  .message-content a:hover { text-decoration:underline; }
  .message-content p { margin-bottom:12px; }
  .message-content ul, .message-content ol { margin:8px 0 12px 24px; }
  .message-content h1,.message-content h2,.message-content h3 { margin:16px 0 8px; font-weight:600; }
  .message-content h1 { font-size:20px; } .message-content h2 { font-size:18px; } .message-content h3 { font-size:16px; }
  .text-block { margin-bottom:8px; }
  .text-block strong,.text-block b { font-weight:600; }
  .text-block code { background:rgba(127,127,127,0.15); padding:2px 5px; border-radius:4px;
    font-family:var(--font-mono); font-size:0.88em; }
  /* Code block — header visually distinct from code body */
  .code-block { margin:12px 0; border-radius:8px; overflow:hidden; border:1px solid #e5e7eb; }
  @media (prefers-color-scheme: dark) { .code-block { border-color:#3a3a3a; } }
  .code-header {
    background:#f3f4f6; border-bottom:1px solid #e5e7eb;
    display:flex; align-items:center; justify-content:space-between;
    padding:6px 14px; font-family:var(--font-mono); font-size:12px; color:#6b7280; gap:8px;
  }
  @media (prefers-color-scheme: dark) {
    .code-header { background:#2a2a2a; border-bottom-color:#3a3a3a; color:#9ca3af; }
  }
  .code-header-left { display:flex; align-items:center; gap:6px; }
  .copy-btn {
    background:none; border:1px solid transparent; border-radius:5px; cursor:pointer;
    color:#9ca3af; padding:3px 8px; font-size:11px; font-family:var(--font);
    display:flex; align-items:center; gap:4px; transition:all 0.15s; white-space:nowrap;
  }
  .copy-btn:hover { background:rgba(127,127,127,0.12); border-color:rgba(127,127,127,0.25); color:#6b7280; }
  .copy-btn.copied { color:#10b981; border-color:rgba(16,185,129,0.4); }
  .code-block pre { background:var(--bg-code); padding:14px; overflow-x:auto; margin:0; }
  .code-block pre code.hljs { background:transparent; padding:0; font-size:13px; line-height:1.5; }
  .code-block code { font-family:var(--font-mono); font-size:13px; line-height:1.5; color:#d4d4d4; }
  .artifact-block { margin:16px 0; border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; }
  .artifact-header { display:flex; align-items:center; gap:8px; padding:10px 14px;
    background:rgba(127,127,127,0.08); font-size:13px; font-weight:600; }
  .artifact-type { margin-left:auto; font-weight:400; color:var(--text-sec); font-size:11px; }
  .artifact-preview { border-top:1px solid var(--border); }
  .artifact-preview iframe { width:100%; height:400px; border:none; background:#fff; }
  .artifact-source { border-top:1px solid var(--border); }
  .artifact-source summary { padding:8px 14px; font-size:12px; color:var(--text-sec); cursor:pointer; }
  .artifact-source pre { padding:12px 14px; background:var(--bg-code); color:#d4d4d4; overflow-x:auto; margin:0; }
  .artifact-source code { font-family:var(--font-mono); font-size:12px; }
  .artifact-link { border-top:1px solid var(--border); padding:6px 14px; font-size:12px; background:rgba(127,127,127,0.04); }
  .artifact-link a { color:var(--accent-user); text-decoration:none; }
  .artifact-link a:hover { text-decoration:underline; }
  .mermaid { margin:16px 0; text-align:center; overflow-x:auto; }
  .mermaid svg { max-width:100%; height:auto; }
  .file-tag { font-size:10px; color:var(--text-sec); opacity:0.7; margin-left:4px; }
  .present-files-list { margin:6px 0 0 0; padding:0; list-style:none; display:flex; flex-direction:column; gap:4px; }
  .present-files-list li { display:flex; align-items:baseline; gap:8px; }
  .present-files-list a { color:var(--accent-user); text-decoration:none; font-weight:500; }
  .present-files-list a:hover { text-decoration:underline; }
  .image-block { margin:12px 0; }
  .image-block img { max-width:100%; height:auto; border-radius:8px; border:1px solid var(--border); }
  .attachment-block,.file-block { margin:8px 0; padding:10px 14px; background:rgba(127,127,127,0.06);
    border-radius:8px; font-size:13px; }
  .file-block pre { margin-top:8px; background:var(--bg-code); color:#d4d4d4;
    padding:12px; border-radius:6px; overflow-x:auto; font-size:12px; }
  .file-header { font-weight:500; margin-bottom:4px; }
  .file-header a { color:var(--accent-user); text-decoration:none; }
  .file-header a:hover { text-decoration:underline; }
  .file-size { color:var(--text-sec); font-size:11px; }
  .tool-block { margin:8px 0; padding:10px 14px; background:rgba(127,127,127,0.06);
    border-radius:8px; border-left:3px solid var(--border); font-size:13px; }
  .tool-block.search { border-left-color:#10b981; }
  .tool-header { font-weight:600; font-size:12px; color:var(--text-sec); margin-bottom:4px; }
  .tool-desc { font-size:12px; color:var(--text-sec); margin-top:4px; }
  .tool-input,.tool-result-block pre { margin-top:6px; background:var(--bg-code); color:#d4d4d4;
    padding:10px; border-radius:6px; overflow-x:auto; font-size:12px; font-family:var(--font-mono); }
  .thinking-block { margin:8px 0; border:1px solid var(--border); border-radius:8px; }
  .thinking-block summary { padding:8px 14px; font-size:12px; color:var(--text-sec); cursor:pointer; }
  .thinking-content { padding:12px 14px; font-size:13px; color:var(--text-sec); white-space:pre-wrap; }
  .md-code { margin:8px 0; background:var(--bg-code); color:#d4d4d4;
    padding:12px; border-radius:6px; overflow-x:auto; font-size:13px; }
  blockquote { border-left:3px solid var(--border); padding-left:12px; color:var(--text-sec); margin:8px 0; }
  .html-block { margin:10px 0; overflow-x:auto; }
  .html-block table, .text-block table { border-collapse:collapse; font-size:14px; width:auto; max-width:100%; margin:10px 0; }
  .html-block th, .html-block td,
  .text-block th, .text-block td { border:1px solid var(--border); padding:7px 12px; text-align:left; vertical-align:top; }
  .html-block th, .text-block th { background:rgba(127,127,127,0.08); font-weight:600; font-size:13px; }
  .html-block tr:nth-child(even) td, .text-block tr:nth-child(even) td { background:rgba(127,127,127,0.04); }
  .html-block code { background:rgba(127,127,127,0.15); padding:1px 4px; border-radius:3px; font-family:var(--font-mono); font-size:0.87em; }
  @media print {
    .no-print { display:none!important; }
    .copy-btn { display:none!important; }
    .artifact-preview iframe { border:1px solid #ddd!important; max-height:300px!important; }
  }
  @media (max-width:600px) { .artifact-preview iframe { height:300px; } }
</style>
<style>${VENDOR_HLJS_CSS}</style>
</head>
<body>
<div class="container">
  <div class="export-header">
    <h1>{{TITLE}}</h1>
    <div class="export-meta">
      <span class="platform-badge">{{PLATFORM_BADGE}}</span>
      <span>Model: {{MODEL}}</span>
      <span>Created: {{DATE}}</span>
      <span>Exported: {{EXPORT_DATE}}</span>
      <span>{{MESSAGE_COUNT}} messages \xb7 {{ARTIFACT_COUNT}} artifacts</span>
    </div>
  </div>
  <div class="messages">
  {{MESSAGES}}
  </div>
</div>
{{MERMAID_SCRIPT}}
<script>${VENDOR_HLJS}<\/script>
<script>
  hljs.highlightAll();
  document.querySelectorAll('.copy-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var code = btn.closest('.code-block') && btn.closest('.code-block').querySelector('code');
      var text = code ? code.textContent : '';
      var label = btn.querySelector('.copy-label');
      function markCopied() {
        btn.classList.add('copied');
        if (label) label.textContent = 'Copied!';
        setTimeout(function() {
          btn.classList.remove('copied');
          if (label) label.textContent = 'Copy';
        }, 2000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(markCopied).catch(function() {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); markCopied(); } catch(e) {}
        document.body.removeChild(ta);
      }
    });
  });
<\/script>
</body>
</html>`;
