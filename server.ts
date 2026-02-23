import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { put } from "@vercel/blob";

dotenv.config();

const app = express();
const PORT = 3000;

// Setup Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

app.use(cors());
app.use(express.json({ limit: "50mb" })); // زيادة الحد لاستقبال الصور الكبيرة

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
    cuisineType: {
      type: Type.STRING,
      description: "Middle Eastern or Western Fast Food",
    },
    prepTime: { type: Type.STRING, description: "Preparation time" },
    cookTime: { type: Type.STRING, description: "Cooking time" },
    difficulty: { type: Type.STRING, description: "Easy, Medium, or Hard" },
    ingredients: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of ingredients with quantities",
    },
    instructions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Step-by-step preparation steps",
    },
    chefTips: { type: Type.STRING, description: "Optional tips from the chef" },
    detectedIngredients: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Only for image analysis: list of ingredients detected in the image",
    },
  },
  required: [
    "recipeName",
    "origin",
    "cuisineType",
    "prepTime",
    "cookTime",
    "difficulty",
    "ingredients",
    "instructions",
  ],
};

app.post("/api/upload-image", upload.single("image"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    console.log("Uploading to Vercel Blob...");

    // رفع الصورة إلى Vercel Blob
    const blob = await put(req.file.originalname, req.file.buffer, {
      access: "public",
      contentType: req.file.mimetype,
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log("Uploaded successfully:", blob.url);

    // الآن استخدم الرابط لتحليل الصورة
    const { language, cuisineType } = req.body;

    // تحميل الصورة من الرابط لتحليلها
    const imageResponse = await fetch(blob.url);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    const prompt = `Analyze this image to detect food ingredients. 
    Then, generate a ${cuisineType || "Middle Eastern"} recipe using these detected ingredients.
    The response must be in ${language === "ar" ? "Arabic" : "English"}.
    Include the detected ingredients in the 'detectedIngredients' field.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: req.file.mimetype,
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

    const result = JSON.parse(response.text || "{}");
    result.imageUrl = blob.url; // إضافة رابط الصورة للنتيجة إذا أردت

    res.json(result);
  } catch (error: any) {
    console.error("Error uploading/analyzing image:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/analyze-image-base64", async (req, res) => {
  try {
    const { image, language, cuisineType } = req.body;

    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    // استخراج الـ base64 من data URL
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // تحديد نوع الصورة من الـ data URL
    const matches = image.match(/^data:image\/(\w+);base64,/);
    const mimeType = matches ? `image/${matches[1]}` : "image/jpeg";

    const prompt = `Analyze this image to detect food ingredients. 
    Then, generate a ${cuisineType || "Middle Eastern"} recipe using these detected ingredients.
    The response must be in ${language === "ar" ? "Arabic" : "English"}.
    Include the detected ingredients in the 'detectedIngredients' field.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RECIPE_SCHEMA,
      },
    });

    const result = JSON.parse(response.text || "{}");
    res.json(result);
  } catch (error: any) {
    console.error("Error analyzing image:", error);
    res.status(500).json({ error: error.message });
  }
});
// مسار جديد: إنشاء توكن لرفع الصور إلى Vercel Blob
app.post("/api/upload-token", async (req, res) => {
  try {
    const { filename, contentType } = req.body;

    // استيراد ديناميكي لأن handleUpload يعمل فقط في بيئة Node.js
    const { handleUpload } = await import("@vercel/blob");

    // إنشاء استجابة كاذبة للـ handleUpload
    const mockRequest = {
      json: async () => ({
        filename,
        contentType,
      }),
    } as Request;

    const jsonResponse = await handleUpload({
      body: { filename, contentType },
      request: mockRequest,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/heic",
        ],
        maximumSizeInBytes: 10 * 1024 * 1024,
        tokenPayload: JSON.stringify({}),
      }),
    });

    res.json(jsonResponse);
  } catch (error: any) {
    console.error("Upload token error:", error);
    res.status(500).json({ error: error.message });
  }
});

