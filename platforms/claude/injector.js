/**
 * Claude Chat Exporter - Page Context Injector
 * 
 * This script is injected into the page's context (not the content script's
 * isolated world) so it can:
 * 1. Intercept fetch() calls to capture conversation API data & org ID
 * 2. Make authenticated API calls using the page's session cookies
 * 
 * Communication with content script happens via window.postMessage.
 */

(function () {
  'use strict';

  const CCE_PREFIX = 'cce:';
  const state = {
    orgId: null,
    conversationCache: {},
    debug: false
  };

  function log(...args) {
    if (state.debug) console.log('[CCE:Injector]', ...args);
  }

  // ─── Fetch Interception ─────────────────────────────────────────────

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const [resource, options] = args;
    const url = typeof resource === 'string' ? resource : resource?.url || '';

    // Extract org ID from any API call
    const orgMatch = url.match(/\/api\/organizations\/([a-f0-9-]+)\//);
    if (orgMatch && !state.orgId) {
      state.orgId = orgMatch[1];
      log('Captured org ID:', state.orgId);
      window.postMessage({ type: CCE_PREFIX + 'org-id', orgId: state.orgId }, window.location.origin);
    }

    // Intercept conversation load responses
    const convMatch = url.match(/\/api\/organizations\/[a-f0-9-]+\/chat_conversations\/([a-f0-9-]+)(?:\?|$)/);
    if (convMatch && (!options?.method || options.method === 'GET')) {
      const convId = convMatch[1];
      log('Intercepted conversation fetch:', convId);

      try {
        const response = await originalFetch.apply(this, args);
        const clone = response.clone();

        // Parse in background, don't block the original call
        clone.json().then(data => {
          if (data && data.uuid) {
            state.conversationCache[convId] = data;
            log('Cached conversation:', convId, '- Messages:', data.chat_messages?.length);
            window.postMessage({
              type: CCE_PREFIX + 'conversation-cached',
              convId: convId,
              messageCount: data.chat_messages?.length || 0
            }, window.location.origin);
          }
        }).catch(() => { /* Not JSON or other error, ignore */ });

        return response;
      } catch (err) {
        throw err;
      }
    }

    return originalFetch.apply(this, args);
  };

  // ─── Message Handler (requests from content script) ─────────────────

  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data?.type?.startsWith(CCE_PREFIX + 'request:')) return;

    const requestType = event.data.type.replace(CCE_PREFIX + 'request:', '');
    const requestId = event.data.requestId;

    log('Received request:', requestType, event.data);

    try {
      switch (requestType) {

        case 'get-org-id': {
          // If we already have it, return immediately
          if (state.orgId) {
            respond(requestId, { orgId: state.orgId });
          } else {
            // Try to find it from the page
            const orgId = await discoverOrgId();
            respond(requestId, { orgId });
          }
          break;
        }

        case 'fetch-conversation': {
          const { conversationId, isShared } = event.data;

          // Check cache first
          if (state.conversationCache[conversationId]) {
            log('Returning cached conversation:', conversationId);
            respond(requestId, { data: state.conversationCache[conversationId] });
            break;
          }

          // Shared chats use a different endpoint (no auth required)
          if (isShared) {
            log('Fetching shared conversation:', conversationId);
            const url = `/api/share/${conversationId}`;
            try {
              const response = await originalFetch(url);
              if (!response.ok) {
                respond(requestId, { error: `Shared chat API returned ${response.status}` });
                break;
              }
              const data = await response.json();
              state.conversationCache[conversationId] = data;
              respond(requestId, { data });
            } catch (err) {
              respond(requestId, { error: 'Shared chat fetch failed: ' + err.message });
            }
            break;
          }

          // Need org ID for private chats
          const orgId = state.orgId || await discoverOrgId();
          if (!orgId) {
            respond(requestId, { error: 'Could not determine organization ID. Try refreshing the page.' });
            break;
          }

          log('Fetching conversation via API:', conversationId);
          const url = `/api/organizations/${orgId}/chat_conversations/${conversationId}?tree=True&rendering_mode=messages&render_all_tools=true`;

          // Retry logic
          let lastError = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const response = await originalFetch(url);
              if (response.ok) {
                const data = await response.json();
                state.conversationCache[conversationId] = data;
                respond(requestId, { data });
                lastError = null;
                break;
              } else if (response.status === 401 || response.status === 403) {
                respond(requestId, { error: 'Authentication failed — you may need to log in again' });
                lastError = null;
                break;
              } else {
                lastError = `API returned ${response.status}: ${response.statusText}`;
              }
            } catch (err) {
              lastError = err.message;
            }
            // Brief delay before retry
            if (attempt < 1) await new Promise(r => setTimeout(r, 1000));
          }
          if (lastError) respond(requestId, { error: lastError });
          break;
        }

        case 'fetch-file': {
          const { url } = event.data;
          log('Fetching file:', url);

          // Only allow fetching from claude.ai — reject arbitrary URLs
          if (!url || !url.startsWith('https://claude.ai/')) {
            respond(requestId, { error: 'Invalid URL: only https://claude.ai/ URLs are allowed' });
            break;
          }

          try {
            const response = await originalFetch(url);
            if (!response.ok) {
              respond(requestId, { error: `File fetch failed: ${response.status}` });
              break;
            }

            const blob = await response.blob();
            const reader = new FileReader();
            reader.onload = () => {
              respond(requestId, {
                base64: reader.result,
                mimeType: blob.type,
                size: blob.size
              });
            };
            reader.onerror = () => respond(requestId, { error: 'FileReader failed' });
            reader.readAsDataURL(blob);
          } catch (err) {
            respond(requestId, { error: err.message });
          }
          break;
        }

        case 'set-debug': {
          state.debug = event.data.enabled;
          respond(requestId, { ok: true });
          break;
        }
      }
    } catch (err) {
      log('Error handling request:', err);
      respond(requestId, { error: err.message });
    }
  });

  // ─── Helpers ────────────────────────────────────────────────────────

  function respond(requestId, payload) {
    window.postMessage({
      type: CCE_PREFIX + 'response:' + requestId,
      ...payload
    }, window.location.origin);
  }

  async function discoverOrgId() {
    if (state.orgId) return state.orgId;

    try {
      // Try the bootstrap endpoint
      const resp = await originalFetch('/api/bootstrap');
      if (resp.ok) {
        const data = await resp.json();
        // Look for org ID in various places
        if (data.account?.memberships?.[0]?.organization?.uuid) {
          state.orgId = data.account.memberships[0].organization.uuid;
        } else if (data.account?.active_organization?.uuid) {
          state.orgId = data.account.active_organization.uuid;
        }
      }
    } catch (e) {
      log('Bootstrap fetch failed:', e);
    }

    if (!state.orgId) {
      try {
        // Fallback: try organizations endpoint
        const resp = await originalFetch('/api/organizations');
        if (resp.ok) {
          const orgs = await resp.json();
          if (Array.isArray(orgs) && orgs.length > 0) {
            state.orgId = orgs[0].uuid;
          }
        }
      } catch (e) {
        log('Organizations fetch failed:', e);
      }
    }

    if (state.orgId) {
      log('Discovered org ID:', state.orgId);
      window.postMessage({ type: CCE_PREFIX + 'org-id', orgId: state.orgId }, window.location.origin);
    }

    return state.orgId;
  }

  // Signal that injector is ready
  window.postMessage({ type: CCE_PREFIX + 'injector-ready' }, window.location.origin);
  log('Injector loaded');

})();
