import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@notionhq/client";
import { buildPrompt } from "./prompt.js";

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

        // 1. URL auflösen falls verkürzt (vm.tiktok.com)
        let resolvedUrl = url;
        if (url.includes("vm.tiktok.com") || url.includes("vt.tiktok.com")) {
            const response = await fetch(url, { redirect: "follow" });
            resolvedUrl = response.url;
        }

        // 1. TikTok Caption holen
        const oembedRes = await fetch(
            `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl)}`
        );
        const oembed = await oembedRes.json();
        const caption = oembed.title || "";

        // 2. Caption validieren – Ebene 1
        const cleanCaption = caption.replace(/#\w+/g, "").trim();
        if (!cleanCaption) {
            return res.status(400).json({
                error: "Caption enthält keine Rezeptinformationen",
            });
        }
        // 3. Duplicate Check – URL bereits in Notion?
        const existing = await notion.databases.query({
            database_id: process.env.NOTION_DATABASE_ID,
            filter: {
                property: "TikTok URL",
                url: {
                    equals: resolvedUrl,
                },
            },
        });

        if (existing.results.length > 0) {
            const name = existing.results[0].properties.Name.title[0]?.plain_text;
            return res.status(409).json({
                error: "Rezept bereits vorhanden",
                rezept: name,
            });
        }

        // 3. Claude extrahiert Rezepte
        const message = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2048,
            messages: [
                {
                    role: "user",
                    content: buildPrompt(caption),
                },
            ],
        });

        // 4. Antwort parsen
        const raw = message.content[0].text.replace(/```json|```/g, "").trim();
        const rezepte = JSON.parse(raw);

        // 5. Leeres Array abfangen – Ebene 2
        if (!Array.isArray(rezepte) || rezepte.length === 0) {
            return res.status(400).json({
                error: "Kein Rezept in der Caption gefunden",
            });
        }

        // 6. Für jedes Rezept eine Notion-Seite erstellen
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
                        multi_select: rezept.zutaten_tags.map((tag) => ({ name: tag })),
                    },
                    "TikTok URL": {
                        url: resolvedUrl,
                    },
                },
                children: [
                    {
                        object: "block",
                        type: "heading_2",
                        heading_2: {
                            rich_text: [{ text: { content: "Zutaten" } }],
                        },
                    },
                    ...rezept.zutaten_detail.map((zutat) => ({
                        object: "block",
                        type: "bulleted_list_item",
                        bulleted_list_item: {
                            rich_text: [{ text: { content: zutat } }],
                        },
                    })),
                    {
                        object: "block",
                        type: "heading_2",
                        heading_2: {
                            rich_text: [{ text: { content: "Zubereitung" } }],
                        },
                    },
                    ...rezept.zubereitung.map((schritt) => ({
                        object: "block",
                        type: "numbered_list_item",
                        numbered_list_item: {
                            rich_text: [{ text: { content: schritt } }],
                        },
                    })),
                ],
            });

            gespeichert.push(rezept.name);
        }

        // 7. Bestätigung zurückschicken
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