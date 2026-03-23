import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@notionhq/client";
import { buildPrompt } from "./prompt_ger.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const notion = new Client({ auth: process.env.NOTION_TOKEN });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "❌ Method not allowed" });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ message: "❌ TikTok URL missing" });
  }

  try {
    // 1. Resolve URL if shortened
    let resolvedUrl = url;
    if (url.includes("vm.tiktok.com") || url.includes("vt.tiktok.com")) {
      const response = await fetch(url, { redirect: "follow" });
      resolvedUrl = response.url;
    }

    // 2. URL bereinigen – Parameter entfernen
    const urlObj = new URL(resolvedUrl);
    resolvedUrl = `${urlObj.origin}${urlObj.pathname}`;

    // 2. Fetch TikTok caption
    const oembedRes = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl)}`
    );
    const oembed = await oembedRes.json();
    const caption = oembed.title || "";

    // 3. Validate caption
    const cleanCaption = caption.replace(/#\w+/g, "").trim();
    if (!cleanCaption) {
      return res.status(400).json({
        message: "❌ Caption contains no recipe information",
      });
    }

    // 4. Duplicate check
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
        message: `⚠️ Already saved: ${name}`,
      });
    }

    // 5. Extract recipes with Claude
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: buildPrompt(caption),
        },
      ],
    });

    // 6. Parse response
    const raw = response.content[0].text.replace(/```json|```/g, "").trim();
    const recipes = JSON.parse(raw);

    if (!Array.isArray(recipes) || recipes.length === 0) {
      return res.status(400).json({
        message: "❌ No recipe found in caption",
      });
    }

    // 7. Create a Notion page for each recipe
    const saved = [];

    for (const recipe of recipes) {
      await notion.pages.create({
        parent: { database_id: process.env.NOTION_DATABASE_ID },
        properties: {
          Name: {
            title: [{ text: { content: recipe.name } }],
          },
          Kategorie: {
            select: { name: recipe.category },
          },
          Zutaten: {
            multi_select: recipe.ingredient_tags.map((tag) => ({ name: tag })),
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
          ...recipe.ingredient_detail.map((ingredient) => ({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [{ text: { content: ingredient } }],
            },
          })),
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [{ text: { content: "Zubereitung" } }],
            },
          },
          ...(recipe.servings ? [{
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{
                text: { content: `🍽️ ${recipe.servings}` },
                annotations: { italic: true, color: "gray" }
              }]
            }
          }] : []),
          ...recipe.preparation.map((step) => ({
            object: "block",
            type: "numbered_list_item",
            numbered_list_item: {
              rich_text: [{ text: { content: step } }],
            },
          })),
        ],
      });

      saved.push(recipe.name);
    }

    // 8. Success message
    const successMessage = saved.length === 1
      ? `✅ "${saved[0]}" has been saved!`
      : `✅ ${saved.length} recipes saved:\n${saved.map((n) => `• ${n}`).join("\n")}`;

    return res.status(200).json({ message: successMessage });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "❌ Error: " + error.message });
  }
}