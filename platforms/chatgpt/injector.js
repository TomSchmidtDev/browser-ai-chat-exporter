/**
 * AI Chat Exporter – ChatGPT Injector (Page Context)
 *
 * Runs in the page's JavaScript context (not isolated world) so it can:
 *  • Patch window.fetch to passively capture the conversation ID
 *  • Make authenticated API calls using the existing session cookies
 *
 * Communication: window.postMessage with prefix 'cce:'
 */

(function () {
  'use strict';

  const PREFIX  = 'cce:';
  const ORIGIN  = window.location.origin;

  // ── State ──────────────────────────────────────────────────────────────
  let capturedConversationId = null;

  // ── Announce readiness ─────────────────────────────────────────────────
  window.postMessage({ type: PREFIX + 'injector-ready', platform: 'chatgpt' }, ORIGIN);

  // ── Patch fetch to passively capture conversation ID ──────────────────
  const _origFetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const convMatch = url.match(/\/backend-api\/conversation\/([a-f0-9-]{36})/);
    if (convMatch) capturedConversationId = convMatch[1];
    return _origFetch.apply(this, args);
  };

  // ── Derive conversation ID from URL ──────────────────────────────────
  function getConversationIdFromUrl() {
    const convMatch  = window.location.pathname.match(/\/c\/([a-f0-9-]{36})/);
    if (convMatch)  return convMatch[1];
    const shareMatch = window.location.pathname.match(/\/share\/([a-f0-9-]{36})/);
    if (shareMatch) return shareMatch[1];
    return null;
  }

  function isSharedUrl() {
    return /\/share\//.test(window.location.pathname);
  }

  // ── Fetch conversation from ChatGPT API ────────────────────────────────
  async function fetchConversation(conversationId) {
    const url = `${ORIGIN}/backend-api/conversation/${conversationId}`;
    const resp = await _origFetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });
    if (!resp.ok) throw new Error(`ChatGPT API ${resp.status}: ${resp.statusText}`);
    return resp.json();
  }

  // ── Message handler ────────────────────────────────────────────────────
  window.addEventListener('message', async (event) => {
    if (event.origin !== ORIGIN) return;
    const { type, requestId } = event.data || {};
    if (!type?.startsWith(PREFIX + 'request:')) return;

    const action = type.slice((PREFIX + 'request:').length);

    try {
      if (action === 'get-conversation-id') {
        const id = getConversationIdFromUrl() || capturedConversationId;
        window.postMessage({
          type: PREFIX + 'response:' + requestId,
          data: { conversationId: id, isShared: isSharedUrl() }
        }, ORIGIN);
        return;
      }

      if (action === 'fetch-conversation') {
        // event.data.conversationId might arrive as a plain string or as an object
        // (guard against the object-as-string bug)
        let id = event.data.conversationId;
        if (id && typeof id === 'object') id = id.id || null;
        id = id || getConversationIdFromUrl() || capturedConversationId;

        if (!id) throw new Error('No conversation ID found. Navigate to a ChatGPT conversation first.');
        const data = await fetchConversation(id);
        window.postMessage({ type: PREFIX + 'response:' + requestId, data }, ORIGIN);
        return;
      }

      throw new Error(`Unknown action: ${action}`);

    } catch (err) {
      window.postMessage({
        type:  PREFIX + 'response:' + requestId,
        error: err.message
      }, ORIGIN);
    }
  });

})();
