# AI Chat Exporter

> English version: [README.md](README.md)

Browser-Extension zum Exportieren von Gesprächen aus **Claude**, **ChatGPT**, **Gemini** und **Microsoft Copilot** — als vollständige, eigenständige Dateien die ohne Account, ohne Plattform und ohne Internetverbindung funktionieren.

**Version:** 1.3.4 · **Browser:** Chrome, Edge

---

## Unterstützte Plattformen

| Plattform | URL | Methode | Hinweis |
|-----------|-----|---------|---------|
| 🔶 **Claude** | claude.ai | API + DOM-Fallback | Vollständiger Funktionsumfang inkl. Artifacts, Thinking, Tool-Calls |
| 🟢 **ChatGPT** | chatgpt.com | DOM-Scraping | Text, Code, Tabellen — keine interaktiven Widgets |
| 🔵 **Gemini** | gemini.google.com | DOM-Scraping | Text, Code, Tabellen |
| 🪟 **Microsoft Copilot** | m365.cloud.microsoft/chat | DOM-Scraping | Text, Code, Tabellen |

> **Hinweis:** Der Funktionsumfang variiert je nach Plattform. Claude nutzt die offizielle API und liefert strukturierte Daten inkl. aller Block-Typen. Bei ChatGPT, Gemini und Copilot werden die Inhalte aus dem gerenderten DOM ausgelesen — Text und Code werden zuverlässig exportiert, plattformspezifische Inhalte wie Artifacts oder interaktive Elemente stehen dort nicht zur Verfügung.

---

## Warum diese Extension?

### Kein Vendor-Lock-in beim Teilen

Geteilte Chats sind plattformgebunden und schließen viele Empfänger aus:

- **ChatGPT Enterprise** — ein geteilter Chat ist nur für Empfänger zugänglich, die im selben Unternehmens-Account laufen.
- **Claude** — geteilte Chats zeigen keine Artifacts und visuellen Inhalte, wenn der Empfänger keinen Claude-Account besitzt.

Der Export funktioniert für **jeden** — als einfache HTML-, ZIP-, Markdown- oder PDF-Datei, ohne Account, ohne Login, ohne Abhängigkeit von der Plattform.

### Langzeitarchiv

Chats mit wichtigen Entscheidungen, Code-Reviews, Analysen oder Recherchen bleiben als eigenständige Dateien dauerhaft erhalten — unabhängig davon ob das Konto noch existiert, das Abo ausläuft oder die Plattform ihren Dienst einstellt.

### Vollständiger Inhalt

Nicht nur der Text: Artifacts (interaktive React-Apps, Diagramme, SVGs), generierte Dateien, Code-Blöcke mit Syntax-Highlighting und Tabellen werden vollständig exportiert und bleiben im Export funktionsfähig.

### Vier Formate für jeden Zweck

| Format | Ideal für |
|--------|-----------|
| **HTML** | Teilen mit Kollegen, Einbetten in Dokumentation, vollständig offline nutzbar |
| **ZIP** | Alle Dateien und Artifacts einzeln zugänglich, direkt weiterverwendbar |
| **Markdown** | Obsidian, Notion, Confluence, Git-Repositories |
| **PDF** | Formelle Dokumentation, Meetings, Archivierung |

---

## Installation

### Chrome / Edge

1. ZIP herunterladen und **entpacken**
2. `chrome://extensions` öffnen (oder `edge://extensions`)
3. **Entwicklermodus** aktivieren (Schalter oben rechts)
4. **Entpackte Erweiterung laden** klicken
5. Den entpackten Ordner `ai-chat-exporter` auswählen
6. Das Extension-Icon erscheint in der Toolbar

> **Wichtig:** Der Ordner, aus dem die Extension geladen wurde, darf **nicht verschoben oder gelöscht** werden. Chrome lädt die Extension-Dateien direkt aus diesem Verzeichnis — wird er entfernt, funktioniert die Extension nicht mehr und muss neu installiert werden.

> **Nach einem Update:** Auf der Extensions-Seite auf das Reload-Symbol klicken, damit neue Kontextmenüeinträge und Berechtigungen aktiv werden.

---

## Verwendung

### Variante 1 — Toolbar-Icon

1. Einen Chat auf einer unterstützten Plattform öffnen
2. Extension-Icon in der Toolbar klicken
3. Format wählen: **HTML**, **ZIP**, **Markdown** oder **PDF**
4. **Export Chat** klicken — oder **Preview & Select** für selektiven Export

### Variante 2 — Rechtsklick-Kontextmenü

Rechtsklick auf die Seite → **„Chat exportieren"**:

- Als HTML exportieren
- Als Markdown exportieren
- Als ZIP exportieren
- Als PDF exportieren
- Preview & Select…

Der Export startet sofort — kein Popup nötig.

### Variante 3 — Preview & Select

Öffnet einen eigenen Tab mit der vollständigen Gesprächsansicht:

