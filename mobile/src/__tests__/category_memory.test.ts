import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { SQLiteCategoryMemoryRepository } from '../database/repositories/SQLiteCategoryMemoryRepository';
import { suggestCategoryAsync, suggestCategoryFromMerchant } from '../domain/rules/smartCategorySuggestion';
import { CategoryModel } from '../domain/models';

describe('Category Memory & Smart Suggestion Tests (Step 8)', () => {
  let memoryDb: MemorySQLiteAdapter;
  let memoryRepo: SQLiteCategoryMemoryRepository;
  const userId = 'test_user_capture_123';

  const testCategories: CategoryModel[] = [
    {
      id: 'cat_food',
      userId: null,
      name: 'Food & Dining',
      type: 'EXPENSE',
      icon: '🍔',
      color: '#F97316',
      isSystem: true,
      isArchived: false,
      createdAt: '2026-09-13T00:00:00Z',
      updatedAt: '2026-09-13T00:00:00Z',
      version: 1,
    },
    {
      id: 'cat_groceries',
      userId: null,
      name: 'Groceries',
      type: 'EXPENSE',
      icon: '🛒',
      color: '#10B981',
      isSystem: true,
      isArchived: false,
      createdAt: '2026-09-13T00:00:00Z',
      updatedAt: '2026-09-13T00:00:00Z',
      version: 1,
    },
    {
      id: 'cat_transport',
      userId: null,
      name: 'Transport & Fuel',
      type: 'EXPENSE',
      icon: '🚗',
      color: '#3B82F6',
      isSystem: true,
      isArchived: false,
      createdAt: '2026-09-13T00:00:00Z',
      updatedAt: '2026-09-13T00:00:00Z',
      version: 1,
    },
    {
      id: 'cat_shopping',
      userId: null,
      name: 'Shopping',
      type: 'EXPENSE',
      icon: '🛍️',
      color: '#EC4899',
      isSystem: true,
      isArchived: false,
      createdAt: '2026-09-13T00:00:00Z',
      updatedAt: '2026-09-13T00:00:00Z',
      version: 1,
    },
    {
      id: 'cat_custom',
      userId,
      name: 'Coffee Addiction',
      type: 'EXPENSE',
      icon: '☕',
      color: '#78350F',
      isSystem: false,
      isArchived: false,
      createdAt: '2026-09-13T00:00:00Z',
      updatedAt: '2026-09-13T00:00:00Z',
      version: 1,
    },
  ];

  beforeEach(async () => {
    await DatabaseManager.getInstance().close();
    memoryDb = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(memoryDb);
    DatabaseManager.getInstance().setCurrentUser(userId);
    memoryRepo = new SQLiteCategoryMemoryRepository();
  });

  it('records choice and updates frequency on consecutive choices', async () => {
    await memoryRepo.recordChoice(userId, 'Blue Bottle Coffee', 'cat_custom');

    const preferred = await memoryRepo.getPreferredCategory(userId, 'Blue Bottle Coffee');
    expect(preferred).toBe('cat_custom');

    // Record again for same merchant
    await memoryRepo.recordChoice(userId, 'Blue Bottle Coffee', 'cat_custom');

    const all = await memoryRepo.getAllForUser(userId);
    expect(all).toHaveLength(1);
    expect(all[0].keywordNormalized).toBe('blue bottle coffee');
    expect(all[0].categoryId).toBe('cat_custom');
    expect(all[0].frequency).toBe(2);
  });

  it('matches partial merchant names based on stored memory', async () => {
    await memoryRepo.recordChoice(userId, 'Starbucks', 'cat_custom');

    // Querying with longer text containing "Starbucks"
    const matchedLonger = await memoryRepo.getPreferredCategory(userId, 'Starbucks Reserve Roastery');
    expect(matchedLonger).toBe('cat_custom');

    // Querying with case variations
    const matchedLower = await memoryRepo.getPreferredCategory(userId, 'starbucks');
    expect(matchedLower).toBe('cat_custom');
  });

  it('suggestCategoryAsync prioritizes user memory (Tier 1) over default keyword rules (Tier 2)', async () => {
    // By default rules, "Starbucks" would map to 'cat_food' ("Food & Dining")
    const defaultSuggestion = suggestCategoryFromMerchant('Starbucks', testCategories);
    expect(defaultSuggestion?.id).toBe('cat_food');

    // User explicitly categorized Starbucks into their custom 'cat_custom' ("Coffee Addiction")
    await memoryRepo.recordChoice(userId, 'Starbucks', 'cat_custom');

    // Now 3-tier suggestCategoryAsync should return 'cat_custom'
    const tier1Suggestion = await suggestCategoryAsync({
      merchant: 'Starbucks',
      categories: testCategories,
      userId,
      memoryRepo,
    });
    expect(tier1Suggestion?.id).toBe('cat_custom');
    expect(tier1Suggestion?.name).toBe('Coffee Addiction');
  });

  it('suggestCategoryAsync falls back to default rules (Tier 2) when user has no memory', async () => {
    const suggestion = await suggestCategoryAsync({
      merchant: 'Uber Trip',
      categories: testCategories,
      userId,
      memoryRepo,
    });
    expect(suggestion?.id).toBe('cat_transport');
    expect(suggestion?.name).toBe('Transport & Fuel');
  });

  it('suggestCategoryAsync falls back to direct category name matching (Tier 3)', async () => {
    const suggestion = await suggestCategoryAsync({
      merchant: 'Monthly Groceries Visit',
      categories: testCategories,
      userId,
      memoryRepo,
    });
    expect(suggestion?.id).toBe('cat_groceries');
    expect(suggestion?.name).toBe('Groceries');
  });

  it('clears memory for a specific user without affecting others', async () => {
    const otherUser = 'user_other_999';
    await memoryRepo.recordChoice(userId, 'Whole Foods', 'cat_groceries');
    await memoryRepo.recordChoice(otherUser, 'Whole Foods', 'cat_food');

    await memoryRepo.clearForUser(userId);

    const userChoices = await memoryRepo.getAllForUser(userId);
    expect(userChoices).toHaveLength(0);

    const otherChoices = await memoryRepo.getAllForUser(otherUser);
    expect(otherChoices).toHaveLength(1);
    expect(otherChoices[0].categoryId).toBe('cat_food');
  });
});
