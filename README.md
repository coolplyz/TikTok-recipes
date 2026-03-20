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

```json
{
  "name": "tiktok-rezepte",
  "version": "1.0.0",
  "dependencies": {
    "@notionhq/client": "^2.2.15",
    "@anthropic-ai/sdk": "^0.27.0"
  }
}
```

### vercel.json

```json
{
  "version": 2,
  "functions": {
    "api/save-recipe.js": {
      "memory": 256,
      "maxDuration": 30
    }
  }
}
```

### api/prompt.js

Enthält den Claude Prompt als separate Datei – so kann der Prompt angepasst werden ohne die Hauptlogik zu ändern.

```javascript
export function buildPrompt(caption) {
  return `Du bist ein präziser Rezept-Extraktor der TikTok Captions analysiert und strukturierte Rezeptdaten extrahiert. Deine Ausgabe wird direkt in eine Datenbank gespeichert – Fehler im Format führen zu einem Systemfehler.

Regeln:
- Erkenne Rezepte auf Deutsch UND Englisch
- Ist das Rezept auf Englisch, übersetze name, zutaten_detail und zubereitung ins Deutsche
- Ist das Rezept bereits auf Deutsch, behalte es so
- Enthält die Caption ein Rezept, extrahiere dieses eine
- Enthält die Caption mehrere Rezepte, extrahiere ALLE als separate Einträge
- Ist kein Rezeptname erkennbar, erstelle einen passenden kurzen Namen
- Enthält die Caption kein erkennbares Rezept, gib ein leeres Array zurück: []

Kategorisierung nach Hauptkomponente:
- Pasta → wenn Nudeln die Hauptkomponente sind
- Reis → wenn Reis die Hauptkomponente ist
- Kartoffeln → wenn Kartoffeln die Hauptkomponente sind
- Suppe → wenn es sich um eine Suppe oder Eintopf handelt
- Snack → kleine Gerichte, Fingerfood, Dips
- Sonstiges → alles andere (Fleisch, Salate, Bowls etc.)

Für zutaten_tags gilt:
- Maximal 5 Tags pro Rezept
- NUR die wichtigsten Hauptzutaten als kurze Begriffe ohne Mengenangaben
- Erlaubt: Proteine (Hähnchen, Lachs, Tofu, Hackfleisch, Eier, Käse)
- Erlaubt: Hauptgemüse und Früchte (Tomate, Paprika, Brokkoli)
- Erlaubt: Hauptkohlenhydrate (Reis, Pasta, Kartoffeln, Nudeln)
- Erlaubt: Besondere Zutaten (Feta, Kimchi, Miso, Kokosmilch)
- NICHT erlaubt: Salz, Pfeffer, Olivenöl, Butter, Wasser, Brühe
- NICHT erlaubt: Gewürze unter 1 EL (Kurkuma, Kreuzkümmel, Paprikapulver)
- NICHT erlaubt: Standardzutaten die in jedem Rezept vorkommen
- Immer auf Deutsch (z.B. "Hähnchen" statt "Chicken")

Für zutaten_detail gilt:
- Alle Zutaten MIT Mengenangaben als Array auf Deutsch
- Jede Zutat als eigener Eintrag: ["400g Hähnchenbrust", "200g Reis"]
- Falls keine Zutaten vorhanden: ["Keine Zutaten angegeben"]

Für zubereitung gilt:
- Jeden Schritt als eigener Eintrag im Array
- Sind Zubereitungsschritte explizit in der Caption vorhanden, extrahiere NUR diese
- Sind KEINE Schritte in der Caption vorhanden, erfinde sinnvolle Schritte basierend auf den Zutaten und füge als ERSTEN Eintrag im Array hinzu: "⚠️ Keine Zubereitung gefunden – im Video nachschauen. Folgende Zubereitung von Claude empfohlen:"
- Sind Schritte vorhanden, kein Disclaimer nötig

Antworte NUR als reines JSON Array, keine Backticks, kein Markdown, keine Erklärungen.

Caption: "${caption}"

