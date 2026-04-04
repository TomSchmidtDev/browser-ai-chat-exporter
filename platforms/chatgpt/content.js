/**
 * AI Chat Exporter – ChatGPT Content Script (Isolated World)
 *
 * Uses DOM scraping to extract conversation content directly from the
 * rendered page — works for private chats, shared chats, and Enterprise.
 *
 * The ChatGPT internal /backend-api/conversation endpoint was an
 * undocumented web-app internal that OpenAI has removed. DOM scraping
 * is the only reliable approach.
 */

(function () {
  'use strict';

  const CCE_PREFIX = 'cce:';

  // ═══════════════════════════════════════════════════════════════════════
  // ─── extractBlocksFromProseEl ──────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  function extractBlocksFromProseEl(proseEl) {
    if (!proseEl) return [];
    const blocks = [];

    function isCodeBlockContainer(el) {
      if (!el.querySelector) return false;
      const code = el.querySelector('code');
      if (!code) return false;
      const cls = code.className || '';
      return /hljs/.test(cls) || /language-\w+/.test(cls) || /whitespace-pre/.test(cls);
    }

    function extractCode(el) {
      const code = el.querySelector('code') || (el.nodeName.toLowerCase() === 'code' ? el : null);
      if (!code) return { lang: '', text: el.textContent || '' };
      const cls = code.className || '';
      const langMatch = cls.match(/language-(\w+)/);
      return { lang: langMatch ? langMatch[1] : '', text: code.textContent || '' };
    }

    function isLangLabelEl(el) {
      const txt = el.textContent.trim();
      if (txt.length === 0 || txt.length > 30) return false;
      if (el.querySelector && el.querySelector('code, pre, p, ul, ol')) return false;
      const parent = el.parentElement;
      const grandparent = parent?.parentElement;
      return isCodeBlockContainer(parent) || isCodeBlockContainer(grandparent);
    }

    // Walk cm-content converting <br> to newlines
    function cmTextContent(node) {
      let r = '';
      for (const c of node.childNodes) {
        if (c.nodeType === 3) r += c.textContent;
        else if (c.nodeName.toLowerCase() === 'br') r += '\n';
        else r += cmTextContent(c);
      }
      return r;
    }

    function nodeToMarkdown(el, depth) {
      const tag = el.nodeName.toLowerCase();

      if (tag === 'button') return '';
      if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return '';
      if (tag === 'svg') return '';
      if ((tag === 'div' || tag === 'span') && isLangLabelEl(el)) return '';

      // <pre> — always a code block
      if (tag === 'pre') {
        let lang = '', codeText = '';
        const cmContent = el.querySelector('.cm-content, [class*="cm-content"]');
        if (cmContent) {
          codeText = cmTextContent(cmContent);
          for (const d of Array.from(el.querySelectorAll('div'))) {
            if (d.closest('[class*="cm-"]')) continue;
            const txt = d.textContent.trim();
            if (txt.length > 0 && txt.length <= 20 &&
                !d.querySelector('code, pre, p, ul, ol, button, [class*="cm-"]') &&
                d.children.length <= 2) { lang = txt.toLowerCase(); break; }
          }
        } else {
          const codeEl = el.querySelector('code');
          const target = codeEl || el;
          const cls = target.className || '';
          const langMatch = cls.match(/language-(\w+)/);
          lang = langMatch ? langMatch[1] : '';
          let contentEl = target;
          const elemKids = Array.from(target.children);
          if (elemKids.length === 1 && elemKids[0].nodeName.toLowerCase() === 'div')
            contentEl = elemKids[0];
          const cc = Array.from(contentEl.childNodes);
          let labelIdx = -1;
          for (let i = 0; i < cc.length; i++) {
            const n = cc[i];
            if (n.nodeType === 3 && !n.textContent.trim()) continue;
            const nt = n.nodeName.toLowerCase();
            if (nt === 'span' || nt === 'div') {
              const txt = n.textContent.trim();
              if (txt.length > 0 && txt.length <= 20 &&
                  !n.querySelector('code, pre, p, ul, ol, table')) {
                labelIdx = i; if (!lang) lang = txt.toLowerCase();
              }
            }
            break;
          }
          codeText = cc.filter((_, i) => i !== labelIdx).map(n => n.textContent).join('');
        }
        return `\x00CODE_BLOCK\x00${lang}\x00${codeText}\x00END_CODE\x00`;
      }

      // <code> inline or block
      if (tag === 'code') {
        const cls = el.className || '';
        if (/hljs/.test(cls) || /language-\w+/.test(cls) || /whitespace-pre/.test(cls)) {
          const lm = cls.match(/language-(\w+)/);
          return `\x00CODE_BLOCK\x00${lm ? lm[1] : ''}\x00${el.textContent}\x00END_CODE\x00`;
        }
        return '`' + el.textContent + '`';
      }

      // div wrapping class-detected code block
      if ((tag === 'div' || tag === 'section') && isCodeBlockContainer(el)) {
        const { lang, text } = extractCode(el);
        return `\x00CODE_BLOCK\x00${lang}\x00${text}\x00END_CODE\x00`;
      }

      // Table — pass through as HTML
      if (tag === 'table') return `\x00TABLE\x00${el.outerHTML}\x00END_TABLE\x00`;

      // Headings
      if (tag === 'h1') return '\n# '    + el.textContent + '\n';
      if (tag === 'h2') return '\n## '   + el.textContent + '\n';
      if (tag === 'h3') return '\n### '  + el.textContent + '\n';
      if (tag === 'h4') return '\n#### ' + el.textContent + '\n';

      // Inline
      if (tag === 'strong' || tag === 'b') return '**' + childrenToMarkdown(el, depth) + '**';
      if (tag === 'em'     || tag === 'i') return '_'  + childrenToMarkdown(el, depth) + '_';

      // Lists
      if (tag === 'ul' || tag === 'ol') return '\n' + childrenToMarkdown(el, depth) + '\n';
      if (tag === 'li') {
        const prefix = depth > 0 ? '  '.repeat(depth) : '';
        return prefix + '- ' + childrenToMarkdown(el, depth + 1).trim() + '\n';
      }

      // Block elements
      if (tag === 'p')          return childrenToMarkdown(el, depth) + '\n\n';
      if (tag === 'br')         return '\n';
      if (tag === 'hr')         return '\n---\n';
      if (tag === 'blockquote') return '\n> ' + childrenToMarkdown(el, depth).replace(/\n/g, '\n> ') + '\n';
      if (tag === 'a') {
        const href = el.getAttribute('href') || '';
        const text = childrenToMarkdown(el, depth);
        return href ? `[${text}](${href})` : text;
      }

      if (el.nodeType === 3) return el.textContent;
      return childrenToMarkdown(el, depth);
    }

    function childrenToMarkdown(el, depth) {
      let r = '';
      for (const c of el.childNodes) r += nodeToMarkdown(c, depth);
      return r;
    }

    const raw = nodeToMarkdown(proseEl, 0);
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
    const convMatch  = window.location.pathname.match(/\/c\/([a-f0-9-]{36})/);
    const shareMatch = window.location.pathname.match(/\/share\/([a-f0-9-]{36})/);
    const conversationId = (convMatch || shareMatch)?.[1] || null;

    let turns = Array.from(document.querySelectorAll('article[data-testid*="conversation-turn"]'));
    if (turns.length === 0) turns = Array.from(document.querySelectorAll('[data-message-id]'));
    if (turns.length === 0) {
      turns = [...new Set(
        Array.from(document.querySelectorAll('[data-message-author-role]'))
          .map(el => el.closest('article, [class*="group"]') || el)
      )];
    }
    if (turns.length === 0) return null;

    const messages = [];

    for (const turn of turns) {
      const roleEl = turn.querySelector('[data-message-author-role]')
        || turn.closest('[data-message-author-role]');
      const role = roleEl?.getAttribute('data-message-author-role') === 'user' ? 'user' : 'assistant';

      if (role === 'user') {
        const userText = (
          turn.querySelector('[data-message-author-role="user"]')?.innerText
          || turn.innerText || ''
        ).trim();
        if (userText) messages.push({ id: null, role: 'user', content: [{ type: 'text', text: userText }], createdAt: null });
        continue;
      }

      const proseEl =
        turn.querySelector('.markdown.prose') ||
        turn.querySelector('[class*="markdown"][class*="prose"]') ||
        turn.querySelector('.markdown') ||
        turn.querySelector('.prose') ||
        turn.querySelector('[class*="markdown"]') ||
        turn.querySelector('[class*="prose"]') ||
        turn.querySelector('[data-message-author-role="assistant"] > div') ||
        turn.querySelector('[data-message-author-role="assistant"]');

      if (!proseEl) continue;

      const blocks = extractBlocksFromProseEl(proseEl);
      if (blocks && blocks.length > 0) {
        messages.push({ id: null, role: 'assistant', content: blocks, createdAt: null });
      }
    }

    if (messages.length === 0) return null;

    return {
      id:        conversationId,
      title:     document.title.replace(/\s*[-–|]?\s*ChatGPT\s*$/i, '').trim() || 'ChatGPT Conversation',
      platform:  'chatgpt',
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
      sendResponse({ ok: true, platform: 'chatgpt', url: window.location.href });
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
        console.error('[CCE:ChatGPT] Error:', err);
        sendResponse({ ok: false, error: err.message });
      }
      return false;
    }
  });

})();
