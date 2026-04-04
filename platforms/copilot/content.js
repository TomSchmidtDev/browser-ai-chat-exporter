/**
 * AI Chat Exporter – Microsoft Copilot Content Script (Isolated World)
 * v1.2.3 — improved selectors + debug logging
 */

(function () {
  'use strict';

  const CCE_PREFIX = 'cce:';

  // Language names for detecting from sibling heading context
  const LANG_NAMES = /\b(java(?:script)?|typescript|python|c\+\+|c#|csharp|go|rust|sql|bash|shell|powershell|html|css|xml|json|yaml|kotlin|swift|ruby|php|scala|haskell)\b/i;

  // ═══════════════════════════════════════════════════════════════════════
  // ─── extractBlocksFromMarkdown ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  function extractBlocksFromMarkdown(markdownEl) {
    if (!markdownEl) return [];
    const blocks = [];

    function nodeToMarkdown(el, depth, prevSiblingText) {
      const tag = el.nodeName.toLowerCase();

      if (tag === 'button') return '';
      if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return '';
      if (tag === 'svg') return '';

      // ── Copilot code block: identified by aria-label OR own className ──
      // ONLY check this element's own attributes, never querySelector
      // (querySelector would match ancestor divs that merely contain code blocks)
      if (tag === 'div' || tag === 'section') {
        const ariaLabel = el.getAttribute && el.getAttribute('aria-label');
        const cls = el.className || '';

        const isCodeGroupWrapper = ariaLabel && /codevorschau|code\s*preview/i.test(ariaLabel);
        const isScriptorRoot = /\bscriptor-component-code-block\b/.test(cls);

        if (isCodeGroupWrapper || isScriptorRoot) {
          const paragraphs = Array.from(
            el.querySelectorAll('.scriptor-paragraph, [class*="scriptor-paragraph"]')
          );
          let codeText = '';
          if (paragraphs.length > 0) {
            codeText = paragraphs.map(p => {
              const runs = Array.from(p.querySelectorAll('[class*="scriptor-textRun"]'));
              if (runs.length > 0) {
                return runs
                  .filter(r => !r.className.includes('nonDisplayable') || r.textContent.trim())
                  .map(r => r.textContent).join('');
              }
              return p.textContent;
            }).join('\n');
          } else {
            // Fallback: raw textContent of the block
            codeText = el.textContent;
          }
          const lang = (prevSiblingText && LANG_NAMES.exec(prevSiblingText))?.[1]?.toLowerCase() || '';
          if (codeText.trim()) return `\x00CODE_BLOCK\x00${lang}\x00${codeText}\x00END_CODE\x00`;
          return '';
        }
      }

      // ── Table ─────────────────────────────────────────────────────────
      if (tag === 'table') return `\x00TABLE\x00${el.outerHTML}\x00END_TABLE\x00`;

      // ── Standard pre/code ─────────────────────────────────────────────
      if (tag === 'pre') {
        const codeEl = el.querySelector('code');
        const target = codeEl || el;
        const lm = (target.className || '').match(/language-(\w+)/);
        return `\x00CODE_BLOCK\x00${lm ? lm[1] : ''}\x00${target.textContent}\x00END_CODE\x00`;
      }
      if (tag === 'code') {
        const cls = el.className || '';
        if (/language-\w+/.test(cls)) {
          const lm = cls.match(/language-(\w+)/);
          return `\x00CODE_BLOCK\x00${lm ? lm[1] : ''}\x00${el.textContent}\x00END_CODE\x00`;
        }
        return '`' + el.textContent + '`';
      }

      // ── Headings ──────────────────────────────────────────────────────
      if (tag === 'h1') return '\n# '    + el.textContent + '\n';
      if (tag === 'h2') return '\n## '   + el.textContent + '\n';
      if (tag === 'h3') return '\n### '  + el.textContent + '\n';
      if (tag === 'h4') return '\n#### ' + el.textContent + '\n';

      // ── Inline ────────────────────────────────────────────────────────
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

      if (el.nodeType === 3) return el.textContent;
      return childrenToMarkdown(el, depth);
    }

    function childrenToMarkdown(el, depth) {
      let result = '';
      let lastText = '';
      for (const child of el.childNodes) {
        const out = nodeToMarkdown(child, depth, lastText);
        result += out;
        const stripped = out.replace(/\x00[^\x00]*\x00/g, '').trim();
        if (stripped) lastText = stripped;
      }
      return result;
    }

    const raw = nodeToMarkdown(markdownEl, 0, '');
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
    const messages = [];

    // ── Strategy 1: role="article" with fai- classes ───────────────────
    let allArticles = Array.from(document.querySelectorAll(
      '[role="article"][class*="fai-UserMessage"], [role="article"][class*="fai-CopilotMessage"]'
    ));

    console.log('[CCE:Copilot] Strategy 1 (fai- articles):', allArticles.length,
      allArticles.map(a => a.className.match(/fai-\w+/)?.[0]).join(', '));

    // ── Strategy 2: data-testid based ─────────────────────────────────
    if (allArticles.length === 0) {
      // Find all user and copilot message containers via data-testid
      const userDivs    = Array.from(document.querySelectorAll('[data-testid*="user-message"]'));
      const copilotDivs = Array.from(document.querySelectorAll('[data-testid*="copilot-message"]'));

      console.log('[CCE:Copilot] Strategy 2 — user testid:', userDivs.length, 'copilot testid:', copilotDivs.length);

      // Interleave by DOM position
      const combined = [...userDivs, ...copilotDivs].sort((a, b) => {
        const pos = a.compareDocumentPosition(b);
        return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
      allArticles = combined;
    }

    // ── Strategy 3: markdown-reply elements directly ───────────────────
    if (allArticles.length === 0) {
      console.log('[CCE:Copilot] Strategy 3 — direct markdown-reply elements');
      const markdownReplies = document.querySelectorAll('[data-testid="markdown-reply"]');
      console.log('[CCE:Copilot] markdown-reply elements:', markdownReplies.length);

      for (const markdownEl of markdownReplies) {
        const blocks = extractBlocksFromMarkdown(markdownEl);
        if (blocks?.length > 0) {
          messages.push({ id: null, role: 'assistant', content: blocks, createdAt: null });
        }
      }
      if (messages.length > 0) return buildResult(messages);
      return null;
    }

    console.log('[CCE:Copilot] Processing', allArticles.length, 'articles');

    for (const article of allArticles) {
      const cls = article.className || '';
      const testid = article.getAttribute('data-testid') || '';
      const isUser = /fai-UserMessage/.test(cls) || /user-message/.test(testid);

      if (isUser) {
        const textEl = article.querySelector('[data-testid="chatOutput"]')
          || article.querySelector('.fai-UserMessage__message')
          || article;
        const text = (textEl.innerText || textEl.textContent || '').trim();
        console.log('[CCE:Copilot] User message text length:', text.length);
        if (text) messages.push({ id: null, role: 'user', content: [{ type: 'text', text }], createdAt: null });
      } else {
        // Copilot response — try multiple selectors for the content area
        const markdownEl =
          article.querySelector('[data-testid="markdown-reply"]') ||
          article.querySelector('.fai-CopilotMessage__content') ||
          article.querySelector('[class*="CopilotMessage__content"]') ||
          article;

        // Deep diagnostic: find where content actually lives
        const firstP = article.querySelector('p');
        console.log('[CCE:Copilot] First <p> in article:', firstP?.textContent?.substring(0, 80));
        console.log('[CCE:Copilot] First <p> parent testid:', firstP?.parentElement?.getAttribute('data-testid'));
        console.log('[CCE:Copilot] First <p> ancestor chain:',
          (function(el) {
            const chain = [];
            let cur = el?.parentElement;
            for (let i = 0; i < 8 && cur; i++, cur = cur.parentElement) {
              chain.push(cur.tagName + (cur.getAttribute('data-testid') ? '['+cur.getAttribute('data-testid')+']' : '') + (cur.className ? '.'+cur.className.split(' ')[0] : ''));
            }
            return chain.join(' > ');
          })(firstP)
        );

        // Check shadow root on markdown-reply
        const mrEl = article.querySelector('[data-testid="markdown-reply"]');
        if (mrEl?.shadowRoot) {
          console.log('[CCE:Copilot] markdown-reply has shadowRoot! innerHTML[0:200]:', mrEl.shadowRoot.innerHTML?.substring(0, 200));
        }

        // Check lastChatMessage
        const lastChat = article.querySelector('[data-testid="lastChatMessage"]');
        console.log('[CCE:Copilot] lastChatMessage found:', !!lastChat, 'textContent length:', lastChat?.textContent?.length);

        // Check all data-testid elements in article
        const testidEls = Array.from(article.querySelectorAll('[data-testid]'));
        console.log('[CCE:Copilot] All data-testid in article:', testidEls.map(e => e.getAttribute('data-testid') + '(' + e.textContent.length + ')').join(', '));

        // Use the element that actually contains text
        const contentEl = [
          article.querySelector('[data-testid="lastChatMessage"]'),
          article.querySelector('[data-testid="markdown-reply"]'),
          article.querySelector('.fai-CopilotMessage__content'),
          article
        ].find(el => el && el.textContent.trim().length > 0) || markdownEl;

        console.log('[CCE:Copilot] Using contentEl testid:', contentEl?.getAttribute?.('data-testid'), 'textContent length:', contentEl?.textContent?.length);

        const blocks = extractBlocksFromMarkdown(contentEl);
        console.log('[CCE:Copilot] Copilot blocks extracted:', blocks?.length ?? 0);
        if (blocks?.length > 0) {
          messages.push({ id: null, role: 'assistant', content: blocks, createdAt: null });
        }
      }
    }

    if (messages.length === 0) return null;
    return buildResult(messages);
  }

  function buildResult(messages) {
    const title = document.title
      .replace(/\s*[-–|]?\s*(Microsoft Copilot|Copilot)\s*$/i, '').trim()
      || 'Copilot Conversation';
    return { id: null, title, platform: 'copilot', createdAt: null, model: null, source: 'dom', messages };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Main Handler ──────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const { type } = message;

    if (type === CCE_PREFIX + 'ping') {
      sendResponse({ ok: true, platform: 'copilot', url: window.location.href });
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
        console.error('[CCE:Copilot] Error:', err);
        sendResponse({ ok: false, error: err.message });
      }
      return false;
    }
  });

})();
