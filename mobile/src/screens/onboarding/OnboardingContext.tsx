import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DatabaseManager } from '../../database/sqlite/DatabaseManager';
import { getUTCTimestamp } from '../../utils/date';
import { EXPENSE_CATEGORY_POOL, INCOME_CATEGORY_POOL, getExpenseSuggestions, getIncomeSuggestions } from './data/onboardingData';

import { DataEvents } from '../../database/sqlite/DataEvents';

const ONBOARDING_KEY_PREFIX = '@onboarding/completed_';

interface OnboardingContextType {
  profile: string;
  selectedExpenseIds: string[];
  selectedIncomeIds: string[];
  setProfile: (id: string) => void;
  toggleExpenseCategory: (id: string) => void;
  toggleIncomeCategory: (id: string) => void;
  completeOnboarding: (userId: string, onDone: () => void) => Promise<void>;
  skipOnboarding: (userId: string, onDone: () => void) => Promise<void>;
  isSaving: boolean;
}

const OnboardingContext = createContext<OnboardingContextType>({
  profile: '',
  selectedExpenseIds: [],
  selectedIncomeIds: [],
  setProfile: () => {},
  toggleExpenseCategory: () => {},
  toggleIncomeCategory: () => {},
  completeOnboarding: async () => {},
  skipOnboarding: async () => {},
  isSaving: false,
});

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [profile, setProfileState] = useState('');
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [selectedIncomeIds, setSelectedIncomeIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const setProfile = useCallback((id: string) => {
    setProfileState(id);
    // Auto-populate suggestions when profile is chosen
    setSelectedExpenseIds(getExpenseSuggestions(id));
    setSelectedIncomeIds(getIncomeSuggestions(id));
  }, []);

  const toggleExpenseCategory = useCallback((id: string) => {
    setSelectedExpenseIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const toggleIncomeCategory = useCallback((id: string) => {
    setSelectedIncomeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const seedExtraSystemCategories = useCallback(async () => {
    const db = DatabaseManager.getInstance().getDatabase();
    const now = getUTCTimestamp();
    // All new expense categories (IDs >= 010)
    const allExtras = [
      ...EXPENSE_CATEGORY_POOL.filter(c => {
        const num = parseInt(c.id.slice(-3), 10);
        return num >= 10;
      }),
      ...INCOME_CATEGORY_POOL.filter(c => {
        const num = parseInt(c.id.slice(-3), 10);
        return num >= 10;
      }),
    ];

    for (const cat of allExtras) {
      await db.executeSql(
        `INSERT OR IGNORE INTO categories (
          id, user_id, name, type, icon, color, is_system, is_archived, created_at, updated_at, version
        ) VALUES (?, NULL, ?, ?, ?, ?, 1, 0, ?, ?, 1)`,
        [cat.id, cat.name, cat.type, cat.icon, cat.color, now, now]
      );
    }
  }, []);

  const completeOnboarding = useCallback(async (userId: string, onDone: () => void) => {
    setIsSaving(true);
    try {
      await seedExtraSystemCategories();
      const db = DatabaseManager.getInstance().getDatabase();
      const allCategories = [...EXPENSE_CATEGORY_POOL, ...INCOME_CATEGORY_POOL];

      for (const cat of allCategories) {
        const isSelected =
          (cat.type === 'EXPENSE' && selectedExpenseIds.includes(cat.id)) ||
          (cat.type === 'INCOME' && selectedIncomeIds.includes(cat.id));
        await db.executeSql(
          'UPDATE categories SET is_archived = ? WHERE id = ?',
          [isSelected ? 0 : 1, cat.id]
        );
      }
      DataEvents.notify('CATEGORIES_CHANGED');

      await AsyncStorage.setItem(`${ONBOARDING_KEY_PREFIX}${userId}`, JSON.stringify({
        profile,
        completedAt: new Date().toISOString(),
      }));
      onDone();
    } catch (e) {
      // Fail gracefully — mark complete anyway
      await AsyncStorage.setItem(`${ONBOARDING_KEY_PREFIX}${userId}`, '1');
      onDone();
    } finally {
      setIsSaving(false);
    }
  }, [profile, selectedExpenseIds, selectedIncomeIds, seedExtraSystemCategories]);

  const skipOnboarding = useCallback(async (userId: string, onDone: () => void) => {
    try {
      await seedExtraSystemCategories();
      DataEvents.notify('CATEGORIES_CHANGED');
      await AsyncStorage.setItem(`${ONBOARDING_KEY_PREFIX}${userId}`, '1');
      onDone();
    } catch {
      await AsyncStorage.setItem(`${ONBOARDING_KEY_PREFIX}${userId}`, '1');
      onDone();
    }
  }, [seedExtraSystemCategories]);

  return (
    <OnboardingContext.Provider
      value={{
        profile,
        selectedExpenseIds,
        selectedIncomeIds,
        setProfile,
        toggleExpenseCategory,
        toggleIncomeCategory,
        completeOnboarding,
        skipOnboarding,
        isSaving,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => useContext(OnboardingContext);

export { ONBOARDING_KEY_PREFIX };
