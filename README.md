# TikTok Recipes – Dokumentation

Dieses Tool ermöglicht es, TikTok Rezepte direkt über den iOS Teilen-Button in einer Notion Datenbank zu speichern. Claude (Anthropic API) analysiert die Caption automatisch und extrahiert Rezeptname, Kategorie, Zutaten und Zubereitung.

---

## Architektur

```
TikTok Teilen-Button
→ iOS Shortcut
→ Vercel Serverless Function (api/save-recipe.js)
→ TikTok oEmbed API (Caption holen)
→ Anthropic API / Claude Haiku (Rezept extrahieren)
→ Notion API (Seite erstellen)
→ Bestätigung ans iPhone
```

---

## 1. Voraussetzungen

- GitHub Account
- Vercel Account (kostenlos, mit GitHub verbinden)
- Notion Account
- Anthropic Account (console.anthropic.com)
- iPhone mit Shortcuts App

---

## 2. Notion Setup

### 2a. Datenbank erstellen

1. Neue Seite in Notion erstellen
2. Typ **„Table"** auswählen
3. Folgende Spalten anlegen:

| Spaltenname | Typ |
|---|---|
| Name | Title |
| Kategorie | Select |
| Zutaten | Multi-select |
| TikTok URL | URL |
| Hinzugefügt am | Created time |

### 2b. Notion Integration erstellen

