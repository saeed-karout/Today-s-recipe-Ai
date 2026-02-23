// api/analyze-image.ts

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

const RECIPE_SCHEMA = {
  type: "OBJECT",
  properties: {
    recipeName: { type: "STRING", description: "Name of the recipe" },
    origin: { type: "STRING", description: "Country or region of origin" },
    cuisineType: { type: "STRING", description: "Middle Eastern or Western Fast Food" },
    prepTime: { type: "STRING", description: "Preparation time" },
    cookTime: { type: "STRING", description: "Cooking time" },
    difficulty: { type: "STRING", description: "Easy, Medium, or Hard" },
    ingredients: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "List of ingredients with quantities"
    },
    instructions: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Step-by-step preparation steps"
    },
    chefTips: { type: "STRING", description: "Optional tips from the chef" },
    detectedIngredients: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Only for image analysis: list of ingredients detected in the image"
    }
  },
  required: ["recipeName", "origin", "cuisineType", "prepTime", "cookTime", "difficulty", "ingredients", "instructions"]
};

export const config = {
  maxDuration: 60,
};

export default async function handler(req: any, res: any) {
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

  try {
    // قراءة JSON body (صغير جدًا)
    let rawBody = "";
    req.on("data", (chunk: Buffer) => { rawBody += chunk.toString(); });
    await new Promise((resolve) => req.on("end", resolve));

    const body = JSON.parse(rawBody || "{}");
    const { imageUrl, language = "en", cuisineType = "Middle Eastern" } = body;

    if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("https://")) {
      res.writeHead(400, corsHeaders);
      res.end(JSON.stringify({ error: "Valid imageUrl[](https://...) required" }));
      return;
    }

    const prompt = `Analyze this image to detect food ingredients. Then, generate a ${cuisineType} recipe using these detected ingredients. The response must be in ${language === "ar" ? "Arabic" : "English"}. Include the detected ingredients in the 'detectedIngredients' field.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    console.time("gemini-analysis");
    const result = await model.generateContent([
      { text: prompt },
      {
        fileData: {
          mimeType: "image/jpeg",
          fileUri: imageUrl
        }
      }
    ]);
    console.timeEnd("gemini-analysis");

    const responseText = result.response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr);
      const cleaned = responseText.replace(/```json\s*|\s*```/g, "").trim();
      data = JSON.parse(cleaned);
    }

    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify(data));

  } catch (err: any) {
    console.error("analyze-image error:", err);
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ error: err.message || "Analysis failed" }));
  }
}