// api/analyze-image.ts

import busboy from "busboy";
import sharp from "sharp";
import { GoogleGenerativeAI } from "@google/generative-ai";  // ← SDK الرسمي

type Handler = (req: any, res: any) => Promise<void>;

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
    recipeName: { type: "STRING" },
    origin: { type: "STRING" },
    cuisineType: { type: "STRING" },
    prepTime: { type: "STRING" },
    cookTime: { type: "STRING" },
    difficulty: { type: "STRING" },
    ingredients: { type: "ARRAY", items: { type: "STRING" } },
    instructions: { type: "ARRAY", items: { type: "STRING" } },
    chefTips: { type: "STRING" },
    detectedIngredients: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["recipeName", "origin", "cuisineType", "prepTime", "cookTime", "difficulty", "ingredients", "instructions"]
};

interface ParsedForm {
  image?: { buffer: Buffer; mimeType: string }[];
  language?: string[];
  cuisineType?: string[];
}

function isParsedForm(obj: unknown): obj is ParsedForm {
  return obj != null && typeof obj === 'object';
}

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
    res.end(JSON.stringify({ error: "GEMINI_API_KEY not set" }));
    return;
  }

  try {
    const parsedResult = await new Promise<ParsedForm>((resolve, reject) => {
      const result: ParsedForm = {};
      const contentType = req.headers["content-type"] || "";
      const bb = busboy({ headers: { "content-type": contentType } });

      bb.on("file", (name, file, info) => {
        if (name !== "image") return file.resume();
        const chunks: Buffer[] = [];
        file.on("data", chunk => chunks.push(chunk));
        file.on("end", () => {
          result.image = [{ buffer: Buffer.concat(chunks), mimeType: info.mimeType || "image/jpeg" }];
        });
      });

      bb.on("field", (name, value) => {
        if (name === "language") result.language = [value];
        if (name === "cuisineType") result.cuisineType = [value];
      });

      bb.on("error", reject);
      bb.on("finish", () => resolve(result));

      req.pipe(bb);
    });

    if (!isParsedForm(parsedResult) || !parsedResult.image?.[0]) {
      res.writeHead(400, corsHeaders);
      res.end(JSON.stringify({ error: "No image uploaded or invalid form" }));
      return;
    }

    const imageEntry = parsedResult.image[0];
    const language = parsedResult.language?.[0] || "en";
    const cuisineType = parsedResult.cuisineType?.[0] || "Middle Eastern";

    const MAX_EDGE = 800;
    const resized = await sharp(imageEntry.buffer)
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    const base64Image = resized.toString("base64");

    const prompt = `Analyze this image to detect food ingredients. Then, generate a ${cuisineType} recipe using these detected ingredients. The response must be in ${language === "ar" ? "Arabic" : "English"}. Include the detected ingredients in the 'detectedIngredients' field.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: { responseMimeType: "application/json" },
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: "image/jpeg", data: base64Image } }
    ]);

    const text = result.response.text();
    const data = JSON.parse(text);  // لو فشل، أضف try-catch هنا

    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify(data));

  } catch (err) {
    console.error("analyze-image error:", err);
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ error: (err as Error).message || "Server error" }));
  }
}