1. Gehe zu [notion.so/my-integrations](https://notion.so/my-integrations)
2. Klicke auf **„+ New integration"**
3. Name: `TikTok Rezepte`
4. Workspace auswählen → **„Submit"**
5. **Integration Token kopieren** (`secret_...`)

### 2c. Datenbank mit Integration verbinden

1. Datenbank als **Full Page** öffnen
2. Oben rechts **„..."** → **„Connections"**
3. Integration `TikTok Rezepte` hinzufügen

### 2d. Datenbank-ID kopieren

Die URL der Datenbank sieht so aus:
```
https://www.notion.so/abc123def456ghi789...?v=xyz
```
Der Teil **vor** dem `?v=` ist die Datenbank-ID.

---

## 3. Anthropic API Setup

1. Account erstellen auf [console.anthropic.com](https://console.anthropic.com)
2. **„API Keys"** → **„Create Key"**
3. Key kopieren (`sk-ant-...`)
4. Guthaben aufladen (min. $5 – reicht für tausende Rezepte)

> **Hinweis:** Nur Kreditkarte oder Debitkarte werden akzeptiert, kein PayPal.

---

## 4. GitHub Repository erstellen

1. Auf [github.com](https://github.com) → **„New"**
2. Name: `TikTok-recipes`
3. **Private** auswählen
4. ✅ **„Add a README file"** anhaken
5. **„Create repository"**

---

## 5. Code

### Dateistruktur

```
TikTok-recipes/
├── api/
│   ├── save-recipe.js   → Hauptlogik
│   └── prompt.js        → Claude Prompt
├── package.json
└── vercel.json
```

### package.json

Definiert die benötigten Abhängigkeiten – siehe [`package.json`](./package.json).

### vercel.json

Konfiguriert die Vercel Serverless Function mit Speicher und maximaler Laufzeit – siehe [`vercel.json`](./vercel.json).

### api/prompt.js

Enthält den Claude Prompt als separate Datei – so kann der Prompt angepasst werden ohne die Hauptlogik zu ändern – siehe [`api/prompt.js`](./api/prompt.js).

### api/save-recipe.js

Hauptlogik der Anwendung – empfängt die TikTok URL, löst sie auf, holt die Caption, extrahiert das Rezept via Claude und speichert es in Notion – siehe [`api/save-recipe.js`](./api/save-recipe.js).

## 6. Vercel Setup

### 6a. Account erstellen

1. Gehe auf [vercel.com](https://vercel.com)
2. **„Sign Up"** → **„Continue with GitHub"**

### 6b. Projekt deployen

1. **„Add New Project"** → **„Import Git Repository"**
2. Repo `TikTok-recipes` auswählen → **„Import"**
3. Alles auf Standard lassen → **„Deploy"**

### 6c. Environment Variables eintragen

1. Vercel Projekt → **„Settings"** → **„Environment Variables"**
2. Folgende drei Variablen eintragen (alle Environments auswählen):

| Name | Wert |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `NOTION_TOKEN` | `secret_...` |
| `NOTION_DATABASE_ID` | Datenbank-ID |

3. Danach **„Deployments"** → **„Redeploy"**

> **Wichtig:** API Keys niemals direkt im Code eintragen – immer über Environment Variables!

---

## 7. iOS Shortcut einrichten

### Shortcut erstellen

1. **Shortcuts App** öffnen → **„+"**
2. Folgende 3 Actions in dieser Reihenfolge hinzufügen:

**Action 1:** `URLs von Share-Sheet erhalten`
- Wenn es keine Eingabe gibt: Fortfahren

**Action 2:** `Inhalte von URL abrufen`
- URL: `https://DEINE-VERCEL-URL.vercel.app/api/save-recipe`
  > Deine URL findest du in Vercel → dein Projekt → „Domains", z.B. `https://tik-tok-recipes.vercel.app`
- Methode: **POST**
- Haupttext anfordern: **JSON**
- Schlüssel: `url` / Wert: **Kurzbefehl-Eingabe** (blaue Variable)

**Action 3:** `Wert für "message" in Inhalt der URL abrufen`
- Wörterbuch: **Inhalt der URL**
- Schlüssel: `message`

**Action 4:** `Mitteilung anzeigen`
- Nachricht: **Wörterbuchwert** (Variable aus Action 3)

### Im Teilen-Menü aktivieren

1. Shortcut Namen tippen → **„Details"**
2. **„Im Share Sheet anzeigen"** aktivieren

### Verwendung

1. TikTok öffnen
2. Rezept-Video → **Teilen**
3. **„Rezept speichern"** antippen
4. Kurz warten (~5 Sekunden)
5. Notification erscheint mit Bestätigung

---

## 8. Troubleshooting

| Fehler | Ursache | Lösung |
|---|---|---|
| `TikTok URL fehlt` | Shortcut übergibt URL nicht korrekt | Wert bei Schlüssel `url` auf **Kurzbefehl-Eingabe** setzen |
| `Caption enthält keine Rezeptinformationen` | Video hat keine oder nur Hashtag-Caption | Anderes Video versuchen |
| `Kein Rezept in der Caption gefunden` | Claude hat kein Rezept erkannt | Caption enthält kein strukturiertes Rezept |
| `Bereits gespeichert: [Name]` | Duplicate Check hat angeschlagen | Rezept ist bereits in Notion vorhanden |
| `404 NOT FOUND` | Vercel findet die Funktion nicht | Dateistruktur prüfen: `api/save-recipe.js` |
| Deployment schlägt fehl | Environment Variables fehlen | In Vercel Settings → Environment Variables prüfen |

---

## 9. Kosten

| Service | Kosten |
|---|---|
| Vercel | Kostenlos (Hobby Plan) |
| GitHub | Kostenlos |
| Notion | Kostenlos |
| Anthropic API | ~$0.001 pro Rezept (Haiku Modell) |

Mit $5 Startguthaben bei Anthropic können ca. 5.000 Rezepte gespeichert werden.

---

## 10. Mögliche Erweiterungen

- **Mehr Kategorien** – Prompt in `api/prompt.js` anpassen
- **Andere Sprachen** – Prompt erweitern
- **Mehrere Nutzer** – Supabase für User-Management hinzufügen
- **Notion OAuth** – „Connect with Notion" Button für andere Nutzer
- **Modell wechseln** – von Haiku zu Sonnet für bessere Extraktion