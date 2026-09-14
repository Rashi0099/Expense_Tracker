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
import { PAYMENT_METHODS } from '../../app/config/constants';

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

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Quick Expense
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Fast 2–5s entry • Saved locally to SQLite
        </Text>
      </View>

      {/* Primary Focus: Large Numeric Money Input */}
      <MoneyInput
        ref={amountInputRef}
        value={amount}
        onChangeValue={(val) => {
          setAmount(val);
          if (error) setError(null);
        }}
        currency={user?.baseCurrency || 'USD'}
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
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
          Category
        </Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => {
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
                        : `${catColor}18`,
                      borderColor: isSelected
                        ? theme.colors.primary
                        : `${catColor}35`,
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

      {/* Payment Method Selector Chips */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
          Payment Method
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          {PAYMENT_METHODS.map((method) => {
            const isSelected = method.value === paymentMethod;
            return (
              <TouchableOpacity
                key={method.value}
                onPress={() => setPaymentMethod(method.value as PaymentMethod)}
                activeOpacity={0.7}
                style={[
                  styles.methodChip,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primaryLight
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
                    styles.methodLabel,
                    {
                      color: isSelected
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                    },
                  ]}
                >
                  {method.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Payee & Note */}
      <View style={styles.detailsSection}>
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

      {/* Save Action Buttons: Consecutive Entry + Standard Save */}
      <View style={styles.actionsContainer}>
        <Button
          label="Save & Add Another"
          variant="outline"
          onPress={handleSaveAndAddAnother}
          isLoading={isSaving}
          size="lg"
          style={styles.consecutiveButton}
          accessibilityLabel="Save expense and add another immediately"
        />
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
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
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
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipsContainer: {
    paddingRight: 16,
    gap: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginHorizontal: -4,
  },
  categoryGridItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 14,
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
  methodChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  methodLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsSection: {
    marginTop: 16,
  },
  actionsContainer: {
    marginTop: 24,
    marginBottom: 36,
    gap: 12,
  },
  consecutiveButton: {
    minHeight: 52,
  },
  saveButton: {
    minHeight: 52,
  },
});
