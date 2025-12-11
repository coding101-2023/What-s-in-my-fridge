import { GoogleGenAI, Type } from "@google/genai";
import { Category, ScannedFoodData } from "../types";

// Helper to remove code blocks if model adds them
const cleanJSON = (text: string) => {
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
};

export const analyzeFridgeItem = async (base64Images: string[]): Promise<ScannedFoodData> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });

  const imageParts = base64Images.map(img => ({
    inlineData: { mimeType: "image/jpeg", data: img }
  }));

  const prompt = `
    Analyze these images of a food item. Extract the following information:
    1. Name of the food in Simplified Chinese (be concise, e.g., "希腊酸奶", "菠菜").
    2. Category (choose closest from: Vegetable, Fruit, Meat, Dairy, Drink, Snack, Condiment, Other).
    3. Expiry date (YYYY-MM-DD). If only month/day is visible, assume current year. If not found, leave null.
    4. Production date (YYYY-MM-DD). If not found, leave null.
    5. Net Weight or Volume (e.g., "500g", "1L"). If not found, leave null.
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
            name: { type: Type.STRING },
            category: { type: Type.STRING, enum: Object.values(Category) },
            expiryDate: { type: Type.STRING, nullable: true },
            productionDate: { type: Type.STRING, nullable: true },
            weight: { type: Type.STRING, nullable: true },
          },
          required: ["name", "category"],
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

export const identifyShopItem = async (base64Images: string[]): Promise<{ name: string; category: Category }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });

  const imageParts = base64Images.map(img => ({
    inlineData: { mimeType: "image/jpeg", data: img }
  }));

  const prompt = `
    Identify this food item from the images. Return the name (in Simplified Chinese) and its general category.
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
            name: { type: Type.STRING },
            category: { type: Type.STRING, enum: Object.values(Category) },
          },
          required: ["name", "category"],
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