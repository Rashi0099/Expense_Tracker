import React from 'react';
import {
  Utensils,
  Car,
  Home,
  Zap,
  Film,
  Activity,
  ShoppingBag,
  Smile,
  Briefcase,
  Laptop,
  TrendingUp,
  Gift,
  Tag,
  DollarSign,
  Coffee,
  Plane,
  Heart,
  BookOpen,
  Smartphone,
  Music,
  CreditCard,
  Percent,
  Wallet,
  LucideIcon,
} from 'lucide-react';

const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  home: Home,
  zap: Zap,
  film: Film,
  activity: Activity,
  'shopping-bag': ShoppingBag,
  shopping_bag: ShoppingBag,
  shoppingbag: ShoppingBag,
  shopping: ShoppingBag,
  smile: Smile,
  briefcase: Briefcase,
  laptop: Laptop,
  'trending-up': TrendingUp,
  trending_up: TrendingUp,
  trendingup: TrendingUp,
  trending: TrendingUp,
  gift: Gift,
  coffee: Coffee,
  plane: Plane,
  heart: Heart,
  book: BookOpen,
  phone: Smartphone,
  music: Music,
  creditcard: CreditCard,
  'credit-card': CreditCard,
  percent: Percent,
  wallet: Wallet,
  dollar: DollarSign,
  money: DollarSign,
  tag: Tag,
  default: Tag,
};

const EMOJI_MAP: Record<string, string> = {
  utensils: '🍽️',
  car: '🚗',
  home: '🏠',
  zap: '⚡',
  film: '🎬',
  activity: '🏥',
  'shopping-bag': '🛍️',
  shopping_bag: '🛍️',
  shoppingbag: '🛍️',
  shopping: '🛍️',
  smile: '💆',
  briefcase: '💼',
  laptop: '💻',
  'trending-up': '📈',
  trending_up: '📈',
  trendingup: '📈',
  trending: '📈',
  gift: '🎁',
  coffee: '☕',
  plane: '✈️',
  heart: '❤️',
  book: '📚',
  phone: '📱',
  music: '🎵',
  creditcard: '💳',
  'credit-card': '💳',
  percent: '🏷️',
  wallet: '👛',
  dollar: '💵',
  money: '💵',
  tag: '🏷️',
  default: '🏷️',
};

export const getCategoryEmoji = (icon?: string | null): string => {
  if (!icon) return '🏷️';
  const clean = icon.trim();
  // If it's already an emoji (contains non-ASCII characters)
  if (/[^\u0000-\u007F]/.test(clean)) {
    return clean;
  }
  const lower = clean.toLowerCase();
  return EMOJI_MAP[lower] || '🏷️';
};

export interface CategoryIconProps {
  icon?: string | null;
  className?: string;
  color?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon,
  className = 'w-5 h-5',
  color,
  size,
}) => {
  if (!icon) {
    return <Tag className={className} style={color ? { color } : undefined} size={size} />;
  }

  const clean = icon.trim();

  // If it's an emoji (contains non-ASCII characters)
  if (/[^\u0000-\u007F]/.test(clean)) {
    return <span className="inline-flex items-center justify-center leading-none text-xl select-none">{clean}</span>;
  }

  // If it's a known Lucide icon name
  const IconComponent = LUCIDE_ICON_MAP[clean.toLowerCase()];
  if (IconComponent) {
    return (
      <IconComponent
        className={className}
        style={color ? { color } : undefined}
        size={size}
      />
    );
  }

  // Fallback to Tag icon
  return <Tag className={className} style={color ? { color } : undefined} size={size} />;
};
