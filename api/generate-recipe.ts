// api/generate-recipe.ts

import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const SYSTEM_INSTRUCTION = `
You are a professional chef specializing ONLY in Middle Eastern and Western Fast Food.
STRICT RULES:
1. ONLY provide recipes from these cuisines:
   - Middle Eastern: Syrian, Lebanese, Iraqi, Palestinian, Egyptian, Jordanian, Saudi, Yemeni, Gulf.
   - Western Fast Food: Burgers, Pizza, Crispy Chicken, Pasta, Sandwiches.
2. ABSOLUTELY FORBIDDEN: Any Asian cuisines (Korean, Japanese, Chinese, Thai, Vietnamese, etc.), Turkish cuisine, or any other cuisine not mentioned above.
3. If the user asks for a forbidden cuisine, politely refuse and explain that you only specialize in Middle Eastern and Western Fast Food.
4. Use few-shot learning examples for quality:
   - Maqluba (Palestine/Syria/Lebanon): Rice with chicken/meat, eggplant, cauliflower.
   - Kibbeh (Syria/Lebanon/Iraq): Bulgur balls stuffed with meat and pine nuts.
   - Freekeh (Syria/Palestine/Jordan): Green wheat with meat/chicken.
   - Mandi (Yemen/Saudi): Rice with smoked meat/chicken.
   - Kabsa (Saudi/Gulf): Long rice with meat/chicken and spices.
5. Always respond in the language requested (Arabic or English).
6. Output MUST be in valid JSON format.
`;

export const config = { maxDuration: 60 }; // مهم لـ Pro plan، Hobby محدود ~10-30s

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set in Vercel Environment Variables" });
  }

  try {
    const body = await req.json();
    const { ingredients, cuisineType = "Middle Eastern", language = "en" } = body;

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: "ingredients array is required and must not be empty" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",  // مستقر وسريع، تجنب preview إلا إذا كنت تحتاج ميزة جديدة
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        // أضف باقي الفئات إذا أردت
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const prompt = `
Generate a ${cuisineType} recipe using these ingredients: ${ingredients.join(", ")}.
The response must be in ${language === "ar" ? "Arabic" : "English"}.
Return ONLY valid JSON matching this schema:
{
  "recipeName": string,
  "origin": string,
  "cuisineType": "${cuisineType}",
  "prepTime": string,
  "cookTime": string,
  "difficulty": "Easy" | "Medium" | "Hard",
  "ingredients": string[],  // with quantities
  "instructions": string[],
  "chefTips": string | null,
  "detectedIngredients": string[] | null
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let recipeJson;
    try {
      recipeJson = JSON.parse(responseText);
    } catch (parseErr) {
      console.error("JSON parse failed:", parseErr, "Raw:", responseText);
      return res.status(500).json({ error: "Failed to parse Gemini response as JSON" });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(recipeJson);

  } catch (err) {
    console.error("Full error in generate-recipe:", err);
    const errorMsg = err.message?.includes("API key") 
      ? "Invalid or missing GEMINI_API_KEY – check Vercel env vars"
      : err.message || "Internal server error during Gemini call";

    return res.status(500).json({ error: errorMsg });
  }
}