/**
 * AI Chat Exporter – Markdown Exporter
 * Depends on: shared/utils.js (escHtml, formatFileSize)
 */

function exportMarkdown(data, options) {
  const lines = [];
  const platform = data.platform || 'unknown';

  lines.push(`# ${data.title || 'Chat Export'}`);
  lines.push('');
  lines.push(`> **Platform:** ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
  lines.push(`> **Exported:** ${new Date().toLocaleString()}`);
  if (data.model)     lines.push(`> **Model:** ${data.model}`);
  if (data.createdAt) lines.push(`> **Created:** ${new Date(data.createdAt).toLocaleString()}`);
  lines.push(`> **Source:** ${data.source || 'unknown'}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  let artifactIndex = 0;

  for (const msg of data.messages) {
    const role = msg.role === 'user' ? '**You**' : '**Assistant**';
    const ts   = msg.createdAt ? ` *(${new Date(msg.createdAt).toLocaleString()})*` : '';
    lines.push(`### ${role}${ts}`);
    lines.push('');

    for (const block of (msg.content || [])) {
      switch (block.type) {
        case 'text':
          lines.push(block.text || '');
          lines.push('');
          break;

        case 'html': {
          // Convert table HTML to markdown pipe table
          const tmpDiv = { innerHTML: block.html }; // can't use DOM here - use regex
          const tableText = (block.html || '')
            .replace(/<th[^>]*>(.*?)<\/th>/gi, (_, c) => c.replace(/<[^>]+>/g,'').trim() + ' | ')
            .replace(/<td[^>]*>(.*?)<\/td>/gi, (_, c) => c.replace(/<[^>]+>/g,'').trim() + ' | ')
            .replace(/<tr[^>]*>/gi, '| ')
            .replace(/<\/tr>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .split('\n').filter(l => l.trim()).join('\n');
          lines.push(tableText);
          lines.push('');
          break;
        }

        case 'thinking':
          if (!options.includeThinking) break;
          lines.push('<details><summary>💭 Thinking</summary>');
          lines.push('');
          lines.push(block.text || '');
          lines.push('');
          lines.push('</details>');
          lines.push('');
          break;

        case 'code':
          lines.push('```' + (block.language || ''));
          lines.push(block.code || '');
          lines.push('```');
          lines.push('');
          break;

        case 'artifact':
          if (!options.includeArtifacts) break;
          artifactIndex++;
          lines.push(`**📦 Artifact ${artifactIndex}: ${block.title || 'Artifact'}**`);
          lines.push(`- **Type:** ${block.artifactType || 'unknown'}`);
          if (block.sourceCode) {
            const lang = block.language || extensionFromMime(block.artifactType);
            lines.push('```' + lang);
            lines.push(block.sourceCode);
            lines.push('```');
          }
          lines.push('');
          break;

        case 'canvas':
          if (!options.includeArtifacts) break;
          artifactIndex++;
          lines.push(`**🎨 Canvas ${artifactIndex}: ${block.name || 'Canvas'}**`);
          lines.push(`- **Type:** ${block.canvasType || 'unknown'}`);
          if (block.content) {
            const lang = block.language || (block.canvasType === 'document' ? 'markdown' : '');
            lines.push('```' + lang);
            lines.push(block.content);
            lines.push('```');
          }
          lines.push('');
          break;

        case 'visualizer':
          if (!options.includeArtifacts) break;
          artifactIndex++;
          lines.push(`**🎨 Visualization ${artifactIndex}: ${block.title || 'Visualization'}**`);
          lines.push('```html');
          lines.push(block.code || '');
          lines.push('```');
          lines.push('');
          break;

        case 'image':
          if (!options.includeImages) break;
          if (block.src) {
            lines.push(`![${block.alt || 'image'}](${block.src})`);
          } else if (block.base64) {
            lines.push(`![${block.alt || 'image'}](${block.base64})`);
          }
          lines.push('');
          break;

        case 'attachment':
          lines.push(`📎 **Attachment:** ${block.fileName} (${formatFileSize(block.fileSize)})`);
          lines.push('');
          break;

        case 'file':
        case 'file_creation':
          if (!options.includeFiles) break;
          lines.push(`📄 **File:** \`${block.path || block.fileName || 'file'}\``);
          if (block.description) lines.push(`> ${block.description}`);
          if (block.content) {
            lines.push('```');
            lines.push(block.content);
            lines.push('```');
          }
          lines.push('');
          break;

        case 'present_files':
          if (!options.includeFiles) break;
          lines.push('📥 **Files:**');
          for (const p of (block.paths || [])) lines.push(`- \`${p}\``);
          lines.push('');
          break;

        case 'web_search':
          if (!options.includeToolUse) break;
          lines.push(`🔍 **Search:** ${block.query}`);
          lines.push('');
          break;

        case 'web_fetch':
          if (!options.includeToolUse) break;
          lines.push(`🌐 **Fetch:** ${block.url}`);
          lines.push('');
          break;

        case 'bash':
          if (!options.includeToolUse) break;
          lines.push('🖥️ **Bash:**');
          lines.push('```bash');
          lines.push(block.command || '');
          lines.push('```');
          lines.push('');
          break;

        case 'file_edit':
          if (!options.includeToolUse) break;
          lines.push(`✏️ **Edit:** \`${block.path}\``);
          if (block.description) lines.push(`> ${block.description}`);
          lines.push('');
          break;

        case 'tool_use':
        case 'mcp_tool':
        case 'widget_tool':
        case 'system_tool':
          if (!options.includeToolUse) break;
          lines.push(`🔧 **Tool:** ${block.toolName || block.type}`);
          if (block.input && Object.keys(block.input).length > 0) {
            lines.push('```json');
            lines.push(JSON.stringify(block.input, null, 2));
            lines.push('```');
          }
          lines.push('');
          break;
      }
    }

    lines.push('---');
    lines.push('');
  }

  return {
    content:   lines.join('\n'),
    extension: 'md',
    mimeType:  'text/markdown;charset=utf-8'
  };
}
