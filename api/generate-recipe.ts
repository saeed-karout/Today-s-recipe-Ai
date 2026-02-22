import { GoogleGenAI, Type } from "@google/genai";

type Handler = (event: { httpMethod: string; body: string | null; headers: Record<string, string> }) => Promise<{ statusCode: number; headers: Record<string, string>; body: string }>;

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
  type: Type.OBJECT,
  properties: {
    recipeName: { type: Type.STRING, description: "Name of the recipe" },
    origin: { type: Type.STRING, description: "Country or region of origin" },
    cuisineType: { type: Type.STRING, description: "Middle Eastern or Western Fast Food" },
    prepTime: { type: Type.STRING, description: "Preparation time" },
    cookTime: { type: Type.STRING, description: "Cooking time" },
    difficulty: { type: Type.STRING, description: "Easy, Medium, or Hard" },
    ingredients: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of ingredients with quantities"
    },
    instructions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Step-by-step preparation steps"
    },
    chefTips: { type: Type.STRING, description: "Optional tips from the chef" },
    detectedIngredients: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Only for image analysis: list of ingredients detected in the image"
    }
  },
  required: ["recipeName", "origin", "cuisineType", "prepTime", "cookTime", "difficulty", "ingredients", "instructions"]
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "GEMINI_API_KEY is not set" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { ingredients, cuisineType, language } = body;
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "ingredients array is required" }) };
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Generate a ${cuisineType || "Middle Eastern"} recipe using these ingredients: ${ingredients.join(", ")}. 
    The response must be in ${language === "ar" ? "Arabic" : "English"}.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RECIPE_SCHEMA,
      },
    });

    const text = response.text;
    const data = text ? JSON.parse(text) : {};
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    let message = raw;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const inner = parsed?.error?.message ?? parsed?.message;
      if (typeof inner === "string") message = inner;
    } catch {
      // keep message as raw
    }
    if (message.includes("expired") || message.includes("renew") || message.includes("leaked") || message.includes("API key") || message.includes("INVALID")) {
      message = "API key expired or invalid. Create a new key at Google AI Studio (aistudio.google.com/apikey), set GEMINI_API_KEY in Netlify Environment variables, then redeploy.";
    }
    console.error("generate-recipe error:", err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: message }) };
  }
};
