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
    const author = oembed.author_name || "";

    if (!caption) {
      return res.status(400).json({ error: "Keine Caption gefunden" });
    }

    // 2. Claude extrahiert Rezept
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Analysiere diese TikTok Caption und extrahiere das Rezept.
Antworte NUR als JSON, kein Text davor oder danach.

Caption: "${caption}"

JSON Format:
{
  "name": "Rezeptname",
  "kategorie": "eine aus: Pasta, Reis, Kartoffeln, Suppe, Auflauf, Snack, Salat, Fleisch, Fisch, Dessert, Sonstiges",
  "hauptzutat": "wichtigste Zutat",
  "zutaten": "Zutat 1, Zutat 2, Zutat 3...",
  "zubereitung": "Schritt 1. Schritt 2. Schritt 3..."
}`,
        },
      ],
    });

    const raw = message.content[0].text.replace(/```json|```/g, "").trim();
    const rezept = JSON.parse(raw);

    // 3. In Notion speichern
    await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        Name: {
          title: [{ text: { content: rezept.name } }],
        },
        Kategorie: {
          select: { name: rezept.kategorie },
        },
        Hauptzutat: {
          select: { name: rezept.hauptzutat },
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

    return res.status(200).json({
      success: true,
      rezept: rezept.name,
      kategorie: rezept.kategorie,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}