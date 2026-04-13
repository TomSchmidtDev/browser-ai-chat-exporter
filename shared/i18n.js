/**
 * AI Chat Exporter — i18n (Internationalization)
 * Supported languages: 'en' (English), 'de' (Deutsch)
 * Language preference stored in chrome.storage.sync as 'cce_language'
 * Values: 'en' | 'de' | 'auto' (default — uses browser UI language)
 */

const CCE_MESSAGES = {
  en: {
    // ── Status ─────────────────────────────────────────────────────────
    checkingConnection:    'Checking connection…',
    noActiveTab:           'No active tab',
    noSupportedTab:        'No supported chat tab active',
    connecting:            'Connecting to $1…',
    contentScriptNotReady: 'Content script not ready — reload the page',
    ready:                 '$1 — ready',
    connected:             'Connected — $1',
    couldNotLoadPreview:   'could not load preview',

    // ── Chat meta ──────────────────────────────────────────────────────
    unknownModel: 'unknown model',
    messages:     'messages',
    artifacts:    'artifacts',

    // ── Popup UI ───────────────────────────────────────────────────────
    exportFormat:      'Export Format',
    options:           'Options',
    includeArtifacts:  'Include artifacts & canvas',
    embedImages:       'Embed images as Base64',
    includeThinking:   'Include thinking blocks',
    includeToolCalls:  'Include tool calls / results',
    includeFiles:      'Include generated files',
    exportChat:        'Export Chat',
    previewAndSelect:  'Preview & Select',
    opening:           'Opening…',
    exporting:         'Exporting…',
    debugLog:          'Debug Log',
    supportedPlatforms:'Supported Platforms',
    settings:          'Settings',

    // ── Progress ───────────────────────────────────────────────────────
    starting:          'Starting…',
    fetchingChatData:  'Fetching chat data…',
    generating:        'Generating $1…',
    preparingDownload: 'Preparing download…',
    exportComplete:    'Export complete!',
    pdfReady:          'PDF ready — Ctrl+P to print',
    zipReady:          'ZIP ready!',

    // ── Errors / info ──────────────────────────────────────────────────
    noDataLoaded:        'No chat data loaded yet. Wait for the connection.',
    couldNotOpenPreview: 'Could not open preview: $1',

    // ── Context menus ──────────────────────────────────────────────────
    menuRoot:     'Export chat',
    menuHtml:     '📄 Export as HTML',
    menuMarkdown: '📝 Export as Markdown',
    menuZip:      '📦 Export as ZIP',
    menuPdf:      '🖨️ Export as PDF',
    menuPreview:  '📋 Preview & Select…',

    // ── Preview page ───────────────────────────────────────────────────
    previewPageTitle:   '📋 Preview & Select',
    loadingChat:        'Loading chat data…',
    exportSelected:     '⬇ Export Selected',
    exportingBtn:       '⏳ Exporting…',
    doneBtn:            '✓ Done!',
    deselectAll:        'De-/Select All',
    deselectPrompts:    'Deselect Prompts',
    deselectTools:      'Deselect Tool Output',
    noMessagesSelected: 'No messages selected. Please select at least one message.',
    noDataFound:        'No chat data found. Please trigger the export from the extension popup.',
    messagesAndBlocks:  '$1/$2 messages · $3/$4 blocks selected',
    roleUser:           'You',
    roleAssistant:      'Assistant',
    nBlocks:            '$1 blocks',
    metaMessages:       '$1 messages',
    metaModel:          'Model: $1',
    metaCreated:        'Created: $1',
    exportingAs:        'Exporting as $1…',

    // ── Block labels (Preview) ─────────────────────────────────────────
    bEmpty:      '(empty)',
    bArtifact:   'Artifact',
    bViz:        'Visualization',
    bCanvas:     'Canvas',
    bImage:      'Image',
    bThinking:   'Thinking',
    bSearch:     'Search',
    bFetch:      'Fetch',
    bDownload:   'Download',
    bResult:     'Result',
    bTable:      'Table / HTML block',
    bTool:       'Tool',
    bDraft:      'Message Draft',

    // ── Options page ───────────────────────────────────────────────────
    settingsPageTitle: 'Settings — AI Chat Exporter',
    settingsHeading:   'Settings',
    languageLabel:     'Language',
    languageAuto:      'Auto (browser default)',
    languageEn:        'English',
    languageDe:        'Deutsch',
    saveBtn:           'Save',
    savedConfirm:      'Saved!',
  },

  de: {
    // ── Status ─────────────────────────────────────────────────────────
    checkingConnection:    'Verbindung wird geprüft…',
    noActiveTab:           'Kein aktiver Tab',
    noSupportedTab:        'Kein unterstützter Chat-Tab aktiv',
    connecting:            'Verbinde mit $1…',
    contentScriptNotReady: 'Content Script nicht bereit — Seite neu laden',
    ready:                 '$1 — bereit',
    connected:             'Verbunden — $1',
    couldNotLoadPreview:   'Vorschau konnte nicht geladen werden',

    // ── Chat meta ──────────────────────────────────────────────────────
    unknownModel: 'unbekanntes Modell',
    messages:     'Nachrichten',
    artifacts:    'Artefakte',

    // ── Popup UI ───────────────────────────────────────────────────────
    exportFormat:      'Exportformat',
    options:           'Optionen',
    includeArtifacts:  'Artefakte & Canvas einschließen',
    embedImages:       'Bilder als Base64 einbetten',
    includeThinking:   'Thinking-Blöcke einschließen',
    includeToolCalls:  'Tool-Calls / Ergebnisse einschließen',
    includeFiles:      'Generierte Dateien einschließen',
    exportChat:        'Chat exportieren',
    previewAndSelect:  'Vorschau & Auswahl',
    opening:           'Öffne…',
    exporting:         'Exportiere…',
    debugLog:          'Debug-Log',
    supportedPlatforms:'Unterstützte Plattformen',
    settings:          'Einstellungen',

    // ── Progress ───────────────────────────────────────────────────────
    starting:          'Starte…',
    fetchingChatData:  'Chat-Daten werden geladen…',
    generating:        '$1 wird generiert…',
    preparingDownload: 'Download wird vorbereitet…',
    exportComplete:    'Export abgeschlossen!',
    pdfReady:          'PDF bereit — Strg+P zum Drucken',
    zipReady:          'ZIP bereit!',

    // ── Errors / info ──────────────────────────────────────────────────
    noDataLoaded:        'Noch keine Chat-Daten geladen. Warte auf die Verbindung.',
    couldNotOpenPreview: 'Vorschau konnte nicht geöffnet werden: $1',

    // ── Context menus ──────────────────────────────────────────────────
    menuRoot:     'Chat exportieren',
    menuHtml:     '📄 Als HTML exportieren',
    menuMarkdown: '📝 Als Markdown exportieren',
    menuZip:      '📦 Als ZIP exportieren',
    menuPdf:      '🖨️ Als PDF exportieren',
    menuPreview:  '📋 Vorschau & Auswahl…',

    // ── Preview page ───────────────────────────────────────────────────
    previewPageTitle:   '📋 Vorschau & Auswahl',
    loadingChat:        'Chat-Daten werden geladen…',
    exportSelected:     '⬇ Auswahl exportieren',
    exportingBtn:       '⏳ Exportiere…',
    doneBtn:            '✓ Fertig!',
    deselectAll:        'Alle aus-/abwählen',
    deselectPrompts:    'Prompts abwählen',
    deselectTools:      'Tool-Ausgabe abwählen',
    noMessagesSelected: 'Keine Nachrichten ausgewählt. Bitte mindestens eine Nachricht auswählen.',
    noDataFound:        'Keine Chat-Daten gefunden. Bitte Export aus dem Extension-Popup starten.',
    messagesAndBlocks:  '$1/$2 Nachrichten · $3/$4 Blöcke ausgewählt',
    roleUser:           'Du',
    roleAssistant:      'Assistent',
    nBlocks:            '$1 Blöcke',
    metaMessages:       '$1 Nachrichten',
    metaModel:          'Modell: $1',
    metaCreated:        'Erstellt: $1',
    exportingAs:        'Exportiere als $1…',

    // ── Block labels (Preview) ─────────────────────────────────────────
    bEmpty:      '(leer)',
    bArtifact:   'Artefakt',
    bViz:        'Visualisierung',
    bCanvas:     'Canvas',
    bImage:      'Bild',
    bThinking:   'Denken',
    bSearch:     'Suche',
    bFetch:      'Abruf',
    bDownload:   'Download',
    bResult:     'Ergebnis',
    bTable:      'Tabelle / HTML-Block',
    bTool:       'Tool',
    bDraft:      'Nachrichtenentwurf',

    // ── Options page ───────────────────────────────────────────────────
    settingsPageTitle: 'Einstellungen — AI Chat Exporter',
    settingsHeading:   'Einstellungen',
    languageLabel:     'Sprache',
    languageAuto:      'Automatisch (Browser-Standard)',
    languageEn:        'English',
    languageDe:        'Deutsch',
    saveBtn:           'Speichern',
    savedConfirm:      'Gespeichert!',
  }
};

