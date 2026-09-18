import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput as RNTextInput,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen } from '../../components/common/Screen';
import { Button } from '../../components/common/Button';
import { createExpenseUseCase } from '../../domain/usecases/expenseUseCases';
import { createIncomeUseCase } from '../../domain/usecases/incomeUseCases';
import { listCategoriesUseCase } from '../../domain/usecases/categoryUseCases';
import { transferBetweenWalletsUseCase } from '../../domain/usecases/walletUseCases';
import { suggestCategoryAsync } from '../../domain/rules/smartCategorySuggestion';
import { SQLiteCategoryMemoryRepository } from '../../database/repositories/SQLiteCategoryMemoryRepository';
import { CategoryModel, PaymentMethod } from '../../domain/models';
import { dollarsToCents, getCurrencySymbol } from '../../utils/money';
import { getTodayDateString, formatDisplayDate } from '../../utils/date';
import { useAuth } from '../../app/providers/AuthProvider';
import { useTheme } from '../../theme/useTheme';
import { useWallet } from '../../app/providers/WalletProvider';
import { useBalanceVisibility } from '../../app/providers/BalanceVisibilityProvider';
import { CurrencyText } from '../../components/common/CurrencyText';
import { IconWallet } from '../../components/common/NavIcons';
import { BottomSheet } from '../../components/common/BottomSheet';

const QUICK_PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Debit', value: 'DEBIT_CARD' },
  { label: 'Credit', value: 'CREDIT_CARD' },
];

