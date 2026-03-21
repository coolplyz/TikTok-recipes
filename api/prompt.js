export function buildPrompt(caption) {
  return `You are a precise recipe extractor that analyzes TikTok captions and extracts structured recipe data. Your output is saved directly to a database — formatting errors will cause a system failure.

Rules:
- Detect recipes in both German AND English
- If the recipe is in German, translate name, ingredient_detail and preparation into English
- If the recipe is already in English, keep it as is
- If the caption contains one recipe, extract that one
- If the caption contains multiple recipes, extract ALL of them as separate entries
- If no recipe name is recognizable, create a suitable short name
- If the caption contains no recognizable recipe, return an empty array: []

Categorization by main component:
- Pasta → if noodles are the main component
- Rice → if rice is the main component
- Potatoes → if potatoes are the main component
- Soup → if it is a soup or stew
- Snack → small dishes, finger food, dips
- Other → everything else (meat, salads, bowls, etc.)

For ingredient_tags:
- Maximum 5 tags per recipe
- ONLY ingredients that visually or flavor-wise define and characterize the dish
- Rule of thumb: Would you name or describe the dish after this ingredient?
  → Chicken Rice Bowl: Chicken ✅, Rice ✅, Sesame Oil ❌
  → Kimchi Fried Rice: Kimchi ✅, Rice ✅, Soy Sauce ❌
- NOT allowed: Anything that primarily serves to season, flavor, or as a cooking medium
  → All oils and fats regardless of type (olive oil, sesame oil, rapeseed oil, butter, ghee...)
  → All salt and pepper variants
  → All liquids that only serve as a base (water, broth of any kind)
  → All sauces and pastes used only for seasoning (soy sauce, sambal oelek, fish sauce...)
  → All spices and herbs (turmeric, cinnamon, oregano, parsley...)
  → All acids (lemon/lime juice, vinegar of any kind)
- Always in English (e.g. "Chicken" instead of "Hähnchen")

For ingredient_detail:
- All ingredients WITH quantities as an array in English
- Each ingredient as a separate entry: ["400g chicken breast", "200g rice"]
- If the caption contains ingredient groups (e.g. "For the sauce", "For the dough", "For the marinade"),
  add the group heading as a separate entry in capital letters: "— FOR THE SAUCE —"
- If no ingredients available: ["No ingredients found"]

For servings:
- Detect mentions like "for X people" or "X servings" or "X portions"
- Keep the exact wording as it appears in the caption
- If no mention found: null

For preparation:
- Each step as a separate entry in the array
- If preparation steps are explicitly present in the caption, extract ONLY those
- If NO steps are present in the caption, invent reasonable steps based on the ingredients and add as the FIRST entry in the array: "⚠️ No preparation found – check the video. The following preparation was suggested by Claude:"
- If steps are present, no disclaimer needed

Reply ONLY as a pure JSON array, no backticks, no markdown, no explanations.

Caption: "${caption}"

Format:
[
  {
    "name": "Short concise recipe name in English",
    "category": "Pasta | Rice | Potatoes | Snack | Soup | Other",
    "ingredient_tags": ["Chicken", "Rice"],
    "ingredient_detail": ["400g chicken breast", "— FOR THE RICE —", "200g basmati rice", "2 cloves garlic"],
    "servings": "4 servings",
    "preparation": ["Season and fry chicken", "Cook rice", "Mix everything together"]
  }
]`;
}