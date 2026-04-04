/**
 * AI Chat Exporter – Widget CSS & Artifact Builders
 *
 * Provides:
 *  WIDGET_CSS_VARS   – :root tokens + SVG class rules matching the host page themes
 *  buildRunnableArtifact(block)   – for Claude artifact blocks
 *  buildVisualizerHtml(block)     – for Claude show_widget / visualize blocks
 *  buildCanvasHtml(block)         – for ChatGPT canvas blocks
 */

// Two layers:
// 1. CSS custom properties — the actual --color-* names used in widget/artifact code
// 2. CSS class rules — SVG diagrams rely on .c-teal/.c-gray/.th/.arr etc. from the
//    host page's global stylesheet; without them rect fills default to black.
const WIDGET_CSS_VARS = `
  :root {
    /* ── Claude.ai / ChatGPT design-system tokens ──────────────────── */
    --color-background-primary:   #ffffff;
    --color-background-secondary: #f8f9fa;
    --color-background-tertiary:  #f1f3f5;
    --color-background-success:   #d1fae5;
    --color-background-warning:   #fef3c7;
    --color-background-danger:    #fee2e2;
    --color-background-info:      #dbeafe;
    --color-text-primary:   #1a1a1a;
    --color-text-secondary: #4a4a4a;
    --color-text-tertiary:  #6b7280;
    --color-text-success:   #065f46;
    --color-text-warning:   #92400e;
    --color-text-danger:    #991b1b;
    --color-text-info:      #1e40af;
    --color-border-primary:   #e5e7eb;
    --color-border-secondary: #d1d5db;
    --color-border-tertiary:  #e5e7eb;
    --color-border-info:      #93c5fd;
    --font-mono: 'SF Mono','Fira Code','Cascadia Code',monospace;
    --border-radius-sm: 4px;
    --border-radius-md: 8px;
    --border-radius-lg: 12px;
    /* ── Legacy / alternate naming variants ────────────────────────── */
    --bg-primary: #ffffff;  --bg-secondary: #f8f9fa;  --bg-tertiary: #f1f3f5;
    --text-primary: #1a1a1a; --text-secondary: #4a4a4a; --text-tertiary: #6b7280;
    --border: #e5e7eb;
    --accent: #6366f1;
    --success: #10b981; --warning: #f59e0b; --error: #ef4444; --info: #3b82f6;
    --color-1:#6366f1; --color-2:#ec4899; --color-3:#10b981;
    --color-4:#f59e0b; --color-5:#3b82f6; --color-6:#ef4444;
    --chart-1:#6366f1; --chart-2:#ec4899; --chart-3:#10b981; --chart-4:#f59e0b; --chart-5:#3b82f6;
    --radius:8px; --radius-sm:4px; --radius-md:10px; --radius-lg:16px;
    --font:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  }

  /* ── SVG widget CSS classes from the host page global stylesheet ──── */
  .c-teal   rect,.c-teal   circle { fill:#ccfbf1; stroke:#2dd4bf; }  .c-teal   text { fill:#0f766e; }
  .c-coral  rect,.c-coral  circle { fill:#ffe4e6; stroke:#fb7185; }  .c-coral  text { fill:#be123c; }
  .c-blue   rect,.c-blue   circle { fill:#dbeafe; stroke:#60a5fa; }  .c-blue   text { fill:#1d4ed8; }
  .c-green  rect,.c-green  circle { fill:#dcfce7; stroke:#4ade80; }  .c-green  text { fill:#15803d; }
  .c-yellow rect,.c-yellow circle { fill:#fef9c3; stroke:#facc15; }  .c-yellow text { fill:#a16207; }
  .c-purple rect,.c-purple circle { fill:#ede9fe; stroke:#a78bfa; }  .c-purple text { fill:#6d28d9; }
  .c-gray   rect,.c-gray   circle { fill:#f3f4f6; stroke:#d1d5db; }  .c-gray   text { fill:#374151; }
  .c-red    rect,.c-red    circle { fill:#fee2e2; stroke:#f87171; }  .c-red    text { fill:#b91c1c; }
  .c-orange rect,.c-orange circle { fill:#ffedd5; stroke:#fb923c; }  .c-orange text { fill:#c2410c; }
  .c-indigo rect,.c-indigo circle { fill:#e0e7ff; stroke:#818cf8; }  .c-indigo text { fill:#4338ca; }
  .c-pink   rect,.c-pink   circle { fill:#fce7f3; stroke:#f472b6; }  .c-pink   text { fill:#be185d; }
  .th { font-weight:600; font-size:13px; fill:inherit; }
  .ts { font-size:11px; fill:#6b7280; }
  .tm { font-size:12px; fill:#374151; }
  .tc { text-anchor:middle; }  .tl { text-anchor:start; }  .tr { text-anchor:end; }
  .bold { font-weight:700; }  .muted { fill:#9ca3af; }  .label { font-size:11px; fill:#6b7280; }
  .arr       { stroke:#9ca3af; stroke-width:1.5; fill:none; marker-end:url(#arrow); }
  .arr-dashed{ stroke:#9ca3af; stroke-width:1.5; fill:none; stroke-dasharray:4 3; marker-end:url(#arrow); }
  .connector { stroke:#d1d5db; stroke-width:1; fill:none; }
  .highlight rect { fill:#e0e7ff; stroke:#6366f1; stroke-width:1.5; }
  .highlight text { fill:#3730a3; }
  .accent rect { fill:#6366f1; }  .accent text { fill:#ffffff; }
  svg { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  svg text { font-family:inherit; }
  rect { stroke-width:1; }
`;

