import { GoogleGenAI, Type } from "@google/genai";
import { Category, ScannedFoodData, ReceiptData, Recipe } from "../types";

// Helper to remove code blocks if model adds them
const cleanJSON = (text: string) => {
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
};

const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error("API Key is missing");
const ai = new GoogleGenAI({ apiKey });

export const analyzeFridgeItem = async (base64Images: string[]): Promise<ScannedFoodData> => {
  const imageParts = base64Images.map(img => ({
    inlineData: { mimeType: "image/jpeg", data: img }
  }));

  const prompt = `
    Analyze these images of a food item. Extract the following information:
    1. Name of the food in English (nameEn).
    2. Name of the food in Simplified Chinese (nameZh).
    3. Category (choose closest from: Vegetable, Fruit, Meat, Dairy, Drink, Snack, Condiment, Other).
    4. Expiry date (YYYY-MM-DD). If only month/day is visible, assume current year. If not found, leave null.
    5. Production date (YYYY-MM-DD). If not found, leave null.
    6. Net Weight or Volume (e.g., "500g", "1L"). If not found, leave null.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          ...imageParts,
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nameEn: { type: Type.STRING },
            nameZh: { type: Type.STRING },
            category: { type: Type.STRING, enum: Object.values(Category) },
            expiryDate: { type: Type.STRING, nullable: true },
            productionDate: { type: Type.STRING, nullable: true },
            weight: { type: Type.STRING, nullable: true },
          },
          required: ["nameEn", "nameZh", "category"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(cleanJSON(text)) as ScannedFoodData;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    throw error;
  }
};

export const identifyShopItem = async (base64Images: string[]): Promise<{ nameEn: string; nameZh: string; category: Category }> => {
  const imageParts = base64Images.map(img => ({
    inlineData: { mimeType: "image/jpeg", data: img }
  }));

  const prompt = `
    Identify this food item. Return the name in English and Simplified Chinese, and its category.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
           ...imageParts,
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nameEn: { type: Type.STRING },
            nameZh: { type: Type.STRING },
            category: { type: Type.STRING, enum: Object.values(Category) },
          },
          required: ["nameEn", "nameZh", "category"],
        },
      },
    });

     const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(cleanJSON(text));
  } catch (error) {
    console.error("Gemini identification failed:", error);
    throw error;
  }
};

export const parseReceipt = async (base64Images: string[]): Promise<ReceiptData> => {
  const imageParts = base64Images.map(img => ({
    inlineData: { mimeType: "image/jpeg", data: img }
  }));

  const prompt = `
    Analyze this shopping receipt.
    1. Extract the Purchase Date (YYYY-MM-DD). If not found, return null.
    2. List all food items found on the receipt.
    3. For each item, identify the Name in English (nameEn) and Simplified Chinese (nameZh).
    4. Categorize each item.
    5. If there is a quantity or weight (e.g. "x2", "500g"), include it.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          ...imageParts,
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, nullable: true },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                   nameEn: { type: Type.STRING },
                   nameZh: { type: Type.STRING },
                   category: { type: Type.STRING, enum: Object.values(Category) },
                   quantity: { type: Type.STRING, nullable: true }
                },
                required: ["nameEn", "nameZh", "category"]
              }
            }
          },
          required: ["items"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(cleanJSON(text)) as ReceiptData;
  } catch (error) {
    console.error("Receipt parsing failed:", error);
    throw error;
  }
};

export const suggestRecipes = async (ingredients: string[], lang: 'en' | 'zh'): Promise<Recipe[]> => {
    // 1. Search for recipes using Google Search Grounding
    const langInstruction = lang === 'zh' ? "in Simplified Chinese" : "in English";
    const cuisine = lang === 'zh' ? "Chinese or Fusion" : "International or Home-style";
    
    // Define search/video platforms
    const platform1 = lang === 'zh' ? "Xiaohongshu" : "YouTube";
    const platform2 = lang === 'zh' ? "Douyin" : "TikTok";

    const prompt = `
      I have these ingredients that are about to expire: ${ingredients.join(', ')}.
      
      Task:
      1. Create **at least 3 distinct** delicious ${cuisine} recipes that efficiently use these ingredients.
         - **Maximize ingredient usage**: Try to use as many of the provided ingredients as possible.
         - Ensure the 3 recipes are different from each other.
      
      2. For **EACH** recipe, find **at least 2** relevant video tutorials.
         - **CRITICAL REQUIREMENT**: The video links must be WORKING.
         - **SAFE FALLBACK**: If you cannot find a specific, confirmed video URL, **construct a valid SEARCH URL** for the platform instead.
           - Example for YouTube: https://www.youtube.com/results?search_query=Recipe+Name+Here
           - Example for TikTok: https://www.tiktok.com/search?q=Recipe+Name+Here
           - Example for Xiaohongshu: https://www.xiaohongshu.com/search_result?keyword=Recipe+Name+Here
         - **DO NOT** invent fake video IDs (e.g. do not output youtube.com/watch?v=RANDOM_STRING). It is better to give a search link than a broken video link.
      
      3. Find a **real image URL** for the final dish using Google Search. 
      
      4. Provide clear cooking instructions. **Do not number the steps** in the text (e.g. just "Chop the onions", not "1. Chop the onions"), as the app handles numbering.

      Output the result strictly as a valid JSON array of objects with the following schema:
      [
        {
          "name": "Recipe Name (${langInstruction})",
          "description": "Short appetizing description (${langInstruction})",
          "ingredientsUsed": ["ingredient 1", "ingredient 2"],
          "missingIngredients": ["missing ingredient 1"],
          "instructions": ["Step 1 text", "Step 2 text"],
          "videoLinks": [
             { "title": "Watch on ${platform1}", "url": "URL", "platform": "${platform1}" },
             { "title": "Watch on ${platform2}", "url": "URL", "platform": "${platform2}" }
          ],
          "imageUrl": "https://..."
        }
      ]
      Do not include any markdown formatting like \`\`\`json. Just the raw JSON string.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        const text = response.text;
        if (!text) return [];
        const recipes = JSON.parse(cleanJSON(text)) as Recipe[];
        return recipes;
    } catch (error) {
        console.error("Recipe search failed:", error);
        throw error;
    }
};

export const generateRecipeImage = async (recipeName: string, description: string): Promise<string | undefined> => {
    try {
        const prompt = `
        Draw a food illustration of ${recipeName} in the style of Studio Ghibli. 
        Hand-painted anime food style, watercolor textures, warm and cozy lighting. 
        Highly detailed, appetizing, screenshot from a Ghibli movie.
        Description: ${description}.
        `;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: { parts: [{ text: prompt }] },
        });
        
        const candidates = response.candidates;
        if (candidates && candidates[0]?.content?.parts) {
             for (const part of candidates[0].content.parts) {
                 if (part.inlineData && part.inlineData.data) {
                     return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                 }
             }
        }
        return undefined;
    } catch (error) {
        console.error("Image gen failed:", error);
        return undefined;
    }
}
