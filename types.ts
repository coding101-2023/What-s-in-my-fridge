export enum Category {
  VEGETABLE = 'Vegetable',
  FRUIT = 'Fruit',
  MEAT = 'Meat',
  DAIRY = 'Dairy',
  DRINK = 'Drink',
  SNACK = 'Snack',
  CONDIMENT = 'Condiment',
  OTHER = 'Other',
}

export interface FoodItem {
  id: string;
  name: string; // Fallback / Primary ID
  nameEn?: string;
  nameZh?: string;
  category: Category;
  productionDate?: string; // ISO Date string YYYY-MM-DD
  purchaseDate: string;   // ISO Date string YYYY-MM-DD
  expiryDate?: string;    // ISO Date string YYYY-MM-DD
  weight?: string;
  remainingPercentage: number; // 0 to 100
  emoji: string;
}

export interface ScannedFoodData {
  nameEn: string;
  nameZh: string;
  category: Category;
  productionDate?: string;
  expiryDate?: string;
  weight?: string;
}

export interface ReceiptData {
  date: string | null;
  items: {
    nameEn: string;
    nameZh: string;
    category: Category;
    quantity?: string; // e.g. "2", "500g"
  }[];
}

export interface VideoLink {
  title: string;
  url: string;
  platform: 'Xiaohongshu' | 'Douyin' | 'YouTube' | 'TikTok' | 'Web';
}

export interface Recipe {
  name: string;
  description: string;
  ingredientsUsed: string[];      // Ingredients available in fridge
  missingIngredients: string[];   // Ingredients to buy
  instructions: string[];         // Step by step
  videoLinks: VideoLink[];        // External video links
  imageUrl?: string;              // URL from search or generation
  imageLoading?: boolean;
}

export interface SearchResult {
  found: boolean;
  item?: FoodItem;
  scannedNameEn: string;
  scannedNameZh: string;
}