// ── Helpers ────────────────────────────────────────────────────────────────

function _injectVarsIntoHtml(html) {
  const styleTag = `<style>${WIDGET_CSS_VARS}</style>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/(<head[^>]*>)/i, `$1${styleTag}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/(<html[^>]*>)/i, `$1<head>${styleTag}</head>`);
  return html; // already broken — return as-is
}

function _svgShell(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${WIDGET_CSS_VARS}body{margin:0;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;padding:16px;box-sizing:border-box;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a}</style></head><body>${content}</body></html>`;
}

function _htmlFragmentShell(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${WIDGET_CSS_VARS}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;background:#fff}</style></head><body>${content}</body></html>`;
}

// ── Claude artifact builder ────────────────────────────────────────────────

function buildRunnableArtifact(block) {
  const type = block.artifactType || '';
  const code = block.sourceCode || '';

  // SVG
  if (type === 'image/svg+xml' || code.trim().startsWith('<svg')) {
    return _svgShell(code);
  }

  // Plain HTML — inject CSS vars so var(--color-*) tokens resolve correctly
  if (type === 'text/html') {
    if (code.includes('<html') || code.includes('<!DOCTYPE') || code.includes('<!doctype')) {
      return _injectVarsIntoHtml(code);
    }
    return _htmlFragmentShell(code);
  }

  // Mermaid
  if (type === 'application/vnd.ant.mermaid') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.6.1/mermaid.min.js"><\/script>
<style>body{margin:16px;font-family:-apple-system,sans-serif;background:#fff}</style>
</head><body>
<div class="mermaid">${escHtml(code)}</div>
<script>mermaid.initialize({startOnLoad:true,theme:'neutral'});<\/script>
</body></html>`;
  }

  // Markdown
  if (type === 'text/markdown') {
    return _htmlFragmentShell(`<div style="max-width:720px;margin:0 auto;padding:24px">${markdownToHtml(code)}</div>`);
  }

  // Code display
  if (type === 'application/vnd.ant.code') {
    const lang = block.language || '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{margin:0;background:#1e1e1e}pre{margin:0;padding:20px;overflow:auto}code{font-family:'SF Mono','Fira Code',monospace;font-size:13px;color:#d4d4d4;line-height:1.5}
.lang{position:fixed;top:8px;right:12px;font-size:11px;color:#999;font-family:monospace}</style>
</head><body><span class="lang">${escHtml(lang)}</span><pre><code>${escHtml(code)}</code></pre></body></html>`;
  }

  // React / JSX
  if (type === 'application/vnd.ant.react' || type.includes('react')) {
    let processedCode = code
      .replace(/import\s+\{[^}]*\}\s+from\s+['"]react['"];?\s*/g, '')
      .replace(/import\s+React\s*,?\s*\{[^}]*\}\s+from\s+['"]react['"];?\s*/g, '')
      .replace(/import\s+React\s+from\s+['"]react['"];?\s*/g, '')
      .replace(/import\s+\{[^}]*\}\s+from\s+['"]recharts['"];?\s*/g, (m) => {
        const names = (m.match(/\{([^}]+)\}/)?.[1] || '').split(',').map(s => s.trim()).filter(Boolean);
        return names.map(n => `const ${n} = Recharts.${n};`).join('\n') + '\n';
      })
      .replace(/import\s+\{[^}]*\}\s+from\s+['"]lucide-react['"];?\s*/g, (m) => {
        const names = (m.match(/\{([^}]+)\}/)?.[1] || '').split(',').map(s => s.trim()).filter(Boolean);
        return names.map(n =>
          `const ${n} = (p) => React.createElement('span',{...p,style:{display:'inline-flex',width:p?.size||24,height:p?.size||24,...p?.style}},'○');`
        ).join('\n') + '\n';
      })
      .replace(/import\s+.*\s+from\s+['"]@\/components\/ui\/[^'"]+['"];?\s*/g, '')
      .replace(/import\s+\*\s+as\s+(\w+)\s+from\s+['"](\w+)['"];?\s*/g, (_, name, mod) => {
        const g = {d3:'d3',lodash:'_',mathjs:'math',three:'THREE'}[mod] || mod;
        return `const ${name} = window.${g} || {};\n`;
      })
      .replace(/export\s+default\s+function\s+(\w+)/g, 'function $1')
      .replace(/export\s+default\s+class\s+(\w+)/g,    'class $1')
      .replace(/export\s+default\s+/g,                 'window.__CCE_DEFAULT_EXPORT__ = ')
      .replace(/export\s+(const|let|var|function|class)\s+/g, '$1 ');

    const compMatch = processedCode.match(/(?:function|const|class)\s+([A-Z]\w+)/);
    const compName  = compMatch ? compMatch[1] : null;
    const renderCode = compName
      ? `window.__CCE_DEFAULT_EXPORT__ || ${compName}`
      : `window.__CCE_DEFAULT_EXPORT__ || (() => React.createElement('div',null,'Component rendered'))`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js"><\/script>
<link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/recharts/2.12.7/Recharts.min.js"><\/script>
<style>${WIDGET_CSS_VARS}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}#root{min-height:100vh}#error{display:none;padding:20px;color:#e53e3e;font-family:monospace;white-space:pre-wrap}</style>
</head><body><div id="root"></div><div id="error"></div>
<script type="text/babel" data-type="module">
const {useState,useEffect,useRef,useCallback,useMemo,useReducer,useContext,createContext,Fragment}=React;
const {createRoot}=ReactDOM;
${processedCode}
try{
  const App=${renderCode};
  createRoot(document.getElementById('root')).render(React.createElement(App));
}catch(e){
  const el=document.getElementById('error');
  el.style.display='block';
  el.textContent='Error: '+e.message+'\\n'+e.stack;
}
<\/script></body></html>`;
  }

  // Fallback: treat as HTML fragment
  return _htmlFragmentShell(`<pre><code>${escHtml(code)}</code></pre>`);
}

// ── Claude visualizer builder ──────────────────────────────────────────────

function buildVisualizerHtml(block) {
  const code = block.code || '';
  if (code.trim().startsWith('<svg')) return _svgShell(code);
  if (code.includes('<') && code.includes('>')) {
    if (/<head[^>]*>/i.test(code) || code.includes('<html')) return _injectVarsIntoHtml(code);
    return _htmlFragmentShell(code);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><pre>${escHtml(code)}</pre></body></html>`;
}

