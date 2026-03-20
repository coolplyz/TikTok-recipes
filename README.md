# TikTok Recipes

This tool allows you to save TikTok recipes directly to a Notion database via the iOS Share Sheet. Claude (Anthropic API) automatically analyzes the caption and extracts the recipe name, category, ingredients, and preparation steps.

---

## Architecture

```
TikTok Share Button
→ iOS Shortcut
→ Vercel Serverless Function (api/save-recipe.js)
→ TikTok oEmbed API (fetch caption)
→ Anthropic API / Claude Haiku (extract recipe)
→ Notion API (create page)
→ Confirmation to iPhone
```

---

## 1. Prerequisites

- GitHub account
- Vercel account (free, connect with GitHub)
- Notion account
- Anthropic account (console.anthropic.com)
- iPhone with Shortcuts app

---

## 2. Notion Setup

### 2a. Create database

1. Create a new page in Notion
2. Select type **"Table"**
3. Add the following columns:

| Column name | Type |
|---|---|
| Name | Title |
| Category | Select |
| Ingredients | Multi-select |
| TikTok URL | URL |
| Added on | Created time |

> **Note on categories:** The default categories in this project are `Pasta`, `Rice`, `Potatoes`, `Soup`, `Snack`, and `Other`. These can be freely customized — just make sure the category values in your Notion Select column match exactly what the prompt in `api/prompt.js` outputs. If you change the categories, update both places.

### 2b. Create Notion integration

1. Go to [notion.so/my-integrations](https://notion.so/my-integrations)
2. Click **"+ New integration"**
3. Name: `TikTok Recipes`
4. Select workspace → **"Submit"**
5. **Copy the integration token** (`secret_...`)

### 2c. Connect database to integration

1. Open the database as **Full Page**
2. Top right **"..."** → **"Connections"**
3. Add your integration `TikTok Recipes`

### 2d. Copy database ID

The database URL looks like this:
```
https://www.notion.so/abc123def456ghi789...?v=xyz
```
The part **before** `?v=` is your database ID.

---

## 3. Anthropic API Setup

1. Create an account at [console.anthropic.com](https://console.anthropic.com)
2. **"API Keys"** → **"Create Key"**
3. Copy the key (`sk-ant-...`)
4. Add credits (min. $5 – enough for thousands of recipes)

> **Note:** Only credit cards or debit cards are accepted, no PayPal.

---

## 4. Create GitHub repository

1. Go to [github.com](https://github.com) → **"New"**
2. Name: `TikTok-recipes`
3. Select **Public** or **Private** – both are safe since API keys are stored in Vercel
4. ✅ Check **"Add a README file"**
5. **"Create repository"**

---

## 5. Code

### File structure

```
TikTok-recipes/
├── api/
│   ├── save-recipe.js   → main logic
│   └── prompt.js        → Claude prompt
├── package.json
└── vercel.json
```

### package.json

Defines the required dependencies – see [`package.json`](./package.json).

### vercel.json

Configures the Vercel Serverless Function with memory and maximum runtime – see [`vercel.json`](./vercel.json).

### api/prompt.js

Contains the Claude prompt as a separate file – so the prompt can be adjusted without touching the main logic – see [`api/prompt.js`](./api/prompt.js).

> **Note:** If you rename this file, make sure to update the import path at the top of `api/save-recipe.js` accordingly:
> ```javascript
> import { buildPrompt } from "./prompt.js"; // ← update filename here if changed
> ```

### api/save-recipe.js

Main application logic – receives the TikTok URL, resolves it, fetches the caption, extracts the recipe via Claude and saves it to Notion – see [`api/save-recipe.js`](./api/save-recipe.js).

> **Note on Notion headings and column names:** The Notion page headings (`Zutaten`, `Zubereitung`) and database column names (`Kategorie`, `Zutaten`, `TikTok URL`) are hardcoded in `api/save-recipe.js`. If you rename any columns in Notion, make sure to update the corresponding property names in the code as well — otherwise saving will fail.

---

## 6. Vercel Setup

### 6a. Create account

1. Go to [vercel.com](https://vercel.com)
2. **"Sign Up"** → **"Continue with GitHub"**

### 6b. Deploy project

1. **"Add New Project"** → **"Import Git Repository"**
2. Select repo `TikTok-recipes` → **"Import"**
3. Leave everything as default → **"Deploy"**

### 6c. Add environment variables

1. Vercel project → **"Settings"** → **"Environment Variables"**
2. Add the following three variables (select all environments):

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `NOTION_TOKEN` | `secret_...` |
| `NOTION_DATABASE_ID` | your database ID |

3. Then go to **"Deployments"** → **"Redeploy"**

> **Important:** Never put API keys directly in the code – always use environment variables!

---

## 7. iOS Shortcut Setup

### Create shortcut

1. Open **Shortcuts app** → **"+"**
2. Add the following 4 actions in this order:

**Action 1:** `Get URLs from Share Sheet`
- If there is no input: Continue

**Action 2:** `Get Contents of URL`
- URL: `https://YOUR-VERCEL-URL.vercel.app/api/save-recipe`
  > Find your URL in Vercel → your project → "Domains", e.g. `https://tik-tok-recipes.vercel.app`
- Method: **POST**
- Request body: **JSON**
- Key: `url` / Value: **Shortcut Input** (blue variable)

**Action 3:** `Get value for "message" from Contents of URL`
- Dictionary: **Contents of URL**
- Key: `message`

**Action 4:** `Show Notification`
- Message: **Dictionary Value** (variable from Action 3)

### Enable in Share Sheet

1. Tap shortcut name → **"Details"**
2. Enable **"Show in Share Sheet"**

### Usage

1. Open TikTok
2. Find a recipe video → tap **Share**
3. Select **"Save Recipe"**
4. Wait briefly (~5 seconds)
5. Notification appears with confirmation

---

## 8. Troubleshooting

| Error | Cause | Solution |
|---|---|---|
| `TikTok URL missing` | Shortcut not passing URL correctly | Set value for key `url` to **Shortcut Input** |
| `Caption contains no recipe information` | Video has no or only hashtag caption | Try a different video |
| `No recipe found in caption` | Claude could not detect a recipe | Caption does not contain a structured recipe |
| `Already saved: [Name]` | Duplicate check triggered | Recipe already exists in Notion |
| `404 NOT FOUND` | Vercel cannot find the function | Check file structure: `api/save-recipe.js` |
| Deployment fails | Environment variables missing | Check Vercel Settings → Environment Variables |

---

## 9. Costs

| Service | Cost |
|---|---|
| Vercel | Free (Hobby Plan) |
| GitHub | Free |
| Notion | Free |
| Anthropic API | ~$0.001 per recipe (Haiku model) |

With $5 starting credits at Anthropic you can save approximately 5,000 recipes.

---

## 10. Possible Extensions

- **More categories** – adjust prompt in `api/prompt.js` and Notion Select column
- **Other languages** – extend the prompt
- **Multiple users** – add Supabase for user management
- **Notion OAuth** – "Connect with Notion" button for other users
- **Switch model** – from Haiku to Sonnet for better extraction
