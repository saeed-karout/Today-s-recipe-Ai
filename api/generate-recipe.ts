import { GoogleGenAI } from "@google/genai";

// تعريف الأنواع
type Handler = (event: { 
  httpMethod: string; 
  body: string | null; 
  headers: Record<string, string> 
}) => Promise<{ statusCode: number; headers: Record<string, string>; body: string }>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// SYSTEM_INSTRUCTION مبسطة للاختبار
const SYSTEM_INSTRUCTION = `
You are a professional chef specializing in Middle Eastern and Western Fast Food.
Respond in JSON format.
`;

export const handler: Handler = async (event) => {
  // معالجة CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  
  // السماح فقط بـ POST
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers: corsHeaders, 
      body: JSON.stringify({ error: "Method not allowed. Use POST." }) 
    };
  }

  // التحقق من مفتاح API
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { 
      statusCode: 500, 
      headers: corsHeaders, 
      body: JSON.stringify({ error: "GEMINI_API_KEY is not set in environment variables" }) 
    };
  }

  try {
    // قراءة body الطلب
    const body = JSON.parse(event.body || "{}");
    const { ingredients, cuisineType = "Middle Eastern", language = "en" } = body;
    
    // التحقق من وجود المكونات
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return { 
        statusCode: 400, 
        headers: corsHeaders, 
        body: JSON.stringify({ error: "ingredients array is required" }) 
      };
    }

    console.log("🔄 Generating recipe with:", { ingredients, cuisineType, language });

    // تهيئة Gemini
    const ai = new GoogleGenAI({ apiKey });
    
    // بناء prompt
    const prompt = `
    ${SYSTEM_INSTRUCTION}
    
    Generate a ${cuisineType} recipe using these ingredients: ${ingredients.join(", ")}.
    The response must be in ${language === "ar" ? "Arabic" : "English"}.
    
    Return a valid JSON object with this exact structure:
    {
      "recipeName": "Name of the recipe",
      "origin": "Country of origin",
      "cuisineType": "${cuisineType}",
      "prepTime": "Preparation time",
      "cookTime": "Cooking time",
      "difficulty": "Easy/Medium/Hard",
      "ingredients": ["list", "of", "ingredients", "with", "quantities"],
      "instructions": ["step 1", "step 2"],
      "chefTips": "Optional tip"
    }
    `;

    // استدعاء Gemini بدون responseSchema المعقد
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // اسم النموذج الذي تريده
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    });

    // التحقق من وجود رد
    if (!response || !response.text) {
      throw new Error("Empty response from Gemini API");
    }

    // استخراج JSON من الرد (قد يكون محاطاً بعلامات Markdown)
    let text = response.text;
    const jsonMatch = text.match(/```(?:json)?\n([\s\S]*?)\n```/) || 
                      text.match(/{[\s\S]*}/);
    
    if (jsonMatch) {
      text = jsonMatch[1] || jsonMatch[0];
    }

    // تحويل النص إلى JSON
    const recipeJson = JSON.parse(text.trim());
    
    return { 
      statusCode: 200, 
      headers: corsHeaders, 
      body: JSON.stringify(recipeJson) 
    };

  } catch (err: unknown) {
    // تسجيل الخطأ بالكامل للتصحيح
    console.error("🔴 Full error:", err);
    
    // استخراج رسالة الخطأ
    let errorMessage = "Unknown error occurred";
    if (err instanceof Error) {
      errorMessage = err.message;
      
      // محاولة استخراج تفاصيل أكثر من أخطاء Gemini
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error?.message) {
          errorMessage = parsed.error.message;
        }
      } catch {
        // ليس JSON، نستخدم الرسالة كما هي
      }
    }
    
    return { 
      statusCode: 500, 
      headers: corsHeaders, 
      body: JSON.stringify({ 
        error: errorMessage,
        details: err instanceof Error ? err.toString() : String(err)
      }) 
    };
  }
};