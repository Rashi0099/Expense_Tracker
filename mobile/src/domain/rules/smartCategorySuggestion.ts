/**
 * Deterministic Smart Category Suggestion Engine (Section 32)
 *
 * Provides instant, zero-AI merchant keyword to category matching.
 * Architecture is cleanly decoupled behind this interface so machine learning or server heuristics
 * can be plugged in without refactoring UI components.
 */

import { CategoryModel } from '../models';
import { ICategoryMemoryRepository } from '../../database/repositories/interfaces/ICategoryMemoryRepository';

export interface CategorySuggestionRule {
  keywords: string[];
  categoryName: string;
}

export const DEFAULT_MERCHANT_RULES: CategorySuggestionRule[] = [
  {
    categoryName: 'Food & Dining',
    keywords: [
      'starbucks',
      'mcdonald',
      'subway',
      'kfc',
      'burger',
      'pizza',
      'domino',
      'cafe',
      'coffee',
      'restaurant',
      'swiggy',
      'zomato',
      'diner',
      'bakery',
      'taco',
      'chipotle',
      'doordash',
      'ubereats',
      'dunkin',
      'panera',
      'wendy',
    ],
  },
  {
    categoryName: 'Groceries',
    keywords: [
      'walmart',
      'target',
      'supermarket',
      'grocery',
      'groceries',
      'costco',
      'trader joe',
      'whole foods',
      'safeway',
      'kroger',
      'market',
      'mart',
      'aldi',
      'sprouts',
      'instacart',
    ],
  },
  {
    categoryName: 'Transport & Fuel',
    keywords: [
      'uber',
      'lyft',
      'ola',
      'grab',
      'taxi',
      'cab',
      'metro',
      'subway ticket',
      'train',
      'transit',
      'bus',
      'shell',
      'chevron',
      'bp',
      'exxon',
      'gas',
      'fuel',
      'petrol',
      'parking',
      'toll',
      'speedway',
      'mobil',
    ],
  },
  {
    categoryName: 'Shopping',
    keywords: [
      'amazon',
      'ebay',
      'aliexpress',
      'apple store',
      'best buy',
      'clothing',
      'zara',
      'h&m',
      'nike',
      'adidas',
      'mall',
      'store',
      'shop',
      'flipkart',
      'shein',
      'ikea',
    ],
  },
  {
    categoryName: 'Bills & Utilities',
    keywords: [
      'electric',
      'power',
      'water',
      'gas utility',
      'internet',
      'wifi',
      'broadband',
      'verizon',
      'at&t',
      't-mobile',
      'airtel',
      'jio',
      'telecom',
      'rent',
      'utility',
      'coned',
      'pge',
    ],
  },
  {
    categoryName: 'Entertainment',
    keywords: [
      'netflix',
      'spotify',
      'hulu',
      'disney',
      'prime video',
      'cinema',
      'movie',
      'theater',
      'playstation',
      'xbox',
      'steam',
      'game',
      'concert',
      'ticketmaster',
      'youtube premium',
      'apple tv',
      'audible',
    ],
  },
];

/**
 * Suggests a category based on the merchant / payee string.
 * Returns the matching CategoryModel or null if no confident match.
 */
export function suggestCategoryFromMerchant(
  merchant: string,
  categories: CategoryModel[],
  customRules: CategorySuggestionRule[] = DEFAULT_MERCHANT_RULES
): CategoryModel | null {
  if (!merchant || merchant.trim() === '') return null;

  const normalized = merchant.toLowerCase().trim();

  // 1. Look for keyword matches
  for (const rule of customRules) {
    const matched = rule.keywords.some((kw) => normalized.includes(kw));
    if (matched) {
      const category = categories.find(
        (c) => c.name.toLowerCase() === rule.categoryName.toLowerCase() && c.type === 'EXPENSE'
      );
      if (category) {
        return category;
      }
    }
  }

  // 2. Direct partial match against category names
  const directMatch = categories.find(
    (c) =>
      c.type === 'EXPENSE' &&
      (normalized.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(normalized))
  );

  return directMatch || null;
}

export interface SuggestCategoryParams {
  merchant: string;
  categories: CategoryModel[];
  userId?: string | null;
  memoryRepo?: ICategoryMemoryRepository;
  customRules?: CategorySuggestionRule[];
}

/**
 * 3-Tier Deterministic Category Suggestion Engine (Zero AI/ML):
 * Tier 1: User's learned SQLite Category Memory (highest priority)
 * Tier 2: Deterministic keyword rules (DEFAULT_MERCHANT_RULES)
 * Tier 3: Direct category name matching
 */
export async function suggestCategoryAsync(
  params: SuggestCategoryParams
): Promise<CategoryModel | null> {
  const { merchant, categories, userId, memoryRepo, customRules = DEFAULT_MERCHANT_RULES } = params;
  if (!merchant || merchant.trim() === '') return null;

  // Tier 1: SQLite Category Memory
  if (userId && memoryRepo) {
    try {
      const preferredCatId = await memoryRepo.getPreferredCategory(userId, merchant);
      if (preferredCatId) {
        const found = categories.find((c) => c.id === preferredCatId && c.type === 'EXPENSE');
        if (found) {
          return found;
        }
      }
    } catch {
      // Fall through to deterministic rules on DB error
    }
  }

  // Tier 2 & 3: Deterministic keyword rules + Direct match
  return suggestCategoryFromMerchant(merchant, categories, customRules);
}

