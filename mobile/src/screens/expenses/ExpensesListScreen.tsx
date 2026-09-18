import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  TextInput as RNTextInput,
  Modal,
} from 'react-native';
import { Screen } from '../../components/common/Screen';
import { TextInput } from '../../components/forms/TextInput';
import { Card } from '../../components/common/Card';
import { CurrencyText } from '../../components/common/CurrencyText';
import { EmptyState } from '../../components/common/EmptyState';
import { BottomSheet } from '../../components/common/BottomSheet';
import { Button } from '../../components/common/Button';
import { ExpenseModel, CategoryModel, PaymentMethod, IncomeModel } from '../../domain/models';
import { listExpensesUseCase, deleteExpenseUseCase } from '../../domain/usecases/expenseUseCases';
import { listIncomeUseCase, deleteIncomeUseCase } from '../../domain/usecases/incomeUseCases';
import { listCategoriesUseCase } from '../../domain/usecases/categoryUseCases';
import { ExpenseEditModal } from './components/ExpenseEditModal';
import { IncomeEditModal } from './components/IncomeEditModal';
import { useTheme } from '../../theme/useTheme';
import { useWallet } from '../../app/providers/WalletProvider';
import { useAuth } from '../../app/providers/AuthProvider';
import { formatDisplayDate, getTodayDateString } from '../../utils/date';
import {
  groupExpensesByDate,
  groupIncomesByDate,
  ExpenseDateGroup,
  IncomeDateGroup,
} from '../../utils/dateGrouping';
import {
  normalizeTransactionsForExport,
  generateCSV,
  generateFinancialStatement,
  shareExportContent,
} from '../../utils/exportUtils';
import { DataEvents } from '../../database/sqlite/DataEvents';
import { PAYMENT_METHODS } from '../../app/config/constants';
import { useSync } from '../../sync/hooks/useSync';
import { useNetworkState } from '../../sync/network/useNetworkState';
import { IconFilter } from '../../components/common/NavIcons';
import { useRoute } from '@react-navigation/native';

export type TransactionTab = 'INCOME' | 'EXPENSE';
export type DatePreset = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH';

const PAGE_SIZE = 25;

export const ExpensesListScreen: React.FC = () => {
  const { theme, isDark } = useTheme();
  const { syncNow } = useSync();
  const { isOffline } = useNetworkState();
  const { wallets } = useWallet();
  const { user } = useAuth();
  const currency = user?.baseCurrency || 'INR';
  const route = useRoute<any>();

  const initialTab: TransactionTab = route.params?.tab === 'INCOME' ? 'INCOME' : 'EXPENSE';
  const [selectedTab, setSelectedTab] = useState<TransactionTab>(initialTab);

  const [expenses, setExpenses] = useState<ExpenseModel[]>([]);
  const [incomes, setIncomes] = useState<IncomeModel[]>([]);
  const [categories, setCategories] = useState<CategoryModel[]>([]);

  // Advanced Filters State
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseModel | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Income Modal State
  const [selectedIncome, setSelectedIncome] = useState<IncomeModel | null>(null);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);

  // Keep selected tab in sync if route param changes
  useEffect(() => {
    if (route.params?.tab) {
      setSelectedTab(route.params.tab);
    }
  }, [route.params?.tab]);

  // Debounce search input (250ms) to ensure lightning-fast SQLite search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Load available categories from local SQLite
  useEffect(() => {
    async function loadCats() {
      try {
        const cats = await listCategoriesUseCase(selectedTab);
        setCategories(cats);
      } catch {
        // Handled
      }
    }
    loadCats();
  }, [selectedTab]);

