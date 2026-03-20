import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@notionhq/client";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const notion = new Client({ auth: process.env.NOTION_TOKEN });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "TikTok URL fehlt" });
  }

  try {
    // 1. TikTok Caption holen
    const oembedRes = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    );
    const oembed = await oembedRes.json();
    const caption = oembed.title || "";

    if (!caption) {
      return res.status(400).json({ error: "Keine Caption gefunden" });
    }

    // 2. Claude extrahiert Rezepte
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Du bist ein Rezept-Extraktor. Analysiere die folgende TikTok Caption.

Regeln:
- Erkennt Rezepte auf Deutsch UND Englisch
- Enthält die Caption ein Rezept, extrahiere dieses eine
- Enthält die Caption mehrere Rezepte, extrahiere ALLE als separate Einträge
- Ist kein Rezeptname erkennbar, erstelle einen passenden kurzen Namen
- Fehlen Zutaten, schreibe "Keine Zutaten angegeben"
- Fehlen Zubereitungsschritte, schreibe "Keine Schritte angegeben"
- Kategorisiere in NUR eine dieser Kategorien: Pasta, Reis, Kartoffeln, Snack, Suppe, Sonstiges
- Antworte NUR als reines JSON Array, keine Backticks, kein Markdown, keine Erklärungen

Caption: "${caption}"

Antworte mit einem JSON Array, auch wenn es nur ein Rezept ist:
[
  {
    "name": "Kurzer prägnanter Rezeptname",
    "kategorie": "Pasta | Reis | Kartoffeln | Snack | Suppe | Sonstiges",
    "zutaten": "Zutat 1, Zutat 2, Zutat 3...",
    "zubereitung": "Schritt 1. Schritt 2. Schritt 3."
  }
]`,
        },
      ],
    });

    // 3. Antwort parsen
    const raw = message.content[0].text.replace(/```json|```/g, "").trim();
    const rezepte = JSON.parse(raw);

    if (!Array.isArray(rezepte) || rezepte.length === 0) {
      return res.status(400).json({ error: "Keine Rezepte gefunden" });
    }

    // 4. Für jedes Rezept eine Notion-Seite erstellen
    const gespeichert = [];

    for (const rezept of rezepte) {
      await notion.pages.create({
        parent: { database_id: process.env.NOTION_DATABASE_ID },
        properties: {
          Name: {
            title: [{ text: { content: rezept.name } }],
          },
          Kategorie: {
            select: { name: rezept.kategorie },
          },
          Zutaten: {
            rich_text: [{ text: { content: rezept.zutaten } }],
          },
          Zubereitung: {
            rich_text: [{ text: { content: rezept.zubereitung } }],
          },
          "TikTok URL": {
            url: url,
          },
        },
      });

      gespeichert.push(rezept.name);
    }

    // 5. Bestätigung zurückschicken
    return res.status(200).json({
      success: true,
      anzahl: gespeichert.length,
      rezepte: gespeichert,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}