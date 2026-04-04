/**
 * AI Chat Exporter – Gemini Content Script (Isolated World)
 *
 * Pure DOM scraping — no internal API exists for Gemini chat history.
 *
 * Gemini DOM structure (Angular SPA):
 *
 *   <user-query>
 *     <user-query-content>
 *       <div class="query-content">
 *         <p>User text</p>
 *       </div>
 *     </user-query-content>
 *   </user-query>
 *
 *   <model-response>
 *     <message-content class="...">
 *       <div class="markdown markdown-main-panel">
 *         <p>Text with <b>bold</b> and <code>inline code</code></p>
 *         <h2>Heading</h2>
 *         <response-element>
 *           <code-block>
 *             <div class="code-block-decoration ...">
 *               <span>Python</span>   ← language label
 *             </div>
 *             <pre><code data-test-id="code-content">…code…</code></pre>
 *           </code-block>
 *         </response-element>
 *         <table>…</table>
 *       </div>
 *     </message-content>
 *   </model-response>
 */

(function () {
  'use strict';

  const CCE_PREFIX = 'cce:';

  // ═══════════════════════════════════════════════════════════════════════
  // ─── extractBlocksFromMarkdown ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  function extractBlocksFromMarkdown(markdownEl) {
    if (!markdownEl) return [];
    const blocks = [];

    function nodeToMarkdown(el, depth) {
      const tag = el.nodeName.toLowerCase();

      if (tag === 'button') return '';
      if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return '';
      if (tag === 'svg' || tag === 'mat-icon') return '';

      // ── Gemini code-block custom element ─────────────────────────────
      if (tag === 'code-block') {
        // Language from .code-block-decoration first span
        let lang = '';
        const decoration = el.querySelector('.code-block-decoration, [class*="header"]');
        if (decoration) {
          const langSpan = decoration.querySelector('span');
          if (langSpan) lang = langSpan.textContent.trim().toLowerCase();
        }
        // Code from data-test-id="code-content" or pre > code
        const codeEl = el.querySelector('[data-test-id="code-content"]')
          || el.querySelector('pre code')
          || el.querySelector('code');
        const codeText = codeEl ? codeEl.textContent : '';
        if (codeText.trim()) {
          return `\x00CODE_BLOCK\x00${lang}\x00${codeText}\x00END_CODE\x00`;
        }
        return '';
      }

      // ── response-element wrapper (contains code-block) ────────────────
      if (tag === 'response-element') return childrenToMarkdown(el, depth);

      // ── <pre><code> standard fallback ─────────────────────────────────
      if (tag === 'pre') {
        const codeEl = el.querySelector('code');
        const target = codeEl || el;
        const cls = target.className || '';
        const langMatch = cls.match(/language-(\w+)/);
        return `\x00CODE_BLOCK\x00${langMatch ? langMatch[1] : ''}\x00${target.textContent}\x00END_CODE\x00`;
      }

      // ── <code> inline ─────────────────────────────────────────────────
      if (tag === 'code') {
        const cls = el.className || '';
        if (/language-\w+/.test(cls)) {
          const lm = cls.match(/language-(\w+)/);
          return `\x00CODE_BLOCK\x00${lm ? lm[1] : ''}\x00${el.textContent}\x00END_CODE\x00`;
        }
        return '`' + el.textContent + '`';
      }

      // ── Table ─────────────────────────────────────────────────────────
      if (tag === 'table') return `\x00TABLE\x00${el.outerHTML}\x00END_TABLE\x00`;

      // ── Headings ──────────────────────────────────────────────────────
      if (tag === 'h1') return '\n# '    + el.textContent + '\n';
      if (tag === 'h2') return '\n## '   + el.textContent + '\n';
      if (tag === 'h3') return '\n### '  + el.textContent + '\n';
      if (tag === 'h4') return '\n#### ' + el.textContent + '\n';

      // ── Inline formatting ─────────────────────────────────────────────
      if (tag === 'strong' || tag === 'b') return '**' + childrenToMarkdown(el, depth) + '**';
      if (tag === 'em'     || tag === 'i') return '_'  + childrenToMarkdown(el, depth) + '_';

      // ── Lists ─────────────────────────────────────────────────────────
      if (tag === 'ul' || tag === 'ol') return '\n' + childrenToMarkdown(el, depth) + '\n';
      if (tag === 'li') {
        const prefix = depth > 0 ? '  '.repeat(depth) : '';
        return prefix + '- ' + childrenToMarkdown(el, depth + 1).trim() + '\n';
      }

      // ── Block elements ────────────────────────────────────────────────
      if (tag === 'p')          return childrenToMarkdown(el, depth) + '\n\n';
      if (tag === 'br')         return '\n';
      if (tag === 'hr')         return '\n---\n';
      if (tag === 'blockquote') return '\n> ' + childrenToMarkdown(el, depth).replace(/\n/g, '\n> ') + '\n';
      if (tag === 'a') {
        const href = el.getAttribute('href') || '';
        const text = childrenToMarkdown(el, depth);
        return href ? `[${text}](${href})` : text;
      }

      // Text node
      if (el.nodeType === 3) return el.textContent;

      // Default: recurse
      return childrenToMarkdown(el, depth);
    }

    function childrenToMarkdown(el, depth) {
      let r = '';
      for (const c of el.childNodes) r += nodeToMarkdown(c, depth);
      return r;
    }

    // Build raw string and split on sentinels
    const raw = nodeToMarkdown(markdownEl, 0);
    const parts = raw.split(/\x00CODE_BLOCK\x00|\x00TABLE\x00/);

    for (const part of parts) {
      const cm = part.match(/^([^\x00]*)\x00([^\x00]*)\x00END_CODE\x00([\s\S]*)$/);
      if (cm) {
        const [, lang, code, rest] = cm;
        if (code.trim()) blocks.push({ type: 'code', language: lang || '', code: code.trim() });
        processRest(rest); continue;
      }
      const tm = part.match(/^([\s\S]*?)\x00END_TABLE\x00([\s\S]*)$/);
      if (tm) {
        const [, tableHtml, rest] = tm;
        if (tableHtml.trim()) blocks.push({ type: 'html', html: tableHtml.trim() });
        processRest(rest); continue;
      }
      processRest(part);
    }

    function processRest(text) {
      const t = text?.trim();
      if (t) blocks.push({ type: 'text', text: t });
    }

    return blocks.length > 0 ? blocks : null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── scrapeDOM ─────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  function scrapeDOM() {
    // Conversation ID from URL: gemini.google.com/app/{id}
    const convMatch = window.location.pathname.match(/\/app\/([a-f0-9]+)/);
    const conversationId = convMatch?.[1] || null;

    // Find all turn containers in document order
    // Each <user-query> and <model-response> is a sibling in the conversation
    const allTurns = Array.from(document.querySelectorAll('user-query, model-response'));

    if (allTurns.length === 0) return null;

    const messages = [];

    for (const turn of allTurns) {
      const tag = turn.nodeName.toLowerCase();

      if (tag === 'user-query') {
        // User text lives in .query-content — get all <p> tags
        const queryContent = turn.querySelector('.query-content, user-query-content');
        if (!queryContent) continue;

        // Collect paragraphs and spans with actual text
        const paras = Array.from(queryContent.querySelectorAll('p, .query-text'));
        let text = paras.map(p => p.textContent.trim()).filter(Boolean).join('\n');
        if (!text) text = queryContent.textContent.trim();
        if (!text) continue;

        messages.push({
          id: null, role: 'user',
          content: [{ type: 'text', text }],
          createdAt: null
        });

      } else if (tag === 'model-response') {
        // Model content in <message-content> → .markdown div
        const messageContent = turn.querySelector('message-content');
        if (!messageContent) continue;

        const markdownEl = messageContent.querySelector('.markdown, [class*="markdown"]')
          || messageContent;

        const blocks = extractBlocksFromMarkdown(markdownEl);
        if (blocks && blocks.length > 0) {
          messages.push({ id: null, role: 'assistant', content: blocks, createdAt: null });
        }
      }
    }

    if (messages.length === 0) return null;

    // Title: try the conversation title element, fall back to page title
    const titleEl = document.querySelector(
      '.conversation-title, [class*="conversation-title"], .chat-title, bard-sidenav .selected'
    );
    const title = titleEl?.textContent?.trim()
      || document.title.replace(/\s*[-–|]?\s*Gemini\s*$/i, '').trim()
      || 'Gemini Conversation';

    return {
      id:        conversationId,
      title,
      platform:  'gemini',
      createdAt: null,
      model:     null,
      source:    'dom',
      messages
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Main Handler ──────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const { type } = message;

    if (type === CCE_PREFIX + 'ping') {
      sendResponse({ ok: true, platform: 'gemini', url: window.location.href });
      return false;
    }

    if (type === CCE_PREFIX + 'get-chat-data') {
      try {
        const data = scrapeDOM();
        if (!data) {
          sendResponse({ ok: false, error: 'Could not extract chat content. Make sure the conversation is fully loaded.' });
        } else {
          sendResponse({ ok: true, data });
        }
      } catch (err) {
        console.error('[CCE:Gemini] Error:', err);
        sendResponse({ ok: false, error: err.message });
      }
      return false;
    }
  });

})();