export const QuickExpenseScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { activeWallet, activeWalletId, wallets } = useWallet();
  const { isBalanceHidden } = useBalanceVisibility();
  const amountInputRef = useRef<RNTextInput>(null);

  const memoryRepo = useMemo(() => new SQLiteCategoryMemoryRepository(), []);

  const initialTab =
    route.params?.tab === 'TRANSFER'
      ? 'TRANSFER'
      : route.params?.tab === 'INCOME'
      ? 'INCOME'
      : 'EXPENSE';
  const [transactionType, setTransactionType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>(initialTab);
  const [selectedWalletId, setSelectedWalletId] = useState<string>(activeWalletId || '');
  const [toWalletId, setToWalletId] = useState<string>('');
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [showToWalletPicker, setShowToWalletPicker] = useState(false);
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
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerTempDate, setPickerTempDate] = useState<Date>(new Date());

  // Keep selected tab in sync if route parameter changes
  useEffect(() => {
    if (route.params?.tab) {
      setTransactionType(route.params.tab);
    }
  }, [route.params?.tab]);

  // Initialize destination wallet to first different wallet
  useEffect(() => {
    if (wallets.length > 1 && !toWalletId) {
      const sourceId = selectedWalletId || activeWalletId || wallets[0].id;
      const other = wallets.find((w) => w.id !== sourceId);
      if (other) {
        setToWalletId(other.id);
      }
    }
  }, [wallets, selectedWalletId, activeWalletId, toWalletId]);

  // Load available categories from local SQLite based on transactionType
  useEffect(() => {
    async function loadCategories() {
      if (transactionType === 'TRANSFER') {
        setCategories([]);
        setSelectedCategoryId('');
        return;
      }
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
    const formatted = Number.isInteger(next) ? next.toString() : next.toFixed(2);
    setAmount(formatted);
    if (error) setError(null);
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 50);
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
    if (transactionType !== 'TRANSFER' && !selectedCategoryId) {
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
      if (transactionType === 'TRANSFER') {
        const fromId = selectedWalletId || activeWalletId || (wallets.length > 0 ? wallets[0].id : '');
        if (!fromId || !toWalletId) {
          setError('Please select both source and destination wallets.');
          setIsSaving(false);
          return;
        }
        if (fromId === toWalletId) {
          setError('Source and destination wallets must be different.');
          setIsSaving(false);
          return;
        }
        await transferBetweenWalletsUseCase({
          fromWalletId: fromId,
          toWalletId,
          amountCents: cents,
          transactionDate: selectedDate,
          note: (note || payee).trim() || undefined,
        });
      } else {
        const targetWalletId = selectedWalletId || activeWalletId || undefined;
        if (transactionType === 'INCOME') {
          await createIncomeUseCase({
            categoryId: selectedCategoryId,
            walletId: targetWalletId,
            amountCents: cents,
            currency: user?.baseCurrency || 'INR',
            transactionDate: selectedDate,
            source: payee.trim() || 'Income',
            note: note.trim() || undefined,
          });
        } else {
          await createExpenseUseCase({
            categoryId: selectedCategoryId,
            walletId: targetWalletId,
            amountCents: cents,
            currency: user?.baseCurrency || 'INR',
            transactionDate: selectedDate,
            paymentMethod,
            payee: payee.trim() || undefined,
            note: note.trim() || undefined,
          });

          // Update learned category memory for fast future capture
          if (payee.trim() && user?.id) {
            await memoryRepo.recordChoice(user.id, payee.trim(), selectedCategoryId);
          }
        }
      }

      setAmount('');
      setPayee('');
      setNote('');
      navigation.navigate('Home');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not complete transaction.');
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
          {transactionType === 'TRANSFER'
            ? 'Transfer Funds'
            : transactionType === 'EXPENSE'
            ? 'Add Expense'
            : 'Add Income'}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Segmented Pill Toggle: [ Expense ]  [ Income ]  [ Transfer ] */}
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

        <TouchableOpacity
          onPress={() => setTransactionType('TRANSFER')}
          activeOpacity={0.8}
          style={[
            styles.toggleBtn,
            transactionType === 'TRANSFER' && (isDark ? styles.toggleBtnTransferActiveDark : styles.toggleBtnTransferActive),
          ]}
        >
          <Text
            style={[
              styles.toggleText,
              {
                color: transactionType === 'TRANSFER' ? '#6366F1' : theme.colors.textSecondary,
                fontWeight: transactionType === 'TRANSFER' ? '700' : '500',
              },
            ]}
          >
            Transfer
          </Text>
        </TouchableOpacity>
      </View>

      {/* Standard Wallet Switcher Pill for Expense/Income */}
      {transactionType !== 'TRANSFER' && wallets.length > 0 && (
        <View style={styles.walletPillRow}>
          <TouchableOpacity
            style={[
              styles.walletPill,
              {
                backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
            onPress={() => setShowWalletPicker(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Wallet: ${wallets.find((w) => w.id === selectedWalletId)?.name || activeWallet?.name || 'Wallet 1'}. Tap to switch.`}
          >
            <IconWallet color={theme.colors.primary} size={14} />
            <Text style={[styles.walletPillText, { color: theme.colors.textPrimary }]}>
              {wallets.find((w) => w.id === selectedWalletId)?.name || activeWallet?.name || 'Wallet 1'}
            </Text>
            <Text style={[styles.walletPillChevron, { color: theme.colors.textMuted }]}>▾</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Inter-Wallet Transfer Cards: From -> To */}
      {transactionType === 'TRANSFER' && (
        <View style={styles.transferSection}>
          {wallets.length < 2 ? (
            <View
              style={[
                styles.transferWarningBox,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FEF3C7',
                  borderColor: isDark ? '#334155' : '#FDE68A',
                },
              ]}
            >
              <Text style={[styles.transferWarningText, { color: isDark ? '#F8FAFC' : '#92400E' }]}>
                ⚠️ You need at least 2 wallets to transfer funds.
              </Text>
              <TouchableOpacity
                style={[styles.createWalletCta, { backgroundColor: theme.colors.primary }]}
                onPress={() => navigation.navigate('Wallets')}
                activeOpacity={0.7}
              >
                <Text style={styles.createWalletCtaText}>+ Create New Wallet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.transferCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.surfaceBorder,
                },
              ]}
            >
              {/* From Wallet Row */}
              <TouchableOpacity
                style={styles.transferWalletRow}
                onPress={() => setShowWalletPicker(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.transferWalletIconBox, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
                  <Text style={styles.transferWalletEmoji}>👛</Text>
                </View>
                <View style={styles.transferWalletInfo}>
                  <Text style={[styles.transferWalletLabel, { color: theme.colors.textMuted }]}>
                    From (Source)
                  </Text>
                  <Text style={[styles.transferWalletName, { color: theme.colors.textPrimary }]}>
                    {wallets.find((w) => w.id === (selectedWalletId || activeWalletId))?.name || 'Select Wallet'}
                  </Text>
                </View>
                <View style={styles.transferWalletRight}>
                  <Text style={[styles.transferWalletBalance, { color: theme.colors.textSecondary }]}>
                    {isBalanceHidden ? (
                      '••••'
                    ) : (
                      <CurrencyText
                        amountCents={
                          wallets.find((w) => w.id === (selectedWalletId || activeWalletId))?.balanceCents || 0
                        }
                        currency={user?.baseCurrency || 'INR'}
                      />
                    )}
                  </Text>
                  <Text style={[styles.transferChevron, { color: theme.colors.textMuted }]}>▾</Text>
                </View>
              </TouchableOpacity>

              {/* Swap Button Divider */}
              <View style={[styles.transferDivider, { backgroundColor: theme.colors.surfaceBorder }]}>
                <TouchableOpacity
                  style={[
                    styles.transferSwapBtn,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.surfaceBorder,
                    },
                  ]}
                  onPress={() => {
                    const currentFrom = selectedWalletId || activeWalletId || (wallets[0]?.id || '');
                    const currentTo = toWalletId || (wallets.find((w) => w.id !== currentFrom)?.id || '');
                    setSelectedWalletId(currentTo);
                    setToWalletId(currentFrom);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Swap from and to wallets"
                >
                  <Text style={[styles.transferSwapIcon, { color: '#6366F1' }]}>⇅</Text>
                </TouchableOpacity>
              </View>

              {/* To Wallet Row */}
              <TouchableOpacity
                style={styles.transferWalletRow}
                onPress={() => setShowToWalletPicker(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.transferWalletIconBox, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
                  <Text style={styles.transferWalletEmoji}>📥</Text>
                </View>
                <View style={styles.transferWalletInfo}>
                  <Text style={[styles.transferWalletLabel, { color: theme.colors.textMuted }]}>
                    To (Destination)
                  </Text>
                  <Text style={[styles.transferWalletName, { color: theme.colors.textPrimary }]}>
                    {wallets.find((w) => w.id === toWalletId)?.name || 'Select Destination'}
                  </Text>
                </View>
                <View style={styles.transferWalletRight}>
                  <Text style={[styles.transferWalletBalance, { color: theme.colors.textSecondary }]}>
                    {isBalanceHidden ? (
                      '••••'
                    ) : (
                      <CurrencyText
                        amountCents={wallets.find((w) => w.id === toWalletId)?.balanceCents || 0}
                        currency={user?.baseCurrency || 'INR'}
                      />
                    )}
                  </Text>
                  <Text style={[styles.transferChevron, { color: theme.colors.textMuted }]}>▾</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Large Amount Display: Visible and directly editable input */}
      <TouchableOpacity
        style={[
          styles.amountContainer,
          error ? { borderColor: theme.colors.expense, borderWidth: 1 } : null,
        ]}
        activeOpacity={1}
        onPress={() => amountInputRef.current?.focus()}
      >
        <View style={styles.amountInputRow}>
          <Text style={[styles.currencyPrefixText, { color: theme.colors.textPrimary }]}>
            {getCurrencySymbol(user?.baseCurrency || 'INR')}
          </Text>
          <RNTextInput
            ref={amountInputRef}
            value={amount}
            onChangeText={(val) => {
              const clean = val.replace(/[^0-9.]/g, '');
              const parts = clean.split('.');
              const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;
              setAmount(sanitized);
              if (error) setError(null);
            }}
            placeholder="0"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="decimal-pad"
            style={[styles.amountInput, { color: theme.colors.textPrimary }]}
            autoFocus
            selectTextOnFocus={false}
          />
        </View>
        <Text style={[styles.amountSubtitle, { color: theme.colors.textSecondary }]}>
          Enter amount
        </Text>
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

      {/* Category Grid Section — only for Expense / Income */}
      {transactionType !== 'TRANSFER' && (
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
      )}

      {/* Detail Selectors List (Date, Payment Method, Note) */}
      <View style={[styles.detailsListCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.surfaceBorder }]}>
        {/* Date Row — tappable */}
        <TouchableOpacity
          style={[styles.detailRow, { borderBottomColor: theme.colors.surfaceBorder }]}
          activeOpacity={0.7}
          onPress={() => {
            const parts = selectedDate.split('-');
            const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            setPickerTempDate(d);
            setShowDatePicker(true);
          }}
        >
          <View style={styles.detailRowLeft}>
            <Text style={styles.detailRowIcon}>📅</Text>
            <Text style={[styles.detailRowLabel, { color: theme.colors.textPrimary }]}>Date</Text>
          </View>
          <Text style={[styles.detailRowValue, { color: theme.colors.primary }]}>
            {formatDisplayDate(selectedDate)} ›
          </Text>
        </TouchableOpacity>

        {/* Payment Method — label row then chips row */}
        {transactionType === 'EXPENSE' && (
          <View style={[styles.paymentMethodBlock, { borderBottomColor: theme.colors.surfaceBorder }]}>
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
                        borderWidth: isSelected ? 0 : 1,
                        borderColor: theme.colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodChipText,
                        {
                          color: isSelected ? '#FFFFFF' : theme.colors.textSecondary,
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

        {/* Note / Payee / Transfer Reason Row */}
        <View style={styles.detailRow}>
          <View style={styles.detailRowLeft}>
            <Text style={styles.detailRowIcon}>📝</Text>
            <Text style={[styles.detailRowLabel, { color: theme.colors.textPrimary }]}>
              {transactionType === 'TRANSFER'
                ? 'Transfer Note'
                : transactionType === 'EXPENSE'
                ? 'Add Note'
                : 'Source'}
            </Text>
          </View>
          <RNTextInput
            value={payee}
            onChangeText={setPayee}
            placeholder={
              transactionType === 'TRANSFER'
                ? 'Reason or memo (optional)'
                : transactionType === 'EXPENSE'
                ? 'Add a note (optional)'
                : 'e.g. Salary, Client'
            }
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.noteInput, { color: theme.colors.textPrimary }]}
          />
        </View>
      </View>

      {/* Save Action Button */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
          style={[
            styles.savePillButton,
            {
              backgroundColor: transactionType === 'TRANSFER' ? '#6366F1' : theme.colors.primary,
              shadowColor: transactionType === 'TRANSFER' ? '#6366F1' : theme.colors.primary,
            },
          ]}
        >
          <Text style={styles.savePillButtonText}>
            {isSaving
              ? 'Processing...'
              : transactionType === 'TRANSFER'
              ? 'Transfer Funds'
              : `Save ${transactionType === 'EXPENSE' ? 'Expense' : 'Income'}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Inline Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          style={styles.dateModalOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.dateModalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.surfaceBorder }]}
            onPress={() => {}}
          >
            <Text style={[styles.dateModalTitle, { color: theme.colors.textPrimary }]}>
              Select Date
            </Text>

            {/* Month / Day / Year row */}
            <View style={styles.datePickerRow}>
              {/* Day */}
              <View style={styles.dateSpinnerCol}>
                <TouchableOpacity
                  onPress={() => {
                    const d = new Date(pickerTempDate);
                    d.setDate(d.getDate() + 1);
                    if (d <= new Date()) setPickerTempDate(d);
                  }}
                  style={styles.spinnerArrow}
                >
                  <Text style={[styles.spinnerArrowText, { color: theme.colors.primary }]}>▲</Text>
                </TouchableOpacity>
                <Text style={[styles.spinnerValue, { color: theme.colors.textPrimary }]}>
                  {String(pickerTempDate.getDate()).padStart(2, '0')}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const d = new Date(pickerTempDate);
                    d.setDate(d.getDate() - 1);
                    setPickerTempDate(d);
                  }}
                  style={styles.spinnerArrow}
                >
                  <Text style={[styles.spinnerArrowText, { color: theme.colors.primary }]}>▼</Text>
                </TouchableOpacity>
                <Text style={[styles.spinnerLabel, { color: theme.colors.textMuted }]}>Day</Text>
              </View>

              <Text style={[styles.dateSlash, { color: theme.colors.textMuted }]}>/</Text>

              {/* Month */}
              <View style={styles.dateSpinnerCol}>
                <TouchableOpacity
                  onPress={() => {
                    const d = new Date(pickerTempDate);
                    d.setMonth(d.getMonth() + 1);
                    if (d <= new Date()) setPickerTempDate(d);
                  }}
                  style={styles.spinnerArrow}
                >
                  <Text style={[styles.spinnerArrowText, { color: theme.colors.primary }]}>▲</Text>
                </TouchableOpacity>
                <Text style={[styles.spinnerValue, { color: theme.colors.textPrimary }]}>
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][pickerTempDate.getMonth()]}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const d = new Date(pickerTempDate);
                    d.setMonth(d.getMonth() - 1);
                    setPickerTempDate(d);
                  }}
                  style={styles.spinnerArrow}
                >
                  <Text style={[styles.spinnerArrowText, { color: theme.colors.primary }]}>▼</Text>
                </TouchableOpacity>
                <Text style={[styles.spinnerLabel, { color: theme.colors.textMuted }]}>Month</Text>
              </View>

              <Text style={[styles.dateSlash, { color: theme.colors.textMuted }]}>/</Text>

              {/* Year */}
              <View style={styles.dateSpinnerCol}>
                <TouchableOpacity
                  onPress={() => {
                    const d = new Date(pickerTempDate);
                    d.setFullYear(d.getFullYear() + 1);
                    if (d <= new Date()) setPickerTempDate(d);
                  }}
                  style={styles.spinnerArrow}
                >
                  <Text style={[styles.spinnerArrowText, { color: theme.colors.primary }]}>▲</Text>
                </TouchableOpacity>
                <Text style={[styles.spinnerValue, { color: theme.colors.textPrimary }]}>
                  {pickerTempDate.getFullYear()}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const d = new Date(pickerTempDate);
                    d.setFullYear(d.getFullYear() - 1);
                    setPickerTempDate(d);
                  }}
                  style={styles.spinnerArrow}
                >
                  <Text style={[styles.spinnerArrowText, { color: theme.colors.primary }]}>▼</Text>
                </TouchableOpacity>
                <Text style={[styles.spinnerLabel, { color: theme.colors.textMuted }]}>Year</Text>
              </View>
            </View>

            <View style={styles.dateModalButtons}>
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={[styles.dateModalCancelBtn, { borderColor: theme.colors.surfaceBorder }]}
              >
                <Text style={[styles.dateModalCancelText, { color: theme.colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const y = pickerTempDate.getFullYear();
                  const m = String(pickerTempDate.getMonth() + 1).padStart(2, '0');
                  const d = String(pickerTempDate.getDate()).padStart(2, '0');
                  setSelectedDate(`${y}-${m}-${d}`);
                  setShowDatePicker(false);
                }}
                style={[styles.dateModalConfirmBtn, { backgroundColor: theme.colors.primary }]}
              >
                <Text style={styles.dateModalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Wallet Selection BottomSheet */}
      <BottomSheet
        visible={showWalletPicker}
        onClose={() => setShowWalletPicker(false)}
        title="Select Wallet"
      >
        <View style={{ paddingBottom: 24 }}>
          {wallets.map((w) => {
            const isSelected = (selectedWalletId || activeWalletId) === w.id;
            return (
              <TouchableOpacity
                key={w.id}
                style={[
                  styles.walletPickerRow,
                  isSelected && {
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',
                    borderColor: isDark ? '#1D4ED8' : '#BFDBFE',
                  },
                ]}
                onPress={() => {
                  setSelectedWalletId(w.id);
                  setShowWalletPicker(false);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '800',
                      width: 20,
                      textAlign: 'center',
                      color: isSelected ? theme.colors.primary : 'transparent',
                    }}
                  >
                    ✓
                  </Text>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: isSelected ? '700' : '500',
                      color: theme.colors.textPrimary,
                    }}
                  >
                    {w.name}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                  {w.isDefault ? 'Default' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

      {/* Destination Wallet Selection BottomSheet */}
      <BottomSheet
        visible={showToWalletPicker}
        onClose={() => setShowToWalletPicker(false)}
        title="Select Destination Wallet"
      >
        <View style={{ paddingBottom: 24 }}>
          {wallets.map((w) => {
            const isSelected = toWalletId === w.id;
            const isSource = (selectedWalletId || activeWalletId) === w.id;
            return (
              <TouchableOpacity
                key={w.id}
                style={[
                  styles.walletPickerRow,
                  isSelected && {
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF',
                    borderColor: isDark ? '#4F46E5' : '#C7D2FE',
                  },
                  isSource && { opacity: 0.45 },
                ]}
                onPress={() => {
                  if (isSource) {
                    Alert.alert('Invalid Selection', 'Destination wallet cannot be the same as source wallet.');
                    return;
                  }
                  setToWalletId(w.id);
                  setShowToWalletPicker(false);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '800',
                      width: 20,
                      textAlign: 'center',
                      color: isSelected ? '#6366F1' : 'transparent',
                    }}
                  >
                    ✓
                  </Text>
                  <View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: isSelected ? '700' : '500',
                        color: theme.colors.textPrimary,
                      }}
                    >
                      {w.name} {isSource ? '(Source)' : ''}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                  {isBalanceHidden ? (
                    '••••'
                  ) : (
                    <CurrencyText amountCents={w.balanceCents || 0} currency={user?.baseCurrency || 'INR'} />
                  )}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  walletPillRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  walletPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  walletPillChevron: {
    fontSize: 11,
    marginTop: 1,
  },
  walletPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 6,
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
  toggleBtnTransferActive: {
    backgroundColor: '#EEF2FF',
  },
  toggleBtnTransferActiveDark: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  transferSection: {
    marginBottom: 20,
  },
  transferWarningBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  transferWarningText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  createWalletCta: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  createWalletCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  transferCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 4,
  },
  transferWalletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  transferWalletIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transferWalletEmoji: {
    fontSize: 18,
  },
  transferWalletInfo: {
    flex: 1,
  },
  transferWalletLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  transferWalletName: {
    fontSize: 15,
    fontWeight: '700',
  },
  transferWalletRight: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
  },
  transferWalletBalance: {
    fontSize: 14,
    fontWeight: '600',
  },
  transferChevron: {
    fontSize: 14,
    marginTop: 2,
  },
  transferDivider: {
    height: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  transferSwapBtn: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  transferSwapIcon: {
    fontSize: 16,
    fontWeight: '800',
  },
  toggleText: {
    fontSize: 14,
  },
  amountContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 16,
    borderRadius: 18,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '90%',
  },
  currencyPrefixText: {
    fontSize: 36,
    fontWeight: '800',
    marginRight: 4,
    letterSpacing: -0.5,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    minWidth: 50,
    paddingVertical: 0,
    paddingHorizontal: 2,
    margin: 0,
    textAlign: 'left',
  },
  amountSubtitle: {
    fontSize: 13,
    marginTop: 4,
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
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  paymentMethodBlock: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  methodChipText: {
    fontSize: 12,
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
  // Date picker modal styles
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dateModalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 36,
  },
  dateModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
  },
  dateSpinnerCol: {
    alignItems: 'center',
    minWidth: 64,
  },
  spinnerArrow: {
    padding: 8,
  },
  spinnerArrowText: {
    fontSize: 16,
    fontWeight: '700',
  },
  spinnerValue: {
    fontSize: 22,
    fontWeight: '700',
    marginVertical: 4,
    minWidth: 60,
    textAlign: 'center',
  },
  spinnerLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  dateSlash: {
    fontSize: 22,
    fontWeight: '300',
    marginBottom: 20,
  },
  dateModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  dateModalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dateModalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateModalConfirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
