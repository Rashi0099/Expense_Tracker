import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { Screen } from '../../components/common/Screen';
import { Card } from '../../components/common/Card';
import { CurrencyText } from '../../components/common/CurrencyText';
import { EmptyState } from '../../components/common/EmptyState';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { Button } from '../../components/common/Button';
import {
  getMonthlyBudgetOverviewUseCase,
  createBudgetUseCase,
  updateBudgetLimitUseCase,
  deleteBudgetUseCase,
  calculateBudgetStatus,
} from '../../domain/usecases/budgetUseCases';
import { listCategoriesUseCase } from '../../domain/usecases/categoryUseCases';
import { MonthlyBudgetOverview } from '../../database/repositories/interfaces/IBudgetRepository';
import { CategoryModel, BudgetModel } from '../../domain/models';
import { getCurrentMonthString } from '../../utils/date';
import { dollarsToCents, centsToDollars } from '../../utils/money';
import { useAuth } from '../../app/providers/AuthProvider';
import { useTheme } from '../../theme/useTheme';
import { DataEvents } from '../../database/sqlite/DataEvents';

export const BudgetsScreen: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [overview, setOverview] = useState<MonthlyBudgetOverview | null>(null);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const currentMonth = getCurrentMonthString();

  // Create Budget Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [limitAmount, setLimitAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit Budget Limit Modal State
  const [editingBudget, setEditingBudget] = useState<BudgetModel | null>(null);
  const [editLimitAmount, setEditLimitAmount] = useState('');

  const loadBudgets = useCallback(async () => {
    try {
      const data = await getMonthlyBudgetOverviewUseCase(currentMonth);
      setOverview(data);
    } catch {
      // Handled
    }
  }, [currentMonth]);

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

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  // Reactive updates on budget or expense mutations
  useEffect(() => {
    const unsub1 = DataEvents.subscribe('BUDGETS_CHANGED', () => {
      loadBudgets();
    });
    const unsub2 = DataEvents.subscribe('EXPENSES_CHANGED', () => {
      loadBudgets();
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [loadBudgets]);

  const handleCreateBudget = async () => {
    const cents = dollarsToCents(limitAmount);
    if (cents <= 0) {
      setError('Please enter a limit amount greater than zero.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await createBudgetUseCase({
        categoryId: selectedCategory || undefined,
        limitAmountCents: cents,
        periodStart: `${currentMonth}-01`,
        currency: user?.baseCurrency || 'USD',
      });

      setLimitAmount('');
      setSelectedCategory(null);
      setIsAddModalOpen(false);
      loadBudgets();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create budget');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateLimit = async () => {
    if (!editingBudget) return;
    const cents = dollarsToCents(editLimitAmount);
    if (cents <= 0) {
      Alert.alert('Invalid Limit', 'Budget limit must be greater than zero.');
      return;
    }

    try {
      await updateBudgetLimitUseCase(editingBudget.id, cents);
      setEditingBudget(null);
      loadBudgets();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update budget limit');
    }
  };

  const handleDeleteBudget = (id: string, name: string) => {
    Alert.alert(
      'Delete Budget',
      `Are you sure you want to delete the budget limit for ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteBudgetUseCase(id);
            if (editingBudget) setEditingBudget(null);
            loadBudgets();
          },
        },
      ]
    );
  };

  const hasBudgets =
    !!overview?.overallBudget || (overview?.categoryBudgets && overview.categoryBudgets.length > 0);

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Monthly Budgets</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {currentMonth} • Spending Limits
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setLimitAmount('');
            setSelectedCategory(null);
            setError(null);
            setIsAddModalOpen(true);
          }}
          style={[styles.setBudgetBtn, { backgroundColor: theme.colors.primary }]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Set new budget"
        >
          <Text style={styles.setBudgetBtnText}>+ Set Budget</Text>
        </TouchableOpacity>
      </View>

      {!hasBudgets ? (
        <EmptyState
          title="No Budgets Set"
          description="Set monthly spending limits for categories or overall expenses to stay on track offline."
        />
      ) : (
        <View style={styles.content}>
          {/* Overall Monthly Budget */}
          {overview?.overallBudget && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setEditingBudget(overview.overallBudget!.budget);
                setEditLimitAmount(centsToDollars(overview.overallBudget!.budget.limitAmountCents));
              }}
            >
              <Card style={styles.overallCard}>
                <View style={styles.budgetHeader}>
                  <View>
                    <Text style={[styles.budgetTitle, { color: theme.colors.textPrimary }]}>
                      Overall Monthly Spending Limit
                    </Text>
                    <Text
                      style={[
                        styles.statusBadge,
                        {
                          color:
                            calculateBudgetStatus(overview.overallBudget.percentageUsed) === 'OVER_BUDGET'
                              ? theme.colors.expense
                              : calculateBudgetStatus(overview.overallBudget.percentageUsed) === 'NEAR_LIMIT'
                              ? theme.colors.warning
                              : theme.colors.income,
                        },
                      ]}
                    >
                      {calculateBudgetStatus(overview.overallBudget.percentageUsed) === 'OVER_BUDGET'
                        ? 'OVER BUDGET'
                        : calculateBudgetStatus(overview.overallBudget.percentageUsed) === 'NEAR_LIMIT'
                        ? 'NEAR LIMIT'
                        : 'ON TRACK'}
                    </Text>
                  </View>
                  <Text style={[styles.percent, { color: theme.colors.primary }]}>
                    {overview.overallBudget.percentageUsed}%
                  </Text>
                </View>

                {/* Progress bar */}
                <View style={[styles.progressBarBg, { backgroundColor: theme.colors.surfaceSubtle }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(100, overview.overallBudget.percentageUsed)}%`,
                        backgroundColor:
                          overview.overallBudget.percentageUsed > 100
                            ? theme.colors.expense
                            : overview.overallBudget.percentageUsed > 80
                            ? theme.colors.warning
                            : theme.colors.income,
                      },
                    ]}
                  />
                </View>

                <View style={styles.budgetFooter}>
                  <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
                    Spent: <CurrencyText amountCents={overview.overallBudget.spentCents} />
                  </Text>
                  <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
                    Limit: <CurrencyText amountCents={overview.overallBudget.budget.limitAmountCents} />
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          )}

          {/* Category-Specific Budgets */}
          {overview?.categoryBudgets.map((cb) => {
            const status = calculateBudgetStatus(cb.percentageUsed);
            return (
              <TouchableOpacity
                key={cb.budget.id}
                activeOpacity={0.8}
                onPress={() => {
                  setEditingBudget(cb.budget);
                  setEditLimitAmount(centsToDollars(cb.budget.limitAmountCents));
                }}
              >
                <Card style={styles.categoryCard}>
                  <View style={styles.budgetHeader}>
                    <View style={styles.catLeft}>
                      <Text style={styles.catIcon}>{cb.budget.categoryIcon || '🏷️'}</Text>
                      <View>
                        <Text style={[styles.catName, { color: theme.colors.textPrimary }]}>
                          {cb.budget.categoryName || 'Category'}
                        </Text>
                        <Text
                          style={[
                            styles.statusBadge,
                            {
                              color:
                                status === 'OVER_BUDGET'
                                  ? theme.colors.expense
                                  : status === 'NEAR_LIMIT'
                                  ? theme.colors.warning
                                  : theme.colors.income,
                            },
                          ]}
                        >
                          {status === 'OVER_BUDGET'
                            ? 'Over Budget'
                            : status === 'NEAR_LIMIT'
                            ? 'Near Limit'
                            : 'On Track'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.percent, { color: theme.colors.primary }]}>
                      {cb.percentageUsed}%
                    </Text>
                  </View>

                  <View style={[styles.progressBarBg, { backgroundColor: theme.colors.surfaceSubtle }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(100, cb.percentageUsed)}%`,
                          backgroundColor:
                            cb.percentageUsed > 100
                              ? theme.colors.expense
                              : cb.percentageUsed > 80
                              ? theme.colors.warning
                              : theme.colors.income,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.budgetFooter}>
                    <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
                      Spent: <CurrencyText amountCents={cb.spentCents} />
                    </Text>
                    <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
                      Limit: <CurrencyText amountCents={cb.budget.limitAmountCents} />
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Set Budget Modal */}
      <Modal visible={isAddModalOpen} animationType="slide" transparent onRequestClose={() => setIsAddModalOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                Set Spending Limit
              </Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)} style={styles.closeBtn}>
                <Text style={[styles.closeBtnText, { color: theme.colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              <MoneyInput
                value={limitAmount}
                onChangeValue={(val) => {
                  setLimitAmount(val);
                  if (error) setError(null);
                }}
                currency={user?.baseCurrency || 'USD'}
                error={error || undefined}
              />

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                Target Scope
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <TouchableOpacity
                  onPress={() => setSelectedCategory(null)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedCategory === null ? theme.colors.primary : theme.colors.surfaceSubtle,
                      borderColor: selectedCategory === null ? theme.colors.primary : theme.colors.surfaceBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selectedCategory === null ? '#FFFFFF' : theme.colors.textPrimary },
                    ]}
                  >
                    ⭐ Overall Monthly Ceiling
                  </Text>
                </TouchableOpacity>

                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceSubtle,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.surfaceBorder,
                        },
                      ]}
                    >
                      <Text style={styles.chipIcon}>{cat.icon}</Text>
                      <Text
                        style={[
                          styles.chipText,
                          { color: isSelected ? '#FFFFFF' : theme.colors.textPrimary },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Button
                label="Save Budget Limit"
                onPress={handleCreateBudget}
                isLoading={isSaving}
                size="md"
                style={styles.saveBtn}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Budget Limit Modal */}
      <Modal visible={!!editingBudget} animationType="slide" transparent onRequestClose={() => setEditingBudget(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                Edit Limit — {editingBudget?.categoryName || 'Overall Monthly'}
              </Text>
              <TouchableOpacity onPress={() => setEditingBudget(null)} style={styles.closeBtn}>
                <Text style={[styles.closeBtnText, { color: theme.colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              <MoneyInput
                value={editLimitAmount}
                onChangeValue={setEditLimitAmount}
                currency={user?.baseCurrency || 'USD'}
              />

              <View style={styles.modalActions}>
                <Button
                  label="Update Limit"
                  onPress={handleUpdateLimit}
                  size="md"
                  style={styles.saveBtn}
                />
                <Button
                  label="Delete Budget"
                  variant="danger"
                  onPress={() =>
                    handleDeleteBudget(
                      editingBudget!.id,
                      editingBudget!.categoryName || 'Overall Monthly'
                    )
                  }
                  size="md"
                  style={styles.deleteBtn}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 4,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  setBudgetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setBudgetBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  content: {
    gap: 12,
  },
  overallCard: {
    padding: 16,
    marginBottom: 8,
  },
  categoryCard: {
    padding: 14,
    marginBottom: 8,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  budgetTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  catName: {
    fontSize: 14,
    fontWeight: '700',
  },
  percent: {
    fontSize: 14,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 8,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollBody: {
    paddingBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalActions: {
    marginTop: 20,
    gap: 10,
  },
  saveBtn: {
    marginTop: 16,
    width: '100%',
  },
  deleteBtn: {
    width: '100%',
  },
});
