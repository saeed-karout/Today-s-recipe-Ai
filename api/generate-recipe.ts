// api/generate-recipe.ts

import { GoogleGenerativeAI } from "@google/generative-ai";

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

export default async function handler(req, res) {
  // معالجة CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, corsHeaders);
    res.end(JSON.stringify({ error: "Method not allowed. Use POST." }));
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ error: "GEMINI_API_KEY is not set in Vercel Environment Variables" }));
    return;
  }

  // قراءة body كـ stream (الطريقة الآمنة في Node.js raw على Vercel)
  let rawBody = "";
  req.on("data", (chunk) => {
    rawBody += chunk.toString();
  });

  await new Promise((resolve) => req.on("end", resolve));

  let body;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch (err) {
    res.writeHead(400, corsHeaders);
    res.end(JSON.stringify({ error: "Invalid JSON in request body" }));
    return;
  }

  const { ingredients, cuisineType = "Middle Eastern", language = "en" } = body;

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    res.writeHead(400, corsHeaders);
    res.end(JSON.stringify({ error: "ingredients array is required and must not be empty" }));
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",  // مستقر وأفضل من preview في معظم الحالات
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const prompt = `
Generate a ${cuisineType} recipe using these ingredients: ${ingredients.join(", ")}.
The response must be in ${language === "ar" ? "Arabic" : "English"}.
Return ONLY valid JSON object with this exact structure (no markdown, no extra text before or after):
{
  "recipeName": "Name of the recipe",
  "origin": "Country or region of origin",
  "cuisineType": "${cuisineType}",
  "prepTime": "Preparation time (e.g. 20 minutes)",
  "cookTime": "Cooking time (e.g. 45 minutes)",
  "difficulty": "Easy" or "Medium" or "Hard",
  "ingredients": ["1 cup rice", "500g chicken", ...],
  "instructions": ["Step 1: ...", "Step 2: ...", ...],
  "chefTips": "Optional tip or null"
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let recipeJson;
    try {
      recipeJson = JSON.parse(responseText);
    } catch (parseErr) {
      // تنظيف إذا أضاف Gemini ```json أو مسافات
      const cleaned = responseText
        .replace(/^\s*```json\s*/, "")
        .replace(/\s*```$/, "")
        .trim();
      recipeJson = JSON.parse(cleaned);
    }

    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify(recipeJson));

  } catch (err) {
    console.error("Gemini error in generate-recipe:", err);
    const errorMessage = err?.message?.includes("key") || err?.message?.includes("API")
      ? "Invalid or missing GEMINI_API_KEY. Check Vercel → Settings → Environment Variables."
      : err?.message || "Failed to generate recipe";

    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ error: errorMessage }));
  }
}