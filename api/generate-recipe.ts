// api/generate-recipe.ts

import { GoogleGenerativeAI } from "@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const SYSTEM_INSTRUCTION = `You are a professional chef specializing ONLY in Middle Eastern and Western Fast Food.
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
6. Output MUST be in valid JSON format.`;

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
  if (!apiKey) {
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ error: "GEMINI_API_KEY is not set" }));
    return;
  }

  let bodyData;
  try {
    let rawBody = "";
    req.on("data", chunk => { rawBody += chunk; });
    await new Promise((resolve) => req.on("end", resolve));

    bodyData = JSON.parse(rawBody || "{}");
  } catch (e) {
    res.writeHead(400, corsHeaders);
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const { ingredients, cuisineType = "Middle Eastern", language = "en" } = bodyData;

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    res.writeHead(400, corsHeaders);
    res.end(JSON.stringify({ error: "ingredients array is required and must not be empty" }));
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",  // أو gemini-3-flash-preview إذا كنت متأكد أنه يعمل
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const prompt = `Generate a ${cuisineType} recipe using these ingredients: ${ingredients.join(", ")}.
The response must be in ${language === "ar" ? "Arabic" : "English"}.
Return ONLY valid JSON with this structure:
{
  "recipeName": "string",
  "origin": "string",
  "cuisineType": "${cuisineType}",
  "prepTime": "string",
  "cookTime": "string",
  "difficulty": "Easy|Medium|Hard",
  "ingredients": ["quantity + name", ...],
  "instructions": ["step 1", "step 2", ...],
  "chefTips": "string or null"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let jsonData;
    try {
      jsonData = JSON.parse(text);
    } catch {
      // محاولة تنظيف إذا وضع Gemini markdown
      const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
      jsonData = JSON.parse(cleaned);
    }

    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify(jsonData));

  } catch (err) {
    console.error("Gemini error:", err);
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({
      error: err.message?.includes("key") ? "API key issue" : "Failed to generate recipe"
    }));
  }
}