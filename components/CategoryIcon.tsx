import React from 'react';
import { Category } from '../types';

export const getCategoryEmoji = (category: Category): string => {
  switch (category) {
    case Category.VEGETABLE: return '🥦';
    case Category.FRUIT: return '🍎';
    case Category.MEAT: return '🥩';
    case Category.DAIRY: return '🧀';
    case Category.DRINK: return '🥤';
    case Category.SNACK: return '🥨';
    case Category.CONDIMENT: return '🥫';
    case Category.OTHER: return '📦';
    default: return '📦';
  }
};

export const CategoryIcon: React.FC<{ category: Category; size?: string }> = ({ category, size = 'text-2xl' }) => {
  return <span className={size}>{getCategoryEmoji(category)}</span>;
};
