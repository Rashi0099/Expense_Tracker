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
} from 'react-native';
import { Screen } from '../../components/common/Screen';
import { TextInput } from '../../components/forms/TextInput';
import { Card } from '../../components/common/Card';
import { CurrencyText } from '../../components/common/CurrencyText';
import { EmptyState } from '../../components/common/EmptyState';
import { BottomSheet } from '../../components/common/BottomSheet';
import { Button } from '../../components/common/Button';
import { ExpenseModel, CategoryModel, PaymentMethod } from '../../domain/models';
import { listExpensesUseCase, deleteExpenseUseCase } from '../../domain/usecases/expenseUseCases';
import { listCategoriesUseCase } from '../../domain/usecases/categoryUseCases';
import { ExpenseEditModal } from './components/ExpenseEditModal';
import { useTheme } from '../../theme/useTheme';
import { formatDisplayDate } from '../../utils/date';
import { groupExpensesByDate, ExpenseDateGroup } from '../../utils/dateGrouping';
import { DataEvents } from '../../database/sqlite/DataEvents';
import { PAYMENT_METHODS } from '../../app/config/constants';
import { useSync } from '../../sync/hooks/useSync';
import { useNetworkState } from '../../sync/network/useNetworkState';

const PAGE_SIZE = 25;

export const ExpensesListScreen: React.FC = () => {
  const { theme } = useTheme();
  const { syncNow } = useSync();
  const { isOffline } = useNetworkState();

  const [expenses, setExpenses] = useState<ExpenseModel[]>([]);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseModel | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
        const cats = await listCategoriesUseCase('EXPENSE');
        setCategories(cats);
      } catch {
        // Handled
      }
    }
    loadCats();
  }, []);

  // Fetch paginated expenses from local SQLite
  const loadExpenses = useCallback(
    async (reset = false) => {
      setIsLoading(true);
      try {
        const currentOffset = reset ? 0 : offsetRef.current;
        const list = await listExpensesUseCase({
          search: debouncedSearch.trim() || undefined,
          categoryId: selectedCategory || undefined,
          paymentMethod: selectedPaymentMethod || undefined,
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
    [debouncedSearch, selectedCategory, selectedPaymentMethod]
  );

  // Reload when filters or search change
  useEffect(() => {
    loadExpenses(true);
  }, [debouncedSearch, selectedCategory, selectedPaymentMethod, loadExpenses]);

  // Reactive subscription: auto-refresh on SQLite change events
  useEffect(() => {
    const unsub = DataEvents.subscribe('EXPENSES_CHANGED', () => {
      loadExpenses(true);
    });
    return unsub;
  }, [loadExpenses]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadExpenses(true);
      if (!isOffline) {
        syncNow().catch(() => {});
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
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

  const handleClearAllFilters = () => {
    setSelectedCategory(null);
    setSelectedPaymentMethod(null);
    setSearch('');
  };

  // Group transactions into Today, Yesterday, and formatted date sections
  const sections: ExpenseDateGroup[] = useMemo(() => {
    return groupExpensesByDate(expenses);
  }, [expenses]);

  const activeFiltersCount = (selectedCategory ? 1 : 0) + (selectedPaymentMethod ? 1 : 0);

  const selectedCategoryModel = useMemo(() => {
    return categories.find((c) => c.id === selectedCategory);
  }, [categories, selectedCategory]);

  return (
    <Screen style={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Expenses</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            {expenses.length} transaction{expenses.length !== 1 ? 's' : ''} stored offline in SQLite
          </Text>
        </View>

        {/* Filter Button with Count Badge */}
        <TouchableOpacity
          onPress={() => setIsFilterSheetOpen(true)}
          style={[
            styles.filterButton,
            {
              backgroundColor: activeFiltersCount > 0 ? theme.colors.primary : theme.colors.surface,
              borderColor: theme.colors.surfaceBorder,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Open filter sheet. ${activeFiltersCount} filters currently active.`}
        >
          <Text
            style={[
              styles.filterButtonText,
              { color: activeFiltersCount > 0 ? '#FFFFFF' : theme.colors.textPrimary },
            ]}
          >
            🔍 Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <TextInput
        placeholder="Search merchant, description, or notes..."
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
        autoCapitalize="none"
      />

      {/* Active Filter Chips Bar */}
      {activeFiltersCount > 0 && (
        <View style={styles.activeFiltersRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersScroll}>
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
                  {selectedPaymentMethod.replace('_', ' ')} ✕
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleClearAllFilters} style={styles.clearAllButton}>
              <Text style={[styles.clearAllText, { color: theme.colors.expense }]}>Clear All</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Grouped Transactions List */}
      <SectionList
        sections={sections}
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

      {/* Advanced Filter Bottom Sheet */}
      <BottomSheet
        visible={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Filter Expenses"
      >
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

      {/* Edit & Delete Transaction Modal */}
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
  searchInput: {
    marginBottom: 10,
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