function getDateRangeFromPreset(preset: DatePreset): { startDate?: string; endDate?: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  if (preset === 'TODAY') {
    return { startDate: todayStr, endDate: todayStr };
  }
  if (preset === 'THIS_WEEK') {
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    const startY = startOfWeek.getFullYear();
    const startM = String(startOfWeek.getMonth() + 1).padStart(2, '0');
    const startD = String(startOfWeek.getDate()).padStart(2, '0');
    return { startDate: `${startY}-${startM}-${startD}`, endDate: todayStr };
  }
  if (preset === 'THIS_MONTH') {
    return { startDate: `${yyyy}-${mm}-01`, endDate: todayStr };
  }
  if (preset === 'LAST_MONTH') {
    const lastMonthDate = new Date(yyyy, now.getMonth() - 1, 1);
    const lmY = lastMonthDate.getFullYear();
    const lmM = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
    const lastDayOfLastMonth = new Date(yyyy, now.getMonth(), 0).getDate();
    return {
      startDate: `${lmY}-${lmM}-01`,
      endDate: `${lmY}-${lmM}-${String(lastDayOfLastMonth).padStart(2, '0')}`,
    };
  }
  return {};
}

  // Fetch paginated expenses from local SQLite
  const loadExpenses = useCallback(
    async (reset = false) => {
      setIsLoading(true);
      try {
        const dateRange = getDateRangeFromPreset(datePreset);
        const minCents = minAmount.trim() ? Math.round(parseFloat(minAmount) * 100) : undefined;
        const maxCents = maxAmount.trim() ? Math.round(parseFloat(maxAmount) * 100) : undefined;

        const currentOffset = reset ? 0 : offsetRef.current;
        const list = await listExpensesUseCase({
          search: debouncedSearch.trim() || undefined,
          categoryId: selectedCategory || undefined,
          walletId: selectedWalletId || undefined,
          paymentMethod: selectedPaymentMethod || undefined,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          minAmountCents: minCents,
          maxAmountCents: maxCents,
          limit: PAGE_SIZE,
          offset: currentOffset,
        });

        if (reset) {
          setExpenses(list);
          offsetRef.current = PAGE_SIZE;
          setOffset(PAGE_SIZE);
          setHasMore(list.length === PAGE_SIZE);
        } else {
          setExpenses((prev) => [...prev, ...list]);
          offsetRef.current += PAGE_SIZE;
          setOffset((prev) => prev + PAGE_SIZE);
          setHasMore(list.length === PAGE_SIZE);
        }
      } catch {
        // Handled
      } finally {
        setIsLoading(false);
      }
    },
    [
      debouncedSearch,
      selectedCategory,
      selectedPaymentMethod,
      selectedWalletId,
      datePreset,
      minAmount,
      maxAmount,
    ]
  );

  // Fetch incomes from local SQLite with category and payment method filters
  const loadIncomes = useCallback(async () => {
    setIsLoading(true);
    try {
      const dateRange = getDateRangeFromPreset(datePreset);
      const minCents = minAmount.trim() ? Math.round(parseFloat(minAmount) * 100) : undefined;
      const maxCents = maxAmount.trim() ? Math.round(parseFloat(maxAmount) * 100) : undefined;

      const list = await listIncomeUseCase({
        search: debouncedSearch.trim() || undefined,
        categoryId: selectedCategory || undefined,
        walletId: selectedWalletId || undefined,
        paymentMethod: selectedPaymentMethod || undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        minAmountCents: minCents,
        maxAmountCents: maxCents,
      });
      setIncomes(list);
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  }, [
    debouncedSearch,
    selectedCategory,
    selectedPaymentMethod,
    selectedWalletId,
    datePreset,
    minAmount,
    maxAmount,
  ]);

  // Reload when filters or search change
  useEffect(() => {
    if (selectedTab === 'EXPENSE') {
      loadExpenses(true);
    } else {
      loadIncomes();
    }
  }, [
    selectedTab,
    debouncedSearch,
    selectedCategory,
    selectedPaymentMethod,
    selectedWalletId,
    datePreset,
    minAmount,
    maxAmount,
    loadExpenses,
    loadIncomes,
  ]);

  // Reactive subscription: auto-refresh on SQLite change events
  useEffect(() => {
    const unsubExp = DataEvents.subscribe('EXPENSES_CHANGED', () => {
      loadExpenses(true);
    });
    const unsubInc = DataEvents.subscribe('INCOME_CHANGED', () => {
      loadIncomes();
    });
    const unsubWallets = DataEvents.subscribe('WALLETS_CHANGED', () => {
      loadExpenses(true);
      loadIncomes();
    });
    return () => {
      unsubExp();
      unsubInc();
      unsubWallets();
    };
  }, [loadExpenses, loadIncomes]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadExpenses(true), loadIncomes()]);
      if (!isOffline) {
        syncNow().catch(() => {});
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (selectedTab === 'EXPENSE' && !isLoading && hasMore) {
      loadExpenses(false);
    }
  };

  const handleCardPress = (item: ExpenseModel) => {
    setSelectedExpense(item);
    setIsEditModalOpen(true);
  };

  const handleActionMenu = (item: ExpenseModel) => {
    Alert.alert(
      item.payee || item.categoryName || 'Expense',
      `Choose an action for this transaction of $${(item.amountCents / 100).toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit',
          onPress: () => {
            setSelectedExpense(item);
            setIsEditModalOpen(true);
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDelete(item.id, item.payee || 'Expense'),
        },
      ]
    );
  };

  const handleDelete = (id: string, payee: string) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete this expense from ${payee}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteExpenseUseCase(id);
            loadExpenses(true);
          },
        },
      ]
    );
  };

  const handleIncomeCardPress = (item: IncomeModel) => {
    setSelectedIncome(item);
    setIsIncomeModalOpen(true);
  };

  const handleIncomeActionMenu = (item: IncomeModel) => {
    Alert.alert(
      item.source || item.categoryName || 'Income',
      `Choose an action for this income of $${(item.amountCents / 100).toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit',
          onPress: () => {
            setSelectedIncome(item);
            setIsIncomeModalOpen(true);
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleIncomeDelete(item.id, item.source || 'Income'),
        },
      ]
    );
  };

  const handleIncomeDelete = (id: string, source: string) => {
    Alert.alert(
      'Delete Income',
      `Are you sure you want to delete this income from ${source}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteIncomeUseCase(id);
            loadIncomes();
          },
        },
      ]
    );
  };

  const handleClearAllFilters = () => {
    setSelectedCategory(null);
    setSelectedPaymentMethod(null);
    setSelectedWalletId(null);
    setDatePreset('ALL');
    setMinAmount('');
    setMaxAmount('');
    setSearch('');
  };

  // Fetch all filtered items for complete export (no pagination cutoff)
  const fetchExportItems = async () => {
    const dateRange = getDateRangeFromPreset(datePreset);
    const minCents = minAmount.trim() ? Math.round(parseFloat(minAmount) * 100) : undefined;
    const maxCents = maxAmount.trim() ? Math.round(parseFloat(maxAmount) * 100) : undefined;

    const [allExp, allInc] = await Promise.all([
      selectedTab === 'EXPENSE'
        ? listExpensesUseCase({
            search: debouncedSearch.trim() || undefined,
            categoryId: selectedCategory || undefined,
            walletId: selectedWalletId || undefined,
            paymentMethod: selectedPaymentMethod || undefined,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            minAmountCents: minCents,
            maxAmountCents: maxCents,
            limit: 10000,
          })
        : Promise.resolve([]),
      selectedTab === 'INCOME'
        ? listIncomeUseCase({
            search: debouncedSearch.trim() || undefined,
            categoryId: selectedCategory || undefined,
            walletId: selectedWalletId || undefined,
            paymentMethod: selectedPaymentMethod || undefined,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            minAmountCents: minCents,
            maxAmountCents: maxCents,
          })
        : Promise.resolve([]),
    ]);

    return normalizeTransactionsForExport(allExp, allInc);
  };

  // Export handlers
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const items = await fetchExportItems();
      if (items.length === 0) {
        Alert.alert('No Records', 'There are no transactions to export with the current filters.');
        return;
      }
      const csv = generateCSV(items);
      setIsExportModalOpen(false);
      await shareExportContent(`spending_book_export_${getTodayDateString()}.csv`, csv);
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Could not export data.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportStatement = async () => {
    setIsExporting(true);
    try {
      const items = await fetchExportItems();
      if (items.length === 0) {
        Alert.alert('No Records', 'There are no transactions to export with the current filters.');
        return;
      }
      const statement = generateFinancialStatement(items, currency);
      setIsExportModalOpen(false);
      await shareExportContent(`spending_book_statement_${getTodayDateString()}.txt`, statement);
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Could not generate statement.');
    } finally {
      setIsExporting(false);
    }
  };

  // Group transactions into Today, Yesterday, and formatted date sections
  const expenseSections: ExpenseDateGroup[] = useMemo(() => {
    return groupExpensesByDate(expenses);
  }, [expenses]);

  const incomeSections: IncomeDateGroup[] = useMemo(() => {
    return groupIncomesByDate(incomes);
  }, [incomes]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedWalletId) count++;
    if (selectedCategory) count++;
    if (selectedPaymentMethod) count++;
    if (datePreset !== 'ALL') count++;
    if (minAmount.trim() || maxAmount.trim()) count++;
    return count;
  }, [selectedWalletId, selectedCategory, selectedPaymentMethod, datePreset, minAmount, maxAmount]);

  const selectedCategoryModel = useMemo(() => {
    return categories.find((c) => c.id === selectedCategory);
  }, [categories, selectedCategory]);

  const selectedWalletModel = useMemo(() => {
    return wallets.find((w) => w.id === selectedWalletId);
  }, [wallets, selectedWalletId]);

  return (
    <Screen style={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Transactions</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            {selectedTab === 'EXPENSE'
              ? `${expenses.length} transaction${expenses.length !== 1 ? 's' : ''} stored offline`
              : `${incomes.length} income stream${incomes.length !== 1 ? 's' : ''} stored offline`}
          </Text>
        </View>

        {/* Right Header Actions: Export & Filter */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setIsExportModalOpen(true)}
            style={[
              styles.filterButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.surfaceBorder,
                paddingHorizontal: 10,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Export transactions report"
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary }}>
              📤 Export
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsFilterSheetOpen(true)}
            style={[
              styles.filterButton,
              {
                backgroundColor: activeFiltersCount > 0 ? theme.colors.primary : theme.colors.surface,
                borderColor: activeFiltersCount > 0 ? theme.colors.primary : theme.colors.surfaceBorder,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Open filter sheet. ${activeFiltersCount} filters currently active.`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <IconFilter
                color={activeFiltersCount > 0 ? '#FFFFFF' : theme.colors.textPrimary}
                size={13}
              />
              <Text
                style={[
                  styles.filterButtonText,
                  { color: activeFiltersCount > 0 ? '#FFFFFF' : theme.colors.textPrimary },
                ]}
              >
                Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input with Instant Clear Button */}
      <View style={styles.searchBoxWrapper}>
        <TextInput
          placeholder={
            selectedTab === 'EXPENSE'
              ? 'Search merchant, category, or note...'
              : 'Search source, category, or note...'
          }
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity
            style={styles.searchClearBtn}
            onPress={() => setSearch('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.searchClearIcon, { color: theme.colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Segmented Filter Control: [ Income | Expense ] */}
      <View
        style={[
          styles.segmentContainer,
          {
            backgroundColor: isDark ? '#161B2E' : '#F1F5F9',
            borderColor: isDark ? '#232A42' : '#E2E8F0',
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setSelectedTab('INCOME')}
          style={[
            styles.segmentTab,
            selectedTab === 'INCOME' && [
              styles.segmentTabActive,
              {
                backgroundColor: isDark ? '#283256' : '#FFFFFF',
                shadowOpacity: isDark ? 0.25 : 0.08,
              },
            ],
          ]}
          accessibilityRole="button"
          accessibilityLabel="Filter by Income"
        >
          <Text
            style={[
              styles.segmentText,
              { color: isDark ? '#8F9BB3' : '#64748B' },
              selectedTab === 'INCOME' && [
                styles.segmentTextActive,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ],
            ]}
          >
            Income
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setSelectedTab('EXPENSE')}
          style={[
            styles.segmentTab,
            selectedTab === 'EXPENSE' && [
              styles.segmentTabActive,
              {
                backgroundColor: isDark ? '#283256' : '#FFFFFF',
                shadowOpacity: isDark ? 0.25 : 0.08,
              },
            ],
          ]}
          accessibilityRole="button"
          accessibilityLabel="Filter by Expense"
        >
          <Text
            style={[
              styles.segmentText,
              { color: isDark ? '#8F9BB3' : '#64748B' },
              selectedTab === 'EXPENSE' && [
                styles.segmentTextActive,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ],
            ]}
          >
            Expense
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Filter Chips Bar (Category, Wallet, Date, Payment, Amount) */}
      {(activeFiltersCount > 0 || search.length > 0) && (
        <View style={styles.activeFiltersRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersScroll}>
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                style={[styles.activeFilterChip, { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.primary }]}
              >
                <Text style={[styles.activeFilterText, { color: theme.colors.primary }]}>
                  🔍 "{search}" ✕
                </Text>
              </TouchableOpacity>
            )}

            {selectedWalletModel && (
              <TouchableOpacity
                onPress={() => setSelectedWalletId(null)}
                style={[styles.activeFilterChip, { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.primary }]}
              >
                <Text style={[styles.activeFilterText, { color: theme.colors.primary }]}>
                  👛 {selectedWalletModel.name} ✕
                </Text>
              </TouchableOpacity>
            )}

            {datePreset !== 'ALL' && (
              <TouchableOpacity
                onPress={() => setDatePreset('ALL')}
                style={[styles.activeFilterChip, { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.primary }]}
              >
                <Text style={[styles.activeFilterText, { color: theme.colors.primary }]}>
                  📅 {datePreset.replace('_', ' ')} ✕
                </Text>
              </TouchableOpacity>
            )}

            {selectedCategoryModel && (
              <TouchableOpacity
                onPress={() => setSelectedCategory(null)}
                style={[styles.activeFilterChip, { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.primary }]}
              >
                <Text style={[styles.activeFilterText, { color: theme.colors.primary }]}>
                  {selectedCategoryModel.icon} {selectedCategoryModel.name} ✕
                </Text>
              </TouchableOpacity>
            )}

            {selectedPaymentMethod && (
              <TouchableOpacity
                onPress={() => setSelectedPaymentMethod(null)}
                style={[styles.activeFilterChip, { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.primary }]}
              >
                <Text style={[styles.activeFilterText, { color: theme.colors.primary }]}>
                  💳 {selectedPaymentMethod.replace('_', ' ')} ✕
                </Text>
              </TouchableOpacity>
            )}

            {(minAmount.trim() || maxAmount.trim()) && (
              <TouchableOpacity
                onPress={() => {
                  setMinAmount('');
                  setMaxAmount('');
                }}
                style={[styles.activeFilterChip, { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.primary }]}
              >
                <Text style={[styles.activeFilterText, { color: theme.colors.primary }]}>
                  💵 {currency} {minAmount || '0'} - {maxAmount || '∞'} ✕
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleClearAllFilters} style={styles.clearAllButton}>
              <Text style={[styles.clearAllText, { color: theme.colors.expense }]}>Clear All</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* EXPENSE VIEW */}
      {selectedTab === 'EXPENSE' ? (
        <>

          {/* Grouped Expenses List */}
          <SectionList
            sections={expenseSections}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={
              !isLoading ? (
                <EmptyState
                  title={search || activeFiltersCount > 0 ? 'No matching expenses' : 'No expenses recorded yet'}
                  description={
                    search || activeFiltersCount > 0
                      ? 'Try clearing your search or filters to see all local transactions.'
                      : 'Tap "+ Add" in the bottom menu to save an expense in 2-5 seconds.'
                  }
                />
              ) : null
            }
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionHeaderText, { color: theme.colors.textMuted }]}>
                  {title}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleCardPress(item)}
                onLongPress={() => handleActionMenu(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.payee || item.categoryName}, $${(item.amountCents / 100).toFixed(2)}, on ${formatDisplayDate(item.transactionDate)}`}
              >
                <Card style={styles.card}>
                  <View style={styles.cardLeft}>
                    <View
                      style={[
                        styles.iconBox,
                        {
                          backgroundColor: item.categoryColor
                            ? `${item.categoryColor}25`
                            : theme.colors.surfaceSubtle,
                        },
                      ]}
                    >
                      <Text style={styles.icon}>{item.categoryIcon || '🏷️'}</Text>
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={[styles.payee, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                        {item.payee || item.categoryName || 'Expense'}
                      </Text>
                      <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                        {item.paymentMethod.replace('_', ' ')}
                        {item.categoryName ? ` • ${item.categoryName}` : ''}
                        {item.walletName ? ` • ${item.walletName}` : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardRight}>
                    <CurrencyText
                      amountCents={item.amountCents}
                      currency={item.currency}
                      type="expense"
                      showSign
                      style={styles.amount}
                    />
                    {item.syncStatus === 'PENDING' && (
                      <Text style={[styles.syncBadge, { color: theme.colors.warning }]}>• Offline</Text>
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            )}
          />
        </>
      ) : (
        /* INCOME VIEW */
        <SectionList
          sections={incomeSections}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState
                title={search ? 'No matching income' : 'No income recorded yet'}
                description={
                  search
                    ? 'Try clearing your search keyword.'
                    : 'Tap "+" below to track salary, freelance, or investment returns.'
                }
              />
            ) : null
          }
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionHeaderText, { color: theme.colors.textMuted }]}>
                {title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleIncomeCardPress(item)}
              onLongPress={() => handleIncomeActionMenu(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.source}, $${(item.amountCents / 100).toFixed(2)}, on ${formatDisplayDate(item.transactionDate)}`}
            >
              <Card style={styles.card}>
                <View style={styles.cardLeft}>
                  <View
                    style={[
                      styles.iconBox,
                      {
                        backgroundColor: item.categoryColor
                          ? `${item.categoryColor}25`
                          : `${theme.colors.income}25`,
                      },
                    ]}
                  >
                    <Text style={styles.icon}>{item.categoryIcon || '💼'}</Text>
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={[styles.payee, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                      {item.source}
                    </Text>
                    <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                      {item.paymentMethod ? item.paymentMethod.replace('_', ' ') : 'INCOME'}
                      {item.categoryName ? ` • ${item.categoryName}` : ''}
                      {item.walletName ? ` • ${item.walletName}` : ''}
                      {item.note ? ` • ${item.note}` : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardRight}>
                  <CurrencyText
                    amountCents={item.amountCents}
                    currency={item.currency}
                    type="income"
                    showSign
                    style={styles.amount}
                  />
                  {item.syncStatus === 'PENDING' && (
                    <Text style={[styles.syncBadge, { color: theme.colors.warning }]}>• Offline</Text>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Advanced Filter Bottom Sheet (for Expenses & Income) */}
      <BottomSheet
        visible={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Filter Transactions"
      >
        {/* Wallet Filter Section */}
        {wallets.length > 0 && (
          <View style={styles.sheetSection}>
            <Text style={[styles.sheetSectionTitle, { color: theme.colors.textMuted }]}>
              Wallet
            </Text>
            <View style={styles.sheetChipsRow}>
              <TouchableOpacity
                onPress={() => setSelectedWalletId(null)}
                style={[
                  styles.sheetChip,
                  {
                    backgroundColor: selectedWalletId === null ? theme.colors.primary : theme.colors.surfaceSubtle,
                    borderColor: selectedWalletId === null ? theme.colors.primary : theme.colors.surfaceBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sheetChipText,
                    { color: selectedWalletId === null ? '#FFFFFF' : theme.colors.textPrimary },
                  ]}
                >
                  All Wallets
                </Text>
              </TouchableOpacity>

              {wallets.map((w) => {
                const isSelected = selectedWalletId === w.id;
                return (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => setSelectedWalletId(isSelected ? null : w.id)}
                    style={[
                      styles.sheetChip,
                      {
                        backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceSubtle,
                        borderColor: isSelected ? theme.colors.primary : theme.colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Text style={styles.sheetChipIcon}>👛</Text>
                    <Text
                      style={[
                        styles.sheetChipText,
                        { color: isSelected ? '#FFFFFF' : theme.colors.textPrimary },
                      ]}
                    >
                      {w.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Date Range Preset Section */}
        <View style={styles.sheetSection}>
          <Text style={[styles.sheetSectionTitle, { color: theme.colors.textMuted }]}>
            Date Range
          </Text>
          <View style={styles.sheetChipsRow}>
            {(
              [
                { label: 'All Time', value: 'ALL' },
                { label: 'Today', value: 'TODAY' },
                { label: 'This Week', value: 'THIS_WEEK' },
                { label: 'This Month', value: 'THIS_MONTH' },
                { label: 'Last Month', value: 'LAST_MONTH' },
              ] as { label: string; value: DatePreset }[]
            ).map((preset) => {
              const isSelected = datePreset === preset.value;
              return (
                <TouchableOpacity
                  key={preset.value}
                  onPress={() => setDatePreset(preset.value)}
                  style={[
                    styles.sheetChip,
                    {
                      backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceSubtle,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.surfaceBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetChipText,
                      { color: isSelected ? '#FFFFFF' : theme.colors.textPrimary },
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Category Filters */}
        <View style={styles.sheetSection}>
          <Text style={[styles.sheetSectionTitle, { color: theme.colors.textMuted }]}>
            Category
          </Text>
          <View style={styles.sheetChipsRow}>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(isSelected ? null : cat.id)}
                  style={[
                    styles.sheetChip,
                    {
                      backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceSubtle,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.surfaceBorder,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${cat.name}`}
                >
                  <Text style={styles.sheetChipIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.sheetChipText,
                      { color: isSelected ? '#FFFFFF' : theme.colors.textPrimary },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Payment Method Filters */}
        <View style={styles.sheetSection}>
          <Text style={[styles.sheetSectionTitle, { color: theme.colors.textMuted }]}>
            Payment Method
          </Text>
          <View style={styles.sheetChipsRow}>
            {PAYMENT_METHODS.map((method) => {
              const isSelected = selectedPaymentMethod === method.value;
              return (
                <TouchableOpacity
                  key={method.value}
                  onPress={() =>
                    setSelectedPaymentMethod(isSelected ? null : (method.value as PaymentMethod))
                  }
                  style={[
                    styles.sheetChip,
                    {
                      backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceSubtle,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.surfaceBorder,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${method.label}`}
                >
                  <Text
                    style={[
                      styles.sheetChipText,
                      { color: isSelected ? '#FFFFFF' : theme.colors.textPrimary },
                    ]}
                  >
                    {method.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Amount Range Filter Section */}
        <View style={styles.sheetSection}>
          <Text style={[styles.sheetSectionTitle, { color: theme.colors.textMuted }]}>
            Amount Range ({currency})
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <RNTextInput
                value={minAmount}
                onChangeText={setMinAmount}
                placeholder="Min Amount"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                style={[
                  styles.filterAmountInput,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.surfaceBorder,
                    color: theme.colors.textPrimary,
                  },
                ]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <RNTextInput
                value={maxAmount}
                onChangeText={setMaxAmount}
                placeholder="Max Amount"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                style={[
                  styles.filterAmountInput,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.surfaceBorder,
                    color: theme.colors.textPrimary,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Sheet Actions */}
        <View style={styles.sheetActions}>
          <Button
            label="Clear All Filters"
            variant="outline"
            onPress={handleClearAllFilters}
            style={styles.sheetActionButton}
          />
          <Button
            label="Apply Filters"
            variant="primary"
            onPress={() => setIsFilterSheetOpen(false)}
            style={styles.sheetActionButton}
          />
        </View>
      </BottomSheet>

      {/* Export Report Modal */}
      <Modal
        visible={isExportModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsExportModalOpen(false)}
      >
        <View style={styles.exportModalOverlay}>
          <View style={[styles.exportModalCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.exportModalTitle, { color: theme.colors.textPrimary }]}>
              Export Transactions
            </Text>
            <Text style={[styles.exportModalSubtitle, { color: theme.colors.textSecondary }]}>
              Export your records based on active filters ({selectedTab === 'EXPENSE' ? expenses.length : incomes.length} transactions).
            </Text>

            <TouchableOpacity
              style={[
                styles.exportOptionCard,
                {
                  borderColor: theme.colors.surfaceBorder,
                  backgroundColor: theme.colors.surfaceSubtle,
                },
              ]}
              onPress={handleExportCSV}
              disabled={isExporting}
              activeOpacity={0.7}
            >
              <Text style={styles.exportOptionEmoji}>📊</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.exportOptionTitle, { color: theme.colors.textPrimary }]}>
                  CSV Spreadsheet (.csv)
                </Text>
                <Text style={[styles.exportOptionDesc, { color: theme.colors.textMuted }]}>
                  Compatible with Microsoft Excel, Google Sheets, & Apple Numbers
                </Text>
              </View>
              <Text style={[styles.chevron, { color: theme.colors.textMuted }]}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.exportOptionCard,
                {
                  borderColor: theme.colors.surfaceBorder,
                  backgroundColor: theme.colors.surfaceSubtle,
                },
              ]}
              onPress={handleExportStatement}
              disabled={isExporting}
              activeOpacity={0.7}
            >
              <Text style={styles.exportOptionEmoji}>📄</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.exportOptionTitle, { color: theme.colors.textPrimary }]}>
                  Financial Statement (.txt)
                </Text>
                <Text style={[styles.exportOptionDesc, { color: theme.colors.textMuted }]}>
                  Formatted accounting summary ready to share via WhatsApp or Email
                </Text>
              </View>
              <Text style={[styles.chevron, { color: theme.colors.textMuted }]}>›</Text>
            </TouchableOpacity>

            <Button
              label="Cancel"
              variant="outline"
              size="md"
              onPress={() => setIsExportModalOpen(false)}
              style={{ marginTop: 12 }}
            />
          </View>
        </View>
      </Modal>

      {/* Edit & Delete Expense Modal */}
      {selectedExpense && (
        <ExpenseEditModal
          visible={isEditModalOpen}
          expense={selectedExpense}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedExpense(null);
          }}
          onSuccess={() => {
            setIsEditModalOpen(false);
            setSelectedExpense(null);
            loadExpenses(true);
          }}
        />
      )}

      {/* Record & Edit Income Modal */}
      <IncomeEditModal
        visible={isIncomeModalOpen}
        income={selectedIncome}
        onClose={() => {
          setIsIncomeModalOpen(false);
          setSelectedIncome(null);
        }}
        onSuccess={() => {
          setIsIncomeModalOpen(false);
          setSelectedIncome(null);
          loadIncomes();
        }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9999,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addIncomeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9999,
  },
  addIncomeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  segmentTabActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    fontWeight: '700',
  },
  searchBoxWrapper: {
    position: 'relative',
    marginBottom: 10,
    justifyContent: 'center',
  },
  searchClearBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 6,
    zIndex: 3,
  },
  searchClearIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  searchInput: {
    paddingRight: 40,
  },
  filterAmountInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  exportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  exportModalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  exportModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  exportModalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  exportOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  exportOptionEmoji: {
    fontSize: 24,
    marginRight: 14,
  },
  exportOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  exportOptionDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
  activeFiltersRow: {
    marginBottom: 10,
  },
  activeFiltersScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
  },
  activeFilterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  clearAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 64,
    marginBottom: 6,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
  },
  txInfo: {
    flex: 1,
  },
  payee: {
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 15,
  },
  syncBadge: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  sheetSection: {
    marginBottom: 16,
  },
  sheetSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sheetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 9999,
    borderWidth: 1,
  },
  sheetChipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  sheetChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  sheetActionButton: {
    flex: 1,
  },
});
