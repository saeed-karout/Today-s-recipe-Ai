// api/generate-recipe.ts

import { GoogleGenerativeAI } from "@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const SYSTEM_INSTRUCTION = `You are a professional chef specializing ONLY in Middle Eastern and Western Fast Food.
STRICT RULES:
1. ONLY provide recipes from these cuisines: Syrian, Lebanese, Iraqi, Palestinian, Egyptian, Jordanian, Saudi, Yemeni, Gulf, Burgers, Pizza, Crispy Chicken, Pasta, Sandwiches.
2. ABSOLUTELY FORBIDDEN: Any Asian or Turkish cuisines.
3. If forbidden cuisine requested, politely refuse.
4. Use examples like Maqluba, Kibbeh, Kabsa, etc. for quality.
5. Respond in requested language (Arabic or English).
6. Output MUST be valid JSON only.`;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, corsHeaders);
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Debug block (يمكن حذفه لاحقًا)
  if (!apiKey) {
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({
      error: "GEMINI_API_KEY missing or empty",
      debugInfo: {
        keyExists: "GEMINI_API_KEY" in process.env,
        keyLength: apiKey ? apiKey.length : 0,
        envKeysWithGeminiOrApi: Object.keys(process.env).filter(k => 
          k.includes("GEMINI") || k.includes("API")
        )
      }
    }));
    return;
  }

  let rawBody = "";
  req.on("data", chunk => { rawBody += chunk; });

  await new Promise(resolve => req.on("end", resolve));

  let body;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    res.writeHead(400, corsHeaders);
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const { ingredients, cuisineType = "Middle Eastern", language = "en" } = body;

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    res.writeHead(400, corsHeaders);
    res.end(JSON.stringify({ error: "ingredients array is required" }));
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
      systemInstruction: SYSTEM_INSTRUCTION
    });

    const prompt = `Generate a ${cuisineType} recipe using: ${ingredients.join(", ")}. 
    Language: ${language === "ar" ? "Arabic" : "English"}.
    Return ONLY valid JSON with: recipeName, origin, cuisineType, prepTime, cookTime, difficulty, ingredients (array with quantities), instructions (array), chefTips (optional).`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json|```/g, "").trim();
      data = JSON.parse(cleaned);
    }

    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify(data));

  } catch (err) {
    console.error(err);
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ error: err.message || "Generation failed" }));
  }
}