// server.ts - أضف هذا المسار الجديد
app.post("/api/analyze-image-base64", async (req, res) => {
  try {
    const { image, language, cuisineType } = req.body;

    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    console.log("Analyzing image from base64...");

    // استخراج الـ base64 من data URL
    const base64Data = image.split(",")[1];

    // استخراج نوع الصورة
    const matches = image.match(/^data:image\/(\w+);base64,/);
    const mimeType = matches ? `image/${matches[1]}` : "image/jpeg";

    if (!base64Data) {
      return res.status(400).json({ error: "Invalid image format" });
    }

    const prompt = `Analyze this image to detect food ingredients. 
    Then, generate a ${cuisineType || "Middle Eastern"} recipe using these detected ingredients.
    The response must be in ${language === "ar" ? "Arabic" : "English"}.
    Include the detected ingredients in the 'detectedIngredients' field.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RECIPE_SCHEMA,
      },
    });

    if (!response.text) {
      throw new Error("No response from Gemini");
    }

    const result = JSON.parse(response.text);
    console.log("Analysis complete:", result.recipeName);

    res.json(result);
  } catch (error: any) {
    console.error("Error analyzing image:", error);

    // التحقق من خطأ الحصة (quota)
    if (
      error.status === 429 ||
      error.message?.includes("429") ||
      error.message?.includes("quota")
    ) {
      // استخراج وقت الانتظار من رسالة الخطأ
      const retryMatch = error.message?.match(/retry in (\d+(\.\d+)?)s/);
      const retrySeconds = retryMatch
        ? Math.ceil(parseFloat(retryMatch[1]))
        : 60;

      return res.status(429).json({
        error: "QUOTA_EXCEEDED",
        message: error.message,
        retryAfter: retrySeconds,
        userMessage: {
          ar: `لقد استنفدت حصتك اليومية من الطلبات (20 طلب). يرجى الانتظار ${retrySeconds} ثانية أو العودة غداً.`,
          en: `You've exceeded your daily quota (20 requests). Please wait ${retrySeconds} seconds or try again tomorrow.`,
        },
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// تعديل مسار تحليل الصور لاستقبال رابط الصورة
app.post("/api/analyze-image", async (req, res) => {
  try {
    const { imageUrl, language, cuisineType } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: "No image URL provided" });
    }

    console.log("Analyzing image from URL:", imageUrl);

    // تحميل الصورة من الرابط
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error("Failed to fetch image from URL");
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

    const prompt = `Analyze this image to detect food ingredients. 
    Then, generate a ${cuisineType || "Middle Eastern"} recipe using these detected ingredients.
    The response must be in ${language === "ar" ? "Arabic" : "English"}.
    Include the detected ingredients in the 'detectedIngredients' field.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
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

    const result = JSON.parse(response.text || "{}");
    console.log("Analysis result:", result.recipeName);

    res.json(result);
  } catch (error: any) {
    console.error("Error analyzing image:", error);

    // التحقق من خطأ الحصة (quota)
    if (
      error.status === 429 ||
      error.message?.includes("429") ||
      error.message?.includes("quota")
    ) {
      // استخراج وقت الانتظار من رسالة الخطأ
      const retryMatch = error.message?.match(/retry in (\d+(\.\d+)?)s/);
      const retrySeconds = retryMatch
        ? Math.ceil(parseFloat(retryMatch[1]))
        : 60;

      return res.status(429).json({
        error: "QUOTA_EXCEEDED",
        message: error.message,
        retryAfter: retrySeconds,
        userMessage: {
          ar: `لقد استنفدت حصتك اليومية من الطلبات (20 طلب). يرجى الانتظار ${retrySeconds} ثانية أو العودة غداً.`,
          en: `You've exceeded your daily quota (20 requests). Please wait ${retrySeconds} seconds or try again tomorrow.`,
        },
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// الاحتفاظ بالمسار القديم للتوافق (اختياري)
app.post(
  "/api/analyze-image-upload",
  upload.single("image"),
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      const { language, cuisineType } = req.body;
      const base64Image = req.file.buffer.toString("base64");

      const prompt = `Analyze this image to detect food ingredients. 
    Then, generate a ${cuisineType || "Middle Eastern"} recipe using these detected ingredients.
    The response must be in ${language === "ar" ? "Arabic" : "English"}.
    Include the detected ingredients in the 'detectedIngredients' field.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { text: prompt },
          {
            inlineData: {
              mimeType: req.file.mimetype,
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

      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("Error analyzing image:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

app.post("/api/generate-recipe", async (req, res) => {
  try {
    const { ingredients, cuisineType, language } = req.body;

    const prompt = `Generate a ${cuisineType} recipe using these ingredients: ${ingredients.join(", ")}. 
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

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Error generating recipe:", error);

    // التحقق من خطأ الحصة (quota)
    if (
      error.status === 429 ||
      error.message?.includes("429") ||
      error.message?.includes("quota")
    ) {
      // استخراج وقت الانتظار من رسالة الخطأ
      const retryMatch = error.message?.match(/retry in (\d+(\.\d+)?)s/);
      const retrySeconds = retryMatch
        ? Math.ceil(parseFloat(retryMatch[1]))
        : 60;

      return res.status(429).json({
        error: "QUOTA_EXCEEDED",
        message: error.message,
        retryAfter: retrySeconds,
        userMessage: {
          ar: `لقد استنفدت حصتك اليومية من الطلبات (20 طلب). يرجى الانتظار ${retrySeconds} ثانية أو العودة غداً.`,
          en: `You've exceeded your daily quota (20 requests). Please wait ${retrySeconds} seconds or try again tomorrow.`,
        },
      });
    }

    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