Format:
[
  {
    "name": "Kurzer prägnanter Rezeptname auf Deutsch",
    "kategorie": "Pasta | Reis | Kartoffeln | Snack | Suppe | Sonstiges",
    "zutaten_tags": ["Hähnchen", "Reis"],
    "zutaten_detail": ["400g Hähnchenbrust", "200g Reis", "2 Knoblauchzehen"],
    "zubereitung": ["Hähnchen würzen und anbraten", "Reis kochen", "Alles vermengen"]
  }
]`;
}
```

### api/save-recipe.js

```javascript
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@notionhq/client";
import { buildPrompt } from "./prompt.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const notion = new Client({ auth: process.env.NOTION_TOKEN });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "❌ Method not allowed" });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ message: "❌ TikTok URL fehlt" });
  }

  try {
    // 1. URL auflösen falls verkürzt (vm.tiktok.com)
    let resolvedUrl = url;
    if (url.includes("vm.tiktok.com") || url.includes("vt.tiktok.com")) {
      const response = await fetch(url, { redirect: "follow" });
      resolvedUrl = response.url;
    }

    // 2. TikTok Caption holen
    const oembedRes = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl)}`
    );
    const oembed = await oembedRes.json();
    const caption = oembed.title || "";

    // 3. Caption validieren – leere oder nur Hashtag Captions abfangen
    const cleanCaption = caption.replace(/#\w+/g, "").trim();
    if (!cleanCaption) {
      return res.status(400).json({
        message: "❌ Keine Rezeptinformationen in der Caption gefunden",
      });
    }

    // 4. Duplicate Check – URL bereits in Notion?
    const existing = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
      filter: {
        property: "TikTok URL",
        url: { equals: resolvedUrl },
      },
    });

    if (existing.results.length > 0) {
      const name = existing.results[0].properties.Name.title[0]?.plain_text;
      return res.status(409).json({
        message: `⚠️ Bereits gespeichert: ${name}`,
      });
    }

    // 5. Claude extrahiert Rezepte
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: buildPrompt(caption) }],
    });

    // 6. Antwort parsen
    const raw = message.content[0].text.replace(/```json|```/g, "").trim();
    const rezepte = JSON.parse(raw);

    if (!Array.isArray(rezepte) || rezepte.length === 0) {
      return res.status(400).json({
        message: "❌ Kein Rezept in der Caption gefunden",
      });
    }

    // 7. Für jedes Rezept eine Notion-Seite erstellen
    const gespeichert = [];

    for (const rezept of rezepte) {
      await notion.pages.create({
        parent: { database_id: process.env.NOTION_DATABASE_ID },
        properties: {
          Name: { title: [{ text: { content: rezept.name } }] },
          Kategorie: { select: { name: rezept.kategorie } },
          Zutaten: { multi_select: rezept.zutaten_tags.map((tag) => ({ name: tag })) },
          "TikTok URL": { url: resolvedUrl },
        },
        children: [
          {
            object: "block",
            type: "heading_2",
            heading_2: { rich_text: [{ text: { content: "Zutaten" } }] },
          },
          ...rezept.zutaten_detail.map((zutat) => ({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: { rich_text: [{ text: { content: zutat } }] },
          })),
          {
            object: "block",
            type: "heading_2",
            heading_2: { rich_text: [{ text: { content: "Zubereitung" } }] },
          },
          ...rezept.zubereitung.map((schritt) => ({
            object: "block",
            type: "numbered_list_item",
            numbered_list_item: { rich_text: [{ text: { content: schritt } }] },
          })),
        ],
      });

      gespeichert.push(rezept.name);
    }

    // 8. Schöne Erfolgsnachricht
    const nachricht = gespeichert.length === 1
      ? `✅ "${gespeichert[0]}" wurde gespeichert!`
      : `✅ ${gespeichert.length} Rezepte gespeichert:\n${gespeichert.map((n) => `• ${n}`).join("\n")}`;

    return res.status(200).json({ message: nachricht });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "❌ Fehler: " + error.message });
  }
}
```

---

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

---

*Erstellt mit Claude (Anthropic)*