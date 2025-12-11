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
  name: string;
  category: Category;
  productionDate?: string; // ISO Date string YYYY-MM-DD
  purchaseDate: string;   // ISO Date string YYYY-MM-DD
  expiryDate?: string;    // ISO Date string YYYY-MM-DD
  weight?: string;
  remainingPercentage: number; // 0 to 100
  emoji: string;
}

export interface ScannedFoodData {
  name: string;
  category: Category;
  productionDate?: string;
  expiryDate?: string;
  weight?: string;
}

export interface SearchResult {
  found: boolean;
  item?: FoodItem;
  message: string;
}
