/**
 * AI Chat Exporter – Shared Utilities
 * Loaded by popup.html. Content scripts inline what they need.
 */

function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escAttr(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape for srcdoc attribute — only & and " per HTML spec */
function escSrcdoc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Very basic Markdown → HTML (no external library needed) */
function markdownToHtml(md) {
  if (!md) return '';
  let html = escHtml(md);

  // Fenced code blocks  ```lang\n...\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre class="md-code"><code${lang ? ` class="language-${lang}"` : ''}>${code}</code></pre>`
  );

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g,         '<em>$1</em>');
  html = html.replace(/_(.+?)_/g,           '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) =>
    `<a href="${safeUrl(url)}" target="_blank" rel="noopener">${text}</a>`);

  // Tables — detect pipe-delimited blocks with a separator row (|---|---|)
  // Runs after inline formatting so cell content already has <strong>, <code> etc.
  html = html.replace(/((?:(?:^|\n)\|[^\n]+)+)/g, (match) => {
    const lines = match.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('|'));
    if (lines.length < 2) return match;
    // Second line must be a separator: only |, -, :, spaces
    if (!/^\|[-:\s|]+\|$/.test(lines[1])) return match;

    const parseRow = (line) => line.split('|').slice(1, -1).map(c => c.trim());
    const headers = parseRow(lines[0]);
    const bodyRows = lines.slice(2);

    let t = '<table><thead><tr>';
    t += headers.map(h => `<th>${h}</th>`).join('');
    t += '</tr></thead><tbody>';
    for (const row of bodyRows) {
      const cells = parseRow(row);
      t += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    }
    t += '</tbody></table>';
    return '\n' + t + '\n';
  });

  // Horizontal rules
  html = html.replace(/^[-*]{3,}$/gm, '<hr>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // Clean up
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[123]>)/g,    '$1');
  html = html.replace(/(<\/h[123]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<ul>)/g,         '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g,     '$1');
  html = html.replace(/<p>\s*(<pre)/g,         '$1');
  html = html.replace(/(<\/pre>)\s*<\/p>/g,    '$1');
  html = html.replace(/<p>\s*(<hr>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<table>)/g,      '$1');
  html = html.replace(/(<\/table>)\s*<\/p>/g,  '$1');

  return html;
}

/** Allow only http/https URLs in href/src attributes — blocks javascript: and data: */
function safeUrl(url) {
  if (!url) return '#';
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? url : '#';
  } catch { return '#'; }
}

/**
 * Strip executable content from raw scraped HTML (e.g. ChatGPT tables).
 * Removes <script> blocks and inline event handlers; leaves structure intact.
 */
function sanitizeHtmlBlock(html) {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function extensionFromMime(type) {
  const map = {
    'application/vnd.ant.react': 'jsx',
    'text/html':                 'html',
    'image/svg+xml':             'svg',
    'text/markdown':             'md',
    'application/vnd.ant.mermaid': 'mermaid',
    'application/vnd.ant.code':  'txt',
    'text/javascript':           'js',
    'text/x-python':             'py',
    'text/typescript':           'ts',
  };
  return map[type] || 'txt';
}

function sanitizeFilename(name) {
  return (name || 'export')
    .replace(/[^a-zA-Z0-9äöüÄÖÜß _\-\.]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 80);
}
