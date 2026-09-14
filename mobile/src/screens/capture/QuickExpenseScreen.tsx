import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput as RNTextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/common/Screen';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { TextInput } from '../../components/forms/TextInput';
import { Button } from '../../components/common/Button';
import { createExpenseUseCase } from '../../domain/usecases/expenseUseCases';
import { createIncomeUseCase } from '../../domain/usecases/incomeUseCases';
import { listCategoriesUseCase } from '../../domain/usecases/categoryUseCases';
import { suggestCategoryAsync } from '../../domain/rules/smartCategorySuggestion';
import { SQLiteCategoryMemoryRepository } from '../../database/repositories/SQLiteCategoryMemoryRepository';
import { CategoryModel, PaymentMethod } from '../../domain/models';
import { dollarsToCents } from '../../utils/money';
import { getTodayDateString, formatDisplayDate } from '../../utils/date';
import { useAuth } from '../../app/providers/AuthProvider';
import { useTheme } from '../../theme/useTheme';

const QUICK_PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Debit', value: 'DEBIT_CARD' },
  { label: 'Credit', value: 'CREDIT_CARD' },
];

export const QuickExpenseScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const amountInputRef = useRef<RNTextInput>(null);

  const memoryRepo = useMemo(() => new SQLiteCategoryMemoryRepository(), []);

  const [transactionType, setTransactionType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [suggestedCategory, setSuggestedCategory] = useState<CategoryModel | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [payee, setPayee] = useState('');
  const [note, setNote] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load available categories from local SQLite based on transactionType
  useEffect(() => {
    async function loadCategories() {
      try {
        const list = await listCategoriesUseCase(transactionType);
        setCategories(list);
        if (list.length > 0) {
          setSelectedCategoryId(list[0].id);
        }
      } catch {
        // Handled
      }
    }
    loadCategories();
  }, [transactionType]);

  // Quick-Add chip handler: +100, +500, +1,000, +5,000
  const handleQuickAdd = (addVal: number) => {
    const current = parseFloat(amount) || 0;
    const next = current + addVal;
    setAmount(next.toString());
    if (error) setError(null);
  };

  // Real-time deterministic category suggestion (learned memory -> default rules -> category name)
  useEffect(() => {
    let isMounted = true;

    async function checkSuggestion() {
      if (transactionType === 'EXPENSE' && categories.length > 0 && payee.trim().length >= 2) {
        const suggested = await suggestCategoryAsync({
          merchant: payee,
          categories,
          userId: user?.id,
          memoryRepo,
        });
        if (isMounted) {
          if (suggested && suggested.id !== selectedCategoryId) {
            setSuggestedCategory(suggested);
          } else {
            setSuggestedCategory(null);
          }
        }
      } else {
        if (isMounted) {
          setSuggestedCategory(null);
        }
      }
    }

    checkSuggestion();
    return () => {
      isMounted = false;
    };
  }, [payee, categories, selectedCategoryId, user?.id, memoryRepo, transactionType]);

  const handleApplySuggestion = () => {
    if (suggestedCategory) {
      setSelectedCategoryId(suggestedCategory.id);
      setSuggestedCategory(null);
    }
  };

  const validateAndExtractCents = (): number | null => {
    const cents = dollarsToCents(amount);
    if (cents <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return null;
    }
    if (!selectedCategoryId) {
      setError(`Please select ${transactionType === 'EXPENSE' ? 'an expense' : 'an income'} category.`);
      return null;
    }
    return cents;
  };

  // Standard save: writes to SQLite in <50ms and navigates back
  const handleSave = async () => {
    const cents = validateAndExtractCents();
    if (cents === null) return;

    setIsSaving(true);
    setError(null);

    try {
      if (transactionType === 'INCOME') {
        await createIncomeUseCase({
          categoryId: selectedCategoryId,
          amountCents: cents,
          currency: user?.baseCurrency || 'INR',
          transactionDate: getTodayDateString(),
          source: payee.trim() || 'Income',
          note: note.trim() || undefined,
        });
      } else {
        await createExpenseUseCase({
          categoryId: selectedCategoryId,
          amountCents: cents,
          currency: user?.baseCurrency || 'INR',
          transactionDate: getTodayDateString(),
          paymentMethod,
          payee: payee.trim() || undefined,
          note: note.trim() || undefined,
        });

        // Update learned category memory for fast future capture
        if (payee.trim() && user?.id) {
          await memoryRepo.recordChoice(user.id, payee.trim(), selectedCategoryId);
        }
      }

      setAmount('');
      setPayee('');
      setNote('');
      navigation.navigate('Home');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save transaction locally.');
    } finally {
      setIsSaving(false);
    }
  };

  const displayedCategories = useMemo(() => {
    if (showAllCategories || categories.length <= 8) {
      return categories;
    }
    const first8 = categories.slice(0, 8);
    if (selectedCategoryId && !first8.some((c) => c.id === selectedCategoryId)) {
      const selected = categories.find((c) => c.id === selectedCategoryId);
      if (selected) {
        return [...first8.slice(0, 7), selected];
      }
    }
    return first8;
  }, [categories, showAllCategories, selectedCategoryId]);

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.backArrow, { color: theme.colors.textPrimary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          {transactionType === 'EXPENSE' ? 'Add Expense' : 'Add Income'}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Segmented Pill Toggle: [ Expense ]  [ Income ] */}
      <View style={[styles.toggleContainer, { backgroundColor: theme.colors.surfaceSubtle }]}>
        <TouchableOpacity
          onPress={() => setTransactionType('EXPENSE')}
          activeOpacity={0.8}
          style={[
            styles.toggleBtn,
            transactionType === 'EXPENSE' && styles.toggleBtnExpenseActive,
          ]}
        >
          <Text
            style={[
              styles.toggleText,
              {
                color: transactionType === 'EXPENSE' ? '#E05D6A' : theme.colors.textSecondary,
                fontWeight: transactionType === 'EXPENSE' ? '700' : '500',
              },
            ]}
          >
            Expense
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setTransactionType('INCOME')}
          activeOpacity={0.8}
          style={[
            styles.toggleBtn,
            transactionType === 'INCOME' && styles.toggleBtnIncomeActive,
          ]}
        >
          <Text
            style={[
              styles.toggleText,
              {
                color: transactionType === 'INCOME' ? '#16A085' : theme.colors.textSecondary,
                fontWeight: transactionType === 'INCOME' ? '700' : '500',
              },
            ]}
          >
            Income
          </Text>
        </TouchableOpacity>
      </View>

      {/* Large Amount Display: ₹0 + Enter amount */}
      <TouchableOpacity
        style={[
          styles.amountContainer,
          error ? { borderColor: theme.colors.expense, borderWidth: 1 } : null,
        ]}
        activeOpacity={1}
        onPress={() => amountInputRef.current?.focus()}
      >
        <Text style={[styles.amountDisplay, { color: theme.colors.textPrimary }]}>
          ₹{amount || '0'}
        </Text>
        <Text style={[styles.amountSubtitle, { color: theme.colors.textSecondary }]}>
          Enter amount
        </Text>

        {/* Real hidden numeric keyboard input */}
        <RNTextInput
          ref={amountInputRef}
          value={amount}
          onChangeText={(val) => {
            const clean = val.replace(/[^0-9.]/g, '');
            setAmount(clean);
            if (error) setError(null);
          }}
          keyboardType="decimal-pad"
          style={styles.hiddenInput}
          autoFocus
        />
      </TouchableOpacity>

      {/* Quick-Add Pills: + 100, + 500, + 1,000, + 5,000 */}
      <View style={styles.quickAddRow}>
        {[100, 500, 1000, 5000].map((val) => (
          <TouchableOpacity
            key={val}
            onPress={() => handleQuickAdd(val)}
            style={[
              styles.quickAddPill,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.surfaceBorder,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.quickAddText, { color: theme.colors.textPrimary }]}>
              + {val >= 1000 ? val.toLocaleString() : val}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Smart Category Suggestion Banner if detected */}
      {suggestedCategory && (
        <TouchableOpacity
          onPress={handleApplySuggestion}
          activeOpacity={0.8}
          style={[styles.suggestionBox, { backgroundColor: `${theme.colors.primary}15` }]}
        >
          <Text style={[styles.suggestionText, { color: theme.colors.primary }]}>
            💡 Suggestion: {suggestedCategory.icon} {suggestedCategory.name}
          </Text>
          <Text style={[styles.suggestionApply, { color: theme.colors.primary }]}>Tap to Apply</Text>
        </TouchableOpacity>
      )}

      {/* Category Grid Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Category
          </Text>
          <TouchableOpacity
            onPress={() => setShowAllCategories((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={[styles.seeAllText, { color: theme.colors.textSecondary }]}>
              {showAllCategories ? 'Show less' : 'Select category >'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.categoryGrid}>
          {displayedCategories.map((cat, idx) => {
            const isSelected = cat.id === selectedCategoryId;
            const pastelBgs = [
              '#FEF3C7', // Food
              '#E0E7FF', // Transport
              '#FCE7F3', // Shopping
              '#D1FAE5', // Home
              '#E0F2FE', // Bills
              '#FEE2E2', // Health
              '#EDE9FE', // Education
              '#F3F4F6', // Others
            ];
            const tileBg = pastelBgs[idx % pastelBgs.length];

            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => {
                  setSelectedCategoryId(cat.id);
                  if (suggestedCategory?.id === cat.id) {
                    setSuggestedCategory(null);
                  }
                }}
                activeOpacity={0.7}
                style={styles.categoryGridItem}
                accessibilityRole="button"
                accessibilityLabel={cat.name}
                accessibilityState={{ selected: isSelected }}
              >
                <View
                  style={[
                    styles.categoryTile,
                    {
                      backgroundColor: tileBg,
                      borderColor: isSelected ? theme.colors.primary : 'transparent',
                      borderWidth: isSelected ? 2.5 : 0,
                    },
                  ]}
                >
                  <Text style={styles.categoryTileEmoji}>{cat.icon}</Text>
                </View>
                <Text
                  style={[
                    styles.categoryTileLabel,
                    {
                      color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Detail Selectors List (Date, Payment Method, Note) */}
      <View style={styles.detailsListCard}>
        {/* Date Row */}
        <View style={[styles.detailRow, { borderBottomColor: theme.colors.surfaceBorder }]}>
          <View style={styles.detailRowLeft}>
            <Text style={styles.detailRowIcon}>📅</Text>
            <Text style={[styles.detailRowLabel, { color: theme.colors.textPrimary }]}>Date</Text>
          </View>
          <Text style={[styles.detailRowValue, { color: theme.colors.textSecondary }]}>
            {formatDisplayDate(getTodayDateString())} &gt;
          </Text>
        </View>

        {/* Payment Method Selector */}
        {transactionType === 'EXPENSE' && (
          <View style={[styles.detailRow, { borderBottomColor: theme.colors.surfaceBorder }]}>
            <View style={styles.detailRowLeft}>
              <Text style={styles.detailRowIcon}>💳</Text>
              <Text style={[styles.detailRowLabel, { color: theme.colors.textPrimary }]}>
                Payment Method
              </Text>
            </View>
            <View style={styles.methodChipsRow}>
              {QUICK_PAYMENT_METHODS.map((method) => {
                const isSelected = method.value === paymentMethod;
                return (
                  <TouchableOpacity
                    key={method.value}
                    onPress={() => setPaymentMethod(method.value)}
                    activeOpacity={0.7}
                    style={[
                      styles.methodChip,
                      {
                        backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodChipText,
                        {
                          color: isSelected ? '#FFFFFF' : theme.colors.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Note / Payee Row */}
        <View style={styles.detailRow}>
          <View style={styles.detailRowLeft}>
            <Text style={styles.detailRowIcon}>📝</Text>
            <Text style={[styles.detailRowLabel, { color: theme.colors.textPrimary }]}>
              {transactionType === 'EXPENSE' ? 'Add Note' : 'Source'}
            </Text>
          </View>
          <RNTextInput
            value={payee}
            onChangeText={setPayee}
            placeholder={transactionType === 'EXPENSE' ? 'Add a note (optional)' : 'e.g. Salary, Client'}
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.noteInput, { color: theme.colors.textPrimary }]}
          />
        </View>
      </View>

      {/* Save Action Button matching uiii.png */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
          style={[
            styles.savePillButton,
            {
              backgroundColor: theme.colors.primary,
              shadowColor: theme.colors.primary,
            },
          ]}
        >
          <Text style={styles.savePillButtonText}>
            {isSaving
              ? 'Saving...'
              : `Save ${transactionType === 'EXPENSE' ? 'Expense' : 'Income'}`}
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 4,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -6,
  },
  backArrow: {
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerRightPlaceholder: {
    width: 36,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    height: 38,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleBtnExpenseActive: {
    backgroundColor: '#FDE8E9',
  },
  toggleBtnIncomeActive: {
    backgroundColor: '#E8F8F5',
  },
  toggleText: {
    fontSize: 14,
  },
  amountContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 16,
    borderRadius: 18,
    position: 'relative',
  },
  amountDisplay: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  amountSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
  },
  quickAddRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 22,
  },
  quickAddPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddText: {
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 16,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionApply: {
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '500',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryGridItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  categoryTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryTileEmoji: {
    fontSize: 22,
  },
  categoryTileLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  detailsListCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailRowIcon: {
    fontSize: 16,
  },
  detailRowLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailRowValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  methodChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  methodChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  methodChipText: {
    fontSize: 11,
  },
  noteInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    paddingVertical: 2,
  },
  actionsContainer: {
    marginBottom: 36,
  },
  savePillButton: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  savePillButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
