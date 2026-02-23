// api/analyze-image.ts

import busboy from "busboy";
import sharp from "sharp";
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

interface ParsedForm {
  image?: { buffer: Buffer; mimeType: string }[];
  language?: string[];
  cuisineType?: string[];
}

export const config = {
  maxDuration: 60, // أعطِ الدالة حتى 60 ثانية (مهم جدًا لمعالجة الصور + Gemini)
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
    res.end(JSON.stringify({ error: "GEMINI_API_KEY is not set in Vercel Environment Variables" }));
    return;
  }

  try {
    // قراءة multipart/form-data بطريقة مستقرة
    const parsed = await new Promise<ParsedForm>((resolve, reject) => {
      const result: ParsedForm = {};
      const contentType = req.headers["content-type"] || "";

      if (!contentType || !contentType.includes("multipart/form-data")) {
        reject(new Error("Invalid Content-Type, expected multipart/form-data"));
        return;
      }

      const bb = busboy({
        headers: { "content-type": contentType },
        limits: {
          fileSize: 6 * 1024 * 1024, // حد أقصى 6MB (احتياطي)
          files: 1,
        },
      });

      bb.on("file", (fieldname, file, info) => {
        if (fieldname !== "image") {
          file.resume();
          return;
        }

        const chunks: Buffer[] = [];
        file.on("data", (chunk) => chunks.push(chunk));
        file.on("end", () => {
          result.image = [{
            buffer: Buffer.concat(chunks),
            mimeType: info.mimeType || "image/jpeg",
          }];
        });
      });

      bb.on("field", (name, value) => {
        if (name === "language") result.language = [value];
        if (name === "cuisineType") result.cuisineType = [value];
      });

      bb.on("error", (err) => {
        console.error("Busboy error:", err.message);
        reject(err);
      });

      bb.on("finish", () => {
        resolve(result);
      });

      req.pipe(bb);
    });

    // التحقق من وجود الصورة
    if (!parsed.image || !parsed.image[0]) {
      res.writeHead(400, corsHeaders);
      res.end(JSON.stringify({ error: "No image uploaded or invalid form data" }));
      return;
    }

    const imageEntry = parsed.image[0];
    const language = parsed.language?.[0] || "en";
    const cuisineType = parsed.cuisineType?.[0] || "Middle Eastern";

    // ضغط الصورة داخل الـ server (احتياطي مهم)
    const MAX_EDGE = 768; // قيمة متوازنة بين الجودة والسرعة
    const resizedBuffer = await sharp(imageEntry.buffer)
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    const base64Image = resizedBuffer.toString("base64");

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

    console.time("gemini-image-call");
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image,
        },
      },
    ]);
    console.timeEnd("gemini-image-call");

    const responseText = result.response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error("JSON parse failed:", parseErr);
      const cleaned = responseText.replace(/```json\s*|\s*```/g, "").trim();
      data = JSON.parse(cleaned);
    }

    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify(data));

  } catch (err: any) {
    console.error("analyze-image error:", {
      message: err.message,
      stack: err.stack?.substring(0, 500),
      name: err.name,
    });

    const errorMessage =
      err.message?.includes("timeout") || err.message?.includes("took too long")
        ? "Request timed out. Try a smaller image or check your internet connection."
        : err.message?.includes("size") || err.message?.includes("limit")
        ? "Image or request payload too large (Vercel limit ~4.5MB). Compress more or use smaller photo."
        : err.message || "Internal server error during image analysis";

    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ error: errorMessage }));
  }
}