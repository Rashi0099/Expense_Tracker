import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput as RNTextInput,
  ScrollView,
} from 'react-native';
import { Screen } from '../../components/common/Screen';
import { CurrencyText } from '../../components/common/CurrencyText';
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

  // Edit Budget Modal State
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

  useEffect(() => {
    const unsub1 = DataEvents.subscribe('BUDGETS_CHANGED', () => loadBudgets());
    const unsub2 = DataEvents.subscribe('EXPENSES_CHANGED', () => loadBudgets());
    return () => { unsub1(); unsub2(); };
  }, [loadBudgets]);

  const handleCreateBudget = async () => {
    const cents = dollarsToCents(limitAmount);
    if (cents <= 0) {
      setError('Enter a limit greater than zero');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await createBudgetUseCase({
        categoryId: selectedCategory || undefined,
        limitAmountCents: cents,
        periodStart: `${currentMonth}-01`,
        currency: user?.baseCurrency || 'INR',
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
    Alert.alert('Delete Budget', `Delete the budget for ${name}?`, [
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
    ]);
  };

  const hasBudgets =
    !!overview?.overallBudget || (overview?.categoryBudgets && overview.categoryBudgets.length > 0);

  const currency = user?.baseCurrency || 'INR';

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Budgets</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{currentMonth}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setLimitAmount('');
            setSelectedCategory(null);
            setError(null);
            setIsAddModalOpen(true);
          }}
          style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Add Budget</Text>
        </TouchableOpacity>
      </View>

      {!hasBudgets ? (
        /* Empty State */
        <View style={[styles.emptyBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.surfaceBorder }]}>
          <Text style={styles.emptyEmoji}>💰</Text>
          <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No Budgets Yet</Text>
          <Text style={[styles.emptyDesc, { color: theme.colors.textMuted }]}>
            Set monthly spending limits to stay on track. Tap "Add Budget" to get started.
          </Text>
          <TouchableOpacity
            onPress={() => { setLimitAmount(''); setSelectedCategory(null); setError(null); setIsAddModalOpen(true); }}
            style={[styles.emptyAddBtn, { backgroundColor: theme.colors.primary }]}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnText}>+ Add Budget</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.budgetList}>
          {/* Overall Monthly Budget Card */}
          {overview?.overallBudget && (() => {
            const ob = overview.overallBudget;
            const status = calculateBudgetStatus(ob.percentageUsed);
            const statusColor = status === 'OVER_BUDGET' ? theme.colors.expense : status === 'NEAR_LIMIT' ? theme.colors.warning : theme.colors.income;
            const barColor = ob.percentageUsed > 100 ? theme.colors.expense : ob.percentageUsed > 80 ? theme.colors.warning : theme.colors.income;
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => { setEditingBudget(ob.budget); setEditLimitAmount(centsToDollars(ob.budget.limitAmountCents)); }}
                style={[styles.budgetCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.surfaceBorder }]}
              >
                <View style={styles.budgetCardTop}>
                  <View style={[styles.budgetIconBox, { backgroundColor: theme.colors.warningBg }]}>
                    <Text style={styles.budgetIcon}>⭐</Text>
                  </View>
                  <View style={styles.budgetCardMid}>
                    <Text style={[styles.budgetName, { color: theme.colors.textPrimary }]}>Overall Monthly</Text>
                    <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
                      <Text style={[styles.statusPillText, { color: statusColor }]}>
                        {status === 'OVER_BUDGET' ? '⚠ Over Budget' : status === 'NEAR_LIMIT' ? '⚡ Near Limit' : '✓ On Track'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.percentText, { color: theme.colors.primary }]}>{Math.round(ob.percentageUsed)}%</Text>
                </View>

                <View style={[styles.progressBg, { backgroundColor: theme.colors.surfaceSubtle }]}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, ob.percentageUsed)}%`, backgroundColor: barColor }]} />
                </View>

                <View style={styles.budgetFooter}>
                  <Text style={[styles.footerItem, { color: theme.colors.textSecondary }]}>
                    Spent: <CurrencyText amountCents={ob.spentCents} currency={currency} />
                  </Text>
                  <Text style={[styles.footerItem, { color: theme.colors.textSecondary }]}>
                    Limit: <CurrencyText amountCents={ob.budget.limitAmountCents} currency={currency} />
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })()}

          {/* Category Budget Cards */}
          {overview?.categoryBudgets.map((cb) => {
            const status = calculateBudgetStatus(cb.percentageUsed);
            const statusColor = status === 'OVER_BUDGET' ? theme.colors.expense : status === 'NEAR_LIMIT' ? theme.colors.warning : theme.colors.income;
            const barColor = cb.percentageUsed > 100 ? theme.colors.expense : cb.percentageUsed > 80 ? theme.colors.warning : theme.colors.income;
            return (
              <TouchableOpacity
                key={cb.budget.id}
                activeOpacity={0.85}
                onPress={() => { setEditingBudget(cb.budget); setEditLimitAmount(centsToDollars(cb.budget.limitAmountCents)); }}
                style={[styles.budgetCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.surfaceBorder }]}
              >
                <View style={styles.budgetCardTop}>
                  <View style={[styles.budgetIconBox, { backgroundColor: theme.colors.surfaceSubtle }]}>
                    <Text style={styles.budgetIcon}>{cb.budget.categoryIcon || '🏷️'}</Text>
                  </View>
                  <View style={styles.budgetCardMid}>
                    <Text style={[styles.budgetName, { color: theme.colors.textPrimary }]}>{cb.budget.categoryName || 'Category'}</Text>
                    <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
                      <Text style={[styles.statusPillText, { color: statusColor }]}>
                        {status === 'OVER_BUDGET' ? '⚠ Over Budget' : status === 'NEAR_LIMIT' ? '⚡ Near Limit' : '✓ On Track'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.percentText, { color: theme.colors.primary }]}>{Math.round(cb.percentageUsed)}%</Text>
                </View>

                <View style={[styles.progressBg, { backgroundColor: theme.colors.surfaceSubtle }]}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, cb.percentageUsed)}%`, backgroundColor: barColor }]} />
                </View>

                <View style={styles.budgetFooter}>
                  <Text style={[styles.footerItem, { color: theme.colors.textSecondary }]}>
                    Spent: <CurrencyText amountCents={cb.spentCents} currency={currency} />
                  </Text>
                  <Text style={[styles.footerItem, { color: theme.colors.textSecondary }]}>
                    Limit: <CurrencyText amountCents={cb.budget.limitAmountCents} currency={currency} />
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Add Budget Modal ── */}
      <Modal visible={isAddModalOpen} animationType="slide" transparent onRequestClose={() => setIsAddModalOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setIsAddModalOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { backgroundColor: theme.colors.surface }]} onPress={() => {}}>
            {/* Handle bar */}
            <View style={[styles.handleBar, { backgroundColor: theme.colors.surfaceBorder }]} />

            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Set Budget Limit</Text>

            {/* Large amount display + hidden input */}
            <TouchableOpacity
              style={[styles.amountBox, { borderColor: error ? theme.colors.expense : theme.colors.surfaceBorder }]}
              activeOpacity={1}
            >
              <Text style={[styles.currencySymbol, { color: theme.colors.textMuted }]}>₹</Text>
              <RNTextInput
                value={limitAmount}
                onChangeText={(val) => { setLimitAmount(val.replace(/[^0-9.]/g, '')); setError(null); }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.amountInput, { color: theme.colors.textPrimary }]}
                autoFocus
              />
            </TouchableOpacity>
            {error ? <Text style={[styles.errorText, { color: theme.colors.expense }]}>{error}</Text> : null}

            {/* Quick amount pills */}
            <View style={styles.quickPillRow}>
              {[1000, 5000, 10000, 25000].map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => setLimitAmount(v.toString())}
                  style={[styles.quickPill, { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.surfaceBorder }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickPillText, { color: theme.colors.textPrimary }]}>
                    ₹{v >= 1000 ? `${v / 1000}k` : v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Category selector */}
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Budget Scope</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {/* Overall option */}
              <TouchableOpacity
                onPress={() => setSelectedCategory(null)}
                style={[
                  styles.catChip,
                  {
                    backgroundColor: selectedCategory === null ? theme.colors.primary : theme.colors.surfaceSubtle,
                    borderColor: selectedCategory === null ? theme.colors.primary : theme.colors.surfaceBorder,
                  },
                ]}
              >
                <Text style={styles.catChipIcon}>⭐</Text>
                <Text style={[styles.catChipText, { color: selectedCategory === null ? '#fff' : theme.colors.textPrimary }]}>
                  Overall
                </Text>
              </TouchableOpacity>

              {categories.map((cat) => {
                const isSel = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategory(cat.id)}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: isSel ? theme.colors.primary : theme.colors.surfaceSubtle,
                        borderColor: isSel ? theme.colors.primary : theme.colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Text style={styles.catChipIcon}>{cat.icon}</Text>
                    <Text style={[styles.catChipText, { color: isSel ? '#fff' : theme.colors.textPrimary }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={handleCreateBudget}
              disabled={isSaving}
              style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save Budget'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit Budget Modal ── */}
      <Modal visible={!!editingBudget} animationType="slide" transparent onRequestClose={() => setEditingBudget(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setEditingBudget(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { backgroundColor: theme.colors.surface }]} onPress={() => {}}>
            <View style={[styles.handleBar, { backgroundColor: theme.colors.surfaceBorder }]} />

            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
              {editingBudget?.categoryName ? `${editingBudget.categoryIcon} ${editingBudget.categoryName}` : '⭐ Overall Monthly'}
            </Text>

            <TouchableOpacity style={[styles.amountBox, { borderColor: theme.colors.surfaceBorder }]} activeOpacity={1}>
              <Text style={[styles.currencySymbol, { color: theme.colors.textMuted }]}>₹</Text>
              <RNTextInput
                value={editLimitAmount}
                onChangeText={(val) => setEditLimitAmount(val.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.amountInput, { color: theme.colors.textPrimary }]}
                autoFocus
              />
            </TouchableOpacity>

            <View style={styles.quickPillRow}>
              {[1000, 5000, 10000, 25000].map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => setEditLimitAmount(v.toString())}
                  style={[styles.quickPill, { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.surfaceBorder }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickPillText, { color: theme.colors.textPrimary }]}>
                    ₹{v >= 1000 ? `${v / 1000}k` : v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity
                onPress={handleUpdateLimit}
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary, flex: 1 }]}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>Update Limit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeleteBudget(editingBudget!.id, editingBudget!.categoryName || 'Overall Monthly')}
                style={[styles.deleteBtn, { borderColor: theme.colors.expense }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.deleteBtnText, { color: theme.colors.expense }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  // Empty state
  emptyBox: {
    marginTop: 32,
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyAddBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
  },
  // Budget cards
  budgetList: {
    gap: 12,
  },
  budgetCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#17233C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  budgetCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  budgetIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  budgetIcon: {
    fontSize: 20,
  },
  budgetCardMid: {
    flex: 1,
    gap: 4,
  },
  budgetName: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  percentText: {
    fontSize: 18,
    fontWeight: '800',
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerItem: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 20,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 18,
    height: 64,
    marginBottom: 6,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    paddingVertical: 0,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  quickPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 20,
  },
  quickPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
  },
  catChipIcon: {
    fontSize: 15,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Edit modal actions
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  deleteBtn: {
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
