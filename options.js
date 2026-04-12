/**
 * AI Chat Exporter — Settings Page
 *
 * Reads/writes the 'cce_language' preference in chrome.storage.sync.
 * Values: 'auto' | 'en' | 'de'
 */

(async () => {
  'use strict';

  await initI18n();
  applyI18n();
  document.title = t('settingsPageTitle');

  // Load current setting
  const stored = await chrome.storage.sync.get('cce_language');
  const langSelect = document.getElementById('langSelect');
  langSelect.value = stored.cce_language || 'auto';

  document.getElementById('saveBtn').addEventListener('click', async () => {
    await chrome.storage.sync.set({ cce_language: langSelect.value });
    const savedMsg = document.getElementById('savedMsg');
    savedMsg.style.display = 'inline';
    setTimeout(() => { savedMsg.style.display = 'none'; }, 2000);
  });
})();
