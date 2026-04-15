/**
 * Claude Chat Exporter - Content Script
 * 
 * Runs in an isolated world on claude.ai pages.
 * Responsibilities:
 * 1. Inject the page-context script (platforms/claude/injector.js)
 * 2. Bridge messages between injector ↔ popup/background
 * 3. DOM scraping fallback when API data is unavailable
 * 4. Extract rendered content (images, artifact renders)
 */

(function () {
  'use strict';

  const CCE_PREFIX = 'cce:';
  const TIMEOUT_MS = 15000;

  let injectorReady = false;
  let pendingRequests = {};
  let requestCounter = 0;
  let cachedOrgId = null;

  // ─── Inject Page Context Script ─────────────────────────────────────

  function injectPageScript() {
    const doInject = () => {
      try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('platforms/claude/injector.js');
        script.onload = () => script.remove();
        script.onerror = () => {
          console.warn('[CCE:Content] Injector script failed to load');
          script.remove();
        };
        (document.head || document.documentElement).appendChild(script);
      } catch (e) {
        console.warn('[CCE:Content] Injection failed:', e.message);
      }
    };

    // Since we run at document_start, DOM might not be ready
    if (document.head || document.documentElement) {
      doInject();
    } else {
      document.addEventListener('DOMContentLoaded', doInject, { once: true });
    }
  }

  injectPageScript();

  // ─── PostMessage Bridge (Injector ↔ Content Script) ─────────────────

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data?.type?.startsWith(CCE_PREFIX)) return;

    const type = event.data.type;

    // Injector is ready
    if (type === CCE_PREFIX + 'injector-ready') {
      injectorReady = true;
      console.log('[CCE:Content] Injector ready');
      return;
    }

    // Org ID captured
    if (type === CCE_PREFIX + 'org-id') {
      cachedOrgId = event.data.orgId;
      return;
    }

    // Response to a request we made
    if (type.startsWith(CCE_PREFIX + 'response:')) {
      const requestId = type.replace(CCE_PREFIX + 'response:', '');
      if (pendingRequests[requestId]) {
        pendingRequests[requestId].resolve(event.data);
        delete pendingRequests[requestId];
      }
      return;
    }
  });

  // Send request to injector and wait for response
  function requestFromInjector(requestType, payload = {}) {
    return new Promise((resolve, reject) => {
      const requestId = 'req_' + (++requestCounter) + '_' + Date.now();

      pendingRequests[requestId] = { resolve, reject };

      // Timeout
      setTimeout(() => {
        if (pendingRequests[requestId]) {
          pendingRequests[requestId].reject(new Error('Injector request timed out'));
          delete pendingRequests[requestId];
        }
      }, TIMEOUT_MS);

      window.postMessage({
        type: CCE_PREFIX + 'request:' + requestType,
        requestId,
        ...payload
      }, window.location.origin);
    });
  }

  // ─── Chrome Runtime Message Handler (Popup ↔ Content Script) ───────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'cce:ping') {
      sendResponse({ ok: true, injectorReady, url: window.location.href });
      return false;
    }

    if (message.type === 'cce:get-chat-data') {
      getChatData(message.options || {})
        .then(data => sendResponse({ ok: true, data }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true; // async response
    }

    if (message.type === 'cce:get-dom-images') {
      getDomImages()
        .then(images => sendResponse({ ok: true, images }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    if (message.type === 'cce:get-artifact-renders') {
      getArtifactRenders()
        .then(renders => sendResponse({ ok: true, renders }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    if (message.type === 'cce:set-debug') {
      requestFromInjector('set-debug', { enabled: message.enabled }).catch(() => {});
      sendResponse({ ok: true });
      return false;
    }
  });

  // ─── Main Data Collection ──────────────────────────────────────────

  async function getChatData(options = {}) {
    const urlInfo = getConversationIdFromUrl();
    if (!urlInfo) {
      throw new Error('Not on a Claude conversation page');
    }

    const { conversationId, isShared } = urlInfo;
    let apiData = null;
    let domData = null;
    let source = 'none';

    // Wait briefly for injector if it's not ready yet
    if (!injectorReady) {
      await new Promise(resolve => {
        let waited = 0;
        const check = setInterval(() => {
          waited += 100;
          if (injectorReady || waited >= 3000) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }

    // Try API first
    if (injectorReady) {
      try {
        const result = await requestFromInjector('fetch-conversation', { conversationId, isShared });
        if (result.data && !result.error) {
          apiData = result.data;
          source = 'api';
          console.log('[CCE:Content] Got API data:', apiData.chat_messages?.length, 'messages');
        } else if (result.error) {
          console.warn('[CCE:Content] API fetch error:', result.error);
        }
      } catch (err) {
        console.warn('[CCE:Content] Injector request failed:', err.message);
      }
    }

    // DOM scraping as fallback or supplement
    try {
      domData = scrapeDOM();
      if (!apiData) source = 'dom';
      else source = 'hybrid';
    } catch (err) {
      console.warn('[CCE:Content] DOM scraping failed:', err.message);
    }

    if (!apiData && !domData) {
      throw new Error('Could not extract chat data from API or DOM');
    }

    // Normalize into our standard format
    const normalized = normalizeData(apiData, domData, conversationId);
    normalized.isShared = isShared;

    // Fetch images as base64 if requested
    if (options.includeImages) {
      await enrichWithImages(normalized);
    }

    return normalized;
  }

  // ─── URL Parsing ───────────────────────────────────────────────────

  function getConversationIdFromUrl() {
    // Matches various URL patterns:
    // /chat/{id}
    // /share/{id}
    // /project/{projectId}/chat/{id}
    const chatMatch = window.location.pathname.match(/\/chat\/([a-f0-9-]+)/);
    const shareMatch = window.location.pathname.match(/\/share\/([a-f0-9-]+)/);
    
    if (chatMatch) {
      return { conversationId: chatMatch[1], isShared: false };
    }
    if (shareMatch) {
      return { conversationId: shareMatch[1], isShared: true };
    }
    return null;
  }

  // ─── API Data Normalization ────────────────────────────────────────

  function normalizeData(apiData, domData, conversationId) {
    if (apiData) {
      return normalizeApiData(apiData, domData);
    }
    return normalizeDomData(domData, conversationId);
  }

  function normalizeApiData(apiData, domData) {
    const messages = [];

    // Shared chats may use different keys for messages
    const rawMessages = apiData.chat_messages || apiData.messages || [];

    for (const msg of rawMessages) {
      const role = msg.sender === 'human' ? 'user' : (msg.role === 'user' ? 'user' : 'assistant');
      const contentBlocks = [];

      // Process content array
      const contents = msg.content || [];
      for (const block of contents) {
        switch (block.type) {
          case 'text':
            if (block.text && block.text.trim()) {
              contentBlocks.push({ type: 'text', text: block.text });
            }
            break;

          case 'thinking':
            if (block.thinking || block.text) {
              contentBlocks.push({
                type: 'thinking',
                text: block.thinking || block.text || ''
              });
            }
            break;

          case 'tool_use':
            processToolUse(block, contentBlocks);
            break;

          case 'tool_result':
            processToolResult(block, contentBlocks);
            break;

          case 'image':
            contentBlocks.push({
              type: 'image',
              mediaType: block.source?.media_type || 'image/png',
              base64: block.source?.data || null,
              src: null
            });
            break;

          case 'document':
            contentBlocks.push({
              type: 'document',
              mediaType: block.source?.media_type || 'application/octet-stream',
              title: block.title || 'Document'
            });
            break;

          case 'code':
            contentBlocks.push({
              type: 'code',
              language: block.language || '',
              code: block.text || block.code || ''
            });
            break;

          default:
            // Don't lose unknown blocks — might be useful for debugging
            if (block.type) {
              contentBlocks.push({ type: 'unknown', blockType: block.type, raw: block });
            }
        }
      }

      // Process attachments
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          contentBlocks.push({
            type: 'attachment',
            fileName: att.file_name || att.filename || 'attachment',
            fileSize: att.file_size || att.size || 0,
            fileType: att.file_type || att.content_type || 'unknown',
            extractedContent: att.extracted_content || null
          });
        }
      }

      // Process files
      if (msg.files && msg.files.length > 0) {
        for (const file of msg.files) {
          contentBlocks.push({
            type: 'file',
            fileName: file.file_name || file.filename || 'file',
            fileUrl: file.content?.url || file.url || null,
            fileType: file.content?.content_type || file.content_type || 'unknown'
          });
        }
      }

      messages.push({
        id: msg.uuid,
        role,
        content: contentBlocks,
        createdAt: msg.created_at || null,
        updatedAt: msg.updated_at || null
      });
    }

    return {
      id: apiData.uuid,
      title: apiData.name || apiData.title || 'Untitled Chat',
      platform: 'claude',
      createdAt: apiData.created_at || null,
      updatedAt: apiData.updated_at || null,
      model: apiData.model || apiData.settings?.model || null,
      projectId: apiData.project_uuid || null,
      isShared: false,
      source: 'api',
      messages
    };
  }

  function processToolUse(block, contentBlocks) {
    const name = block.name || '';
    const input = block.input || {};

    // ── Artifact creation/update ──
    if (name === 'artifacts' || name === 'create_artifact' || name === 'rewrite_artifact') {
      const cmd = input.command || (name === 'create_artifact' ? 'create' : name === 'rewrite_artifact' ? 'rewrite' : 'create');
      contentBlocks.push({
        type: 'artifact',
        artifactId: input.id || block.id || null,
        command: cmd,
        title: input.title || 'Artifact',
        artifactType: input.type || 'text/plain',
        language: input.language || detectLanguage(input.type),
        sourceCode: input.content || input.new_str || '',
        version: input.version_uuid || null
      });
      return;
    }

    // ── Visualizer (multiple naming variants) ──
    if (name === 'show_widget' || name === 'visualize' ||
        name === 'visualize:show_widget' || name === 'visualize:read_me') {
      if (name === 'visualize:read_me') {
        // Skip internal read_me calls — not user-visible
        return;
      }
      contentBlocks.push({
        type: 'visualizer',
        title: input.title || 'Visualization',
        code: input.widget_code || input.code || input.content || ''
      });
      return;
    }

    // ── File creation / editing (computer use) ──
    if (name === 'create_file' || name === 'file_create') {
      contentBlocks.push({
        type: 'file_creation',
        path: input.path || input.file_path || '',
        content: input.file_text || input.content || '',
        description: input.description || ''
      });
      return;
    }

    if (name === 'str_replace' || name === 'str_replace_editor') {
      contentBlocks.push({
        type: 'file_edit',
        path: input.path || '',
        oldStr: input.old_str || '',
        newStr: input.new_str || '',
        description: input.description || ''
      });
      return;
    }

    if (name === 'bash_tool' || name === 'bash' || name === 'execute_bash') {
      contentBlocks.push({
        type: 'bash',
        command: input.command || '',
        description: input.description || ''
      });
      return;
    }

    if (name === 'view' || name === 'view_file') {
      contentBlocks.push({
        type: 'file_view',
        path: input.path || '',
        viewRange: input.view_range || null,
        description: input.description || ''
      });
      return;
    }

    if (name === 'present_files') {
      contentBlocks.push({
        type: 'present_files',
        paths: input.filepaths || input.paths || []
      });
      return;
    }

    // ── Web search ──
    if (name === 'web_search' || name === 'search') {
      contentBlocks.push({
        type: 'web_search',
        query: input.query || ''
      });
      return;
    }

    if (name === 'web_fetch') {
      contentBlocks.push({
        type: 'web_fetch',
        url: input.url || ''
      });
      return;
    }

    if (name === 'image_search') {
      contentBlocks.push({
        type: 'image_search',
        query: input.query || ''
      });
      return;
    }

    // ── Message composition ──
    if (name === 'message_compose_v1') {
      contentBlocks.push({
        type: 'message_compose',
        kind: input.kind || '',
        variants: input.variants || []
      });
      return;
    }

    // ── Sports / Weather / Recipe / Map ──
    if (name === 'fetch_sports_data' || name === 'weather_fetch' ||
        name === 'recipe_display_v0' || name === 'places_search' ||
        name === 'places_map_display_v0') {
      contentBlocks.push({
        type: 'widget_tool',
        toolName: name,
        input: input
      });
      return;
    }

    // ── Memory tools ──
    if (name === 'memory_user_edits' || name === 'conversation_search' || name === 'recent_chats') {
      contentBlocks.push({
        type: 'system_tool',
        toolName: name,
        input: input
      });
      return;
    }

    // ── MCP tools (pattern: mcp__{uuid}__{toolName}) ──
    if (name.startsWith('mcp__')) {
      const parts = name.split('__');
      contentBlocks.push({
        type: 'mcp_tool',
        serverId: parts[1] || '',
        toolName: parts.slice(2).join('__') || name,
        input: input
      });
      return;
    }

    // ── Generic fallback ──
    contentBlocks.push({
      type: 'tool_use',
      toolId: block.id,
      toolName: name,
      input: input
    });
  }

  function processToolResult(block, contentBlocks) {
    const content = block.content;
    if (!content) return;

    if (typeof content === 'string') {
      contentBlocks.push({ type: 'tool_result', text: content });
    } else if (Array.isArray(content)) {
      for (const item of content) {
        if (item.type === 'text') {
          contentBlocks.push({ type: 'tool_result', text: item.text });
        } else if (item.type === 'image') {
          contentBlocks.push({
            type: 'image',
            mediaType: item.source?.media_type || 'image/png',
            base64: item.source?.data || null
          });
        }
      }
    }
  }

  function detectLanguage(artifactType) {
    if (!artifactType) return 'text';
    const map = {
      'application/vnd.ant.react': 'jsx',
      'text/html': 'html',
      'text/css': 'css',
      'text/javascript': 'javascript',
      'application/javascript': 'javascript',
      'image/svg+xml': 'svg',
      'text/markdown': 'markdown',
      'text/x-python': 'python',
      'application/vnd.ant.code': 'code',
      'application/vnd.ant.mermaid': 'mermaid'
    };
    return map[artifactType] || 'text';
  }

  // ─── DOM Scraping Fallback ─────────────────────────────────────────

  function scrapeDOM() {
    const messages = [];
    const title = document.title?.replace(' - Claude', '').trim() || 'Untitled Chat';

    // Find message containers - Claude uses various structures
    // Try multiple selectors for resilience
    const messageEls = document.querySelectorAll(
      '[data-testid*="message"], ' +
      '[class*="Message"], ' +
      '.prose, ' +
      '[data-is-streaming]'
    );

    // Fallback: find the main conversation container and iterate its children
    let conversationContainer = null;
    if (messageEls.length === 0) {
      conversationContainer = document.querySelector(
        '[class*="conversation"], [class*="ChatMessages"], main'
      );
    }

    const elements = messageEls.length > 0
      ? messageEls
      : (conversationContainer?.children ? Array.from(conversationContainer.children) : []);

    let currentRole = 'user';
    for (const el of elements) {
      const role = detectMessageRole(el);
      if (role) currentRole = role;

      const contentBlocks = extractContentFromElement(el);
      if (contentBlocks.length > 0) {
        messages.push({
          id: el.id || el.getAttribute('data-message-id') || `dom_${messages.length}`,
          role: currentRole,
          content: contentBlocks
        });
      }
    }

    return {
      title,
      source: 'dom',
      messages
    };
  }

  function detectMessageRole(el) {
    const text = el.textContent?.toLowerCase() || '';
    const classes = el.className?.toLowerCase() || '';
    const testId = el.getAttribute('data-testid') || '';

    if (testId.includes('human') || classes.includes('human') || classes.includes('user')) return 'user';
    if (testId.includes('assistant') || classes.includes('assistant') || classes.includes('claude')) return 'assistant';

    // Check for avatar or role indicators
    const avatar = el.querySelector('[class*="avatar"], [class*="Avatar"]');
    if (avatar) {
      const avatarText = avatar.textContent?.trim() || '';
      if (avatarText.includes('You') || avatarText.includes('H')) return 'user';
      if (avatarText.includes('C') || avatarText.includes('A')) return 'assistant';
    }

    return null;
  }

  function extractContentFromElement(el) {
    const blocks = [];

    // Text content
    const textNodes = el.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote');
    if (textNodes.length > 0) {
      const textParts = [];
      textNodes.forEach(node => {
        const text = node.textContent?.trim();
        if (text) textParts.push(text);
      });
      if (textParts.length > 0) {
        blocks.push({ type: 'text', text: textParts.join('\n\n') });
      }
    } else {
      // Fallback: direct text content
      const directText = el.textContent?.trim();
      if (directText && directText.length > 0) {
        blocks.push({ type: 'text', text: directText });
      }
    }

    // Code blocks
    el.querySelectorAll('pre code, pre').forEach(codeEl => {
      const lang = codeEl.className?.match(/language-(\w+)/)?.[1] || '';
      blocks.push({
        type: 'code',
        language: lang,
        code: codeEl.textContent || ''
      });
    });

    // Images
    el.querySelectorAll('img').forEach(img => {
      blocks.push({
        type: 'image',
        src: img.src,
        alt: img.alt || '',
        base64: img.src?.startsWith('data:') ? img.src : null
      });
    });

    // Artifact iframes
    el.querySelectorAll('iframe').forEach(iframe => {
      try {
        const srcdoc = iframe.getAttribute('srcdoc') || '';
        blocks.push({
          type: 'artifact',
          title: iframe.title || 'Embedded Artifact',
          renderedHtml: srcdoc || iframe.contentDocument?.documentElement?.outerHTML || '',
          artifactType: 'text/html'
        });
      } catch (e) {
        // Cross-origin iframe access blocked
        blocks.push({
          type: 'artifact',
          title: iframe.title || 'Embedded Artifact',
          note: 'Cross-origin content could not be extracted'
        });
      }
    });

    return blocks;
  }

  function normalizeDomData(domData, conversationId) {
    return {
      id: conversationId,
      title: domData.title || 'Untitled Chat',
      platform: 'claude',
      createdAt: null,
      updatedAt: null,
      model: null,
      source: 'dom',
      messages: domData.messages || []
    };
  }

  // ─── Image Enrichment ─────────────────────────────────────────────

  async function enrichWithImages(normalized) {
    for (const msg of normalized.messages) {
      for (const block of msg.content) {
        if (block.type === 'image' && block.src && !block.base64) {
          try {
            const result = await requestFromInjector('fetch-file', { url: block.src });
            if (result.base64) {
              block.base64 = result.base64;
              block.mediaType = result.mimeType;
            }
          } catch (e) {
            console.warn('[CCE:Content] Failed to fetch image:', block.src, e.message);
          }
        }
      }
    }
  }

  // ─── DOM Image Extraction ──────────────────────────────────────────

  async function getDomImages() {
    const images = [];
    const imgElements = document.querySelectorAll('main img, [class*="conversation"] img');

    for (const img of imgElements) {
      try {
        if (img.src?.startsWith('data:')) {
          images.push({ base64: img.src, alt: img.alt || '' });
        } else if (img.src) {
          // Convert to base64 via canvas
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          images.push({ base64: dataUrl, alt: img.alt || '', src: img.src });
        }
      } catch (e) {
        images.push({ src: img.src, alt: img.alt || '', error: 'CORS restricted' });
      }
    }

    return images;
  }

  // ─── Artifact Render Capture ───────────────────────────────────────

  async function getArtifactRenders() {
    const renders = [];
    const iframes = document.querySelectorAll('iframe[title], iframe[class*="artifact"]');

    for (const iframe of iframes) {
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          renders.push({
            title: iframe.title || 'Artifact',
            html: doc.documentElement.outerHTML
          });
        }
      } catch (e) {
        renders.push({
          title: iframe.title || 'Artifact',
          srcdoc: iframe.getAttribute('srcdoc') || null,
          error: 'Cross-origin access blocked'
        });
      }
    }

    return renders;
  }

  console.log('[CCE:Content] Content script loaded on', window.location.href);

})();
