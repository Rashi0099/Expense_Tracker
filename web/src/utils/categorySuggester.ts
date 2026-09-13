import { Category } from '@/types/category';

// Deterministic keyword to category pattern mapping
const MERCHANT_PATTERNS: Record<string, string[]> = {
  Food: ['swiggy', 'zomato', 'starbucks', 'mcdonald', 'kfc', 'burger', 'restaurant', 'cafe', 'domino', 'pizza', 'diner'],
  Groceries: ['whole foods', 'walmart', 'trader joe', 'supermarket', 'instacart', 'grocery', 'blinkit', 'zepto', 'costco'],
  Transport: ['uber', 'ola', 'lyft', 'metro', 'bus', 'train', 'gas', 'shell', 'fuel', 'chevron', 'petrol'],
  Shopping: ['amazon', 'flipkart', 'target', 'ebay', 'zara', 'h&m', 'nike', 'adidas', 'apple store'],
  Entertainment: ['netflix', 'spotify', 'hulu', 'disney', 'cinema', 'theatre', 'steam', 'playstation', 'prime video'],
  Healthcare: ['pharmacy', 'cvs', 'walgreens', 'hospital', 'clinic', 'dentist', 'apollo', 'doctor', 'medicine'],
  Utilities: ['electricity', 'water', 'internet', 'wifi', 'airtel', 'jio', 'verizon', 'att', 'utility'],
};

const STORAGE_KEY = '@expenseflow/category_memory';

interface LearnedMemoryEntry {
  categoryId: string;
  count: number;
  lastUsedAt: string;
}

/**
 * Persists the user's category choice for a given merchant name in localStorage.
 * Enables zero-AI/ML deterministic learning from the user's own habits.
 */
export function recordUserCategoryChoice(payee: string | undefined, categoryId: string): void {
  if (!payee || !categoryId || typeof window === 'undefined') return;
  const normalized = payee.toLowerCase().trim();
  if (normalized.length < 2) return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const memory: Record<string, LearnedMemoryEntry> = raw ? JSON.parse(raw) : {};

    const existing = memory[normalized];
    memory[normalized] = {
      categoryId,
      count: existing ? existing.count + 1 : 1,
      lastUsedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Graceful fallback if localStorage is unavailable
  }
}

/**
 * Deterministically suggests a matching category based on payee or description text.
 * 1. Tier 1: User's learned memory from previous transactions (Highest Priority)
 * 2. Tier 2: Built-in merchant pattern heuristics
 * 3. Tier 3: Category name substring match
 */
export function getSuggestedCategory(
  payeeOrNote: string | undefined,
  availableCategories: Category[]
): Category | null {
  if (!payeeOrNote || availableCategories.length === 0) {
    return null;
  }

  const query = payeeOrNote.toLowerCase().trim();
  if (query.length < 2) {
    return null;
  }

  // 1. Tier 1: User's learned memory
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const memory: Record<string, LearnedMemoryEntry> = JSON.parse(raw);
        const learned = memory[query];
        if (learned) {
          const match = availableCategories.find(
            (c) => c.type === 'EXPENSE' && c.id === learned.categoryId
          );
          if (match) return match;
        }
      }
    } catch {
      // Continue to heuristics
    }
  }

  // 2. Tier 2: Direct merchant rule matches
  for (const [targetName, keywords] of Object.entries(MERCHANT_PATTERNS)) {
    for (const kw of keywords) {
      if (query.includes(kw)) {
        // Find matching category in the user's available category list
        const match = availableCategories.find(
          (c) =>
            c.type === 'EXPENSE' &&
            c.name.toLowerCase().includes(targetName.toLowerCase())
        );
        if (match) return match;
      }
    }
  }

  // 3. Tier 3: Direct match against category name itself
  const directMatch = availableCategories.find(
    (c) =>
      c.type === 'EXPENSE' &&
      (c.name.toLowerCase().includes(query) || query.includes(c.name.toLowerCase()))
  );
  if (directMatch) return directMatch;

  return null;
}
