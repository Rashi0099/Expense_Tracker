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
import { listCategoriesUseCase } from '../../domain/usecases/categoryUseCases';
import { suggestCategoryAsync } from '../../domain/rules/smartCategorySuggestion';
import { SQLiteCategoryMemoryRepository } from '../../database/repositories/SQLiteCategoryMemoryRepository';
import { CategoryModel, PaymentMethod } from '../../domain/models';
import { dollarsToCents } from '../../utils/money';
import { getTodayDateString } from '../../utils/date';
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

  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [suggestedCategory, setSuggestedCategory] = useState<CategoryModel | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CREDIT_CARD');
  const [payee, setPayee] = useState('');
  const [note, setNote] = useState('');
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load available categories from local SQLite
  useEffect(() => {
    async function loadCategories() {
      try {
        const list = await listCategoriesUseCase('EXPENSE');
        setCategories(list);
        if (list.length > 0) {
          setSelectedCategoryId(list[0].id);
        }
      } catch {
        // Handled
      }
    }
    loadCategories();
  }, []);

  // Real-time deterministic category suggestion (learned memory -> default rules -> category name)
  useEffect(() => {
    let isMounted = true;

    async function checkSuggestion() {
      if (categories.length > 0 && payee.trim().length >= 2) {
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
  }, [payee, categories, selectedCategoryId, user?.id, memoryRepo]);

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
      setError('Please select an expense category.');
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
      // Local-first write: commits immediately to SQLite and queues in sync_outbox atomically
      await createExpenseUseCase({
        categoryId: selectedCategoryId,
        amountCents: cents,
        currency: user?.baseCurrency || 'USD',
        transactionDate: getTodayDateString(),
        paymentMethod,
        payee: payee.trim() || undefined,
        note: note.trim() || undefined,
      });

      // Update learned category memory for fast future capture
      if (payee.trim() && user?.id) {
        await memoryRepo.recordChoice(user.id, payee.trim(), selectedCategoryId);
      }

      setAmount('');
      setPayee('');
      setNote('');
      navigation.navigate('Home');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save expense locally.');
    } finally {
      setIsSaving(false);
    }
  };

  // Consecutive entry UX: saves instantly, flashes success, clears form, keeps numeric keypad open
  const handleSaveAndAddAnother = async () => {
    const cents = validateAndExtractCents();
    if (cents === null) return;

    setIsSaving(true);
    setError(null);

    try {
      await createExpenseUseCase({
        categoryId: selectedCategoryId,
        amountCents: cents,
        currency: user?.baseCurrency || 'USD',
        transactionDate: getTodayDateString(),
        paymentMethod,
        payee: payee.trim() || undefined,
        note: note.trim() || undefined,
      });

      if (payee.trim() && user?.id) {
        await memoryRepo.recordChoice(user.id, payee.trim(), selectedCategoryId);
      }

      const formatted = (cents / 100).toFixed(2);
      setSuccessMessage(`✓ Expense of $${formatted} saved! Ready for next.`);

      // Reset fields for rapid consecutive entry
      setAmount('');
      setPayee('');
      setNote('');
      setSuggestedCategory(null);

      // Keep focus on the amount input with numeric keyboard open
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);

      // Dismiss success feedback banner after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save expense locally.');
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
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Add Expense
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            Log your expense
          </Text>
        </View>
      </View>

      {/* Primary Focus: Large Numeric Money Input */}
      <MoneyInput
        ref={amountInputRef}
        label="Amount"
        value={amount}
        onChangeValue={(val) => {
          setAmount(val);
          if (error) setError(null);
        }}
        currency={user?.baseCurrency || 'INR'}
        containerStyle={{
          backgroundColor: `${theme.colors.primary}0D`,
          borderColor: `${theme.colors.primary}20`,
        }}
        autoFocus
        error={error || undefined}
      />

      {/* Instant Inline Feedback for Consecutive Saves */}
      {successMessage && (
        <View
          style={[
            styles.successBanner,
            { backgroundColor: `${theme.colors.income}20`, borderColor: theme.colors.income },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <Text style={[styles.successText, { color: theme.colors.income }]}>
            {successMessage}
          </Text>
        </View>
      )}

      {/* Smart Category Suggestion Banner */}
      {suggestedCategory && (
        <TouchableOpacity
          onPress={handleApplySuggestion}
          activeOpacity={0.8}
          style={[styles.suggestionBox, { backgroundColor: `${theme.colors.primary}15` }]}
          accessibilityRole="button"
          accessibilityLabel={`Apply suggested category ${suggestedCategory.name}`}
        >
          <Text style={[styles.suggestionText, { color: theme.colors.primary }]}>
            💡 Suggestion: {suggestedCategory.icon} {suggestedCategory.name}
          </Text>
          <Text style={[styles.suggestionApply, { color: theme.colors.primary }]}>Tap to Apply</Text>
        </TouchableOpacity>
      )}

      {/* Category Grid Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Category
          </Text>
          {categories.length > 8 && (
            <TouchableOpacity
              onPress={() => setShowAllCategories((prev) => !prev)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.seeAllText, { color: theme.colors.textMuted }]}>
                {showAllCategories ? 'Show less' : 'See all'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.categoryGrid}>
          {displayedCategories.map((cat) => {
            const isSelected = cat.id === selectedCategoryId;
            const catColor = cat.color || theme.colors.primary;
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
                    styles.categoryCircle,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primary
                        : `${catColor}15`,
                      borderColor: isSelected
                        ? theme.colors.primary
                        : `${catColor}30`,
                    },
                  ]}
                >
                  <Text style={styles.categoryCircleIcon}>{cat.icon}</Text>
                </View>
                <Text
                  style={[
                    styles.categoryGridLabel,
                    {
                      color: isSelected
                        ? theme.colors.primary
                        : theme.colors.textPrimary,
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

      {/* Payment Method Selector - 4 Compact Buttons (No Horizontal Scroll) */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
          Payment Method
        </Text>
        <View style={styles.paymentMethodRow}>
          {QUICK_PAYMENT_METHODS.map((method) => {
            const isSelected = method.value === paymentMethod;
            return (
              <TouchableOpacity
                key={method.value}
                onPress={() => setPaymentMethod(method.value)}
                activeOpacity={0.7}
                style={[
                  styles.paymentMethodBtn,
                  {
                    backgroundColor: isSelected
                      ? `${theme.colors.primary}12`
                      : theme.colors.surface,
                    borderColor: isSelected
                      ? theme.colors.primary
                      : theme.colors.surfaceBorder,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select payment method ${method.label}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.paymentMethodText,
                    {
                      color: isSelected
                        ? theme.colors.primary
                        : theme.colors.textPrimary,
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

      {/* Collapsible More Details (Optional) */}
      <View style={styles.moreDetailsContainer}>
        <TouchableOpacity
          onPress={() => setShowMoreDetails((prev) => !prev)}
          activeOpacity={0.7}
          style={[
            styles.moreDetailsButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.surfaceBorder,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Toggle more details"
          accessibilityState={{ expanded: showMoreDetails }}
        >
          <View style={styles.moreDetailsLeft}>
            <Text style={styles.moreDetailsIcon}>📝</Text>
            <Text style={[styles.moreDetailsLabel, { color: theme.colors.textPrimary }]}>
              More details{' '}
              <Text style={[styles.moreDetailsOptional, { color: theme.colors.textMuted }]}>
                (Optional)
              </Text>
            </Text>
          </View>
          <Text style={[styles.moreDetailsChevron, { color: theme.colors.textMuted }]}>
            {showMoreDetails ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {showMoreDetails && (
          <View style={styles.detailsInputsWrapper}>
            <TextInput
              label="Payee / Merchant"
              value={payee}
              onChangeText={setPayee}
              placeholder="e.g. Starbucks, Uber, Grocery Store"
            />
            <TextInput
              label="Note (Optional)"
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Lunch with team"
            />
          </View>
        )}
      </View>

      {/* Save Action Button */}
      <View style={styles.actionsContainer}>
        <Button
          label="Save Expense"
          variant="primary"
          onPress={handleSave}
          isLoading={isSaving}
          size="lg"
          style={styles.saveButton}
          accessibilityLabel="Save expense and return to dashboard"
        />
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
    marginBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginLeft: -6,
  },
  backArrow: {
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 28,
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  successBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 4,
  },
  successText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 12,
    marginTop: 8,
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
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginHorizontal: -4,
  },
  categoryGridItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  categoryCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryCircleIcon: {
    fontSize: 22,
  },
  categoryGridLabel: {
    fontSize: 11,
    textAlign: 'center',
    maxWidth: '100%',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  paymentMethodBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentMethodText: {
    fontSize: 13,
  },
  moreDetailsContainer: {
    marginTop: 18,
  },
  moreDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
  },
  moreDetailsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moreDetailsIcon: {
    fontSize: 16,
  },
  moreDetailsLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  moreDetailsOptional: {
    fontSize: 12,
    fontWeight: '400',
  },
  moreDetailsChevron: {
    fontSize: 11,
  },
  detailsInputsWrapper: {
    marginTop: 12,
    gap: 4,
  },
  actionsContainer: {
    marginTop: 24,
    marginBottom: 36,
    gap: 10,
    alignItems: 'center',
  },
  saveButton: {
    width: '100%',
    minHeight: 52,
  },
  consecutiveLink: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  consecutiveLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
