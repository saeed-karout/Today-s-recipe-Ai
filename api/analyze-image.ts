import busboy from "busboy";
import sharp from "sharp";
import { GoogleGenAI, Type } from "@google/genai";

type Handler = (event: {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string>;
  isBase64Encoded?: boolean;
}) => Promise<{ statusCode: number; headers: Record<string, string>; body: string }>;

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

interface ParsedForm {
  image?: { buffer: Buffer; mimeType: string }[];
  language?: string[];
  cuisineType?: string[];
}

function parseMultipart(event: {
  body: string | null;
  isBase64Encoded?: boolean;
  headers: Record<string, string>;
}): Promise<ParsedForm> {
  return new Promise((resolve, reject) => {
    const result: ParsedForm = {};
    const rawBody = event.body
      ? event.isBase64Encoded
        ? Buffer.from(event.body, "base64")
        : Buffer.from(event.body, "utf8")
      : Buffer.alloc(0);

    const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";
    const bb = busboy({ headers: { "content-type": contentType } });

    bb.on("file", (name, file, info) => {
      const chunks: Buffer[] = [];
      const { mimeType } = info;
      file.on("data", (chunk: Buffer) => chunks.push(chunk));
      file.on("end", () => {
        if (name === "image") {
          result.image = result.image || [];
          result.image.push({ buffer: Buffer.concat(chunks), mimeType: mimeType || "image/jpeg" });
        }
      });
    });

    bb.on("field", (name, value) => {
      if (name === "language") result.language = [value];
      if (name === "cuisineType") result.cuisineType = [value];
    });

    bb.on("error", reject);
    bb.on("finish", () => resolve(result));
    bb.write(rawBody);
    bb.end();
  });
}

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
    const parsed = await parseMultipart(event);
    const imageEntry = parsed.image?.[0];
    if (!imageEntry) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "No image uploaded" }) };
    }

    const language = parsed.language?.[0] || "en";
    const cuisineType = parsed.cuisineType?.[0] || "Middle Eastern";

    // Resize/compress to stay under function timeout and reduce Gemini processing time
    const MAX_EDGE = 800;
    const resized = await sharp(imageEntry.buffer)
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    const base64Image = resized.toString("base64");

    const prompt = `Analyze this image to detect food ingredients. Then, generate a ${cuisineType} recipe using these detected ingredients. The response must be in ${language === "ar" ? "Arabic" : "English"}. Include the detected ingredients in the 'detectedIngredients' field.`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
      ],
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
    if (message.includes("expired") || message.includes("renew") || message.includes("leaked") || message.includes("API key") || message.includes("INVALID") || message.includes("referer")) {
      message = "API key issue. Check Google AI Studio and Netlify GEMINI_API_KEY, then redeploy.";
    }
    if (message.includes("timed out") || message.includes("Timeout") || message.includes("Sandbox")) {
      message = "Request took too long. Try a smaller image or try again.";
    }
    console.error("analyze-image error:", err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: message }) };
  }
};