- **Checkboxen pro Nachricht** und **pro Block** (Text, Code, Artifact, Bild, Thinking, Tool-Output etc.)
- Alles standardmäßig ausgewählt
- Schnellauswahl-Buttons:
  - **Select All / Deselect All** — alle Nachrichten und Blöcke
  - **Deselect All Prompts** — nur die eigenen Fragen abwählen
  - **Deselect Tool Output** — Thinking, Tool-Calls, Web-Suche etc. abwählen
- Format wählen und **Export Selected** klicken

---

## Unterstützte Inhalte nach Plattform

| Inhaltstyp | Claude | ChatGPT | Gemini | Copilot |
|------------|:------:|:-------:|:------:|:-------:|
| Text mit Formatierung | ✅ | ✅ | ✅ | ✅ |
| Code-Blöcke | ✅ | ✅ | ✅ | ✅ |
| Tabellen | ✅ | ✅ | ✅ | ✅ |
| Artifacts (React, HTML, SVG) | ✅ interaktiv | — | — | — |
| Visualizer-Widgets | ✅ | — | — | — |
| Thinking Blocks | ✅ | — | — | — |
| Tool-Calls / Web-Suche | ✅ optional | — | — | — |
| Eingebettete Bilder | ✅ | — | — | — |
| Generierte Dateien | ✅ | — | — | — |
| Timestamps & Metadaten | ✅ | — | — | — |

*Die Einschränkungen bei ChatGPT, Gemini und Copilot sind technisch bedingt: Diese Plattformen stellen keine zugängliche API für den Abruf von Chatverläufen bereit, weshalb der Inhalt aus dem gerenderten DOM ausgelesen wird.*

---

## Datenschutz

- Alle Verarbeitung findet **lokal im Browser** statt — es wird keine separate Cloud-Infrastruktur verwendet.
- Es werden **keine Daten an Dritte oder externe Server** gesendet.
- **Claude (API-Modus):** Beim Export wird die bestehende Browser-Session genutzt, um die Konversation über die Claude-API abzurufen. Dabei werden Session-Informationen (Authentifizierungstoken) an die Claude-Plattform gesendet — dies sind jedoch dieselben Informationen, die der Browser bereits beim normalen Benutzen des Chats überträgt. Es werden keine zusätzlichen Daten preisgegeben, die nicht ohnehin schon Teil der laufenden Session sind.
- **ChatGPT, Gemini, Copilot (DOM-Scraping):** Keinerlei Netzwerkanfragen — der Inhalt wird ausschließlich aus dem bereits im Browser geladenen DOM gelesen.
- `chrome.storage.session` für die Datenweitergabe an die Preview-Seite — wird beim Schließen des Browsers automatisch gelöscht.
- Die Extension aktiviert sich nur auf den vier unterstützten Domains und ist auf allen anderen Seiten vollständig inaktiv.

---

## Architektur

```
ai-chat-exporter/
├── manifest.json              v1.3.4, permissions: activeTab, storage,
│                              downloads, scripting, tabs, contextMenus
├── background.js              Downloads, Kontextmenü, Tab-Öffnung für PDF
├── popup.html / popup.js      UI, Plattformerkennung, Export-Orchestrierung
├── popup.css
├── preview.html / preview.js  Preview & Select (chrome.storage.session)
│                              Unterstützt ?autoexport=<format> für Direktexport
│                              aus dem Kontextmenü
│
├── platforms/
│   ├── claude/
│   │   ├── injector.js        Page Context: fetch-Patch, Org-ID, Auth-API
│   │   └── content.js         Bridge + API-Normalisierung + DOM-Fallback
│   ├── chatgpt/
│   │   └── content.js         DOM-Scraping (CodeMirror, Tabellen als HTML-Sentinel)
│   ├── gemini/
│   │   └── content.js         DOM-Scraping (Angular: user-query, model-response)
│   └── copilot/
│       └── content.js         DOM-Scraping (Fluent UI: fai-UserMessage,
│                              fai-CopilotMessage, scriptor-component-code-block)
│
└── shared/
    ├── utils.js               escHtml, markdownToHtml, formatFileSize
    ├── widget-css.js          CSS-Variablen + Artifact/Visualizer-Builder
    ├── html-template.js       Export-HTML-Template mit Copy-Button, Dark Mode
    └── exporters/
        ├── html.js            HTML & PDF Exporter
        ├── markdown.js        Markdown Exporter
        └── zip.js             ZIP Exporter (2-Pass: Artifacts, Files, Images)
```

---

## Neue Plattform hinzufügen

1. `platforms/<name>/content.js` erstellen
2. In `manifest.json` unter `content_scripts` und `host_permissions` eintragen
3. In `background.js` → `SUPPORTED_URLS` ergänzen
4. In `popup.js` → `detectPlatform()` und `platformLabel()` ergänzen
5. In `shared/exporters/html.js` → Badge-Mapping ergänzen

---

## Lizenz

Business Source License 1.1 — kostenlos für private, nicht-kommerzielle und interne geschäftliche Nutzung. Wechselt am 2031-04-04 zu Apache 2.0. Details in [LICENSE.md](LICENSE.md).