// ── ChatGPT canvas builder ─────────────────────────────────────────────────

function buildCanvasHtml(block) {
  const { canvasType, language, content, name } = block;

  if (canvasType === 'document') {
    // Markdown document
    return _htmlFragmentShell(
      `<div style="max-width:720px;margin:0 auto;padding:24px;font-family:-apple-system,sans-serif;line-height:1.7">${markdownToHtml(content || '')}</div>`
    );
  }

  if (canvasType === 'code') {
    const lang = language || '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{margin:0;background:#1e1e1e}pre{margin:0;padding:20px;overflow:auto}code{font-family:'SF Mono','Fira Code',monospace;font-size:13px;color:#d4d4d4;line-height:1.5}
.lang-badge{position:fixed;top:8px;right:12px;font-size:11px;color:#999;font-family:monospace}
.name-badge{position:fixed;top:8px;left:12px;font-size:11px;color:#aaa;font-family:monospace}</style>
</head><body>
${name ? `<span class="name-badge">${escHtml(name)}</span>` : ''}
<span class="lang-badge">${escHtml(lang)}</span>
<pre><code>${escHtml(content || '')}</code></pre>
</body></html>`;
  }

  // HTML canvas
  if (canvasType === 'html') {
    if (/<html|<!DOCTYPE/i.test(content || '')) return _injectVarsIntoHtml(content);
    return _htmlFragmentShell(content || '');
  }

  return _htmlFragmentShell(`<pre><code>${escHtml(content || '')}</code></pre>`);
}