// ── Runtime state ───────────────────────────────────────────────────────────
let _lang = 'en';

/**
 * Resolve a stored preference value to a supported language code.
 * Falls back to browser UI language, then 'en'.
 */
function resolveLang(pref) {
  if (pref && pref !== 'auto' && CCE_MESSAGES[pref]) return pref;
  try {
    const ui = chrome.i18n.getUILanguage().split('-')[0].toLowerCase();
    return CCE_MESSAGES[ui] ? ui : 'en';
  } catch (_) {
    return 'en';
  }
}

/**
 * Load language preference from chrome.storage.sync.
 * Must be awaited before calling t() in any page script.
 */
async function initI18n() {
  try {
    const stored = await chrome.storage.sync.get('cce_language');
    _lang = resolveLang(stored.cce_language);
  } catch (_) {
    _lang = 'en';
  }
}

/**
 * Translate key with optional positional substitutions ($1, $2, …).
 */
function t(key, ...args) {
  let msg = CCE_MESSAGES[_lang]?.[key] ?? CCE_MESSAGES['en']?.[key] ?? key;
  args.forEach((arg, i) => { msg = msg.replace('$' + (i + 1), String(arg)); });
  return msg;
}

/**
 * Apply data-i18n / data-i18n-title attributes throughout a DOM root.
 */
function applyI18n(root) {
  const r = root || document;
  r.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  r.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  r.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
}

function getCurrentLang() { return _lang; }
