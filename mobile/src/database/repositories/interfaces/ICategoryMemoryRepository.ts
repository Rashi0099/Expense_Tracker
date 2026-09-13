export interface CategoryMemoryEntry {
  userId: string;
  keywordNormalized: string;
  categoryId: string;
  frequency: number;
  lastUsedAt: string;
}

export interface ICategoryMemoryRepository {
  recordChoice(userId: string, merchant: string, categoryId: string): Promise<void>;
  getPreferredCategory(userId: string, merchant: string): Promise<string | null>;
  getAllForUser(userId: string): Promise<CategoryMemoryEntry[]>;
  clearForUser(userId: string): Promise<void>;
}
